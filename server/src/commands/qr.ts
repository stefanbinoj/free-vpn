import qrcode from "qrcode-terminal";
import { readClientConfig } from "../lib/wireguard.js";

export async function qr() {
  qrcode.generate(readClientConfig(), { small: true });
}
