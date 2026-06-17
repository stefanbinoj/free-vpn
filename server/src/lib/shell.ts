import { spawnSync } from "node:child_process";

type RunOptions = {
  cwd?: string;
  input?: string;
  quiet?: boolean;
};

export function run(command: string, args: string[], options: RunOptions = {}): string {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: "utf8",
    stdio: options.quiet ? ["pipe", "pipe", "pipe"] : "inherit",
  });

  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : "";
    throw new Error(`Command failed: ${command} ${args.join(" ")}${stderr}`);
  }

  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

export function hasCommand(command: string): boolean {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
    stdio: "ignore",
  });

  return result.status === 0;
}
