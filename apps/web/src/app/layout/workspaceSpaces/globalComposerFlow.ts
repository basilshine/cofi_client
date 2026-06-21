import type {
	CaptureCandidate,
	CaptureResponse,
} from "../../../shared/lib/quickCapture";

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
	requiresDeepIntelligence: boolean;
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

export const summarizeCaptureResponse = (
	response: CaptureResponse,
	input: {
		inputKind: GlobalComposerInputKind;
		spaceId?: string | number;
		fallbackIntent?: string;
	},
): GlobalComposerCandidateBundle => {
	const candidates = summarizeCaptureCandidates(response);

	return {
		inputKind: input.inputKind,
		intent: response.intent?.trim() || input.fallbackIntent || "unknown",
		spaceId: input.spaceId,
		sourceDocumentId: response.source_document_id,
		candidates,
		requiresReview:
			response.requires_review === true ||
			response.clarification_message != null ||
			candidates.length > 1,
		requiresDeepIntelligence: response.model_policy?.deep_requested === true,
		clarificationMessage: response.clarification_message,
		modelProfile: response.model_policy?.profile,
		modelMaxProfile: response.model_policy?.max_profile,
		capabilityNotice: capabilityNoticeForResponse(response),
	};
};

const capabilityNoticeForResponse = (
	response: CaptureResponse,
): string | undefined => {
	if (response.model_policy?.max_profile?.toLowerCase() !== "basic") {
		return undefined;
	}
	return "Basic keeps expense and item candidates only. Medium and Premium can surface promos, loyalty, payment proof, privacy, merge, and supporting documents when detected.";
};

const summarizeCaptureCandidates = (
	response: CaptureResponse,
): GlobalComposerCandidateSummary[] => {
	return summarizeServerCandidates(response.candidates ?? []);
};

const summarizeServerCandidates = (
	candidates: CaptureCandidate[],
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
	candidateType: CaptureCandidate["candidate_type"] | string | undefined,
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
		return "Ceits captured the input, but needs a clearer amount, item, promo, or instruction.";
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
		: " Ready for candidate save.";
	const policyHint = bundle.modelProfile
		? ` ${bundle.modelProfile} capture.`
		: "";
	return `Found ${summary} from this capture.${policyHint}${reviewHint}`;
};
