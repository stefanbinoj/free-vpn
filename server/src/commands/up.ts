import { collectServerDiagnostics, configureClient, waitForWireGuardReady } from "../lib/wireguard.js";
import { terraform } from "../lib/terraform.js";
import { errorMessage, hasCommand } from "../lib/shell.js";
import { clientConfigPath } from "../lib/paths.js";
import { ensureSshKeyPair } from "../lib/ssh-key.js";
import { startHealthChecks, waitForever } from "../lib/health.js";
import { connectLocalClient, disconnectLocalClient } from "../lib/local-client.js";

function registerDestroyOnExit(stopHealthChecks: () => void) {
  let isDestroying = false;

  const destroy = (signal: NodeJS.Signals) => {
    if (isDestroying) {
      return;
    }

    isDestroying = true;
    stopHealthChecks();
    console.log(`\nReceived ${signal}. Destroying Brazil VPN infrastructure...`);

    try {
      disconnectLocalClient();
      terraform(["destroy", "-auto-approve"]);
      process.exit(0);
    } catch (error) {
      console.error(errorMessage(error));
      process.exit(1);
    }
  };

  process.once("SIGINT", destroy);
  process.once("SIGTERM", destroy);
}

export async function up() {
  if (!hasCommand("terraform")) {
    throw new Error("terraform is required on PATH.");
  }
  if (!hasCommand("wg")) {
    throw new Error("wg is required locally to generate WireGuard keys. Install wireguard-tools.");
  }

  await ensureSshKeyPair();

  console.log("Starting Brazil VPN infrastructure...");
  terraform(["init"]);

  try {
    terraform(["apply", "-auto-approve"]);
    await waitForWireGuardReady();

    console.log("Generating local WireGuard client config...");
    configureClient();
    console.log(`Client config written to ${clientConfigPath}`);
    connectLocalClient();
  } catch (error) {
    const message = errorMessage(error);
    console.error(message);
    collectServerDiagnostics(message);
    console.error("Setup failed after Terraform started. Destroying any created AWS resources...");
    disconnectLocalClient();
    terraform(["destroy", "-auto-approve"]);
    throw error;
  }

  const stopHealthChecks = startHealthChecks();
  registerDestroyOnExit(stopHealthChecks);
  await waitForever();
}
