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

// Validate that the credentials env vars required by the active provider
// are present. Fail fast at startup with a clear, actionable message
// instead of letting terraform produce an opaque auth error later.
const REQUIRED_ENV: Record<CloudProvider, readonly string[]> = {
  aws: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
  azure: ["ARM_SUBSCRIPTION_ID", "ARM_CLIENT_ID", "ARM_CLIENT_SECRET", "ARM_TENANT_ID"],
  gcp: ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_PROJECT"],
  do: ["DIGITALOCEAN_TOKEN"],
};

function assertProviderEnv(provider: CloudProvider): void {
  const missing = REQUIRED_ENV[provider].filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    const lines = [
      `Missing required env vars for CLOUD_PROVIDER="${provider}":`,
      ...missing.map((key) => `  - ${key}`),
      `Fill them in .env (see .env.example for the expected names).`,
    ];
    throw new Error(lines.join("\n"));
  }
}

assertProviderEnv(cloudProvider);

export const configsDir = resolve(repoRoot, "configs");
export const clientConfigPath = resolve(configsDir, "wg-client.conf");
