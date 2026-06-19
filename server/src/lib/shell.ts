import { spawn, spawnSync, SpawnOptions } from "node:child_process";

type RunOptions = {
  cwd?: string;
  input?: string;
  quiet?: boolean;
  timeoutMs?: number;
};

export function run(command: string, args: string[], options: RunOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 0;

  return new Promise((resolve, reject) => {
    const quiet = options.quiet ?? false;
    const stdio: SpawnOptions["stdio"] = quiet
      ? ["pipe", "pipe", "pipe"]
      : "inherit";

    const child = spawn(command, args, { cwd: options.cwd, stdio });

    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;
    let settled = false;

    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(err);
    };

    const settleResolve = (value: string) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill("SIGTERM");
        // Grace period for clean exit, then force-kill.
        const killTimer = setTimeout(() => {
          if (!child.killed && child.exitCode === null) {
            child.kill("SIGKILL");
          }
        }, 1000);
        killTimer.unref();
        settleReject(
          new Error(
            `Command timed out after ${timeoutMs}ms: ${command} ${args.join(" ")}`,
          ),
        );
      }, timeoutMs);
    }

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
      settleReject(err instanceof Error ? err : new Error(String(err)));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        settleReject(
          new Error(
            `Command failed: ${command} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`,
          ),
        );
      } else {
        settleResolve(quiet ? stdout.trim() : "");
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
