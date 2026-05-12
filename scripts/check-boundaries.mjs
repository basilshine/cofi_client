import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const webSrcRoot = path.join(repoRoot, "apps", "web", "src");
const telegramSrcRoot = path.join(repoRoot, "apps", "telegram-webapp", "src");
const marketingSrcRoot = path.join(repoRoot, "apps", "marketing", "src");

const importRegex = /from\s+["']([^"']+)["']/g;
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const readDirRecursive = async (targetDir) => {
	const entries = await fs.readdir(targetDir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(targetDir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await readDirRecursive(fullPath)));
			continue;
		}
		if (sourceExtensions.has(path.extname(entry.name))) {
			files.push(fullPath);
		}
	}

	return files;
};

const normalizePath = (filePath) => filePath.split(path.sep).join("/");

const toRelative = (filePath) =>
	normalizePath(path.relative(repoRoot, filePath));

const checkFileImports = (filePath, checker) =>
	fs.readFile(filePath, "utf8").then((content) => {
		const violations = [];
		let match = importRegex.exec(content);
		while (match) {
			const specifier = match[1];
			const reason = checker(filePath, specifier);
			if (reason) {
				violations.push({ filePath, specifier, reason });
			}
			match = importRegex.exec(content);
		}
		importRegex.lastIndex = 0;
		return violations;
	});

const getFeatureName = (filePath) => {
	const relative = normalizePath(path.relative(webSrcRoot, filePath));
	const parts = relative.split("/");
	if (parts[0] !== "features" || parts.length < 2) return null;
	return parts[1];
};

const listFeatureNames = async () => {
	const featuresDir = path.join(webSrcRoot, "features");
	const entries = await fs.readdir(featuresDir, { withFileTypes: true });
	return new Set(
		entries.filter((entry) => entry.isDirectory()).map((x) => x.name),
	);
};

const main = async () => {
	const [webFiles, telegramFiles, marketingFiles, featureNames] =
		await Promise.all([
			readDirRecursive(webSrcRoot),
			readDirRecursive(telegramSrcRoot),
			readDirRecursive(marketingSrcRoot),
			listFeatureNames(),
		]);

	const allViolations = [];

	const webViolations = await Promise.all(
		webFiles.map((filePath) =>
			checkFileImports(filePath, (currentFile, specifier) => {
				const relativeFile = toRelative(currentFile);

				if (/packages\/[^/]+\/src\//.test(specifier)) {
					return "Use public package entrypoints instead of packages/*/src/*.";
				}

				if (relativeFile.startsWith("apps/web/src/shared/")) {
					if (
						specifier.startsWith("../features/") ||
						specifier.startsWith("../../features/") ||
						specifier.includes("/features/")
					) {
						return "Shared layer cannot depend on features.";
					}
				}

				const currentFeature = getFeatureName(currentFile);
				if (!currentFeature) return null;
				const crossFeatureMatch = specifier.match(/^\.\.\/([^/]+)\//);
				if (!crossFeatureMatch) return null;
				const target = crossFeatureMatch[1];
				if (target !== currentFeature && featureNames.has(target)) {
					return "Cross-feature deep import is forbidden; use widgets/entities/shared public seams.";
				}
				return null;
			}),
		),
	);

	const telegramViolations = await Promise.all(
		telegramFiles.map((filePath) =>
			checkFileImports(filePath, (_currentFile, specifier) => {
				if (specifier.includes("../../../src/")) {
					return "Telegram app must not import runtime from legacy cofi_client/src.";
				}
				if (
					specifier.includes("../web/src/") ||
					specifier.includes("../../web/src/")
				) {
					return "Telegram app must not deep-import web source via relative paths; use @web public alias.";
				}
				return null;
			}),
		),
	);

	const marketingViolations = await Promise.all(
		marketingFiles.map((filePath) =>
			checkFileImports(filePath, (_currentFile, specifier) => {
				if (/packages\/[^/]+\/src\//.test(specifier)) {
					return "Marketing app must use public package entrypoints instead of packages/*/src/*.";
				}
				return null;
			}),
		),
	);

	allViolations.push(
		...webViolations.flat(),
		...telegramViolations.flat(),
		...marketingViolations.flat(),
	);

	if (allViolations.length === 0) {
		console.log("Boundary checks passed.");
		return;
	}

	console.error("Boundary checks failed:");
	for (const violation of allViolations) {
		console.error(
			`- ${toRelative(violation.filePath)} -> "${violation.specifier}" (${violation.reason})`,
		);
	}
	process.exit(1);
};

void main();
