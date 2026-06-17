import { startHealthChecks, waitForever } from "../lib/health.js";

export async function app() {
  startHealthChecks();
  await waitForever();
}
