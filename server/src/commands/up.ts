import { Listr } from "listr2";
import { configureClient, waitForWireGuardReady } from "../lib/wireguard.js";
import { getOutputs, terraform } from "../lib/terraform.js";
import { errorMessage, hasCommand } from "../lib/shell.js";
import { ensureSshKeyPair } from "../lib/ssh-key.js";
import { error, info, warn } from "../lib/console.js";
import { withTiming } from "../lib/listr-utils.js";
import { startHealthChecks } from "../lib/health.js";
import { connectLocalClient, disconnectLocalClient } from "../lib/local-client.js";
import { assertProviderEnv } from "../lib/paths.js";
import pc from "picocolors";

export async function up() {
  if (!hasCommand("terraform")) {
    throw new Error("terraform is required on PATH.");
  }
  if (!hasCommand("wg")) {
    throw new Error("wg is required locally to generate WireGuard keys. Install wireguard-tools.");
  }

  assertProviderEnv();
  await ensureSshKeyPair();

  const tasks = new Listr(
    [
      {
        title: "Initialize Terraform",
        task: withTiming("Initialize Terraform", () => terraform(["init"])),
      },
      {
        title: "Provision VPN instance",
        task: withTiming("Provision VPN instance", () => terraform(["apply", "-auto-approve"])),
      },
      {
        title: "Wait for WireGuard server",
        task: async (_ctx, task) => {
          await waitForWireGuardReady({
            onProgress: (text) => {
              task.title = text;
            },
          });
          task.title = "WireGuard server is ready";
        },
      },
      {
        title: "Generate client config",
        task: withTiming("Generate client config", () => configureClient()),
      },
      {
        title: "Connect local tunnel",
        task: withTiming("Connect local tunnel", () => connectLocalClient()),
      },
    ],
    { concurrent: false, exitOnError: true, renderer: "simple" },
  );

  try {
    await tasks.run();
  } catch {
    // listr2 already rendered the failure inline under the failed task.
    // Run cleanup, then exit non-zero (no need to re-throw or re-print).
    error("Setup failed. Destroying any created cloud resources...");
    try {
      await disconnectLocalClient();
    } catch (disconnectError) {
      //warn(`Skipping local tunnel teardown: ${errorMessage(disconnectError)}`);
    }
    try {
      await terraform(["destroy", "-auto-approve"]);
    } catch (destroyError) {
      warn(`Cleanup warning: ${errorMessage(destroyError)}`);
    }
    process.exit(1);
  }

  await showReadySummary();
  startHealthChecks();
  registerCleanupReminder();
}

async function showReadySummary() {
  const outputs = await getOutputs();
  const serverLine = `${outputs.sshUser}@${outputs.serverIp}`;
  const endpointLine = `${outputs.serverIp}:51820`;

  info("");
  console.log(`  ┌  ${pc.green(pc.bold("✓ VPN is ready"))}`);
  console.log("  │");
  console.log(`  │  ${pc.dim("Server")}    ${serverLine}`);
  console.log(`  │  ${pc.dim("Endpoint")}  ${endpointLine}`);
  console.log("  │");
  console.log(`  │  ${pc.dim("Run")} ${pc.cyan("npm run vpn:down")} ${pc.dim("to terminate.")}`);
  console.log("  └");
  info("");
}

function registerCleanupReminder() {
  const remind = () => {
    console.log(`\n${pc.dim("Run")} ${pc.cyan("npm run vpn:down")} ${pc.dim("to terminate the cloud instance and disconnect the local tunnel.")}`);
    process.exit(0);
  };

  process.once("SIGINT", remind);
  process.once("SIGTERM", remind);
}
