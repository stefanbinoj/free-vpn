import { getOutputs } from "./terraform.js";
import { ssh, sshToHost } from "./wireguard.js";

const intervalMs = Number(process.env.VPN_HEALTH_INTERVAL_MS ?? 7000);

function now() {
  return new Date().toISOString();
}

type HealthOptions = {
  useTunnelHost?: boolean;
};

export function startHealthChecks(options: HealthOptions = {}) {
  const outputs = getOutputs();
  const host = options.useTunnelHost ? "10.8.0.1" : outputs.serverIp;
  const sshCommand = (remoteCommand: string) => options.useTunnelHost
    ? sshToHost(host, outputs.sshUser, outputs.sshPrivateKeyPath, [], remoteCommand)
    : ssh([], remoteCommand);

  console.log(`Watching Brazil VPN health for ${host}. Press Ctrl+C to destroy resources.`);
  console.log(`Health interval: ${intervalMs}ms`);

  const check = () => {
    try {
      const active = sshCommand("systemctl is-active wg-quick@wg0");
      const latestHandshake = sshCommand(
        "sudo wg show wg0 latest-handshakes | awk '{print $2}' | sort -nr | head -1",
      );
      const transfer = sshCommand("sudo wg show wg0 transfer");
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
  const timer = setInterval(check, intervalMs);

  return () => clearInterval(timer);
}

export function waitForever() {
  return new Promise<void>(() => {});
}
