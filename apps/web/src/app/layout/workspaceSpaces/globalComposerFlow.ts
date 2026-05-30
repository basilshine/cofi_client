import type { CaptureParsePreview } from "../../../shared/lib/quickCaptureTransactions";

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
	requiresReview: boolean;
	requiresDeepParse: boolean;
	clarificationMessage?: string;
	modelProfile?: string;
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
		return { step: "clarifying", message: action.message };
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
	};
};

export const candidateBundleNotice = (
	bundle: GlobalComposerCandidateBundle,
) => {
	if (bundle.clarificationMessage?.trim()) {
		return bundle.clarificationMessage.trim();
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
	return `Found ${summary}.${policyHint}${reviewHint}`;
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
