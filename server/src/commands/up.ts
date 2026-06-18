import { configureClient, waitForWireGuardReady } from "../lib/wireguard.js";
import { terraform } from "../lib/terraform.js";
import { errorMessage, hasCommand } from "../lib/shell.js";
import { clientConfigPath } from "../lib/paths.js";
import { ensureSshKeyPair } from "../lib/ssh-key.js";
import { startHealthChecks } from "../lib/health.js";
import { connectLocalClient, disconnectLocalClient } from "../lib/local-client.js";

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
    console.error("Setup failed after Terraform started. Destroying any created AWS resources...");
    try {
      disconnectLocalClient();
    } catch (disconnectError) {
      console.warn(`Skipping local tunnel teardown: ${errorMessage(disconnectError)}`);
    }
    terraform(["destroy", "-auto-approve"]);
    throw error;
  }

  startHealthChecks();
  registerCleanupReminder();
}

function registerCleanupReminder() {
  const remind = (signal: NodeJS.Signals) => {
    console.log(`\nReceived ${signal}. Health checks stopped.`);
    console.log(`Run \`npm run vpn:down\` to terminate the EC2 instance and disconnect the local tunnel.`);
    process.exit(0);
  };

  process.once("SIGINT", remind);
  process.once("SIGTERM", remind);
}
