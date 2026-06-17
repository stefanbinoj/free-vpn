import { terraform } from "../lib/terraform.js";
import { disconnectLocalClient } from "../lib/local-client.js";
import { assertClockIsSynced } from "../lib/clock.js";

export async function down() {
  await assertClockIsSynced();
  disconnectLocalClient();
  console.log("Destroying Brazil VPN infrastructure...");
  terraform(["destroy", "-auto-approve"]);
}
