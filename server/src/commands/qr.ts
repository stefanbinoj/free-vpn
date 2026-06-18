import { readFileSync } from "node:fs";
import qrcode from "qrcode-terminal";
import { clientConfigPath } from "../lib/paths.js";

export async function qr() {
  qrcode.generate(readFileSync(clientConfigPath, "utf8"), { small: true });
}
