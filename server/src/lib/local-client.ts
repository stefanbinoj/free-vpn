import { platform } from "node:os";
import { basename } from "node:path";
import { clientConfigPath } from "./paths.js";
import { hasCommand, run } from "./shell.js";

const tunnelName = basename(clientConfigPath, ".conf");

export function connectLocalClient() {
  const os = platform();

  if (os === "darwin" || os === "linux") {
    if (!hasCommand("wg-quick")) {
      throw new Error("wg-quick is required to connect this device. Install WireGuard tools.");
    }

    console.log("Connecting this device to the VPN with wg-quick. sudo may ask for your password...");
    run("sudo", ["wg-quick", "up", clientConfigPath]);
    return;
  }

  if (os === "win32") {
    if (!hasCommand("wireguard.exe")) {
      throw new Error("wireguard.exe is required to connect this Windows device. Install the official WireGuard app and add it to PATH.");
    }

    console.log("Connecting this Windows device to the VPN with WireGuard. Run the terminal as Administrator if this fails...");
    run("wireguard.exe", ["/installtunnelservice", clientConfigPath]);
    return;
  }

  throw new Error(`Automatic local VPN connect is not implemented for this OS: ${os}`);
}

type DisconnectOptions = {
  bestEffort?: boolean;
};

function runDisconnect(command: string, args: string[], options: DisconnectOptions) {
  try {
    run(command, args);
  } catch (error) {
    if (!options.bestEffort) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Local VPN disconnect failed, continuing cleanup: ${message}`);
  }
}

export function disconnectLocalClient(options: DisconnectOptions = {}) {
  const os = platform();

  if ((os === "darwin" || os === "linux") && hasCommand("wg-quick")) {
    console.log("Disconnecting this device from the VPN...");
    runDisconnect("sudo", ["wg-quick", "down", clientConfigPath], options);
    return;
  }

  if (os === "win32" && hasCommand("wireguard.exe")) {
    console.log("Disconnecting this Windows device from the VPN...");
    runDisconnect("wireguard.exe", ["/uninstalltunnelservice", tunnelName], options);
  }
}
