export type CapturePacketEntityKey =
	| "expenses"
	| "benefits"
	| "people"
	| "splits"
	| "future"
	| "documents";

export type CapturePacketCounts = Record<CapturePacketEntityKey, number>;

export type CapturePacketSummary<TCandidate> = {
	sourceDocumentId: number;
	title: string;
	meta: string;
	createdAt: string;
	candidates: TCandidate[];
	counts: CapturePacketCounts;
	summary: string;
};

export type CapturePacketSummaryOptions<TCandidate> = {
	getSourceDocumentId: (
		candidate: TCandidate,
	) => number | string | null | undefined;
	getCandidateType: (candidate: TCandidate) => string | null | undefined;
	getCreatedAt: (candidate: TCandidate) => string | null | undefined;
	getTitle: (candidate: TCandidate, sourceDocumentId: number) => string;
	getMeta: (candidate: TCandidate) => string;
};

export const emptyCapturePacketCounts = (): CapturePacketCounts => ({
	expenses: 0,
	benefits: 0,
	people: 0,
	splits: 0,
	future: 0,
	documents: 0,
});

export const captureCandidateEntityKey = (
	candidateType: string | null | undefined,
): CapturePacketEntityKey => {
	if (
		candidateType === "expense_candidate" ||
		candidateType === "expense_item_candidate"
	) {
		return "expenses";
	}
	if (
		candidateType === "promo_code_candidate" ||
		candidateType === "loyalty_event_candidate"
	) {
		return "benefits";
	}
	if (candidateType === "participant_placeholder_candidate") return "people";
	if (candidateType === "split_candidate") return "splits";
	if (
		candidateType === "recurring_candidate" ||
		candidateType === "membership_candidate" ||
		candidateType === "reminder_candidate"
	) {
		return "future";
	}
	return "documents";
};

export const capturePacketCountLabel = (
	count: number,
	singular: string,
	plural = `${singular}s`,
): string | null => {
	if (count <= 0) return null;
	return `${count} ${count === 1 ? singular : plural}`;
};

export const capturePacketSummaryLine = (counts: CapturePacketCounts): string =>
	[
		capturePacketCountLabel(counts.expenses, "expense"),
		capturePacketCountLabel(counts.benefits, "benefit"),
		capturePacketCountLabel(counts.people, "person", "people"),
		capturePacketCountLabel(counts.splits, "split"),
		capturePacketCountLabel(counts.future, "future hint"),
		capturePacketCountLabel(counts.documents, "document signal"),
	]
		.filter((value): value is string => Boolean(value))
		.join(", ") || "Review parsed result";

const parseTimestamp = (value: string | null | undefined): number => {
	const parsed = Date.parse(value ?? "");
	return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

export const buildCapturePacketSummaries = <TCandidate>(
	candidates: TCandidate[],
	options: CapturePacketSummaryOptions<TCandidate>,
): CapturePacketSummary<TCandidate>[] => {
	const bySource = new Map<number, TCandidate[]>();
	for (const candidate of candidates) {
		const sourceDocumentId = Number(options.getSourceDocumentId(candidate));
		if (!Number.isFinite(sourceDocumentId) || sourceDocumentId <= 0) continue;
		const list = bySource.get(sourceDocumentId) ?? [];
		list.push(candidate);
		bySource.set(sourceDocumentId, list);
	}

	return Array.from(bySource.entries())
		.map(([sourceDocumentId, packetCandidates]) => {
			const sorted = [...packetCandidates].sort(
				(a, b) =>
					parseTimestamp(options.getCreatedAt(b)) -
					parseTimestamp(options.getCreatedAt(a)),
			);
			const first = sorted[0];
			const counts = emptyCapturePacketCounts();
			for (const candidate of sorted) {
				counts[
					captureCandidateEntityKey(options.getCandidateType(candidate))
				] += 1;
			}
			return {
				sourceDocumentId,
				title: first
					? options.getTitle(first, sourceDocumentId)
					: `Capture #${sourceDocumentId}`,
				meta: first ? options.getMeta(first) : "Parsed capture",
				createdAt: first ? (options.getCreatedAt(first) ?? "") : "",
				candidates: sorted,
				counts,
				summary: capturePacketSummaryLine(counts),
			};
		})
		.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
};
