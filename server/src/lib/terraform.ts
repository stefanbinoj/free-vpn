import { infraDir } from "./paths.js";
import { run } from "./shell.js";

export function terraform(args: string[], quiet = false): string {
  return run("terraform", args, { cwd: infraDir, quiet });
}

export function getOutputs() {
  return {
    serverIp: terraform(["output", "-raw", "server_ip"], true),
    sshUser: terraform(["output", "-raw", "ssh_user"], true),
    sshPrivateKeyPath: terraform(["output", "-raw", "ssh_private_key_path"], true),
  };
}
