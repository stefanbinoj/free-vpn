import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { clientConfigPath } from "./paths.js";
import { hasCommand, run } from "./shell.js";
import { getOutputs } from "./terraform.js";

const wireguardPort = 51820;
const clientVpnIp = "10.8.0.2/32";

export function generateKeyPair() {
  const privateKey = run("wg", ["genkey"], { quiet: true });
  const publicKey = run("wg", ["pubkey"], { input: `${privateKey}\n`, quiet: true });

  return { privateKey, publicKey };
}

export function ssh(args: string[], remoteCommand: string): string {
  const { serverIp, sshUser, sshPrivateKeyPath } = getOutputs();
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForWireGuardReady(timeoutMs = 180_000) {
  const startedAt = Date.now();
  const retryDelayMs = 5_000;
  let lastError = "";

  console.log("Waiting for cloud-init and WireGuard to finish bootstrapping...");

  while (Date.now() - startedAt < timeoutMs) {
    try {
      ssh(
        [
          "-o",
          "ConnectTimeout=5",
          "-o",
          "ConnectionAttempts=1",
          "-o",
          "BatchMode=yes",
        ],
        [
          "cloud-init status --wait >/dev/null",
          "&&",
          "test -s /etc/wireguard/server_public.key",
          "&&",
          "systemctl is-active --quiet wg-quick@wg0",
        ].join(" "),
      );
      console.log("WireGuard server is ready.");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(retryDelayMs);
    }
  }

  throw new Error(`Timed out waiting for WireGuard server readiness.\n${lastError}`);
}

export function configureClient(): string {
  if (!hasCommand("wg")) {
    throw new Error("wg is required locally to generate WireGuard keys. Install wireguard-tools.");
  }

  const outputs = getOutputs();
  const client = generateKeyPair();
  const serverPublicKey = ssh([], "sudo cat /etc/wireguard/server_public.key");
  const clientIpWithoutMask = clientVpnIp.split("/")[0];
  const clientAllowedIp = `${clientIpWithoutMask}/32`;

  ssh(
    [],
    [
      "sudo wg set wg0 peer",
      client.publicKey,
      "allowed-ips",
      clientAllowedIp,
      "&&",
      "sudo sh -c",
      `'grep -q "PublicKey = ${client.publicKey}" /etc/wireguard/wg0.conf || printf "\\n[Peer]\\nPublicKey = ${client.publicKey}\\nAllowedIPs = ${clientAllowedIp}\\n" >> /etc/wireguard/wg0.conf'`,
    ].join(" "),
  );

  const config = `[Interface]
PrivateKey = ${client.privateKey}
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

  return config;
}

export function readClientConfig(): string {
  return readFileSync(clientConfigPath, "utf8");
}
