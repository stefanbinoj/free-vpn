import pc from "picocolors";
import { errorMessage } from "./shell.js";
import { getOutputs } from "./terraform.js";
import { ssh } from "./wireguard.js";

const intervalMs = 15000;
const FRESH_THRESHOLD_S = 90;
const STALE_THRESHOLD_S = 180;

export async function startHealthChecks() {
  const outputs = await getOutputs();
  console.log("");
  console.log(`  ${pc.green("✔")} ${pc.bold(`Health checks running for ${outputs.serverIp}`)}`);
  console.log(`    ${pc.dim("Run `npm run vpn:down` to destroy resources.")}`);
  console.log("");

  const check = async () => {
    const time = formatTime(new Date());
    try {
      const latestHandshake = await ssh(
        [],
        "sudo wg show wg0 latest-handshakes | awk '{print $2}' | sort -nr | head -1",
      );

      if (!latestHandshake || latestHandshake === "0") {
        console.log(
          `  ${pc.red("✖")} ${pc.dim(time)}  ${pc.red("no handshake")}  ${pc.dim("(peer not connected)")}`,
        );
        return;
      }

      const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(latestHandshake));
      const ageText = formatAge(ageSeconds);

      let icon: string;
      let color: (s: string) => string;
      let suffix = "";
      if (ageSeconds < FRESH_THRESHOLD_S) {
        icon = pc.green("✔");
        color = pc.green;
      } else if (ageSeconds < STALE_THRESHOLD_S) {
        icon = pc.yellow("⚠");
        color = pc.yellow;
      } else {
        icon = pc.red("✖");
        color = pc.red;
        suffix = `  ${pc.dim("(peer may be unreachable)")}`;
      }

      console.log(`  ${icon} ${pc.dim(time)}  ${color(`handshake ${ageText}`)}${suffix}`);
    } catch (error) {
      console.log(
        `  ${pc.yellow("⚠")} ${pc.dim(time)}  ${pc.yellow("health check failed:")} ${pc.dim(errorMessage(error))}`,
      );
    }
  };

  await check();
  const timer = setInterval(() => {
    void check();
  }, intervalMs);

  return () => clearInterval(timer);
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatAge(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s ago`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m ago`;
}
