import { disconnectLocalClient } from "../lib/local-client.js";

export async function disconnect() {
  await disconnectLocalClient();
}
