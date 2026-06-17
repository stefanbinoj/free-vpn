import { terraform } from "../lib/terraform.js";

export async function down() {
  console.log("Destroying Brazil VPN infrastructure...");
  terraform(["destroy"]);
}
