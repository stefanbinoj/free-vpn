import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { clientConfigPath, logsDir } from "./paths.js";
import { errorMessage, hasCommand, run } from "./shell.js";
import { getOutputs } from "./terraform.js";

export const wireguardPort = 51820;
const clientVpnIp = "10.8.0.2/32";

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

export function collectServerDiagnostics(reason: string): string | undefined {
  try {
    const outputs = getOutputs();
    mkdirSync(logsDir, { recursive: true });
    const logPath = `${logsDir}/vpn-debug-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
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
    console.error(`Could not collect server diagnostics: ${errorMessage(error)}`);
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
      lastError = errorMessage(error);
      if (lastError !== lastProgress) {
        console.log("Waiting for SSH to become reachable...");
        lastProgress = lastError;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(`Timed out waiting for WireGuard server readiness.\n${lastError}`);
}

export function configureClient(): string {
  if (!hasCommand("wg")) {
    throw new Error("wg is required locally to generate WireGuard keys. Install wireguard-tools.");
  }

  const outputs = getOutputs();
  const privateKey = run("wg", ["genkey"], { quiet: true });
  const publicKey = run("wg", ["pubkey"], { input: `${privateKey}\n`, quiet: true });
  const serverPublicKey = ssh([], "sudo cat /etc/wireguard/server_public.key");

  ssh(
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

  return config;
}
