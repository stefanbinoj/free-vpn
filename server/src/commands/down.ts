import { terraform } from "../lib/terraform.js";
import { disconnectLocalClient } from "../lib/local-client.js";
import { errorMessage } from "../lib/shell.js";

export async function down() {
  try {
    disconnectLocalClient();
  } catch (error) {
    console.warn(`Skipping local tunnel teardown: ${errorMessage(error)}`);
  }
  console.log("Destroying Brazil VPN infrastructure...");
  terraform(["destroy", "-auto-approve"]);
}
