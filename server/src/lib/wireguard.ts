import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { clientConfigPath } from "./paths.js";
import { errorMessage, hasCommand, run } from "./shell.js";
import { getOutputs } from "./terraform.js";

export const wireguardPort = 51820;
const clientVpnIp = "10.8.0.2/32";

export async function ssh(args: string[], remoteCommand: string): Promise<string> {
  const { serverIp, sshUser, sshPrivateKeyPath } = await getOutputs();
  return run(
    "ssh",
    [
      "-i",
      sshPrivateKeyPath,
      "-o",
      "StrictHostKeyChecking=accept-new",
      ...args,
      `${sshUser}@${serverIp}`,
      remoteCommand,
    ],
    { quiet: true },
  );
}

export async function waitForWireGuardReady(
  options: { onProgress?: (text: string) => void; timeoutMs?: number } = {},
) {
  const { onProgress, timeoutMs = 300_000 } = options;
  const startedAt = Date.now();
  const retryDelayMs = 5_000;
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const progress = await ssh(
        [
          "-o",
          "ConnectTimeout=5",
          "-o",
          "ConnectionAttempts=1",
          "-o",
          "BatchMode=yes",
        ],
        [
          "printf 'cloud_init='",
          "cloud-init status --long 2>/dev/null | tr '\\n' ' ' || true",
          "printf '\\nserver_key='",
          "sudo test -s /etc/wireguard/server_public.key && printf present || printf missing",
          "printf '\\nwg_interface='",
          "sudo wg show wg0 >/dev/null 2>&1 && printf present || printf missing",
          "printf '\\nwg_service='",
          "systemctl is-active wg-quick@wg0 2>/dev/null || true",
        ].join(" ; "),
      );
      onProgress?.(progress);

      const keyPresent = progress.includes("server_key=present");
      const interfacePresent = progress.includes("wg_interface=present");
      const cloudInitDone = progress.includes("status: done");

      if (cloudInitDone && keyPresent && interfacePresent) {
        return;
      }
    } catch (error) {
      lastError = errorMessage(error);
      onProgress?.(`Waiting for SSH to become reachable... (${lastError})`);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  throw new Error(`Timed out waiting for WireGuard server readiness.\n${lastError}`);
}

export async function configureClient(): Promise<void> {
  if (!hasCommand("wg")) {
    throw new Error("wg is required locally to generate WireGuard keys. Install wireguard-tools.");
  }

  const outputs = await getOutputs();
  const privateKey = await run("wg", ["genkey"], { quiet: true });
  const publicKey = await run("wg", ["pubkey"], { input: `${privateKey}\n`, quiet: true });
  const serverPublicKey = await ssh([], "sudo cat /etc/wireguard/server_public.key");

  await ssh(
    [],
    [
      "sudo wg set wg0 peer",
      publicKey,
      "allowed-ips",
      clientVpnIp,
      "&&",
      "sudo sh -c",
      `'grep -q "PublicKey = ${publicKey}" /etc/wireguard/wg0.conf || printf "\\n[Peer]\\nPublicKey = ${publicKey}\\nAllowedIPs = ${clientVpnIp}\\n" >> /etc/wireguard/wg0.conf'`,
    ].join(" "),
  );

  const config = `[Interface]
PrivateKey = ${privateKey}
Address = ${clientVpnIp}
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${outputs.serverIp}:${wireguardPort}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
`;

  mkdirSync(dirname(clientConfigPath), { recursive: true });
  writeFileSync(clientConfigPath, config, { mode: 0o600 });
}
