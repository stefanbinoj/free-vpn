import { app } from "./commands/app.js";
import { down } from "./commands/down.js";
import { qr } from "./commands/qr.js";
import { status } from "./commands/status.js";
import { up } from "./commands/up.js";

const command = process.argv[2];

const commands: Record<string, () => Promise<void>> = {
  up,
  down,
  status,
  qr,
  app,
};

if (!command || !commands[command]) {
  console.error("Usage: npm run vpn:<up|down|status|qr|app>");
  process.exit(1);
}

commands[command]().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
