import { getOutputs } from "./terraform.js";
import { errorMessage } from "./shell.js";
import { ssh } from "./wireguard.js";

const intervalMs = 15000

export function startHealthChecks() {
  const outputs = getOutputs();
  console.log(`Running Health Check for: ${outputs.serverIp}. Run \`npm run vpn:down\` to destroy resources.`);

  const check = () => {
    try {
      const latestHandshake = ssh(
        [],
        "sudo wg show wg0 latest-handshakes | awk '{print $2}' | sort -nr | head -1",
      );
      const handshakeAge = latestHandshake && latestHandshake !== "0"
        ? `${Math.max(0, Math.floor(Date.now() / 1000) - Number(latestHandshake))}s ago`
        : "no handshake yet";

      console.log(`[${new Date().toISOString()}] latest_handshake=${handshakeAge}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] health check failed: ${errorMessage(error)}`);
    }
  };

  check();
  const timer = setInterval(check, intervalMs);

  return () => clearInterval(timer);
}
