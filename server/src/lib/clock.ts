import https from "node:https";
import { platform } from "node:os";

const maxAllowedSkewMs = 5 * 60 * 1000;

function getNetworkDate(): Promise<Date | undefined> {
  return new Promise((resolve) => {
    const request = https.request("https://www.amazon.com", { method: "HEAD", timeout: 5000 }, (response) => {
      const dateHeader = response.headers.date;
      response.resume();

      if (!dateHeader) {
        resolve(undefined);
        return;
      }

      const date = new Date(dateHeader);
      resolve(Number.isNaN(date.getTime()) ? undefined : date);
    });

    request.on("timeout", () => {
      request.destroy();
      resolve(undefined);
    });
    request.on("error", () => resolve(undefined));
    request.end();
  });
}

function clockFixHint() {
  if (platform() === "win32") {
    return [
      "Fix Windows time sync, then rerun the command:",
      "  Settings > Time & language > Date & time > Sync now",
      "or in an Administrator terminal:",
      "  w32tm /resync",
    ].join("\n");
  }

  if (platform() === "darwin") {
    return [
      "Fix macOS time sync, then rerun the command:",
      "  System Settings > General > Date & Time > Set time and date automatically",
    ].join("\n");
  }

  return [
    "Fix Linux time sync, then rerun the command:",
    "  timedatectl status",
    "  sudo timedatectl set-ntp true",
  ].join("\n");
}

export async function assertClockIsSynced() {
  const networkDate = await getNetworkDate();

  if (!networkDate) {
    console.warn("Could not verify local clock against network time. Continuing...");
    return;
  }

  const localNow = new Date();
  const skewMs = localNow.getTime() - networkDate.getTime();

  if (Math.abs(skewMs) <= maxAllowedSkewMs) {
    return;
  }

  const skewMinutes = Math.round(skewMs / 60_000);
  throw new Error(
    [
      `Local clock is out of sync by about ${skewMinutes} minute(s).`,
      "AWS rejects signed API requests when your machine clock is more than a few minutes off.",
      "",
      `Local time:   ${localNow.toISOString()}`,
      `Network time: ${networkDate.toISOString()}`,
      "",
      clockFixHint(),
    ].join("\n"),
  );
}
