import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { clientConfigPath } from "./paths.js";
import { run } from "./shell.js";
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

export function configureClient(): string {
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
