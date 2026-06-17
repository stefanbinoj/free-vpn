const accessKeyPattern = /^(AKIA|ASIA)[A-Z0-9]{16}$/;

function valueOf(name: string) {
  return process.env[name]?.trim();
}

function looksLikeShellAssignment(value: string) {
  return /\b(set|export)\b/i.test(value) || value.includes("AWS_");
}

export function assertAwsCredentialsLookValid() {
  const accessKeyId = valueOf("AWS_ACCESS_KEY_ID");
  const secretAccessKey = valueOf("AWS_SECRET_ACCESS_KEY");
  const sessionToken = valueOf("AWS_SESSION_TOKEN");

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      [
        "AWS credentials are missing.",
        "Create a .env file at the repo root with:",
        "  AWS_ACCESS_KEY_ID=...",
        "  AWS_SECRET_ACCESS_KEY=...",
        "  AWS_DEFAULT_REGION=sa-east-1",
      ].join("\n"),
    );
  }

  if (!accessKeyPattern.test(accessKeyId)) {
    throw new Error(
      [
        "AWS_ACCESS_KEY_ID looks malformed.",
        "It should look like AKIA... or ASIA... and be exactly 20 uppercase letters/numbers.",
        "",
        "Common Windows .env mistake:",
        "  set AWS_ACCESS_KEY_ID=AKIA...",
        "",
        "Correct .env format:",
        "  AWS_ACCESS_KEY_ID=AKIA...",
        "  AWS_SECRET_ACCESS_KEY=...",
        "  AWS_DEFAULT_REGION=sa-east-1",
      ].join("\n"),
    );
  }

  if (looksLikeShellAssignment(secretAccessKey)) {
    throw new Error(
      [
        "AWS_SECRET_ACCESS_KEY looks like it contains extra shell text.",
        "Do not put `set`, `export`, or another AWS variable on the same .env line.",
        "",
        "Correct .env format:",
        "  AWS_ACCESS_KEY_ID=AKIA...",
        "  AWS_SECRET_ACCESS_KEY=...",
        "  AWS_DEFAULT_REGION=sa-east-1",
      ].join("\n"),
    );
  }

  if (sessionToken && looksLikeShellAssignment(sessionToken)) {
    throw new Error("AWS_SESSION_TOKEN looks malformed. Put only the token value after AWS_SESSION_TOKEN=.");
  }
}
