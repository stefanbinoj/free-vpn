import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// Pick the terraform working directory based on CLOUD_PROVIDER in the env.
// Each provider lives in its own subdirectory under infra/ — see
// infra/aws, infra/azure, infra/gcp, infra/do.
const VALID_PROVIDERS = ["aws", "azure", "gcp", "do"] as const;
export type CloudProvider = (typeof VALID_PROVIDERS)[number];

const rawProvider = process.env.CLOUD_PROVIDER ?? "aws";
if (!(VALID_PROVIDERS as readonly string[]).includes(rawProvider)) {
  throw new Error(
    `CLOUD_PROVIDER must be one of: ${VALID_PROVIDERS.join(", ")} (got "${rawProvider}")`,
  );
}
export const cloudProvider: CloudProvider = rawProvider as CloudProvider;
export const infraDir = resolve(repoRoot, "infra", cloudProvider);

export const configsDir = resolve(repoRoot, "configs");
export const clientConfigPath = resolve(configsDir, "wg-client.conf");
