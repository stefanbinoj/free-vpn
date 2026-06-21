import { config } from "dotenv";
import { resolve } from "node:path";
import { Command } from "commander";
import { connect } from "./commands/connect.js";
import { disconnect } from "./commands/disconnect.js";
import { down } from "./commands/down.js";
import { status } from "./commands/status.js";
import { up } from "./commands/up.js";
import { error as logError } from "./lib/console.js";
import { repoRoot } from "./lib/paths.js";

config({ path: resolve(repoRoot, ".env") });

const program = new Command();

program
  .name("vpn")
  .description("Personal WireGuard VPN manager for the Brazil exit node.")
  .version("0.1.0");

program
  .command("up")
  .description("Provision cloud infrastructure and connect this device to the VPN.")
  .action(up);

program
  .command("down")
  .description("Disconnect this device and destroy cloud infrastructure.")
  .action(down);

program
  .command("connect")
  .description("Connect this device to the running VPN.")
  .action(connect);

program
  .command("disconnect")
  .description("Disconnect this device from the VPN.")
  .action(disconnect);

program
  .command("status")
  .description("Show VPN server and tunnel status.")
  .action(status);

program.parseAsync(process.argv).catch((err) => {
  logError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
