import { connectLocalClient } from "../lib/local-client.js";

export async function connect() {
  await connectLocalClient();
}
