import type {
	CapturePacket as ApiCapturePacket,
	BenefitCandidate,
	DashboardPendingDraft,
	DocumentCandidate,
	ExpenseSplitRow,
	Space,
	SpaceMember,
	Transaction,
} from "@cofi/api";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceTabs } from "../../app/layout/workspaceSpaces/SpaceTabs";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";
import {
	buildCapturePacketSummaries,
	captureInputMetaLabel,
	capturePacketSummaryFromApi,
	capturePacketSummaryLine,
} from "../../shared/lib/capturePacketSummary";
import { createManualDraftInSpace } from "../../shared/lib/quickCaptureTransactions";
import { CapturePacketReviewSection } from "./CapturePacketReviewSection";
import type {
	CandidateReviewItem,
	CandidateReviewSource,
	CandidateReviewTone,
	CapturePacket,
	SplitTargetOption,
} from "./reviewPacketTypes";

type ReviewKind = "draft" | "needs_confirmation";

type ReviewItem = {
	id: string;
	kind: ReviewKind;
	expenseId: number;
	spaceId: number;
	spaceName: string;
	title: string;
	amount: number;
	status: string;
	dateLabel: string;
	source: "receipt" | "voice" | "manual" | "chat";
	confidenceLabel: "High" | "Medium";
	confidenceReason: string;
	summaryReason: string;
	whoAffected: string;
	tags: string[];
	linePreview: Array<{ name: string; amount: number }>;
	splits: ExpenseSplitRow[];
	splitMethod: "equal" | "custom" | "manual";
	isDraftLike: boolean;
	detailsLoaded: boolean;
	detailsLoading?: boolean;
	detailError?: string | null;
};

const documentCandidateLabel = (type: string): string => {
	if (type === "expense_candidate") return "Expense draft";
	if (type === "expense_item_candidate") return "Line item";
	if (type === "promo_code_candidate") return "Promo code";
	if (type === "loyalty_event_candidate") return "Loyalty";
	if (type === "payment_proof_candidate") return "Payment proof";
	if (type === "privacy_signal_candidate") return "Privacy signal";
	if (type === "merge_candidate") return "Possible duplicate";
	if (type === "supporting_document_candidate") return "Supporting document";
	if (type === "space_suggestion_candidate") return "Space suggestion";
	if (type === "recurring_candidate") return "Recurring hint";
	if (type === "membership_candidate") return "Membership hint";
	if (type === "reminder_candidate") return "Reminder hint";
	if (type === "split_candidate") return "Split";
	if (type === "participant_placeholder_candidate") return "Participant";
	return type
		.replace(/_candidate$/i, "")
		.replace(/_/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const documentCandidateMeta = (candidate: DocumentCandidate): string => {
	const inputMeta = captureInputMetaLabel(
		candidate.input_kind,
		candidate.source_type,
		candidate.document_type,
	);
	const merchant = candidate.merchant_text?.trim();
	return merchant && merchant.toLowerCase() !== "unknown"
		? `${inputMeta} • ${merchant}`
		: inputMeta;
};

const toRecord = (value: unknown): Record<string, unknown> => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
};

const candidateData = (
	candidate: BenefitCandidate | DocumentCandidate,
): Record<string, unknown> => {
	let current = toRecord(candidate.structured_data);
	for (let i = 0; i < 4; i += 1) {
		const nested = toRecord(current.data);
		if (!Object.keys(nested).length) return current;
		current = nested;
	}
	return current;
};

const firstCandidateText = (
	data: Record<string, unknown>,
	keys: string[],
): string | null => {
	for (const key of keys) {
		const value = data[key];
		if (typeof value === "string" && value.trim()) return value.trim();
		if (typeof value === "number" && Number.isFinite(value))
			return String(value);
	}
	return null;
};

const firstCandidateArray = (
	data: Record<string, unknown>,
	keys: string[],
): unknown[] | null => {
	for (const key of keys) {
		const value = data[key];
		if (Array.isArray(value) && value.length > 0) return value;
	}
	return null;
};

const candidateNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return null;
	const normalized = value.replace(/[^\d,.-]/g, "").replace(",", ".");
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
};

const firstCandidateNumber = (
	data: Record<string, unknown>,
	keys: string[],
): number | null => {
	for (const key of keys) {
		const parsed = candidateNumber(data[key]);
		if (parsed != null) return parsed;
	}
	return null;
};

const nestedCandidateData = (
	data: Record<string, unknown>,
	keys: string[],
): Record<string, unknown> => {
	for (const key of keys) {
		const nested = toRecord(data[key]);
		if (Object.keys(nested).length > 0) return nested;
	}
	return data;
};

const tagsFromCandidateData = (data: Record<string, unknown>): string[] => {
	const rawTags = firstCandidateArray(data, ["tags", "categories", "labels"]);
	const tags =
		rawTags
			?.map((item) =>
				typeof item === "string"
					? item.trim()
					: firstCandidateText(toRecord(item), ["name", "label", "title"]),
			)
			.filter((item): item is string => Boolean(item)) ?? [];
	return tags.length ? tags : ["other"];
};

type ReviewDraftItem = { name: string; amount: number; tags?: string[] };

const draftItemsFromExpenseCandidate = (
	candidate: CandidateReviewItem,
): ReviewDraftItem[] => {
	if (
		candidate.candidateType !== "expense_candidate" &&
		candidate.candidateType !== "expense_item_candidate"
	) {
		return [];
	}
	const data = candidateData(candidate.raw);
	if (candidate.candidateType === "expense_item_candidate") {
		const item = nestedCandidateData(data, ["item"]);
		const name =
			firstCandidateText(item, ["name", "title", "description"]) ??
			candidate.title;
		const amount = firstCandidateNumber(item, ["amount", "total", "price"]);
		return name.trim() && amount != null && amount !== 0
			? [{ name: name.trim(), amount, tags: tagsFromCandidateData(item) }]
			: [];
	}
	const draft = nestedCandidateData(data, ["draft", "data"]);
	const rawItems = firstCandidateArray(draft, [
		"items",
		"line_items",
		"expense_items",
	]);
	if (rawItems?.length) {
		return rawItems
			.map((rawItem): ReviewDraftItem | null => {
				const item = toRecord(rawItem);
				const name = firstCandidateText(item, ["name", "title", "description"]);
				const amount = firstCandidateNumber(item, ["amount", "total", "price"]);
				return name && amount != null && amount !== 0
					? { name, amount, tags: tagsFromCandidateData(item) }
					: null;
			})
			.filter((item): item is ReviewDraftItem => item != null);
	}
	const name =
		firstCandidateText(draft, [
			"merchant",
			"merchant_name",
			"vendor",
			"payee",
		]) ?? candidate.title;
	const amount = firstCandidateNumber(draft, [
		"total",
		"total_amount",
		"amount",
	]);
	return name.trim() && amount != null && amount !== 0
		? [{ name: name.trim(), amount, tags: tagsFromCandidateData(draft) }]
		: [];
};

const appendField = (
	fields: Array<{ label: string; value: string }>,
	label: string,
	value: string | null | undefined,
) => {
	if (value == null || value.trim() === "") return;
	fields.push({ label, value: value.trim() });
};

const appendItemsField = (
	fields: Array<{ label: string; value: string }>,
	data: Record<string, unknown>,
) => {
	const labels = candidateItemLabels(data);
	if (!labels.length) return;
	const rawItems = firstCandidateArray(data, [
		"items",
		"line_items",
		"expense_items",
	]);
	const extra =
		rawItems && rawItems.length > labels.length
			? ` +${rawItems.length - labels.length}`
			: "";
	appendField(fields, "Items", `${labels.join(", ")}${extra}`);
};

const candidateItemLabels = (data: Record<string, unknown>): string[] => {
	const rawItems = firstCandidateArray(data, [
		"items",
		"line_items",
		"expense_items",
	]);
	if (!rawItems?.length) return [];
	return rawItems
		.map((item) => {
			const record = toRecord(item);
			return firstCandidateText(record, ["name", "title", "description"]);
		})
		.filter((value): value is string => Boolean(value))
		.slice(0, 3);
};

const candidateTone = (type: string): CandidateReviewTone => {
	if (type === "promo_code_candidate" || type === "loyalty_event_candidate")
		return "benefit";
	if (type === "split_candidate") return "split";
	if (type === "participant_placeholder_candidate") return "participant";
	if (
		type === "payment_proof_candidate" ||
		type === "merge_candidate" ||
		type === "supporting_document_candidate"
	)
		return "document";
	return "warning";
};

const canMarkDocumentCandidateReviewed = (type: string): boolean =>
	[
		"payment_proof_candidate",
		"privacy_signal_candidate",
		"merge_candidate",
		"supporting_document_candidate",
		"space_suggestion_candidate",
		"recurring_candidate",
		"membership_candidate",
		"reminder_candidate",
	].includes(type);

const canCreateParticipantFromCandidate = (type: string): boolean =>
	type === "participant_placeholder_candidate";

const canOpenSplitReviewFromCandidate = (type: string): boolean =>
	type === "split_candidate";

const canCreateRecurringFromCandidate = (type: string): boolean =>
	type === "recurring_candidate";

const isSelfParticipantCandidate = (candidate: DocumentCandidate): boolean => {
	if (candidate.candidate_type !== "participant_placeholder_candidate") {
		return false;
	}
	const data = candidateData(candidate);
	const participantId = firstCandidateText(data, [
		"participant_id",
		"id",
	])?.toLowerCase();
	if (
		participantId === "me" ||
		participantId === "self" ||
		participantId === "current_user"
	) {
		return true;
	}
	const participantType = firstCandidateText(data, [
		"participant_type",
	])?.toLowerCase();
	if (
		participantType === "registered_member" ||
		participantType === "current_user"
	) {
		return true;
	}
	const displayName = firstCandidateText(data, [
		"display_name",
		"name",
		"title",
	])?.toLowerCase();
	return displayName === "me" || displayName === "you" || displayName === "я";
};

const confidenceLabel = (confidence?: number): string =>
	Number.isFinite(confidence) && confidence != null && confidence > 0
		? `${Math.round(confidence * 100)}%`
		: "Review";

const candidateSummary = (
	candidate: BenefitCandidate | DocumentCandidate,
): {
	detail: string;
	fields: Array<{ label: string; value: string }>;
	itemLabels: string[];
} => {
	const data = candidateData(candidate);
	const type = candidate.candidate_type;
	const fields: Array<{ label: string; value: string }> = [];
	if (type === "expense_candidate") {
		const draft = nestedCandidateData(data, ["draft", "data"]);
		const merchant = firstCandidateText(draft, [
			"merchant",
			"merchant_name",
			"vendor",
			"payee",
		]);
		const amount = firstCandidateText(draft, [
			"total",
			"total_amount",
			"amount",
		]);
		appendField(fields, "Merchant", merchant);
		appendField(fields, "Amount", amount);
		appendField(fields, "Currency", firstCandidateText(draft, ["currency"]));
		appendField(
			fields,
			"Date",
			firstCandidateText(draft, ["date", "txn_date"]),
		);
		appendItemsField(fields, draft);
		const itemLabels = candidateItemLabels(draft);
		const itemSummary =
			itemLabels.length > 1
				? `${itemLabels.slice(0, 2).join(", ")}${
						itemLabels.length > 2 ? ` +${itemLabels.length - 2}` : ""
					}`
				: itemLabels[0];
		return {
			detail:
				[merchant || itemSummary, amount].filter(Boolean).join(" • ") ||
				"Expense draft created from this capture",
			fields,
			itemLabels,
		};
	}
	if (type === "expense_item_candidate") {
		const item = nestedCandidateData(data, ["item"]);
		const name =
			firstCandidateText(item, ["name", "title", "description"]) ??
			"Parsed line item";
		appendField(
			fields,
			"Amount",
			firstCandidateText(item, ["amount", "total"]),
		);
		appendField(
			fields,
			"Quantity",
			firstCandidateText(item, ["quantity", "qty"]),
		);
		appendField(
			fields,
			"Unit price",
			firstCandidateText(item, ["unit_price", "price"]),
		);
		return { detail: name, fields, itemLabels: [name] };
	}
	if (type === "promo_code_candidate") {
		const promo = nestedCandidateData(data, ["promo", "coupon"]);
		const code = firstCandidateText(promo, [
			"promo_code",
			"code",
			"coupon",
			"discount_code",
		]);
		appendField(
			fields,
			"Discount",
			firstCandidateText(promo, ["discount_type"]),
		);
		appendField(
			fields,
			"Value",
			firstCandidateText(promo, ["discount_value", "discount_amount", "value"]),
		);
		appendField(fields, "Until", firstCandidateText(promo, ["valid_until"]));
		appendField(
			fields,
			"Redeem",
			firstCandidateText(promo, ["redeem_platform", "redeem_merchant_name"]),
		);
		return {
			detail: code ?? "Promo code needs review",
			fields,
			itemLabels: [],
		};
	}
	if (type === "loyalty_event_candidate") {
		const loyalty = nestedCandidateData(data, ["loyalty", "bonus"]);
		const program = firstCandidateText(loyalty, [
			"program_name",
			"loyalty_program",
			"name",
		]);
		const balance = firstCandidateText(loyalty, [
			"available_balance",
			"points_earned",
			"points_spent",
		]);
		appendField(
			fields,
			"Balance",
			firstCandidateText(loyalty, ["available_balance"]),
		);
		appendField(
			fields,
			"Earned",
			firstCandidateText(loyalty, ["points_earned"]),
		);
		appendField(fields, "Spent", firstCandidateText(loyalty, ["points_spent"]));
		appendField(fields, "Card", firstCandidateText(loyalty, ["card_mask"]));
		return {
			detail:
				[program, balance ? `${balance} points` : null]
					.filter(Boolean)
					.join(" • ") || "Loyalty event needs review",
			fields,
			itemLabels: [],
		};
	}
	if (type === "split_candidate") {
		const strategy = firstCandidateText(data, ["split_strategy", "strategy"]);
		const count = firstCandidateText(data, ["participant_count"]);
		appendField(fields, "Strategy", strategy);
		appendField(fields, "People", count);
		appendField(fields, "Target", "Choose an expense before applying");
		return {
			detail:
				[strategy, count ? `${count} participants` : null]
					.filter(Boolean)
					.join(" • ") || "Split details need review",
			fields,
			itemLabels: [],
		};
	}
	if (type === "participant_placeholder_candidate") {
		const name =
			firstCandidateText(data, ["display_name", "name"]) ??
			"Participant placeholder";
		appendField(fields, "Email", firstCandidateText(data, ["email"]));
		appendField(
			fields,
			"Telegram",
			firstCandidateText(data, ["telegram_username", "telegram"]),
		);
		appendField(fields, "Type", firstCandidateText(data, ["participant_type"]));
		return { detail: name, fields, itemLabels: [] };
	}
	if (type === "payment_proof_candidate") {
		const payment = nestedCandidateData(data, ["payment_proof", "payment"]);
		appendField(fields, "Amount", firstCandidateText(payment, ["amount"]));
		appendField(fields, "Card", firstCandidateText(payment, ["card_last4"]));
		appendField(fields, "RRN", firstCandidateText(payment, ["rrn"]));
		appendField(
			fields,
			"Terminal",
			firstCandidateText(payment, ["terminal_id"]),
		);
		return {
			detail:
				firstCandidateText(payment, [
					"merchant_text",
					"amount",
					"card_last4",
					"rrn",
				]) ?? "Payment proof needs review",
			fields,
			itemLabels: [],
		};
	}
	if (type === "recurring_candidate") {
		const recurring = nestedCandidateData(data, [
			"recurring",
			"recurring_candidate",
			"renewal_candidate",
		]);
		const service = firstCandidateText(recurring, [
			"service_name",
			"service",
			"merchant_name",
			"vendor_name",
		]);
		const nextDue = firstCandidateText(recurring, [
			"next_due",
			"renewal_date",
			"due_date",
		]);
		const interval = firstCandidateText(recurring, ["interval", "frequency"]);
		appendField(fields, "Next due", nextDue);
		appendField(fields, "Interval", interval);
		appendField(fields, "Amount", firstCandidateText(recurring, ["amount"]));
		appendField(
			fields,
			"Currency",
			firstCandidateText(recurring, ["currency"]),
		);
		return {
			detail:
				[service, interval, nextDue ? `next ${nextDue}` : null]
					.filter(Boolean)
					.join(" • ") || "Recurring payment hint needs review",
			fields,
			itemLabels: [],
		};
	}
	if (type === "membership_candidate") {
		const membership = nestedCandidateData(data, [
			"membership",
			"membership_candidate",
		]);
		const service = firstCandidateText(membership, [
			"service_name",
			"service",
			"title",
			"merchant_name",
			"vendor_name",
		]);
		const periodEnd = firstCandidateText(membership, [
			"period_end",
			"end_date",
			"renewal_date",
		]);
		const duration = firstCandidateText(membership, [
			"duration",
			"service_period",
			"membership_period",
		]);
		appendField(
			fields,
			"Merchant",
			firstCandidateText(membership, [
				"merchant_name",
				"vendor_name",
				"merchant",
				"payee",
			]),
		);
		appendField(
			fields,
			"Start",
			firstCandidateText(membership, ["period_start", "start_date"]),
		);
		appendField(fields, "End", periodEnd);
		appendField(
			fields,
			"Renewal",
			firstCandidateText(membership, ["renewal_date", "next_due"]),
		);
		appendField(fields, "Amount", firstCandidateText(membership, ["amount"]));
		return {
			detail:
				[service, duration, periodEnd ? `ends ${periodEnd}` : null]
					.filter(Boolean)
					.join(" • ") || "Membership period hint needs review",
			fields,
			itemLabels: [],
		};
	}
	if (type === "reminder_candidate") {
		const reminder = nestedCandidateData(data, [
			"reminder",
			"reminder_candidate",
		]);
		const title = firstCandidateText(reminder, [
			"title",
			"service_name",
			"merchant_name",
			"reason",
		]);
		const due = firstCandidateText(reminder, [
			"reminder_at",
			"due_at",
			"due_date",
			"next_due",
			"renewal_date",
		]);
		appendField(fields, "Due", due);
		appendField(fields, "Action", firstCandidateText(reminder, ["action"]));
		appendField(fields, "Reason", firstCandidateText(reminder, ["reason"]));
		return {
			detail:
				[title, due ? `due ${due}` : null].filter(Boolean).join(" • ") ||
				"Reminder hint needs review",
			fields,
			itemLabels: [],
		};
	}
	if (type === "merge_candidate") {
		appendField(fields, "Action", firstCandidateText(data, ["action"]));
		return { detail: "Attach to an existing record", fields, itemLabels: [] };
	}
	if (type === "supporting_document_candidate") {
		appendField(fields, "Role", firstCandidateText(data, ["document_role"]));
		return { detail: "Keep as supporting proof", fields, itemLabels: [] };
	}
	return {
		detail: "Review before anything becomes final.",
		fields,
		itemLabels: [],
	};
};

const toCandidateReviewItem = (
	source: CandidateReviewSource,
	candidate: BenefitCandidate | DocumentCandidate,
): CandidateReviewItem => {
	const summary = candidateSummary(candidate);
	const isSelfParticipant =
		source === "document" &&
		isSelfParticipantCandidate(candidate as DocumentCandidate);
	const status = candidate.status?.trim() || "draft";
	const isDraft = status.toLowerCase() === "draft";
	const fallbackLabel = documentCandidateLabel(candidate.candidate_type);
	const rawTitle = candidate.title?.trim() || "";
	const isTechnicalTitle =
		rawTitle === "" ||
		rawTitle.toLowerCase() === fallbackLabel.toLowerCase() ||
		rawTitle.toLowerCase().endsWith(" candidate");
	return {
		id: Number(candidate.id),
		sourceDocumentId: Number(candidate.source_document_id),
		source,
		candidateType: candidate.candidate_type,
		status,
		label: fallbackLabel,
		title: isTechnicalTitle
			? summary.detail || candidate.merchant_text?.trim() || fallbackLabel
			: rawTitle,
		meta:
			source === "document"
				? documentCandidateMeta(candidate as DocumentCandidate)
				: [
						(candidate as BenefitCandidate).source_type,
						(candidate as BenefitCandidate).input_kind,
						(candidate as BenefitCandidate).merchant_text,
					]
						.map((value) => value?.trim())
						.filter(Boolean)
						.join(" • ") || "Benefits intelligence",
		sourceType: candidate.source_type,
		inputKind: candidate.input_kind,
		documentType: candidate.document_type,
		merchantText: candidate.merchant_text,
		projectedExpenseId:
			source === "document"
				? (candidate as DocumentCandidate).projected_expense_id
				: null,
		detail: summary.detail,
		fields: summary.fields,
		itemLabels: summary.itemLabels,
		tone: candidateTone(candidate.candidate_type),
		confidenceLabel: confidenceLabel(candidate.confidence),
		canMarkReviewed:
			isDraft &&
			source === "document" &&
			(isSelfParticipant ||
				canMarkDocumentCandidateReviewed(candidate.candidate_type)),
		canCreateParticipant:
			isDraft &&
			source === "document" &&
			canCreateParticipantFromCandidate(candidate.candidate_type) &&
			!isSelfParticipant,
		canCreateRecurring:
			isDraft &&
			source === "document" &&
			canCreateRecurringFromCandidate(candidate.candidate_type),
		canOpenSplitReview:
			isDraft &&
			source === "document" &&
			canOpenSplitReviewFromCandidate(candidate.candidate_type),
		canSavePromo:
			isDraft && candidate.candidate_type === "promo_code_candidate",
		isSelfParticipant,
		createdAt: candidate.created_at,
		raw: candidate,
	};
};

const packetPrimaryActionLabel = (counts: CapturePacket["counts"]): string =>
	counts.splits
		? "Review capture"
		: counts.benefits && !counts.expenses
			? "Review benefits"
			: counts.future && !counts.expenses
				? "Review hints"
				: "Review capture";

const memberDisplayLabel = (member: SpaceMember): string =>
	member.name?.trim() || member.email?.trim() || `user #${member.user_id}`;

const buildMemberLabelMap = (
	members: SpaceMember[] | null | undefined,
): Map<number, string> => {
	const labels = new Map<number, string>();
	for (const member of members ?? []) {
		if (Number.isFinite(Number(member.user_id))) {
			labels.set(Number(member.user_id), memberDisplayLabel(member));
		}
	}
	return labels;
};

const buildCapturePacketsFromCandidates = (
	candidates: CandidateReviewItem[],
): CapturePacket[] =>
	buildCapturePacketSummaries(candidates, {
		getSourceDocumentId: (candidate) => candidate.sourceDocumentId,
		getCandidateType: (candidate) => candidate.candidateType,
		getCreatedAt: (candidate) => candidate.createdAt,
		getTitle: (candidate, sourceDocumentId) =>
			candidate.merchantText?.trim() ||
			candidate.title ||
			`Capture ${sourceDocumentId}`,
		getMeta: (candidate) =>
			captureInputMetaLabel(
				candidate.inputKind,
				candidate.sourceType,
				candidate.documentType,
			),
	}).map((packet) => {
		const { counts } = packet;
		return {
			sourceDocumentId: packet.sourceDocumentId,
			createdByUserId: null,
			title: packet.title,
			meta: packet.meta,
			createdAt: packet.createdAt,
			candidates: packet.candidates,
			candidateCount: packet.candidates.length,
			pendingCount: packet.candidates.filter(
				(candidate) => candidate.status === "draft",
			).length,
			projectedCount: packet.candidates.filter(
				(candidate) => candidate.status === "projected",
			).length,
			ignoredCount: packet.candidates.filter(
				(candidate) => candidate.status === "ignored",
			).length,
			primaryActionLabel: packetPrimaryActionLabel(counts),
			summary: capturePacketSummaryLine(counts),
			counts,
		};
	});

const apiCapturePacketRecordCount = (packet: ApiCapturePacket): number =>
	(packet.records?.expenses?.length ?? 0) +
	(packet.records?.expenses ?? []).reduce(
		(total, expense) => total + (expense.items?.length ?? 0),
		0,
	) +
	(packet.records?.benefits?.length ?? 0) +
	(packet.records?.participants?.length ?? 0) +
	(packet.records?.splits?.length ?? 0) +
	(packet.records?.recurring?.length ?? 0);

const buildCapturePackets = (
	candidates: CandidateReviewItem[],
	apiPackets: ApiCapturePacket[],
	memberLabels: Map<number, string>,
): CapturePacket[] => {
	const candidatePackets = buildCapturePacketsFromCandidates(candidates);
	const candidatePacketsBySourceDocument = new Map(
		candidatePackets.map((packet) => [packet.sourceDocumentId, packet]),
	);
	const packets: CapturePacket[] = apiPackets
		.filter(
			(packet) =>
				Number(packet.pending_count ?? 0) > 0 ||
				Number(packet.candidate_count ?? 0) > 0 ||
				Number(packet.projected_count ?? 0) > 0 ||
				apiCapturePacketRecordCount(packet) > 0,
		)
		.map((packet) => {
			const summary = capturePacketSummaryFromApi(packet);
			const detailed = candidatePacketsBySourceDocument.get(
				summary.sourceDocumentId,
			);
			candidatePacketsBySourceDocument.delete(summary.sourceDocumentId);
			return {
				sourceDocumentId: summary.sourceDocumentId,
				createdByUserId: packet.created_by_user_id ?? null,
				createdByLabel:
					packet.created_by_user_id != null
						? (memberLabels.get(Number(packet.created_by_user_id)) ?? null)
						: null,
				title: summary.title,
				meta: summary.meta,
				createdAt: summary.createdAt,
				candidates: detailed?.candidates ?? [],
				candidateCount:
					Number(packet.candidate_count ?? 0) ||
					Number(packet.pending_count ?? 0) ||
					detailed?.candidates.length ||
					0,
				pendingCount: Number(packet.pending_count ?? 0),
				projectedCount: Number(packet.projected_count ?? 0),
				ignoredCount: Number(packet.ignored_count ?? 0),
				records: packet.records,
				primaryActionLabel: packetPrimaryActionLabel(summary.counts),
				summary: summary.summary,
				counts: summary.counts,
			};
		});
	return [...packets, ...candidatePacketsBySourceDocument.values()].sort(
		(a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
	);
};

const captureQueueHref = (spaceId: number, sourceDocumentId: number): string =>
	`/console/review?spaceId=${spaceId}&sourceDocumentId=${sourceDocumentId}`;

const sourceFromExpense = (
	tx: Transaction | undefined,
): ReviewItem["source"] => {
	const blob = `${tx?.description ?? ""} ${tx?.title ?? ""}`.toLowerCase();
	if (
		blob.includes("receipt") ||
		blob.includes("invoice") ||
		blob.includes("scan")
	)
		return "receipt";
	if (
		blob.includes("voice") ||
		blob.includes("audio") ||
		blob.includes("transcript")
	)
		return "voice";
	if (blob.includes("chat")) return "chat";
	return "manual";
};

const humanTitle = (tx?: Transaction, fallback?: string) => {
	const title = (tx?.title ?? fallback ?? "").trim();
	if (title && title.toLowerCase() !== "expense") return title;
	const firstLine = (tx?.items ?? [])
		.map((it) => (it.name ?? "").trim())
		.find(Boolean);
	if (firstLine) return firstLine;
	const descLine = (tx?.description ?? "")
		.split(/\r?\n/)
		.map((l) => l.trim())
		.find(Boolean);
	return descLine || title || "Expense";
};

const splitMethodFromRows = (
	rows: ExpenseSplitRow[],
): ReviewItem["splitMethod"] => {
	if (rows.length <= 1) return "manual";
	const base = rows[0]?.amount ?? 0;
	return rows.every((r) => Math.abs(r.amount - base) < 0.0001)
		? "equal"
		: "custom";
};

const tagName = (tag: { name?: string } | string): string | null => {
	if (typeof tag === "string") return tag.trim() || null;
	return tag.name?.trim() || null;
};

const isString = (value: string | null): value is string => Boolean(value);

export const CeitsReviewFlowPage = () => {
	const { spaces, selectedSpaceId, setSelectedSpaceId } = useWorkspaceSpaces();
	const { formatMoney } = useUserFormat();
	const [searchParams, setSearchParams] = useSearchParams();
	const [queueLoading, setQueueLoading] = useState(true);
	const [candidateLoading, setCandidateLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [queue, setQueue] = useState<ReviewItem[]>([]);
	const [documentCandidates, setDocumentCandidates] = useState<
		DocumentCandidate[]
	>([]);
	const [benefitCandidates, setBenefitCandidates] = useState<
		BenefitCandidate[]
	>([]);
	const [spaceCapturePackets, setSpaceCapturePackets] = useState<
		ApiCapturePacket[]
	>([]);
	const [spaceMembers, setSpaceMembers] = useState<SpaceMember[]>([]);
	const [documentCandidateError, setDocumentCandidateError] = useState<
		string | null
	>(null);
	const [documentCandidateActingId, setDocumentCandidateActingId] = useState<
		number | null
	>(null);
	const [benefitCandidateActingId, setBenefitCandidateActingId] = useState<
		number | null
	>(null);
	const [deletingSourceDocumentId, setDeletingSourceDocumentId] = useState<
		number | null
	>(null);
	const [finishingSourceDocumentId, setFinishingSourceDocumentId] = useState<
		number | null
	>(null);
	const [splitCandidateTargets, setSplitCandidateTargets] = useState<
		Record<number, number>
	>({});

	const spaceIdParam = searchParams.get("spaceId");
	const spaceId =
		spaceIdParam != null
			? Number(spaceIdParam)
			: selectedSpaceId != null
				? Number(selectedSpaceId)
				: null;
	const sourceDocumentIdParam =
		searchParams.get("sourceDocumentId") ??
		searchParams.get("source_document_id");
	const focusedSourceDocumentId =
		sourceDocumentIdParam != null &&
		Number.isFinite(Number(sourceDocumentIdParam))
			? Number(sourceDocumentIdParam)
			: null;
	const expenseIdParam =
		searchParams.get("expenseId") ?? searchParams.get("expense_id");
	const focusedExpenseId =
		expenseIdParam != null && Number.isFinite(Number(expenseIdParam))
			? Number(expenseIdParam)
			: null;
	const activeSpace: Space | null = useMemo(() => {
		if (spaces == null || spaceId == null) return null;
		return spaces.find((s) => Number(s.id) === Number(spaceId)) ?? null;
	}, [spaces, spaceId]);

	useConsoleHeaderTitle("Capture Review", activeSpace?.name ?? null);

	useEffect(() => {
		if (spaceId != null && Number.isFinite(spaceId))
			setSelectedSpaceId(spaceId);
	}, [spaceId, setSelectedSpaceId]);

	useEffect(() => {
		if (spaceId == null || !Number.isFinite(spaceId)) return;
		let cancelled = false;
		setQueueLoading(true);
		setError(null);
		void (async () => {
			try {
				const [dash, tx] = await Promise.all([
					apiClient.dashboard.get({
						variant: "personal",
						period: "month",
						space_id: spaceId,
					}),
					apiClient.spaces.expenses.list(spaceId, { limit: 120 }),
				]);

				const txById = new Map<number, Transaction>(
					tx
						.map((t) => [Number(t.id), t])
						.filter((e): e is [number, Transaction] => Number.isFinite(e[0])),
				);
				const draftItems = (dash.pending_drafts ?? [])
					.filter((d) => Number(d.space_id) === Number(spaceId))
					.filter((d): d is DashboardPendingDraft =>
						Number.isFinite(Number(d.id)),
					);
				const needsConfirmationIds = tx
					.filter((t) => {
						const s = (t.status ?? "").toLowerCase();
						return (
							s.includes("review") ||
							s.includes("question") ||
							(s.includes("pending") && !s.includes("draft"))
						);
					})
					.map((t) => Number(t.id))
					.filter(Number.isFinite);

				const built: ReviewItem[] = [];

				for (const draft of draftItems) {
					const id = Number(draft.id);
					const tr = txById.get(id);
					const source = sourceFromExpense(tr);
					const linePreview = (tr?.items ?? []).slice(0, 3).map((it) => ({
						name: it.name,
						amount: Number(it.amount) || 0,
					}));
					built.push({
						id: `draft-${id}`,
						kind: "draft",
						expenseId: id,
						spaceId: Number(spaceId),
						spaceName: draft.space_name || activeSpace?.name || "Space",
						title: humanTitle(tr, draft.label || "Draft expense"),
						amount: Number(tr?.total ?? draft.total ?? 0),
						status: (tr?.status ?? "draft").toString(),
						dateLabel: tr?.txn_date ?? draft.updated_at ?? "—",
						source,
						confidenceLabel: source === "manual" ? "Medium" : "High",
						confidenceReason:
							source === "manual"
								? "Manual draft with parsed lines."
								: "Ceits parsed receipt/voice details with structured lines.",
						summaryReason:
							"Approving records this draft and applies split logic.",
						whoAffected: `People in ${activeSpace?.name ?? "this space"}.`,
						tags: (tr?.items ?? [])
							.flatMap((it) => (it.tags ?? []).map(tagName))
							.filter(isString)
							.slice(0, 5),
						linePreview,
						splits: [],
						splitMethod: "manual",
						isDraftLike: true,
						detailsLoaded: false,
					});
				}

				for (const id of needsConfirmationIds) {
					if (built.some((b) => b.expenseId === id)) continue;
					const tr = txById.get(id);
					if (!tr) continue;
					const source = sourceFromExpense(tr);
					built.push({
						id: `needs-${id}`,
						kind: "needs_confirmation",
						expenseId: id,
						spaceId: Number(spaceId),
						spaceName: activeSpace?.name ?? "Space",
						title: humanTitle(tr, "Needs confirmation"),
						amount: Number(tr.total ?? 0),
						status: tr.status ?? "needs confirmation",
						dateLabel: tr.txn_date ?? "—",
						source,
						confidenceLabel: "Medium",
						confidenceReason: "This item has unresolved confirmation signals.",
						summaryReason:
							"Confirming finalizes this record and clears review pressure.",
						whoAffected: `People sharing ${activeSpace?.name ?? "this space"}.`,
						tags: (tr.items ?? [])
							.flatMap((it) => (it.tags ?? []).map(tagName))
							.filter(isString)
							.slice(0, 5),
						linePreview: (tr.items ?? []).slice(0, 3).map((it) => ({
							name: it.name,
							amount: Number(it.amount) || 0,
						})),
						splits: [],
						splitMethod: "manual",
						isDraftLike: false,
						detailsLoaded: false,
					});
				}

				if (!cancelled) {
					setQueue(built);
				}
			} catch (e) {
				if (!cancelled)
					setError(
						e instanceof Error ? e.message : "Failed to load capture queue",
					);
			} finally {
				if (!cancelled) setQueueLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [spaceId, activeSpace?.name]);

	useEffect(() => {
		if (spaceId == null || !Number.isFinite(spaceId)) return;
		let cancelled = false;
		setCandidateLoading(true);
		setDocumentCandidateError(null);
		setSpaceCapturePackets([]);
		setSpaceMembers([]);
		void (async () => {
			try {
				const [
					capturePacketRes,
					benefitCandidateRes,
					documentCandidateRes,
					membersRes,
				] = await Promise.all([
					apiClient.spaces
						.listCapturePackets(spaceId, {
							includeRecords: true,
							limit: 50,
							sourceDocumentId: focusedSourceDocumentId ?? undefined,
						})
						.catch(() => null),
					apiClient.spaces.review
						.listBenefitCandidates(spaceId, {
							limit: 50,
							sourceDocumentId: focusedSourceDocumentId ?? undefined,
						})
						.catch(() => null),
					apiClient.spaces.review
						.listDocumentCandidates(spaceId, {
							limit: 50,
							sourceDocumentId: focusedSourceDocumentId ?? undefined,
						})
						.catch(() => null),
					apiClient.spaces.listMembers(spaceId).catch(() => null),
				]);

				if (!cancelled) {
					setSpaceCapturePackets(capturePacketRes?.captures ?? []);
					setBenefitCandidates(benefitCandidateRes?.candidates ?? []);
					setDocumentCandidates(documentCandidateRes?.candidates ?? []);
					setSpaceMembers(membersRes?.members ?? []);
					if (
						capturePacketRes == null ||
						benefitCandidateRes == null ||
						documentCandidateRes == null
					) {
						setDocumentCandidateError(
							"Some capture review data could not be loaded. Expense review is still available.",
						);
					}
				}
			} catch (e) {
				if (!cancelled) {
					setSpaceCapturePackets([]);
					setSpaceMembers([]);
					setBenefitCandidates([]);
					setDocumentCandidates([]);
					setDocumentCandidateError(
						e instanceof Error
							? e.message
							: "Failed to load capture candidates",
					);
				}
			} finally {
				if (!cancelled) setCandidateLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [spaceId, focusedSourceDocumentId]);

	const sourceDocumentIdFromExpenseId = useMemo(() => {
		if (focusedSourceDocumentId != null || focusedExpenseId == null) {
			return null;
		}
		for (const packet of spaceCapturePackets) {
			const packetSourceDocumentId = Number(packet.source_document_id);
			if (
				!Number.isFinite(packetSourceDocumentId) ||
				packetSourceDocumentId <= 0
			) {
				continue;
			}
			const hasExpenseRecord = (packet.records?.expenses ?? []).some(
				(expense) => Number(expense.id) === focusedExpenseId,
			);
			const hasSplitRecord = (packet.records?.splits ?? []).some(
				(split) => Number(split.expense_id) === focusedExpenseId,
			);
			if (hasExpenseRecord || hasSplitRecord) return packetSourceDocumentId;
		}
		for (const candidate of documentCandidates) {
			if (Number(candidate.projected_expense_id) !== focusedExpenseId) {
				continue;
			}
			const sourceDocumentId = Number(candidate.source_document_id);
			if (Number.isFinite(sourceDocumentId) && sourceDocumentId > 0) {
				return sourceDocumentId;
			}
		}
		return null;
	}, [
		documentCandidates,
		focusedExpenseId,
		focusedSourceDocumentId,
		spaceCapturePackets,
	]);

	const effectiveFocusedSourceDocumentId =
		focusedSourceDocumentId ?? sourceDocumentIdFromExpenseId;
	const hasExpenseReviewFallback =
		focusedExpenseId != null && effectiveFocusedSourceDocumentId == null;

	useEffect(() => {
		if (
			focusedSourceDocumentId != null ||
			sourceDocumentIdFromExpenseId == null
		) {
			return;
		}
		const next = new URLSearchParams(searchParams);
		next.set("sourceDocumentId", String(sourceDocumentIdFromExpenseId));
		next.delete("source_document_id");
		next.delete("expenseId");
		next.delete("expense_id");
		setSearchParams(next, { replace: true });
	}, [
		focusedSourceDocumentId,
		searchParams,
		setSearchParams,
		sourceDocumentIdFromExpenseId,
	]);

	const captureCandidates = useMemo(() => {
		const seen = new Set<string>();
		return [
			...documentCandidates.map((candidate) =>
				toCandidateReviewItem("document", candidate),
			),
			...benefitCandidates.map((candidate) =>
				toCandidateReviewItem("benefit", candidate),
			),
		]
			.filter((candidate) => {
				const key = `${candidate.sourceDocumentId}:${candidate.candidateType}:${candidate.id}`;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.sort((a, b) => {
				const left = Date.parse(a.createdAt);
				const right = Date.parse(b.createdAt);
				if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
				if (!Number.isFinite(left)) return 1;
				if (!Number.isFinite(right)) return -1;
				return right - left;
			});
	}, [benefitCandidates, documentCandidates]);
	const memberLabels = useMemo(
		() => buildMemberLabelMap(spaceMembers),
		[spaceMembers],
	);
	const capturePackets = useMemo(
		() =>
			buildCapturePackets(captureCandidates, spaceCapturePackets, memberLabels),
		[captureCandidates, spaceCapturePackets, memberLabels],
	);
	const captureSummary = useMemo(
		() =>
			capturePackets.reduce(
				(summary, packet) => ({
					total: summary.total + 1,
					candidates:
						summary.candidates +
						(packet.candidateCount ?? packet.candidates.length),
					expenses: summary.expenses + packet.counts.expenses,
					benefits: summary.benefits + packet.counts.benefits,
					people: summary.people + packet.counts.people,
					splits: summary.splits + packet.counts.splits,
					future: summary.future + packet.counts.future,
					documents: summary.documents + packet.counts.documents,
				}),
				{
					total: 0,
					candidates: 0,
					expenses: 0,
					benefits: 0,
					people: 0,
					splits: 0,
					future: 0,
					documents: 0,
				},
			),
		[capturePackets],
	);
	const isReviewLoading = queueLoading || candidateLoading;
	const splitTargetOptions = useMemo<SplitTargetOption[]>(() => {
		const seen = new Set<number>();
		return queue
			.filter((item) => {
				if (seen.has(item.expenseId)) return false;
				seen.add(item.expenseId);
				return true;
			})
			.map((item) => ({
				expenseId: item.expenseId,
				label: `${item.title} · ${formatMoney(item.amount)}`,
			}));
	}, [queue, formatMoney]);
	const splitTargetExpenseIdFor = (
		candidate: CandidateReviewItem,
	): number | null => {
		const explicit = splitCandidateTargets[candidate.id];
		if (
			explicit != null &&
			Number.isFinite(explicit) &&
			splitTargetOptions.some((option) => option.expenseId === explicit)
		) {
			return explicit;
		}
		const projectedExpenseId =
			candidate.source === "document"
				? (candidate.raw as DocumentCandidate).projected_expense_id
				: null;
		if (
			projectedExpenseId != null &&
			Number.isFinite(projectedExpenseId) &&
			splitTargetOptions.some(
				(option) => option.expenseId === projectedExpenseId,
			)
		) {
			return projectedExpenseId;
		}
		return splitTargetOptions[0]?.expenseId ?? null;
	};
	const pendingParticipantsBySourceDocument = useMemo(() => {
		const counts = new Map<number, number>();
		for (const candidate of documentCandidates) {
			if (candidate.candidate_type !== "participant_placeholder_candidate")
				continue;
			if (isSelfParticipantCandidate(candidate)) continue;
			counts.set(
				candidate.source_document_id,
				(counts.get(candidate.source_document_id) ?? 0) + 1,
			);
		}
		return counts;
	}, [documentCandidates]);
	const pendingParticipantCountForSplitCandidate = (
		candidate: CandidateReviewItem,
	): number => {
		if (!candidate.canOpenSplitReview || candidate.source !== "document") {
			return 0;
		}
		return (
			pendingParticipantsBySourceDocument.get(
				(candidate.raw as DocumentCandidate).source_document_id,
			) ?? 0
		);
	};

	const handleIgnoreDocumentCandidate = async (
		candidate: DocumentCandidate,
	) => {
		if (spaceId == null) return;
		setDocumentCandidateActingId(candidate.id);
		setDocumentCandidateError(null);
		try {
			await apiClient.spaces.review.ignoreDocumentCandidate(
				spaceId,
				candidate.id,
			);
			setDocumentCandidates((prev) =>
				prev.filter((item) => item.id !== candidate.id),
			);
		} catch (e) {
			setDocumentCandidateError(
				e instanceof Error ? e.message : "Failed to ignore document candidate",
			);
		} finally {
			setDocumentCandidateActingId(null);
		}
	};

	const handleConfirmDocumentCandidate = async (
		candidate: DocumentCandidate,
	) => {
		if (spaceId == null) return;
		setDocumentCandidateActingId(candidate.id);
		setDocumentCandidateError(null);
		try {
			await apiClient.spaces.review.confirmDocumentCandidate(
				spaceId,
				candidate.id,
			);
			setDocumentCandidates((prev) =>
				prev.filter((item) => item.id !== candidate.id),
			);
		} catch (e) {
			setDocumentCandidateError(
				e instanceof Error ? e.message : "Failed to mark candidate reviewed",
			);
		} finally {
			setDocumentCandidateActingId(null);
		}
	};

	const handleCreateParticipantCandidate = async (
		candidate: DocumentCandidate,
	) => {
		if (spaceId == null) return;
		setDocumentCandidateActingId(candidate.id);
		setDocumentCandidateError(null);
		try {
			await apiClient.spaces.review.createParticipantFromCandidate(
				spaceId,
				candidate.id,
			);
			setDocumentCandidates((prev) =>
				prev.filter((item) => item.id !== candidate.id),
			);
		} catch (e) {
			setDocumentCandidateError(
				e instanceof Error ? e.message : "Failed to create participant",
			);
		} finally {
			setDocumentCandidateActingId(null);
		}
	};

	const handleApplySplitCandidate = async (
		candidate: DocumentCandidate,
		targetExpenseId: number | null,
	) => {
		if (spaceId == null) return;
		if (targetExpenseId == null || !Number.isFinite(targetExpenseId)) {
			setDocumentCandidateError(
				"Choose an expense before applying this split.",
			);
			return;
		}
		setDocumentCandidateActingId(candidate.id);
		setDocumentCandidateError(null);
		try {
			await apiClient.spaces.review.applySplitCandidate(spaceId, candidate.id, {
				expense_id: targetExpenseId,
			});
			const updatedSplits =
				(await apiClient.spaces.expenses
					.listSplits(spaceId, targetExpenseId)
					.then((res) => res.splits ?? [])
					.catch(() => null)) ?? null;
			setDocumentCandidates((prev) =>
				prev.filter((item) => item.id !== candidate.id),
			);
			if (updatedSplits != null) {
				setQueue((prev) =>
					prev.map((item) =>
						item.expenseId === targetExpenseId
							? {
									...item,
									splits: updatedSplits,
									splitMethod: splitMethodFromRows(updatedSplits),
									detailsLoaded: true,
									detailsLoading: false,
								}
							: item,
					),
				);
			}
		} catch (e) {
			setDocumentCandidateError(
				e instanceof Error ? e.message : "Failed to apply split candidate",
			);
		} finally {
			setDocumentCandidateActingId(null);
		}
	};

	const handleCreateRecurringCandidate = async (
		candidate: DocumentCandidate,
	) => {
		if (spaceId == null) return;
		setDocumentCandidateActingId(candidate.id);
		setDocumentCandidateError(null);
		try {
			await apiClient.spaces.review.createRecurringFromCandidate(
				spaceId,
				candidate.id,
			);
			setDocumentCandidates((prev) =>
				prev.filter((item) => item.id !== candidate.id),
			);
		} catch (e) {
			setDocumentCandidateError(
				e instanceof Error ? e.message : "Failed to create recurring schedule",
			);
		} finally {
			setDocumentCandidateActingId(null);
		}
	};

	const handleSavePromoCandidate = async (candidate: BenefitCandidate) => {
		if (spaceId == null) return;
		setBenefitCandidateActingId(candidate.id);
		setDocumentCandidateError(null);
		try {
			await apiClient.spaces.review.saveBenefitCandidatePromo(
				spaceId,
				candidate.id,
			);
			setBenefitCandidates((prev) =>
				prev.filter((item) => item.id !== candidate.id),
			);
		} catch (e) {
			setDocumentCandidateError(
				e instanceof Error ? e.message : "Failed to save promo candidate",
			);
		} finally {
			setBenefitCandidateActingId(null);
		}
	};

	const handleFinishCaptureReview = async (packet: CapturePacket) => {
		if (spaceId == null) return;
		const existingExpenses = packet.records?.expenses ?? [];
		const hadExistingExpenses = existingExpenses.length > 0;
		let reviewExpenses = [...existingExpenses];
		let draftExpenses = existingExpenses.filter(
			(expense) => expense.status.trim().toLowerCase() === "draft",
		);
		setFinishingSourceDocumentId(packet.sourceDocumentId);
		setDocumentCandidateError(null);
		try {
			for (const candidate of packet.candidates.filter(
				(item) => item.canCreateParticipant,
			)) {
				await apiClient.spaces.review.createParticipantFromCandidate(
					spaceId,
					candidate.id,
				);
			}
			for (const candidate of packet.candidates.filter(
				(item) => item.canSavePromo,
			)) {
				await apiClient.spaces.review.saveBenefitCandidatePromo(
					spaceId,
					candidate.id,
				);
			}
			for (const candidate of packet.candidates.filter(
				(item) => item.canCreateRecurring,
			)) {
				await apiClient.spaces.review.createRecurringFromCandidate(
					spaceId,
					candidate.id,
				);
			}
			for (const candidate of packet.candidates.filter(
				(item) =>
					item.canMarkReviewed &&
					item.candidateType !== "expense_candidate" &&
					item.candidateType !== "expense_item_candidate",
			)) {
				await apiClient.spaces.review.confirmDocumentCandidate(
					spaceId,
					candidate.id,
				);
			}
			if (!reviewExpenses.length) {
				const draftItems = packet.candidates.flatMap((candidate) =>
					draftItemsFromExpenseCandidate(candidate),
				);
				const uniqueItems = Array.from(
					new Map(
						draftItems.map((item) => [
							`${item.name.toLowerCase()}:${item.amount}`,
							item,
						]),
					).values(),
				);
				if (!uniqueItems.length) {
					throw new Error(
						"No expense items are available to save from this capture.",
					);
				}
				const created = await createManualDraftInSpace(
					spaceId,
					packet.title,
					uniqueItems,
					{ sourceDocumentId: packet.sourceDocumentId },
				);
				const createdExpenseId = Number(
					(created.data as { expense?: { id?: string | number } } | undefined)
						?.expense?.id,
				);
				if (!Number.isFinite(createdExpenseId) || createdExpenseId <= 0) {
					throw new Error(
						"Expense was created but no expense id was returned.",
					);
				}
				const createdExpense = {
					id: createdExpenseId,
					title: packet.title,
					status: "draft",
					currency: "RUB",
					txn_date: new Date().toISOString().slice(0, 10),
					total_amount: uniqueItems.reduce(
						(total, item) => total + item.amount,
						0,
					),
					created_by_user_id: 0,
				};
				reviewExpenses = [createdExpense];
				draftExpenses = [createdExpense];
			}
			for (const expense of draftExpenses) {
				await apiClient.spaces.expenses.confirm(spaceId, expense.id);
			}
			if (hadExistingExpenses) {
				for (const candidate of packet.candidates.filter(
					(item) =>
						item.status === "draft" &&
						item.candidateType === "expense_item_candidate",
				)) {
					await apiClient.spaces.review.confirmDocumentCandidate(
						spaceId,
						candidate.id,
					);
				}
			}
			const targetExpense = reviewExpenses[0];
			if (!targetExpense) {
				throw new Error("No expense is available for this review.");
			}
			for (const candidate of packet.candidates.filter(
				(item) => item.canOpenSplitReview,
			)) {
				await apiClient.spaces.review.applySplitCandidate(
					spaceId,
					candidate.id,
					{
						expense_id: targetExpense.id,
					},
				);
			}
			const confirmedIds = new Set(reviewExpenses.map((expense) => expense.id));
			const refreshedCapture = await apiClient.spaces
				.listCapturePackets(spaceId, {
					includeRecords: true,
					limit: 1,
					sourceDocumentId: packet.sourceDocumentId,
				})
				.catch(() => null);
			if (refreshedCapture?.captures?.length) {
				setSpaceCapturePackets((prev) => {
					const nextPacket = refreshedCapture.captures[0];
					const found = prev.some(
						(item) =>
							Number(item.source_document_id) ===
							Number(nextPacket.source_document_id),
					);
					return found
						? prev.map((item) =>
								Number(item.source_document_id) ===
								Number(nextPacket.source_document_id)
									? nextPacket
									: item,
							)
						: [nextPacket, ...prev];
				});
			} else {
				setSpaceCapturePackets((prev) =>
					prev.map((capturePacket) =>
						Number(capturePacket.source_document_id) !==
						Number(packet.sourceDocumentId)
							? capturePacket
							: {
									...capturePacket,
									records: capturePacket.records
										? {
												...capturePacket.records,
												expenses: (capturePacket.records.expenses ?? []).map(
													(expense) =>
														confirmedIds.has(expense.id)
															? { ...expense, status: "approved" }
															: expense,
												),
											}
										: capturePacket.records,
								},
					),
				);
			}
			setDocumentCandidates((prev) =>
				prev.filter(
					(candidate) =>
						Number(candidate.source_document_id) !==
						Number(packet.sourceDocumentId),
				),
			);
			setBenefitCandidates((prev) =>
				prev.filter(
					(candidate) =>
						Number(candidate.source_document_id) !==
						Number(packet.sourceDocumentId),
				),
			);
			setQueue((prev) =>
				prev.map((item) =>
					confirmedIds.has(item.expenseId)
						? { ...item, status: "approved", isDraftLike: false }
						: item,
				),
			);
		} catch (e) {
			setDocumentCandidateError(
				e instanceof Error ? e.message : "Failed to save review",
			);
		} finally {
			setFinishingSourceDocumentId(null);
		}
	};

	const handleIgnoreBenefitCandidate = async (candidate: BenefitCandidate) => {
		if (spaceId == null) return;
		setBenefitCandidateActingId(candidate.id);
		setDocumentCandidateError(null);
		try {
			await apiClient.spaces.review.ignoreBenefitCandidate(
				spaceId,
				candidate.id,
			);
			setBenefitCandidates((prev) =>
				prev.filter((item) => item.id !== candidate.id),
			);
		} catch (e) {
			setDocumentCandidateError(
				e instanceof Error ? e.message : "Failed to ignore benefit candidate",
			);
		} finally {
			setBenefitCandidateActingId(null);
		}
	};

	const handleIgnoreCaptureCandidate = async (
		candidate: CandidateReviewItem,
	) => {
		if (candidate.source === "benefit") {
			await handleIgnoreBenefitCandidate(candidate.raw as BenefitCandidate);
			return;
		}
		await handleIgnoreDocumentCandidate(candidate.raw as DocumentCandidate);
	};

	const handleDeleteCapture = async (sourceDocumentId: number) => {
		if (spaceId == null || !Number.isFinite(spaceId)) return;
		const confirmed = window.confirm(
			"Remove this capture's review data and parsed candidates?\n\nThe original chat message/media and any records already saved from it stay in the space.",
		);
		if (!confirmed) return;
		setDeletingSourceDocumentId(sourceDocumentId);
		setDocumentCandidateError(null);
		try {
			await apiClient.spaces.review.deleteSourceDocumentReview(
				spaceId,
				sourceDocumentId,
			);
			setBenefitCandidates((prev) =>
				prev.filter(
					(candidate) => candidate.source_document_id !== sourceDocumentId,
				),
			);
			setDocumentCandidates((prev) =>
				prev.filter(
					(candidate) => candidate.source_document_id !== sourceDocumentId,
				),
			);
			setSpaceCapturePackets((prev) =>
				prev.filter((packet) => packet.source_document_id !== sourceDocumentId),
			);
			setSplitCandidateTargets((prev) => {
				const next = { ...prev };
				for (const candidate of documentCandidates) {
					if (candidate.source_document_id === sourceDocumentId) {
						delete next[candidate.id];
					}
				}
				return next;
			});
		} catch (e) {
			setDocumentCandidateError(
				e instanceof Error ? e.message : "Failed to delete capture",
			);
		} finally {
			setDeletingSourceDocumentId(null);
		}
	};

	if (spaceId == null || !Number.isFinite(spaceId))
		return <Navigate replace to="/console/home" />;

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
			<header className="shrink-0 border-b border-border/80 bg-background px-4 py-3 lg:px-8">
				<SpaceTabs />
			</header>
			<div className="flex min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#faf7f2_0%,#f4efe6_100%)]">
				<main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-40 pt-5 lg:px-8">
					{isReviewLoading ? (
						<p className="text-sm text-muted-foreground">
							Loading capture review...
						</p>
					) : null}
					{error ? (
						<p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{error}
						</p>
					) : null}
					{!candidateLoading &&
					documentCandidateError &&
					capturePackets.length === 0 ? (
						<p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{documentCandidateError}
						</p>
					) : null}
					{!candidateLoading && capturePackets.length > 0 ? (
						<CapturePacketReviewSection
							benefitCandidateActingId={benefitCandidateActingId}
							candidateCount={captureSummary.candidates}
							deletingSourceDocumentId={deletingSourceDocumentId}
							documentCandidateActingId={documentCandidateActingId}
							documentCandidateError={documentCandidateError}
							focusedSourceDocumentId={effectiveFocusedSourceDocumentId}
							memberLabels={memberLabels}
							onApplySplitCandidate={(candidate, targetExpenseId) =>
								handleApplySplitCandidate(
									candidate.raw as DocumentCandidate,
									targetExpenseId,
								)
							}
							onConfirmDocumentCandidate={(candidate) =>
								handleConfirmDocumentCandidate(
									candidate.raw as DocumentCandidate,
								)
							}
							onCreateParticipantCandidate={(candidate) =>
								handleCreateParticipantCandidate(
									candidate.raw as DocumentCandidate,
								)
							}
							onCreateRecurringCandidate={(candidate) =>
								handleCreateRecurringCandidate(
									candidate.raw as DocumentCandidate,
								)
							}
							onDeleteCapture={(sourceDocumentId) =>
								void handleDeleteCapture(sourceDocumentId)
							}
							onFinishReview={(packet) => handleFinishCaptureReview(packet)}
							onIgnoreCandidate={(candidate) =>
								void handleIgnoreCaptureCandidate(candidate)
							}
							onSavePromoCandidate={(candidate) =>
								handleSavePromoCandidate(candidate.raw as BenefitCandidate)
							}
							onSplitTargetChange={(candidateId, expenseId) =>
								setSplitCandidateTargets((prev) => ({
									...prev,
									[candidateId]: expenseId,
								}))
							}
							packets={capturePackets}
							finishingSourceDocumentId={finishingSourceDocumentId}
							pendingParticipantCountForSplitCandidate={
								pendingParticipantCountForSplitCandidate
							}
							spaceId={spaceId}
							splitTargetExpenseIdFor={splitTargetExpenseIdFor}
							splitTargetOptions={splitTargetOptions}
						/>
					) : null}
					{!candidateLoading && !error && capturePackets.length === 0 ? (
						<section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-[rgba(120,100,80,0.22)] bg-[rgba(255,252,246,0.9)] px-6 py-8 text-center shadow-sm">
							<h2 className="text-2xl font-semibold tracking-tight text-foreground">
								{hasExpenseReviewFallback
									? "Capture not found for this expense"
									: "No captures waiting"}
							</h2>
							<p className="mt-2 text-sm text-muted-foreground">
								{hasExpenseReviewFallback
									? "This older expense link opened Review, but Ceits could not find a source capture for it. You can still inspect the saved expense record in this space."
									: "Review now starts from captures only. Draft expenses and split records live in their own workspace tabs."}
							</p>
							<div className="mt-5 flex items-center justify-center gap-2">
								<Link
									className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-accent"
									to={`/console/spaces/${spaceId}/overview`}
								>
									Return to space
								</Link>
								{hasExpenseReviewFallback ? (
									<Link
										className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-accent"
										to={`/console/spaces/${encodeURIComponent(String(spaceId))}/expenses?expenseId=${encodeURIComponent(String(focusedExpenseId))}`}
									>
										Open expense record
									</Link>
								) : null}
								<Link
									className="rounded-lg bg-[rgba(55,45,30,0.92)] px-4 py-2 text-sm font-semibold text-[#fffaf0] hover:bg-[rgba(45,38,28,0.95)]"
									to={`/console/chat?spaceId=${spaceId}`}
								>
									Open chat
								</Link>
							</div>
						</section>
					) : null}
				</main>
				<aside className="hidden w-[21rem] shrink-0 border-l border-[rgba(120,100,80,0.2)] bg-[rgba(255,252,246,0.92)] lg:block">
					<div className="h-full overflow-y-auto px-4 pb-40 pt-5">
						<p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
							Capture queue
						</p>
						<p className="mt-2 text-sm text-foreground">
							{captureSummary.total === 0
								? "No parsed captures waiting"
								: `${captureSummary.total} ${captureSummary.total === 1 ? "capture" : "captures"} waiting`}
						</p>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							Review starts from the captures in the main column. Expenses,
							benefits, people, splits, future hints, and document signals stay
							inside the capture they came from.
						</p>
						<div className="mt-4 grid grid-cols-2 gap-2 text-xs">
							{[
								["Findings", captureSummary.candidates],
								["Expenses", captureSummary.expenses],
								["Benefits", captureSummary.benefits],
								["People", captureSummary.people],
								["Splits", captureSummary.splits],
								["Future", captureSummary.future],
								["Documents", captureSummary.documents],
							].map(([label, value]) => (
								<div
									className="rounded-xl border border-border/60 bg-background/70 px-3 py-2"
									key={label}
								>
									<p className="font-semibold tabular-nums text-foreground">
										{value}
									</p>
									<p className="mt-0.5 text-muted-foreground">{label}</p>
								</div>
							))}
						</div>
						<div className="mt-5 space-y-2">
							<p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
								Review packets
							</p>
							{capturePackets.length > 0 ? (
								capturePackets.slice(0, 12).map((packet) => {
									const selected =
										effectiveFocusedSourceDocumentId ===
										packet.sourceDocumentId;
									return (
										<Link
											className={[
												"block rounded-2xl border px-3 py-3 text-left transition",
												selected
													? "border-[rgba(172,124,35,0.42)] bg-[rgba(255,245,219,0.92)] shadow-sm"
													: "border-border/60 bg-background/64 hover:border-[rgba(172,124,35,0.26)] hover:bg-background/86",
											].join(" ")}
											key={packet.sourceDocumentId}
											to={captureQueueHref(spaceId, packet.sourceDocumentId)}
										>
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<p className="truncate text-sm font-semibold text-foreground">
														{packet.title}
													</p>
													<p className="mt-1 truncate text-[11px] text-muted-foreground">
														{packet.createdByLabel
															? `By ${packet.createdByLabel}`
															: `Capture #${packet.sourceDocumentId}`}
													</p>
												</div>
												<span className="shrink-0 rounded-full border border-border/60 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
													{packet.pendingCount && packet.pendingCount > 0
														? `${packet.pendingCount} open`
														: packet.projectedCount && packet.projectedCount > 0
															? `${packet.projectedCount} saved`
															: "review"}
												</span>
											</div>
											<p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
												{packet.summary}
											</p>
										</Link>
									);
								})
							) : (
								<p className="rounded-xl border border-border/60 bg-background/64 px-3 py-3 text-xs text-muted-foreground">
									Captures will appear here after text, photo, or voice input is
									parsed.
								</p>
							)}
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
};
