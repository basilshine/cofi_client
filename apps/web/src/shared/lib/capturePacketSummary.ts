import type { CapturePacket as ApiCapturePacket } from "@cofi/api";

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
		capturePacketCountLabel(
			counts.expenses,
			"expense/item signal",
			"expense/item signals",
		),
		capturePacketCountLabel(counts.benefits, "benefit"),
		capturePacketCountLabel(counts.people, "person", "people"),
		capturePacketCountLabel(counts.splits, "split"),
		capturePacketCountLabel(counts.future, "future hint"),
		capturePacketCountLabel(counts.documents, "document signal"),
	]
		.filter((value): value is string => Boolean(value))
		.join(", ") || "Review capture";

export const capturePacketEntityCountLabel = (
	key: CapturePacketEntityKey,
	count: number,
): string | null => {
	if (count <= 0) return null;
	if (key === "expenses") {
		return capturePacketCountLabel(
			count,
			"expense/item signal",
			"expense/item signals",
		);
	}
	if (key === "people")
		return capturePacketCountLabel(count, "person", "people");
	if (key === "future") {
		return capturePacketCountLabel(count, "future hint");
	}
	if (key === "documents") {
		return capturePacketCountLabel(count, "document signal");
	}
	return capturePacketCountLabel(count, key.slice(0, -1), key);
};

const isUsefulCaptureMetaValue = (
	value: string | null | undefined,
): value is string => {
	const normalized = value?.trim().toLowerCase();
	return Boolean(
		normalized &&
			!normalized.includes("unknown") &&
			normalized !== "null" &&
			normalized !== "undefined",
	);
};

const humanizeCaptureMetaValue = (value: string): string =>
	value
		.trim()
		.replace(/_/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());

export const captureInputMetaLabel = (
	inputKind?: string | null,
	sourceType?: string | null,
	documentType?: string | null,
): string => {
	const normalized = [inputKind, sourceType, documentType]
		.map((value) => value?.trim().toLowerCase())
		.filter(Boolean)
		.join(" ");
	const detail = [documentType, sourceType, inputKind]
		.map((value) => value?.trim())
		.find(
			(value) =>
				isUsefulCaptureMetaValue(value) &&
				![
					"manual_text",
					"text",
					"manual",
					"photo",
					"image",
					"voice",
					"audio",
				].includes(value.toLowerCase()),
		);
	const base = (() => {
		if (/\b(voice|audio)\b/.test(normalized)) return "Voice capture";
		if (/\b(photo|image|receipt|ocr|screenshot)\b/.test(normalized)) {
			return "Receipt capture";
		}
		if (/\b(manual_text|text|manual)\b/.test(normalized)) return "Text capture";
		return "Capture";
	})();
	return detail ? `${base} • ${humanizeCaptureMetaValue(detail)}` : base;
};

export const capturePacketCountsFromApi = (
	packet: Pick<ApiCapturePacket, "candidate_counts">,
): CapturePacketCounts => ({
	expenses:
		Number(packet.candidate_counts?.expenses ?? 0) +
		Number(packet.candidate_counts?.expense_items ?? 0),
	benefits: Number(packet.candidate_counts?.benefits ?? 0),
	people: Number(packet.candidate_counts?.people ?? 0),
	splits: Number(packet.candidate_counts?.splits ?? 0),
	future: Number(packet.candidate_counts?.future ?? 0),
	documents: Number(packet.candidate_counts?.documents ?? 0),
});

const captureRecordCountsFromApi = (
	packet: Pick<ApiCapturePacket, "records">,
): Partial<CapturePacketCounts> => {
	const expenses = packet.records?.expenses ?? [];
	const benefits = packet.records?.benefits ?? [];
	const participants = packet.records?.participants ?? [];
	const splits = packet.records?.splits ?? [];
	const recurring = packet.records?.recurring ?? [];
	return {
		expenses:
			expenses.length +
			expenses.reduce(
				(total, expense) => total + Number(expense.items?.length ?? 0),
				0,
			),
		benefits: benefits.length,
		people: participants.length,
		splits: splits.length,
		future: recurring.length,
	};
};

const isTechnicalCaptureTitle = (value: string | null | undefined): boolean => {
	const normalized = value?.trim().toLowerCase();
	return (
		!normalized ||
		normalized === "expense candidate" ||
		normalized === "promo code candidate" ||
		normalized === "loyalty candidate" ||
		normalized.endsWith("_candidate") ||
		normalized.endsWith(" candidate")
	);
};

const fallbackCaptureTitle = (
	sourceDocumentId: number,
	counts: CapturePacketCounts,
): string => {
	if (counts.expenses > 0 && counts.benefits > 0) {
		return "Capture with expense and benefits";
	}
	if (counts.expenses > 0) return "Capture with expense candidate";
	if (counts.benefits > 0) return "Capture with benefits";
	if (counts.people > 0) return "Capture with people";
	if (counts.splits > 0) return "Capture with split";
	if (counts.future > 0) return "Capture with future hint";
	if (counts.documents > 0) return "Capture with document signal";
	return `Capture ${sourceDocumentId}`;
};

export const capturePacketSummaryFromApi = (
	packet: ApiCapturePacket,
): CapturePacketSummary<never> => {
	const sourceDocumentId = Number(packet.source_document_id);
	const counts = capturePacketCountsFromApi(packet);
	const recordCounts = captureRecordCountsFromApi(packet);
	counts.expenses = Math.max(counts.expenses, recordCounts.expenses ?? 0);
	counts.benefits = Math.max(counts.benefits, recordCounts.benefits ?? 0);
	counts.people = Math.max(counts.people, recordCounts.people ?? 0);
	counts.splits = Math.max(counts.splits, recordCounts.splits ?? 0);
	counts.future = Math.max(counts.future, recordCounts.future ?? 0);
	const rawTitle = packet.title?.trim();
	const merchantTitle = packet.merchant_text?.trim();
	const expenseRecordTitle = packet.records?.expenses
		?.map((expense) => expense.title?.trim())
		.find(Boolean);
	const benefitRecordTitle = packet.records?.benefits
		?.map(
			(benefit) =>
				benefit.title?.trim() ||
				benefit.promo_code?.trim() ||
				benefit.source_merchant_name?.trim() ||
				benefit.redeem_merchant_name?.trim(),
		)
		.find(Boolean);
	const participantRecordTitle = packet.records?.participants
		?.map((participant) => participant.display_name?.trim())
		.find(Boolean);
	const recurringRecordTitle = packet.records?.recurring
		?.map((recurring) => recurring.name?.trim())
		.find(Boolean);
	const meta = captureInputMetaLabel(
		packet.input_kind,
		packet.source_type,
		packet.document_type,
	);
	return {
		sourceDocumentId,
		title: !isTechnicalCaptureTitle(rawTitle)
			? rawTitle
			: expenseRecordTitle ||
				benefitRecordTitle ||
				participantRecordTitle ||
				recurringRecordTitle ||
				merchantTitle ||
				fallbackCaptureTitle(sourceDocumentId, counts),
		meta,
		createdAt:
			packet.latest_candidate_at ||
			packet.updated_at ||
			packet.created_at ||
			"",
		candidates: [],
		counts,
		summary: capturePacketSummaryLine(counts),
	};
};

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
				meta: first ? options.getMeta(first) : "Extracted capture",
				createdAt: first ? (options.getCreatedAt(first) ?? "") : "",
				candidates: sorted,
				counts,
				summary: capturePacketSummaryLine(counts),
			};
		})
		.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
};
