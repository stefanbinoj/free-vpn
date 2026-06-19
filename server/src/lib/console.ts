import pc from "picocolors";

export function info(msg: string): void {
  console.log(msg);
}

export function success(msg: string): void {
  console.log(pc.green(msg));
}

export function warn(msg: string): void {
  console.warn(pc.yellow(msg));
}

export function error(msg: string): void {
  console.error(pc.red(msg));
}

export function dim(msg: string): void {
  console.log(pc.gray(msg));
}

export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 1) return `${ms}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}
