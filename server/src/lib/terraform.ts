import { infraDir } from "./paths.js";
import { run } from "./shell.js";

export function terraform(args: string[], quiet = false): string {
  return run("terraform", args, { cwd: infraDir, quiet });
}

export function terraformOutput(name: string): string {
  return terraform(["output", "-raw", name], true);
}

export function getOutputs() {
  return {
    serverIp: terraformOutput("server_ip"),
    sshUser: terraformOutput("ssh_user"),
    sshPrivateKeyPath: terraformOutput("ssh_private_key_path"),
  };
}
