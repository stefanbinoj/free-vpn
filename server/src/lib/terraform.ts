import { infraDir } from "./paths.js";
import { run } from "./shell.js";

export function terraform(args: string[], quiet = false): Promise<string> {
  return run("terraform", args, { cwd: infraDir, quiet });
}

export async function getOutputs() {
  return {
    serverIp: await terraform(["output", "-raw", "server_ip"], true),
    sshUser: await terraform(["output", "-raw", "ssh_user"], true),
    sshPrivateKeyPath: await terraform(["output", "-raw", "ssh_private_key_path"], true),
  };
}
