import { platform } from "node:os";
import { basename } from "node:path";
import { clientConfigPath } from "./paths.js";
import { findCommand, hasCommand, run } from "./shell.js";

const tunnelName = basename(clientConfigPath, ".conf");

export function isWindowsAdmin() {
  if (platform() !== "win32") {
    return true;
  }

  try {
    run("fltmc.exe", [], { quiet: true });
    return true;
  } catch {
    return false;
  }
}

export function assertLocalClientCanConnect() {
  const os = platform();

  if (os === "darwin" || os === "linux") {
    if (!hasCommand("wg-quick")) {
      throw new Error("wg-quick is required to connect this device. Install WireGuard tools.");
    }
    return;
  }

  if (os === "win32") {
    const wireGuardCommand = findCommand(["wireguard.exe", "wireguard"]);

    if (!wireGuardCommand) {
      throw new Error("wireguard.exe is required to connect this Windows device. Install the official WireGuard app and add it to PATH.");
    }

    if (!isWindowsAdmin()) {
      throw new Error("Windows WireGuard tunnel setup requires an Administrator terminal. Reopen Command Prompt or PowerShell as Administrator and rerun vpn:up.");
    }
    return;
  }

  throw new Error(`Automatic local VPN connect is not implemented for this OS: ${os}`);
}

export function connectLocalClient() {
  const os = platform();

  if (os === "darwin" || os === "linux") {
    assertLocalClientCanConnect();
    disconnectLocalClient({ bestEffort: true });
    console.log("Connecting this device to the VPN with wg-quick. sudo may ask for your password...");
    run("sudo", ["wg-quick", "up", clientConfigPath]);
    return;
  }

  if (os === "win32") {
    assertLocalClientCanConnect();
    const wireGuardCommand = findCommand(["wireguard.exe", "wireguard"]);

    disconnectLocalClient({ bestEffort: true });
    console.log("Connecting this Windows device to the VPN with WireGuard. Run the terminal as Administrator if this fails...");
    run(wireGuardCommand!, ["/installtunnelservice", clientConfigPath]);
    return;
  }

  throw new Error(`Automatic local VPN connect is not implemented for this OS: ${os}`);
}

type DisconnectOptions = {
  bestEffort?: boolean;
};

function tryDisconnect(command: string, args: string[], options: DisconnectOptions) {
  try {
    run(command, args);
    return true;
  } catch (error) {
    if (!options.bestEffort) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Local VPN disconnect attempt failed, continuing cleanup: ${message}`);
    return false;
  }
}

function windowsServiceExists(serviceName: string) {
  try {
    run("sc.exe", ["query", serviceName], { quiet: true });
    return true;
  } catch {
    return false;
  }
}

export function disconnectLocalClient(options: DisconnectOptions = {}) {
  const os = platform();

  if ((os === "darwin" || os === "linux") && hasCommand("wg-quick")) {
    console.log("Disconnecting this device from the VPN...");
    return tryDisconnect("sudo", ["wg-quick", "down", clientConfigPath], options);
  }

  if (os === "win32") {
    const wireGuardCommand = findCommand(["wireguard.exe", "wireguard"]);

    if (!wireGuardCommand) {
      return true;
    }

    const serviceName = `WireGuardTunnel$${tunnelName}`;
    if (!windowsServiceExists(serviceName)) {
      return true;
    }

    console.log("Disconnecting this Windows device from the VPN...");
    const wireGuardStopped = tryDisconnect(wireGuardCommand, ["/uninstalltunnelservice", tunnelName], options);

    if (wireGuardStopped) {
      return true;
    }

    const serviceStopped = tryDisconnect("sc.exe", ["stop", serviceName], { bestEffort: true });
    const serviceDeleted = tryDisconnect("sc.exe", ["delete", serviceName], { bestEffort: true });
    return serviceStopped || serviceDeleted;
  }

  return true;
}
