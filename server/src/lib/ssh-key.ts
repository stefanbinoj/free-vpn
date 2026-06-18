import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chmod } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { hasCommand, run } from "./shell.js";

export const sshPrivateKeyPath = join(homedir(), ".ssh", "fifa-vpn");
export const sshPublicKeyPath = `${sshPrivateKeyPath}.pub`;

export async function ensureSshKeyPair() {
  const hasPrivateKey = existsSync(sshPrivateKeyPath);
  const hasPublicKey = existsSync(sshPublicKeyPath);
  const sshDir = dirname(sshPrivateKeyPath);

  mkdirSync(sshDir, { recursive: true, mode: 0o700 });
  await chmod(sshDir, 0o700);

  if (hasPrivateKey && hasPublicKey) {
    await normalizeSshKeyPermissions();
    return;
  }

  if (!hasCommand("ssh-keygen")) {
    throw new Error("ssh-keygen is required on PATH to create the local SSH key.");
  }

  if (hasPrivateKey && !hasPublicKey) {
    const publicKey = run("ssh-keygen", ["-y", "-f", sshPrivateKeyPath], { quiet: true });
    writeFileSync(sshPublicKeyPath, `${publicKey}\n`, { mode: 0o644 });
    await normalizeSshKeyPermissions();
    return;
  }

  if (!hasPrivateKey && hasPublicKey) {
    throw new Error(
      `Found ${sshPublicKeyPath} but ${sshPrivateKeyPath} is missing. Delete the orphan public key or restore the matching private key.`,
    );
  }

  console.log(`Creating SSH key pair at ${sshPrivateKeyPath}`);
  run("ssh-keygen", ["-t", "ed25519", "-f", sshPrivateKeyPath, "-C", "fifa-vpn", "-N", ""]);
  await normalizeSshKeyPermissions();
}

async function normalizeSshKeyPermissions() {
  await chmod(sshPrivateKeyPath, 0o600);

  if (existsSync(sshPublicKeyPath)) {
    await chmod(sshPublicKeyPath, 0o644);
  }
}
