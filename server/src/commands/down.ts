import { terraform } from "../lib/terraform.js";
import { disconnectLocalClient } from "../lib/local-client.js";

export async function down() {
  disconnectLocalClient();
  console.log("Destroying Brazil VPN infrastructure...");
  terraform(["destroy", "-auto-approve"]);
}
