import { terraform } from "../lib/terraform.js";
import { disconnectLocalClient } from "../lib/local-client.js";
import { assertClockIsSynced } from "../lib/clock.js";
import { platform } from "node:os";

export async function down() {
  const disconnected = disconnectLocalClient({ bestEffort: true });

  if (!disconnected && platform() === "win32") {
    console.warn(
      [
        "Windows WireGuard tunnel could not be disconnected automatically.",
        "Terraform destroy will still run, but if the VPN remains active it may interrupt network access while the server is being destroyed.",
        "For best results, run this terminal as Administrator or turn off the WireGuard tunnel in the WireGuard app before vpn:down.",
      ].join("\n"),
    );
  }

  await assertClockIsSynced();
  console.log("Destroying Brazil VPN infrastructure...");
  terraform(["destroy", "-auto-approve"]);
}
