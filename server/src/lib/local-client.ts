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

export async function connectLocalClient(): Promise<void> {
  const os = platform();

  if (os === "darwin" || os === "linux") {
    if (!hasCommand("wg-quick")) {
      throw new Error("wg-quick is required to connect this device. Install WireGuard tools.");
    }

    await run("sudo", ["wg-quick", "up", clientConfigPath], { quiet: true, timeoutMs: 10_000 });
    return;
  }

  if (os === "win32") {
    if (!hasCommand("wireguard.exe")) {
      throw new Error("wireguard.exe is required to connect this Windows device. Install the official WireGuard app and add it to PATH.");
    }

    await run("wireguard.exe", ["/installtunnelservice", clientConfigPath], { quiet: true, timeoutMs: 10_000 });
    return;
  }

  throw new Error(`Automatic local VPN connect is not implemented for this OS: ${os}`);
}

async function runTeardown(command: string, args: string[]): Promise<void> {
  try {
    await run(command, args, { quiet: true, timeoutMs: 10_000 });
  } catch (error) {
    if (ignoreAlreadyDown(error)) {
      return;
    }
    throw error;
  }
}

export async function disconnectLocalClient(): Promise<void> {
  const os = platform();

  if ((os === "darwin" || os === "linux") && hasCommand("wg-quick")) {
    await runTeardown("sudo", ["wg-quick", "down", clientConfigPath]);
    return;
  }

  if (os === "win32" && hasCommand("wireguard.exe")) {
    await runTeardown("wireguard.exe", ["/uninstalltunnelservice", basename(clientConfigPath, ".conf")]);
  }
}
