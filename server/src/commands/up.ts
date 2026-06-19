import { Listr } from "listr2";
import { configureClient, waitForWireGuardReady } from "../lib/wireguard.js";
import { getOutputs, terraform } from "../lib/terraform.js";
import { errorMessage, hasCommand } from "../lib/shell.js";
import { ensureSshKeyPair } from "../lib/ssh-key.js";
import { error, info, success, warn } from "../lib/console.js";
import { startHealthChecks } from "../lib/health.js";
import { connectLocalClient, disconnectLocalClient } from "../lib/local-client.js";
import pc from "picocolors";

export async function up() {
  if (!hasCommand("terraform")) {
    throw new Error("terraform is required on PATH.");
  }
  if (!hasCommand("wg")) {
    throw new Error("wg is required locally to generate WireGuard keys. Install wireguard-tools.");
  }

  await ensureSshKeyPair();

  const tasks = new Listr(
    [
      {
        title: "Initialize Terraform",
        task: async () => {
          terraform(["init"]);
        },
      },
      {
        title: "Provision EC2 instance",
        task: async () => {
          terraform(["apply", "-auto-approve"]);
        },
      },
      {
        title: "Wait for WireGuard server",
        task: async (_ctx, task) => {
          await waitForWireGuardReady({
            onProgress: (text) => {
              task.title = text;
            },
          });
        },
      },
      {
        title: "Generate client config",
        task: async () => {
          configureClient();
        },
      },
      {
        title: "Connect local tunnel",
        task: async () => {
          connectLocalClient();
        },
      },
    ],
    { concurrent: false, exitOnError: true },
  );

  try {
    await tasks.run();
  } catch {
    // listr2 already rendered the failure inline under the failed task.
    // Run cleanup, then exit non-zero (no need to re-throw or re-print).
    error("Setup failed. Destroying any created AWS resources...");
    try {
      disconnectLocalClient();
    } catch (disconnectError) {
    }
    try {
      terraform(["destroy", "-auto-approve"]);
    } catch (destroyError) {
      warn(`Cleanup warning: ${errorMessage(destroyError)}`);
    }
    process.exit(1);
  }

  showReadySummary();
  startHealthChecks();
  registerCleanupReminder();
}

function showReadySummary() {
  const outputs = getOutputs();
  const serverLine = `${outputs.sshUser}@${outputs.serverIp}`;
  const endpointLine = `${outputs.serverIp}:51820`;

  info("");
  success(pc.bold("✓ VPN is ready"));
  info("");
  info(`  ${pc.dim("Server")}    ${serverLine}`);
  info(`  ${pc.dim("Region")}    sa-east-1`);
  info(`  ${pc.dim("Endpoint")}  ${endpointLine}`);
  info("");
  info(`  Run ${pc.cyan("npm run vpn:down")} to terminate.`);
  info("");
}

function registerCleanupReminder() {
  const remind = (signal: NodeJS.Signals) => {
    warn(`\nReceived ${signal}. Health checks stopped.`);
    info(`Run \`npm run vpn:down\` to terminate the EC2 instance and disconnect the local tunnel.`);
    process.exit(0);
  };

  process.once("SIGINT", remind);
  process.once("SIGTERM", remind);
}
