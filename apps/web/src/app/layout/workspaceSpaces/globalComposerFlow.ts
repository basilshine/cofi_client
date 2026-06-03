import type {
	CaptureIntentPreview,
	CaptureParseCandidate,
	CaptureParsePreview,
} from "../../../shared/lib/quickCaptureTransactions";

export type GlobalComposerInputKind =
	| "text"
	| "photo"
	| "voice"
	| "ask"
	| "message";

export type GlobalComposerFlowStep =
	| "idle"
	| "detecting_intent"
	| "clarifying"
	| "candidate_summary"
	| "review_handoff"
	| "completed"
	| "failed";

export type GlobalComposerCandidateKind =
	| "expense"
	| "expense_item"
	| "promo"
	| "loyalty"
	| "payment_proof"
	| "privacy"
	| "recurring"
	| "membership"
	| "reminder"
	| "split"
	| "participant"
	| "space_suggestion"
	| "merge"
	| "supporting_document";

export type GlobalComposerCandidateSummary = {
	kind: GlobalComposerCandidateKind;
	count: number;
	label: string;
};

export type GlobalComposerCandidateBundle = {
	inputKind: GlobalComposerInputKind;
	intent: string;
	spaceId?: string | number;
	sourceDocumentId?: number;
	candidates: GlobalComposerCandidateSummary[];
	createdRecordCount?: number;
	createdRecordLabels?: string[];
	requiresReview: boolean;
	requiresDeepParse: boolean;
	clarificationMessage?: string;
	modelProfile?: string;
	modelMaxProfile?: string;
	capabilityNotice?: string;
};

export type GlobalComposerFlowState = {
	step: GlobalComposerFlowStep;
	message?: string;
	bundle?: GlobalComposerCandidateBundle;
	error?: string;
};

type GlobalComposerFlowAction =
	| { type: "reset" }
	| {
			type: "detecting_intent";
			inputKind: GlobalComposerInputKind;
	  }
	| {
			type: "clarifying";
			message: string;
			bundle?: GlobalComposerCandidateBundle;
	  }
	| {
			type: "candidate_summary";
			bundle: GlobalComposerCandidateBundle;
	  }
	| {
			type: "review_handoff";
			bundle: GlobalComposerCandidateBundle;
			message?: string;
	  }
	| {
			type: "completed";
			message: string;
	  }
	| {
			type: "failed";
			error: string;
	  };

export const initialGlobalComposerFlowState: GlobalComposerFlowState = {
	step: "idle",
};

export const globalComposerFlowReducer = (
	_state: GlobalComposerFlowState,
	action: GlobalComposerFlowAction,
): GlobalComposerFlowState => {
	if (action.type === "reset") return initialGlobalComposerFlowState;
	if (action.type === "detecting_intent") {
		return {
			step: "detecting_intent",
			message:
				action.inputKind === "message"
					? "Sending message..."
					: "Understanding intent...",
		};
	}
	if (action.type === "clarifying") {
		return {
			step: "clarifying",
			message: action.message,
			bundle: action.bundle,
		};
	}
	if (action.type === "candidate_summary") {
		return {
			step: "candidate_summary",
			bundle: action.bundle,
			message: candidateBundleNotice(action.bundle),
		};
	}
	if (action.type === "review_handoff") {
		return {
			step: "review_handoff",
			bundle: action.bundle,
			message:
				action.message ??
				"Review is ready. Confirm the useful parts before anything becomes final.",
		};
	}
	if (action.type === "completed") {
		return { step: "completed", message: action.message };
	}
	return { step: "failed", error: action.error, message: action.error };
};

export const summarizeCapturePreview = (
	preview: CaptureParsePreview,
	input: {
		inputKind: Extract<GlobalComposerInputKind, "text" | "photo" | "voice">;
		spaceId?: string | number;
		fallbackIntent?: string;
	},
): GlobalComposerCandidateBundle => {
	const data = objectRecord(preview.data);
	const candidates =
		preview.candidates != null
			? summarizeServerCandidates(preview.candidates)
			: summarizePreviewShape(preview, data);

	return {
		inputKind: input.inputKind,
		intent: preview.intent?.trim() || input.fallbackIntent || "unknown",
		spaceId: input.spaceId,
		sourceDocumentId: preview.source_document_id,
		candidates,
		requiresReview:
			preview.requires_review === true ||
			preview.clarification_message != null ||
			candidates.length > 1,
		requiresDeepParse: preview.requires_deep_parse === true,
		clarificationMessage: preview.clarification_message,
		modelProfile: preview.model_policy?.profile,
		modelMaxProfile: preview.model_policy?.max_profile,
		capabilityNotice: capabilityNoticeForPreview(preview),
	};
};

export const summarizeCaptureIntentPreview = (
	preview: CaptureIntentPreview,
	input: {
		inputKind: GlobalComposerInputKind;
		spaceId?: string | number;
		fallbackIntent?: string;
	},
): GlobalComposerCandidateBundle => {
	const candidates = summarizeServerCandidates(preview.candidates ?? []);
	const clarificationMessage =
		preview.required_clarification?.trim() ||
		(preview.next_action === "ask_clarification"
			? "Ceits needs one more detail before continuing."
			: undefined);

	return {
		inputKind: input.inputKind,
		intent: preview.intent?.trim() || input.fallbackIntent || "unknown",
		spaceId: preview.target_context?.space_id ?? input.spaceId,
		sourceDocumentId: preview.source_document_id,
		candidates,
		requiresReview: preview.requires_review === true || candidates.length > 0,
		requiresDeepParse: false,
		clarificationMessage,
		modelProfile: preview.model_policy?.profile,
		modelMaxProfile: preview.model_policy?.max_profile,
		capabilityNotice: capabilityNoticeForIntent(preview),
	};
};

const capabilityNoticeForPreview = (
	preview: CaptureParsePreview,
): string | undefined => {
	if (preview.model_policy?.max_profile?.toLowerCase() !== "basic") {
		return undefined;
	}
	return "Basic keeps expense and item candidates only. Medium and Premium can surface promos, loyalty, payment proof, privacy, merge, and space suggestions when detected.";
};

const capabilityNoticeForIntent = (
	preview: CaptureIntentPreview,
): string | undefined => {
	if (preview.model_policy?.max_profile?.toLowerCase() !== "basic") {
		return undefined;
	}
	return "Basic intent keeps expense and item candidates only. Medium and Premium can surface promos, loyalty, payment proof, privacy, merge, and space suggestions when detected.";
};

const summarizePreviewShape = (
	preview: CaptureParsePreview,
	data: Record<string, unknown>,
) => {
	const candidates: GlobalComposerCandidateSummary[] = [];
	const itemCount = (preview.items ?? []).filter(
		(item) =>
			item?.name?.trim() ||
			(Number.isFinite(Number(item?.amount)) && Number(item?.amount) !== 0),
	).length;

	if (
		itemCount > 0 ||
		hasAnyKey(data, "total", "total_amount", "amount", "merchant", "vendor")
	) {
		candidates.push({ kind: "expense", count: 1, label: "expense" });
	}
	if (itemCount > 0) {
		candidates.push({
			kind: "expense_item",
			count: itemCount,
			label: itemCount === 1 ? "item" : "items",
		});
	}
	if (hasAnyKey(data, "promo_code", "promo", "coupon", "discount_code")) {
		candidates.push({ kind: "promo", count: 1, label: "promo" });
	}
	if (
		hasAnyKey(
			data,
			"loyalty",
			"loyalty_program",
			"bonus",
			"bonus_points",
			"points_earned",
			"points_spent",
		)
	) {
		candidates.push({ kind: "loyalty", count: 1, label: "loyalty" });
	}
	if (hasAnyKey(data, "payment_proof", "card_last4", "rrn", "terminal_id")) {
		candidates.push({
			kind: "payment_proof",
			count: 1,
			label: "payment proof",
		});
	}
	if (hasAnyKey(data, "privacy_signal", "sensitivity", "sensitive")) {
		candidates.push({ kind: "privacy", count: 1, label: "privacy" });
	}
	if (hasAnyKey(data, "recurring", "recurring_rule", "renewal_date")) {
		candidates.push({ kind: "recurring", count: 1, label: "recurring" });
	}
	if (hasAnyKey(data, "membership", "service_period", "period_end")) {
		candidates.push({ kind: "membership", count: 1, label: "membership" });
	}
	if (preview.split_draft != null) {
		candidates.push({ kind: "split", count: 1, label: "split" });
	}
	if (preview.participants_draft != null) {
		candidates.push({
			kind: "participant",
			count: 1,
			label: "participants",
		});
	}
	if (preview.space_suggestion != null) {
		candidates.push({
			kind: "space_suggestion",
			count: 1,
			label: "space suggestion",
		});
	}
	if (hasAnyKey(data, "duplicate_candidate", "merge_candidate")) {
		candidates.push({ kind: "merge", count: 1, label: "merge" });
	}
	if (hasAnyKey(data, "supporting_document")) {
		candidates.push({
			kind: "supporting_document",
			count: 1,
			label: "supporting document",
		});
	}
	return candidates;
};

const summarizeServerCandidates = (
	candidates: CaptureParseCandidate[],
): GlobalComposerCandidateSummary[] => {
	const counts = new Map<GlobalComposerCandidateKind, number>();
	for (const candidate of candidates) {
		const kind = candidateKindFromServer(candidate.candidate_type);
		if (!kind) continue;
		counts.set(kind, (counts.get(kind) ?? 0) + 1);
	}
	return Array.from(counts.entries()).map(([kind, count]) => ({
		kind,
		count,
		label: candidateLabel(kind, count),
	}));
};

const candidateKindFromServer = (
	candidateType: CaptureParseCandidate["candidate_type"] | string | undefined,
): GlobalComposerCandidateKind | null => {
	if (candidateType === "expense_candidate") return "expense";
	if (candidateType === "expense_item_candidate") return "expense_item";
	if (candidateType === "promo_code_candidate") return "promo";
	if (candidateType === "loyalty_event_candidate") return "loyalty";
	if (candidateType === "payment_proof_candidate") return "payment_proof";
	if (candidateType === "privacy_signal_candidate") return "privacy";
	if (candidateType === "recurring_candidate") return "recurring";
	if (candidateType === "membership_candidate") return "membership";
	if (candidateType === "reminder_candidate") return "reminder";
	if (candidateType === "merge_candidate") return "merge";
	if (candidateType === "space_suggestion_candidate") return "space_suggestion";
	if (candidateType === "supporting_document_candidate") {
		return "supporting_document";
	}
	if (candidateType === "split_candidate") return "split";
	if (candidateType === "participant_placeholder_candidate") {
		return "participant";
	}
	return null;
};

const candidateLabel = (
	kind: GlobalComposerCandidateKind,
	count: number,
): string => {
	if (kind === "expense_item") return count === 1 ? "item" : "items";
	if (kind === "payment_proof") return "payment proof";
	if (kind === "space_suggestion") return "space suggestion";
	if (kind === "supporting_document") return "supporting document";
	return kind.replace(/_/g, " ");
};

export const candidateBundleNotice = (
	bundle: GlobalComposerCandidateBundle,
) => {
	if (bundle.clarificationMessage?.trim()) {
		return bundle.clarificationMessage.trim();
	}
	if ((bundle.createdRecordCount ?? 0) > 0 && !bundle.requiresReview) {
		const labels = bundle.createdRecordLabels?.length
			? bundle.createdRecordLabels.slice(0, 3).join(", ")
			: `${bundle.createdRecordCount} records`;
		return `Records created from this capture: ${labels}.`;
	}
	if (!bundle.candidates.length) {
		return "Ceits parsed the input, but needs a clearer amount, item, promo, or instruction.";
	}

	const labels = bundle.candidates
		.slice(0, 4)
		.map((candidate) =>
			candidate.count > 1
				? `${candidate.count} ${candidate.label}`
				: candidate.label,
		);
	const extraCount = bundle.candidates.length - labels.length;
	const summary =
		extraCount > 0
			? `${labels.join(", ")} + ${extraCount} more`
			: labels.join(", ");
	const reviewHint = bundle.requiresReview
		? " Review before final save."
		: " Ready for draft save.";
	const policyHint = bundle.modelProfile
		? ` ${bundle.modelProfile} parse.`
		: "";
	return `Found ${summary} from this capture.${policyHint}${reviewHint}`;
};

const objectRecord = (value: unknown): Record<string, unknown> => {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return value as Record<string, unknown>;
};

const hasAnyKey = (data: Record<string, unknown>, ...keys: string[]) => {
	const normalized = new Set(Object.keys(data).map((key) => key.toLowerCase()));
	return keys.some((key) => normalized.has(key.toLowerCase()));
};
