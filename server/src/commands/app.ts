import { getOutputs } from "../lib/terraform.js";
import { ssh } from "../lib/wireguard.js";

const intervalMs = Number(process.env.VPN_HEALTH_INTERVAL_MS ?? 7000);

function now() {
  return new Date().toISOString();
}

export async function app() {
  const outputs = getOutputs();
  console.log(`Watching Brazil VPN health for ${outputs.serverIp}. Press Ctrl+C to stop.`);
  console.log(`Health interval: ${intervalMs}ms`);

  const check = () => {
    try {
      const active = ssh([], "systemctl is-active wg-quick@wg0");
      const latestHandshake = ssh(
        [],
        "sudo wg show wg0 latest-handshakes | awk '{print $2}' | sort -nr | head -1",
      );
      const transfer = ssh([], "sudo wg show wg0 transfer");
      const handshakeAge = latestHandshake && latestHandshake !== "0"
        ? `${Math.max(0, Math.floor(Date.now() / 1000) - Number(latestHandshake))}s ago`
        : "no handshake yet";

      console.log(`[${now()}] wg=${active} latest_handshake=${handshakeAge}`);
      if (transfer) {
        console.log(transfer);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${now()}] health check failed: ${message}`);
    }
  };

  check();
  setInterval(check, intervalMs);
}
