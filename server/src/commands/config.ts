import { clientConfigPath } from "../lib/paths.js";
import { configureClient } from "../lib/wireguard.js";

export async function config() {
  console.log("Generating local WireGuard client config and registering peer on the server...");
  configureClient();
  console.log(`Client config written to ${clientConfigPath}`);
}
