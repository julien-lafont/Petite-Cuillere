import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

/**
 * The version shown in the site footer, read from the CHANGELOG at build time.
 *
 * The CHANGELOG rather than `git describe`: Vercel builds from a shallow clone
 * that carries no tags, whereas the file is always there. And it cannot drift —
 * `scripts/release.sh` refuses to publish a version that has no section in it,
 * so the topmost heading is the version being deployed.
 *
 * Inlined through `env` rather than read at runtime, so that the statically
 * prerendered pages carry the number in their HTML and no request ever touches
 * the filesystem. Falls back to the empty string, which the footer renders as
 * nothing at all — a missing number is better than a wrong one.
 */
function appVersion(): string {
  const changelog = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
  return changelog.match(/^## +(\S+) *$/m)?.[1] ?? "";
}

const nextConfig: NextConfig = {
  env: { APP_VERSION: appVersion() },
};

export default nextConfig;
