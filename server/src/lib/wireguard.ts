import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { clientConfigPath, logsDir } from "./paths.js";
import { findCommand, run } from "./shell.js";
import { getOutputs } from "./terraform.js";

const wireguardPort = 51820;
const clientVpnIp = "10.8.0.2/32";

function wireGuardCli() {
  const command = findCommand(["wg", "wg.exe"]);

  if (!command) {
    throw new Error("wg is required locally to generate WireGuard keys. Install WireGuard tools and ensure wg is on PATH.");
  }

  return command;
}

export function generateKeyPair() {
  const command = wireGuardCli();
  const privateKey = run(command, ["genkey"], { quiet: true });
  const publicKey = run(command, ["pubkey"], { input: `${privateKey}\n`, quiet: true });

  return { privateKey, publicKey };
}

export function ssh(args: string[], remoteCommand: string): string {
  const { serverIp, sshUser, sshPrivateKeyPath } = getOutputs();
  return sshToHost(serverIp, sshUser, sshPrivateKeyPath, args, remoteCommand);
}

export function sshToHost(host: string, user: string, privateKeyPath: string, args: string[], remoteCommand: string): string {
  const defaultArgs = [
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=8",
    "-o",
    "ConnectionAttempts=1",
    "-o",
    "ServerAliveInterval=5",
    "-o",
    "ServerAliveCountMax=1",
  ];

  return run(
    "ssh",
    [
      "-i",
      privateKeyPath,
      ...defaultArgs,
      ...args,
      `${user}@${host}`,
      remoteCommand,
    ],
    { quiet: true },
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function collectServerDiagnostics(reason: string): string | undefined {
  try {
    const outputs = getOutputs();
    mkdirSync(logsDir, { recursive: true });
    const logPath = `${logsDir}/vpn-debug-${timestamp()}.log`;
    const diagnostics = ssh(
      [
        "-o",
        "ConnectTimeout=8",
        "-o",
        "ConnectionAttempts=1",
        "-o",
        "BatchMode=yes",
      ],
      [
        "echo '=== reason ==='",
        `echo '${reason.replace(/'/g, "'\\''")}'`,
        "echo '=== server ==='",
        `echo '${outputs.sshUser}@${outputs.serverIp}'`,
        "echo '=== cloud-init status ==='",
        "cloud-init status --long || true",
        "echo '=== cloud-init output tail ==='",
        "sudo tail -n 200 /var/log/cloud-init-output.log || true",
        "echo '=== cloud-init log tail ==='",
        "sudo tail -n 200 /var/log/cloud-init.log || true",
        "echo '=== wg service ==='",
        "systemctl status wg-quick@wg0 --no-pager || true",
        "echo '=== wg show ==='",
        "sudo wg show || true",
        "echo '=== wireguard files ==='",
        "sudo ls -la /etc/wireguard || true",
        "echo '=== wg0 config without private key ==='",
        "sudo sed 's/^PrivateKey = .*/PrivateKey = [redacted]/' /etc/wireguard/wg0.conf || true",
        "echo '=== network ==='",
        "ip route || true",
      ].join(" ; "),
    );

    writeFileSync(logPath, diagnostics);
    console.error(`Saved server diagnostics to ${logPath}`);
    return logPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not collect server diagnostics: ${message}`);
    return undefined;
  }
}

export async function waitForWireGuardReady(timeoutMs = 300_000) {
  const startedAt = Date.now();
  const retryDelayMs = 5_000;
  let lastError = "";
  let lastProgress = "";

  console.log("Waiting for cloud-init and WireGuard to finish bootstrapping...");

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const progress = ssh(
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

      if (progress !== lastProgress) {
        console.log(progress);
        lastProgress = progress;
      }

      const keyPresent = progress.includes("server_key=present");
      const interfacePresent = progress.includes("wg_interface=present");
      const cloudInitDone = progress.includes("status: done");

      if (cloudInitDone && keyPresent && interfacePresent) {
        console.log("WireGuard server is ready.");
        return;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (lastError !== lastProgress) {
        console.log("Waiting for SSH to become reachable...");
        lastProgress = lastError;
      }
      await sleep(retryDelayMs);
    }
  }

  throw new Error(`Timed out waiting for WireGuard server readiness.\n${lastError}`);
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

  const registeredPeer = ssh([], `sudo wg show wg0 peers | grep -Fx ${client.publicKey} || true`);
  if (registeredPeer !== client.publicKey) {
    throw new Error("Generated client peer was not registered on the WireGuard server.");
  }

  const config = `[Interface]
PrivateKey = ${client.privateKey}
Address = ${clientVpnIp}
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${outputs.serverIp}:${wireguardPort}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;

  mkdirSync(dirname(clientConfigPath), { recursive: true });
  writeFileSync(clientConfigPath, config, { mode: 0o600 });

  return config;
}

export function readClientConfig(): string {
  return readFileSync(clientConfigPath, "utf8");
}
