import type { LucideIcon } from "lucide-react";
import {
	FileText,
	Gift,
	ListChecks,
	ReceiptText,
	Repeat,
	Shield,
	Sparkles,
	Split,
	UsersRound,
	WalletCards,
} from "lucide-react";
import type { CapturePacketEntityKey } from "./capturePacketSummary";

export type EntityVisualKey =
	| "expense"
	| "expenseItem"
	| "benefit"
	| "people"
	| "split"
	| "future"
	| "document"
	| "loyalty"
	| "privacy"
	| "unknown";

export type EntityVisual = {
	key: EntityVisualKey;
	label: string;
	icon: LucideIcon;
	toneClass: string;
	softToneClass: string;
};

export const entityVisuals: Record<EntityVisualKey, EntityVisual> = {
	expense: {
		key: "expense",
		label: "Expenses",
		icon: ReceiptText,
		toneClass:
			"border-[rgba(125,99,58,0.18)] bg-[rgba(255,250,240,0.92)] text-[#6d5331]",
		softToneClass: "bg-[rgba(255,250,240,0.9)] text-[#6d5331]",
	},
	expenseItem: {
		key: "expenseItem",
		label: "Items",
		icon: ListChecks,
		toneClass:
			"border-[rgba(125,99,58,0.18)] bg-[rgba(255,250,240,0.92)] text-[#6d5331]",
		softToneClass: "bg-[rgba(255,250,240,0.9)] text-[#6d5331]",
	},
	benefit: {
		key: "benefit",
		label: "Benefits",
		icon: Gift,
		toneClass:
			"border-[rgba(91,116,87,0.2)] bg-[rgba(237,247,239,0.92)] text-[#405f44]",
		softToneClass: "bg-[rgba(237,247,239,0.9)] text-[#405f44]",
	},
	people: {
		key: "people",
		label: "People",
		icon: UsersRound,
		toneClass:
			"border-[rgba(83,103,139,0.2)] bg-[rgba(235,241,252,0.92)] text-[#405574]",
		softToneClass: "bg-[rgba(235,241,252,0.9)] text-[#405574]",
	},
	split: {
		key: "split",
		label: "Splits",
		icon: Split,
		toneClass:
			"border-[rgba(181,131,52,0.22)] bg-[rgba(255,240,208,0.86)] text-[#73501b]",
		softToneClass: "bg-[rgba(255,240,208,0.86)] text-[#73501b]",
	},
	future: {
		key: "future",
		label: "Future",
		icon: Repeat,
		toneClass:
			"border-[rgba(117,91,142,0.18)] bg-[rgba(245,240,250,0.9)] text-[#5c4a72]",
		softToneClass: "bg-[rgba(245,240,250,0.9)] text-[#5c4a72]",
	},
	document: {
		key: "document",
		label: "Documents",
		icon: FileText,
		toneClass:
			"border-[rgba(90,101,105,0.18)] bg-[rgba(241,245,246,0.9)] text-[#4d5b5e]",
		softToneClass: "bg-[rgba(241,245,246,0.9)] text-[#4d5b5e]",
	},
	loyalty: {
		key: "loyalty",
		label: "Loyalty",
		icon: WalletCards,
		toneClass:
			"border-[rgba(91,116,87,0.2)] bg-[rgba(237,247,239,0.92)] text-[#405f44]",
		softToneClass: "bg-[rgba(237,247,239,0.9)] text-[#405f44]",
	},
	privacy: {
		key: "privacy",
		label: "Privacy",
		icon: Shield,
		toneClass:
			"border-[rgba(90,101,105,0.18)] bg-[rgba(241,245,246,0.9)] text-[#4d5b5e]",
		softToneClass: "bg-[rgba(241,245,246,0.9)] text-[#4d5b5e]",
	},
	unknown: {
		key: "unknown",
		label: "Signal",
		icon: Sparkles,
		toneClass:
			"border-[rgba(120,100,80,0.16)] bg-white/70 text-muted-foreground",
		softToneClass: "bg-white/70 text-muted-foreground",
	},
};

export const capturePacketEntityVisual = (
	key: CapturePacketEntityKey,
): EntityVisual => {
	if (key === "expenses") return entityVisuals.expense;
	if (key === "benefits") return entityVisuals.benefit;
	if (key === "people") return entityVisuals.people;
	if (key === "splits") return entityVisuals.split;
	if (key === "future") return entityVisuals.future;
	return entityVisuals.document;
};

export const captureCandidateTypeVisual = (
	candidateType: string | null | undefined,
): EntityVisual => {
	if (
		candidateType === "expense_candidate" ||
		candidateType === "expense_item_candidate"
	) {
		return entityVisuals.expense;
	}
	if (candidateType === "promo_code_candidate") return entityVisuals.benefit;
	if (candidateType === "loyalty_event_candidate") return entityVisuals.loyalty;
	if (candidateType === "participant_placeholder_candidate") {
		return entityVisuals.people;
	}
	if (candidateType === "split_candidate") return entityVisuals.split;
	if (
		candidateType === "recurring_candidate" ||
		candidateType === "membership_candidate" ||
		candidateType === "reminder_candidate"
	) {
		return entityVisuals.future;
	}
	if (candidateType === "privacy_signal_candidate")
		return entityVisuals.privacy;
	if (candidateType) return entityVisuals.document;
	return entityVisuals.unknown;
};

export const composerCandidateVisual = (
	kind: string | null | undefined,
): EntityVisual => {
	if (kind === "expense") return entityVisuals.expense;
	if (kind === "expense_item") return entityVisuals.expenseItem;
	if (kind === "promo") return entityVisuals.benefit;
	if (kind === "loyalty") return entityVisuals.loyalty;
	if (kind === "split") return entityVisuals.split;
	if (kind === "participant") return entityVisuals.people;
	if (kind === "recurring" || kind === "membership" || kind === "reminder") {
		return entityVisuals.future;
	}
	if (kind === "privacy") return entityVisuals.privacy;
	if (
		kind === "payment_proof" ||
		kind === "merge" ||
		kind === "supporting_document"
	) {
		return entityVisuals.document;
	}
	return entityVisuals.unknown;
};
