import { spawn, spawnSync, SpawnOptions } from "node:child_process";

type RunOptions = {
  cwd?: string;
  input?: string;
  quiet?: boolean;
};

export function run(command: string, args: string[], options: RunOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const quiet = options.quiet ?? false;
    const stdio: SpawnOptions["stdio"] = quiet
      ? ["pipe", "pipe", "pipe"]
      : "inherit";

    const child = spawn(command, args, { cwd: options.cwd, stdio });

    let stdout = "";
    let stderr = "";

    if (quiet) {
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
    }

    if (options.input && child.stdin) {
      child.stdin.write(options.input);
      child.stdin.end();
    }

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Command failed: ${command} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`,
          ),
        );
      } else {
        resolve(quiet ? stdout.trim() : "");
      }
    });
  });
}

export function hasCommand(command: string): boolean {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
    stdio: "ignore",
  });

  return result.status === 0;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
