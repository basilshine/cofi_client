#!/usr/bin/env node
/**
 * Railway build entry for the Ceits web monorepo (`cofi_client`).
 * Set `CEITS_RAILWAY_TARGET` on each Railway service (marketing vs workspace).
 */
import { spawnSync } from "node:child_process";

const target = process.env.CEITS_RAILWAY_TARGET?.trim().toLowerCase();

if (target !== "marketing" && target !== "workspace") {
	console.error(
		'[railway-build] Set environment variable CEITS_RAILWAY_TARGET to "marketing" or "workspace" on this service.',
	);
	process.exit(1);
}

const script = target === "marketing" ? "build:marketing" : "build:web";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["run", script], {
	stdio: "inherit",
	shell: false,
});

process.exit(result.status ?? 1);
