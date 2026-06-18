import { platform } from "node:os";
import { basename } from "node:path";
import { clientConfigPath } from "./paths.js";
import { errorMessage, hasCommand, run } from "./shell.js";

// wg-quick (Unix) and wireguard.exe (Windows) signal "nothing to tear down"
// with one of these messages. Treat them as success so disconnectLocalClient
// is idempotent and safe to call from cleanup paths.
const ALREADY_DOWN_PATTERN = /is not a WireGuard interface|does not exist/i;

function ignoreAlreadyDown(error: unknown): boolean {
  return ALREADY_DOWN_PATTERN.test(errorMessage(error));
}

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

export function disconnectLocalClient() {
  const os = platform();

  if ((os === "darwin" || os === "linux") && hasCommand("wg-quick")) {
    console.log("Disconnecting this device from the VPN...");
    try {
      run("sudo", ["wg-quick", "down", clientConfigPath]);
    } catch (error) {
      if (ignoreAlreadyDown(error)) {
        console.log("Local WireGuard tunnel is already down; skipping teardown.");
        return;
      }
      throw error;
    }
    return;
  }

  if (os === "win32" && hasCommand("wireguard.exe")) {
    console.log("Disconnecting this Windows device from the VPN...");
    try {
      run("wireguard.exe", ["/uninstalltunnelservice", basename(clientConfigPath, ".conf")]);
    } catch (error) {
      if (ignoreAlreadyDown(error)) {
        console.log("Local WireGuard tunnel is already down; skipping teardown.");
        return;
      }
      throw error;
    }
  }
}
