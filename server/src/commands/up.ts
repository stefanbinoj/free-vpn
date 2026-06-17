import { configureClient } from "../lib/wireguard.js";
import { terraform } from "../lib/terraform.js";
import { hasCommand } from "../lib/shell.js";
import { clientConfigPath } from "../lib/paths.js";
import { ensureSshKeyPair } from "../lib/ssh-key.js";

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
  terraform(["apply"]);

  console.log("Generating local WireGuard client config...");
  configureClient();
  console.log(`Client config written to ${clientConfigPath}`);
}
