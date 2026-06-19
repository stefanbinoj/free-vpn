import { info, warn } from "./console.js";
import { getOutputs } from "./terraform.js";
import { errorMessage } from "./shell.js";
import { ssh } from "./wireguard.js";

const intervalMs = 15000

export async function startHealthChecks() {
  const outputs = await getOutputs();
  info(`Running Health Check for: ${outputs.serverIp}. Run \`npm run vpn:down\` to destroy resources.`);

  const check = async () => {
    try {
      const latestHandshake = await ssh(
        [],
        "sudo wg show wg0 latest-handshakes | awk '{print $2}' | sort -nr | head -1",
      );
      const handshakeAge = latestHandshake && latestHandshake !== "0"
        ? `${Math.max(0, Math.floor(Date.now() / 1000) - Number(latestHandshake))}s ago`
        : "no handshake yet";

      info(`[${new Date().toISOString()}] latest_handshake=${handshakeAge}`);
    } catch (error) {
      warn(`[${new Date().toISOString()}] health check failed: ${errorMessage(error)}`);
    }
  };

  await check();
  const timer = setInterval(() => { void check(); }, intervalMs);

  return () => clearInterval(timer);
}
