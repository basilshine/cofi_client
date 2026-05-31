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
	UserRoundPlus,
	UsersRound,
	WalletCards,
} from "lucide-react";
import type { CapturePacketEntityKey } from "./capturePacketSummary";

export type EntityVisualKey =
	| "expense"
	| "expenseItem"
	| "benefit"
	| "people"
	| "placeholder"
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
	surfaceClass: string;
	selectedSurfaceClass: string;
	chipClass: string;
};

export const entityVisuals: Record<EntityVisualKey, EntityVisual> = {
	expense: {
		key: "expense",
		label: "Expenses",
		icon: ReceiptText,
		toneClass:
			"border-[rgba(72,62,48,0.22)] bg-[rgba(247,243,235,0.96)] text-[#3f382e]",
		softToneClass: "bg-[rgba(247,243,235,0.9)] text-[#3f382e]",
		surfaceClass:
			"border-[rgba(72,62,48,0.14)] bg-[linear-gradient(180deg,rgba(255,253,249,0.92),rgba(246,241,232,0.86))] hover:border-[rgba(72,62,48,0.24)] hover:bg-[rgba(255,253,249,0.98)]",
		selectedSurfaceClass:
			"border-[rgba(72,62,48,0.42)] bg-[rgba(247,243,235,0.96)] ring-2 ring-[rgba(72,62,48,0.14)]",
		chipClass:
			"border-[rgba(72,62,48,0.14)] bg-[rgba(255,253,249,0.72)] text-[#514638]",
	},
	expenseItem: {
		key: "expenseItem",
		label: "Items",
		icon: ListChecks,
		toneClass:
			"border-[rgba(110,104,92,0.2)] bg-[rgba(244,241,235,0.94)] text-[#5b5448]",
		softToneClass: "bg-[rgba(244,241,235,0.9)] text-[#5b5448]",
		surfaceClass:
			"border-[rgba(110,104,92,0.14)] bg-[rgba(250,248,244,0.82)] hover:border-[rgba(110,104,92,0.25)] hover:bg-[rgba(255,253,249,0.96)]",
		selectedSurfaceClass:
			"border-[rgba(110,104,92,0.4)] bg-[rgba(244,241,235,0.96)] ring-2 ring-[rgba(110,104,92,0.14)]",
		chipClass:
			"border-[rgba(110,104,92,0.14)] bg-[rgba(255,253,249,0.72)] text-[#5b5448]",
	},
	benefit: {
		key: "benefit",
		label: "Benefits",
		icon: Gift,
		toneClass:
			"border-[rgba(172,124,35,0.24)] bg-[rgba(255,242,204,0.92)] text-[#7a5514]",
		softToneClass: "bg-[rgba(255,242,204,0.9)] text-[#7a5514]",
		surfaceClass:
			"border-[rgba(172,124,35,0.18)] bg-[linear-gradient(180deg,rgba(255,251,239,0.96),rgba(255,241,202,0.72))] hover:border-[rgba(172,124,35,0.3)] hover:bg-[rgba(255,249,232,0.98)]",
		selectedSurfaceClass:
			"border-[rgba(172,124,35,0.46)] bg-[rgba(255,241,202,0.9)] ring-2 ring-[rgba(209,159,61,0.2)]",
		chipClass:
			"border-[rgba(172,124,35,0.18)] bg-[rgba(255,250,236,0.76)] text-[#7a5514]",
	},
	people: {
		key: "people",
		label: "People",
		icon: UsersRound,
		toneClass:
			"border-[rgba(72,107,82,0.22)] bg-[rgba(235,247,238,0.92)] text-[#365f42]",
		softToneClass: "bg-[rgba(235,247,238,0.9)] text-[#365f42]",
		surfaceClass:
			"border-[rgba(72,107,82,0.16)] bg-[rgba(244,250,245,0.84)] hover:border-[rgba(72,107,82,0.28)] hover:bg-[rgba(248,253,249,0.98)]",
		selectedSurfaceClass:
			"border-[rgba(72,107,82,0.42)] bg-[rgba(235,247,238,0.94)] ring-2 ring-[rgba(72,107,82,0.16)]",
		chipClass:
			"border-[rgba(72,107,82,0.16)] bg-[rgba(247,252,248,0.76)] text-[#365f42]",
	},
	placeholder: {
		key: "placeholder",
		label: "Placeholder",
		icon: UserRoundPlus,
		toneClass:
			"border-[rgba(64,91,118,0.24)] bg-[rgba(236,244,249,0.92)] text-[#34556f]",
		softToneClass: "bg-[rgba(236,244,249,0.9)] text-[#34556f]",
		surfaceClass:
			"border-dashed border-[rgba(64,91,118,0.2)] bg-[rgba(246,251,253,0.84)] hover:border-[rgba(64,91,118,0.34)] hover:bg-[rgba(250,253,255,0.98)]",
		selectedSurfaceClass:
			"border-[rgba(64,91,118,0.48)] bg-[rgba(236,244,249,0.94)] ring-2 ring-[rgba(64,91,118,0.18)]",
		chipClass:
			"border-[rgba(64,91,118,0.16)] bg-[rgba(249,253,255,0.78)] text-[#34556f]",
	},
	split: {
		key: "split",
		label: "Splits",
		icon: Split,
		toneClass:
			"border-[rgba(76,111,87,0.22)] bg-[rgba(235,247,240,0.92)] text-[#2f6043]",
		softToneClass: "bg-[rgba(235,247,240,0.9)] text-[#2f6043]",
		surfaceClass:
			"border-[rgba(76,111,87,0.16)] bg-[linear-gradient(180deg,rgba(248,253,249,0.94),rgba(235,247,240,0.76))] hover:border-[rgba(76,111,87,0.3)] hover:bg-[rgba(249,253,250,0.98)]",
		selectedSurfaceClass:
			"border-[rgba(76,111,87,0.46)] bg-[rgba(235,247,240,0.94)] ring-2 ring-[rgba(76,111,87,0.18)]",
		chipClass:
			"border-[rgba(76,111,87,0.16)] bg-[rgba(248,253,249,0.78)] text-[#2f6043]",
	},
	future: {
		key: "future",
		label: "Future",
		icon: Repeat,
		toneClass:
			"border-[rgba(66,89,135,0.22)] bg-[rgba(236,242,253,0.92)] text-[#334f82]",
		softToneClass: "bg-[rgba(236,242,253,0.9)] text-[#334f82]",
		surfaceClass:
			"border-[rgba(66,89,135,0.16)] bg-[linear-gradient(180deg,rgba(248,251,255,0.94),rgba(236,242,253,0.76))] hover:border-[rgba(66,89,135,0.3)] hover:bg-[rgba(249,252,255,0.98)]",
		selectedSurfaceClass:
			"border-[rgba(66,89,135,0.44)] bg-[rgba(236,242,253,0.94)] ring-2 ring-[rgba(66,89,135,0.16)]",
		chipClass:
			"border-[rgba(66,89,135,0.16)] bg-[rgba(248,251,255,0.78)] text-[#334f82]",
	},
	document: {
		key: "document",
		label: "Documents",
		icon: FileText,
		toneClass:
			"border-[rgba(64,91,118,0.22)] bg-[rgba(236,244,249,0.92)] text-[#34556f]",
		softToneClass: "bg-[rgba(236,244,249,0.9)] text-[#34556f]",
		surfaceClass:
			"border-[rgba(64,91,118,0.16)] bg-[rgba(246,251,253,0.86)] hover:border-[rgba(64,91,118,0.3)] hover:bg-[rgba(250,253,255,0.98)]",
		selectedSurfaceClass:
			"border-[rgba(64,91,118,0.44)] bg-[rgba(236,244,249,0.94)] ring-2 ring-[rgba(64,91,118,0.16)]",
		chipClass:
			"border-[rgba(64,91,118,0.16)] bg-[rgba(249,253,255,0.78)] text-[#34556f]",
	},
	loyalty: {
		key: "loyalty",
		label: "Loyalty",
		icon: WalletCards,
		toneClass:
			"border-[rgba(82,121,86,0.22)] bg-[rgba(236,248,236,0.92)] text-[#38633b]",
		softToneClass: "bg-[rgba(236,248,236,0.9)] text-[#38633b]",
		surfaceClass:
			"border-[rgba(82,121,86,0.16)] bg-[linear-gradient(180deg,rgba(247,253,247,0.94),rgba(236,248,236,0.76))] hover:border-[rgba(82,121,86,0.3)] hover:bg-[rgba(249,253,249,0.98)]",
		selectedSurfaceClass:
			"border-[rgba(82,121,86,0.44)] bg-[rgba(236,248,236,0.94)] ring-2 ring-[rgba(82,121,86,0.16)]",
		chipClass:
			"border-[rgba(82,121,86,0.16)] bg-[rgba(249,253,249,0.78)] text-[#38633b]",
	},
	privacy: {
		key: "privacy",
		label: "Privacy",
		icon: Shield,
		toneClass:
			"border-[rgba(145,78,56,0.22)] bg-[rgba(253,239,232,0.92)] text-[#7b3f2e]",
		softToneClass: "bg-[rgba(253,239,232,0.9)] text-[#7b3f2e]",
		surfaceClass:
			"border-[rgba(145,78,56,0.16)] bg-[rgba(255,247,242,0.86)] hover:border-[rgba(145,78,56,0.3)] hover:bg-[rgba(255,250,247,0.98)]",
		selectedSurfaceClass:
			"border-[rgba(145,78,56,0.44)] bg-[rgba(253,239,232,0.94)] ring-2 ring-[rgba(145,78,56,0.16)]",
		chipClass:
			"border-[rgba(145,78,56,0.16)] bg-[rgba(255,250,247,0.78)] text-[#7b3f2e]",
	},
	unknown: {
		key: "unknown",
		label: "Signal",
		icon: Sparkles,
		toneClass:
			"border-[rgba(112,87,133,0.18)] bg-[rgba(247,241,250,0.9)] text-[#60496f]",
		softToneClass: "bg-[rgba(247,241,250,0.9)] text-[#60496f]",
		surfaceClass:
			"border-[rgba(112,87,133,0.12)] bg-[rgba(252,248,253,0.82)] hover:border-[rgba(112,87,133,0.24)] hover:bg-[rgba(254,251,255,0.98)]",
		selectedSurfaceClass:
			"border-[rgba(112,87,133,0.38)] bg-[rgba(247,241,250,0.94)] ring-2 ring-[rgba(112,87,133,0.14)]",
		chipClass:
			"border-[rgba(112,87,133,0.14)] bg-[rgba(254,251,255,0.78)] text-[#60496f]",
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
		return entityVisuals.placeholder;
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
	if (kind === "placeholder") return entityVisuals.placeholder;
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
