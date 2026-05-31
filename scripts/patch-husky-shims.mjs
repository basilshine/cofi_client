import { promises as fs } from "node:fs";
import path from "node:path";

const hooksDir = path.join(process.cwd(), ".husky", "_");
const envShebang = "#!/usr/bin/env sh";
const directShebang = "#!/bin/sh";
const dirnameLoader = '. "$(dirname "$0")/h"';
const parameterExpansionLoader = '. "${0%/*}/h"';
const dirnameHelper = `n=$(basename "$0")
s=$(dirname "$(dirname "$0")")/$n`;
const parameterExpansionHelper = `n=\${0##*/}
d=\${0%/*}
s=\${d%/*}/$n`;
const pathShRunner = 'sh -e "$s" "$@"';
const shebangRunner = '"$s" "$@"';
const sourceRunner = '. "$s"';

const patchFile = async (filePath) => {
	const stat = await fs.stat(filePath);
	if (!stat.isFile()) return false;

	const content = await fs.readFile(filePath, "utf8");
	let nextContent = content;

	if (nextContent.startsWith(envShebang)) {
		nextContent = nextContent.replace(envShebang, directShebang);
	}
	nextContent = nextContent.replace(dirnameLoader, parameterExpansionLoader);
	nextContent = nextContent.replace(dirnameHelper, parameterExpansionHelper);
	nextContent = nextContent.replace(pathShRunner, sourceRunner);
	nextContent = nextContent.replace(shebangRunner, sourceRunner);

	if (nextContent === content) return false;

	await fs.writeFile(filePath, nextContent);
	return true;
};

try {
	const entries = await fs.readdir(hooksDir);
	let patched = 0;

	for (const entry of entries) {
		if (entry.startsWith(".")) continue;
		if (await patchFile(path.join(hooksDir, entry))) {
			patched += 1;
		}
	}

	if (patched > 0) {
		console.log(`Patched ${patched} Husky shim shebangs for Git for Windows.`);
	}
} catch (error) {
	if (error?.code === "ENOENT") {
		process.exit(0);
	}
	throw error;
}
