import type { BenefitCandidate, DocumentCandidate } from "@cofi/api";

export type CandidateReviewSource = "benefit" | "document";

export type CandidateReviewTone =
	| "benefit"
	| "document"
	| "split"
	| "participant"
	| "warning";

export type CandidateReviewItem = {
	id: number;
	sourceDocumentId: number;
	source: CandidateReviewSource;
	candidateType: string;
	label: string;
	title: string;
	meta: string;
	sourceType: string;
	inputKind: string;
	documentType: string;
	merchantText?: string;
	projectedExpenseId?: number | null;
	detail: string;
	fields: Array<{ label: string; value: string }>;
	tone: CandidateReviewTone;
	confidenceLabel: string;
	canMarkReviewed: boolean;
	canCreateParticipant: boolean;
	canCreateRecurring: boolean;
	canOpenSplitReview: boolean;
	canSavePromo: boolean;
	isSelfParticipant: boolean;
	createdAt: string;
	raw: BenefitCandidate | DocumentCandidate;
};

export type CapturePacket = {
	sourceDocumentId: number;
	title: string;
	meta: string;
	createdAt: string;
	candidates: CandidateReviewItem[];
	primaryActionLabel: string;
	summary: string;
	counts: {
		expenses: number;
		benefits: number;
		people: number;
		splits: number;
		documents: number;
		future: number;
	};
};

export type SplitTargetOption = {
	expenseId: number;
	label: string;
};
