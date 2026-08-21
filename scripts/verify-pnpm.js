#!/usr/bin/env node

/**
 * Blocks `npm install` / `yarn install`. This project ships one lockfile,
 * pnpm-lock.yaml, and that is the one Vercel installs from
 * (`pnpm install --frozen-lockfile`) — a dependency added through npm updates
 * package-lock.json only, leaving pnpm-lock.yaml stale and the next deploy
 * failing on ERR_PNPM_OUTDATED_LOCKFILE with no local sign anything was wrong.
 *
 * Detection follows the npm_config_user_agent convention: every package
 * manager sets it to its own name before running lifecycle scripts.
 */

const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm")) {
  const manager = userAgent.split("/")[0] || "an unknown package manager";
  console.error(
    `\nThis project is installed with pnpm only (see "packageManager" in package.json).\n` +
      `Detected: ${manager}.\n\n` +
      `Run "pnpm install" instead — or "pnpm add <package>" to add a dependency.\n`,
  );
  process.exit(1);
}
