import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const webSrcRoot = path.join(repoRoot, "apps", "web", "src");
const telegramSrcRoot = path.join(repoRoot, "apps", "telegram-webapp", "src");
const marketingSrcRoot = path.join(repoRoot, "apps", "marketing", "src");
const packageSrcRoots = [
	path.join(repoRoot, "packages", "api", "src"),
	path.join(repoRoot, "packages", "ceits-icons", "src"),
	path.join(repoRoot, "packages", "ui", "src"),
];

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

const forbiddenRuntimePatterns = [
	{
		pattern: /\/api\/v1\/captures?\/(?:parse|intent)/,
		reason:
			"Removed capture parse/intent endpoints must not be called; use POST /api/v1/capture.",
	},
	{
		pattern: /\/api\/v1\/spaces\/[^"'`]*\/transactions/,
		reason:
			"Removed space transaction endpoints must not be called; use space expense records and capture review.",
	},
	{
		pattern: /\/api\/v1\/finances\b/,
		reason:
			"Removed global finances endpoints must not be called; use Space-scoped expense and vendor APIs.",
	},
	{
		pattern: /\/review\/benefit-candidates\b/,
		reason:
			"Removed benefit-candidate review alias must not be called; use /review/candidates and filter candidate types.",
	},
	{
		pattern:
			/\b(?:listBenefitCandidates|ignoreBenefitCandidate|saveBenefitCandidatePromo|BenefitCandidate(?:Type|Status)?|BenefitCandidateListResponse|BenefitCandidateState|SaveBenefitCandidatePromoResponse)\b/,
		reason:
			"Removed benefit-candidate API facade must not return; use canonical review candidate APIs.",
	},
	{
		pattern: /\bapiClient\.finances\b/,
		reason:
			"Removed finances API facade must not return; use apiClient.spaces.* record APIs.",
	},
	{
		pattern: /\/console\/transactions\b/,
		reason:
			"Removed transaction page route must not return; use space expense record surfaces.",
	},
	{
		pattern: /\bTransactionsPage\b/,
		reason:
			"Removed transaction page component must not return; use expense record surfaces.",
	},
	{
		pattern: /\bCreateSpaceTransactionManual\b/,
		reason:
			"Removed manual transaction API helper must not return; manual entry is capture-backed.",
	},
	{
		pattern: /\bTransaction\b/,
		reason:
			"Removed Transaction domain type must not return; use ExpenseRecord.",
	},
	{
		pattern: /\bquickCaptureTransactions\b/,
		reason: "Removed transaction quick-capture helper must not return.",
	},
	{
		pattern: /\bparseDummySnippets\b/,
		reason: "Removed dummy parse snippets must not return.",
	},
	{
		pattern: /\bManualTransactionEditor\b/,
		reason:
			"Removed manual transaction editor must not return; manual entry is capture-backed.",
	},
	{
		pattern: /\bSpaceTransaction(?:DetailDialog|TagFilter)\b/,
		reason:
			"Removed space transaction UI must not return; use expense record views.",
	},
	{
		pattern: /\bLegacyReviewRedirectPage\b/,
		reason:
			"Removed legacy review redirect must not return; use canonical capture review routes.",
	},
	{
		pattern: /\b(?:requires_deep_parse|requiresDeepParse)\b/,
		reason:
			"Removed capture response deep-parse flag must not return; use model_policy.deep_requested and deep-intelligence wording.",
	},
	{
		pattern: /\b(?:ai_parse_monthly_limit|AI parse)\b/,
		reason:
			"Removed parser-named quota surface must not return; use capture_monthly_limit and capture wording.",
	},
	{
		pattern: /\bCaptureParsedItem\b/,
		reason:
			"Removed parser-shaped capture response items must not return; use CaptureCandidate preview fields.",
	},
	{
		pattern: /\bresponse\.space_suggestion\b/,
		reason:
			"Removed parser shortcut space_suggestion must not be read; target Space comes from caller context.",
	},
	{
		pattern: /\bspace_suggestion(?:_candidate)?\b/,
		reason:
			"Removed space suggestion capture path must not return; target Space comes from caller context.",
	},
	{
		pattern: /\b(?:ParserCapabilities|ParserProfileCapability)\b/,
		reason:
			"Removed parser capability contract must not return; use CaptureCapabilities.",
	},
	{
		pattern: /\bcapabilities\.parser\b/,
		reason:
			"Removed capabilities.parser surface must not return; use capabilities.capture.",
	},
	{
		pattern: /\bparsedItemsToBuilderItems\b/,
		reason:
			"Removed parser-items capture preview adapter must not return; use candidate summaries.",
	},
	{
		pattern: /\btoRecord\(structured\.data\)\b/,
		reason:
			"Removed legacy structured_data.data candidate unwrap must not return; consume normalized candidate fields directly.",
	},
	{
		pattern: /\bnestedCandidateData\(data,\s*\[\s*["'](?:promo|loyalty)/,
		reason:
			"Removed benefit candidate wrapper fallback must not return; promo and loyalty candidate payloads are normalized.",
	},
	{
		pattern: /\b(?:transactionBuilderTypes|draftLineAnchors)\b/,
		reason: "Removed transaction/draft helper modules must not return.",
	},
	{
		pattern: /\btxn_date\b/,
		reason:
			"Removed transaction-era date field must not return; use expense_date.",
	},
	{
		pattern: /\b(?:DraftCardIcon|ThreadDiscussionIcon|TransactionSavedIcon)\b/,
		reason: "Removed legacy entity icons must not return.",
	},
];

const lineNumberForIndex = (content, index) =>
	content.slice(0, index).split(/\r?\n/).length;

const checkForbiddenRuntimeContent = (filePath) =>
	fs.readFile(filePath, "utf8").then((content) => {
		const violations = [];
		for (const rule of forbiddenRuntimePatterns) {
			const match = rule.pattern.exec(content);
			if (!match) continue;
			violations.push({
				filePath,
				specifier: `${match[0]}:${lineNumberForIndex(content, match.index)}`,
				reason: rule.reason,
			});
		}
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
	const packageFiles = (
		await Promise.all(packageSrcRoots.map((root) => readDirRecursive(root)))
	).flat();

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
					return "Telegram app must not import root-level runtime via ../../../src.";
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

	const runtimeContentViolations = await Promise.all(
		[...webFiles, ...telegramFiles, ...marketingFiles, ...packageFiles].map(
			(filePath) => checkForbiddenRuntimeContent(filePath),
		),
	);
	allViolations.push(...runtimeContentViolations.flat());

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
