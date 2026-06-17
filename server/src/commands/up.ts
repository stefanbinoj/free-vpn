import { collectServerDiagnostics, configureClient, waitForWireGuardReady } from "../lib/wireguard.js";
import { terraform } from "../lib/terraform.js";
import { findCommand, hasCommand } from "../lib/shell.js";
import { clientConfigPath } from "../lib/paths.js";
import { ensureSshKeyPair } from "../lib/ssh-key.js";
import { startHealthChecks, waitForever } from "../lib/health.js";
import { connectLocalClient, disconnectLocalClient } from "../lib/local-client.js";
import { assertClockIsSynced } from "../lib/clock.js";

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
      disconnectLocalClient({ bestEffort: true });
      terraform(["destroy", "-auto-approve"]);
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
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
  if (!findCommand(["wg", "wg.exe"])) {
    throw new Error("wg is required locally to generate WireGuard keys. Install wireguard-tools.");
  }

  await assertClockIsSynced();
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
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    collectServerDiagnostics(message);
    console.error("Setup failed after Terraform started. Destroying any created AWS resources...");
    disconnectLocalClient({ bestEffort: true });
    terraform(["destroy", "-auto-approve"]);
    throw error;
  }

  const stopHealthChecks = startHealthChecks();
  registerDestroyOnExit(stopHealthChecks);
  await waitForever();
}
