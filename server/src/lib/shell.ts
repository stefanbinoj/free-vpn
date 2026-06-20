import { spawn, SpawnOptions } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { delimiter, join, parse } from "node:path";

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
  // Absolute or relative path: check the file directly. Don't require execute
  // bit — PATHEXT-style callers (e.g. "wireguard.exe") should resolve as long
  // as the file exists; spawn will fail later if it isn't actually runnable.
  if (parse(command).dir || command.includes("/") || command.includes("\\")) {
    try {
      return statSync(command).isFile();
    } catch {
      return false;
    }
  }

  const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  if (dirs.length === 0) return false;

  const isWindows = process.platform === "win32";
  const lowerCommand = command.toLowerCase();
  const exts = isWindows
    ? (process.env.PATHEXT ?? ".EXE;.BAT;.CMD;.COM").split(";")
    : [""];

  for (const dir of dirs) {
    // 1) Try the command as-is. Handles names that already include an
    //    extension (e.g. "wireguard.exe", "wg.exe") and bare names too
    //    (e.g. "terraform", where the file is literally "terraform").
    const direct = join(dir, command);
    if (existsSync(direct) && isRegularFile(direct)) return true;

    // 2) On Windows, also try appending each PATHEXT extension. Skip any
    //    extension the command already ends with (case-insensitive) so we
    //    don't generate nonsense like "wireguard.exe.EXE".
    if (isWindows) {
      for (const ext of exts) {
        if (!ext || lowerCommand.endsWith(ext.toLowerCase())) continue;
        const candidate = join(dir, command + ext);
        if (existsSync(candidate) && isRegularFile(candidate)) return true;
      }
    }
  }

  return false;
}

function isRegularFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
