import { formatDuration } from "./console.js";

// Wraps a listr2 task body so the task title is updated with the elapsed
// duration on completion. Works with any listr2 renderer (SimpleRenderer
// shows it inline; DefaultRenderer would show it twice but we don't use that).
export function withTiming(
  label: string,
  fn: () => Promise<unknown>,
): (ctx: unknown, task: { title: string }) => Promise<unknown> {
  return async (_ctx, task) => {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      task.title = `${label} (${formatDuration(Date.now() - start)})`;
    }
  };
}
