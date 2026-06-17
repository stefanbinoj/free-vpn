import { config } from "dotenv";
import { resolve } from "node:path";
import { app } from "./commands/app.js";
import { connect } from "./commands/connect.js";
import { disconnect } from "./commands/disconnect.js";
import { down } from "./commands/down.js";
import { qr } from "./commands/qr.js";
import { status } from "./commands/status.js";
import { up } from "./commands/up.js";
import { repoRoot } from "./lib/paths.js";

config({ path: resolve(repoRoot, ".env") });

const command = process.argv[2];

const commands: Record<string, () => Promise<void>> = {
  up,
  down,
  connect,
  disconnect,
  status,
  qr,
  app,
};

if (!command || !commands[command]) {
  console.error("Usage: npm run vpn:<up|down|connect|disconnect|status|qr|app>");
  process.exit(1);
}

commands[command]().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
