import { clientConfigPath } from "../lib/paths.js";
import { getOutputs } from "../lib/terraform.js";
import { disconnectLocalClient } from "../lib/local-client.js";
import { configureClient } from "../lib/wireguard.js";

export async function config() {
  disconnectLocalClient({ bestEffort: true });
  const outputs = getOutputs();
  console.log(`Registering config against ${outputs.sshUser}@${outputs.serverIp}`);
  console.log("Generating local WireGuard client config and registering peer on the server...");
  configureClient();
  console.log(`Client config written to ${clientConfigPath}`);
}
