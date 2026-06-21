import type {
	CapturePacket as ApiCapturePacket,
	CaptureExpenseRecord,
	DocumentCandidate,
	ExpenseDetail,
	ExpenseRecord,
	ExpenseSplitRow,
	Space,
	SpaceMember,
} from "@cofi/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { GlobalComposerDock } from "../../app/layout/workspaceSpaces/GlobalComposerDock";
import { useGlobalComposerDock } from "../../app/layout/workspaceSpaces/GlobalComposerDockContext";
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
import { CapturePacketReviewSection } from "./CapturePacketReviewSection";
import type {
	CandidateReviewItem,
	CandidateReviewSource,
	CandidateReviewTone,
	CapturePacket,
	SplitTargetOption,
} from "./reviewPacketTypes";

type ReviewItem = {
	id: string;
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
	detailsLoaded: boolean;
	detailsLoading?: boolean;
	detailError?: string | null;
};

const captureExpenseRecordFromExpenseDetail = (
	expense: ExpenseDetail,
	fallbackTitle: string,
): CaptureExpenseRecord => {
	const items = (expense.items ?? []).map((item, index) => ({
		id: Number(item.id ?? index + 1),
		name: item.name,
		amount: Number(item.amount ?? 0),
	}));
	const total = items.reduce((sum, item) => sum + item.amount, 0);
	return {
		id: Number(expense.id),
		title: expense.title?.trim() || fallbackTitle,
		description: expense.description,
		status: expense.status ?? "approved",
		currency: expense.currency ?? "USD",
		expense_date: expense.expense_date ?? new Date().toISOString().slice(0, 10),
		total_amount:
			typeof expense.amount === "number" && Number.isFinite(expense.amount)
				? expense.amount
				: total,
		created_by_user_id: Number(expense.user_id ?? 0),
		items,
	};
};

const documentCandidateLabel = (type: string): string => {
	if (type === "expense_candidate") return "Expense candidate";
	if (type === "expense_item_candidate") return "Line item";
	if (type === "promo_code_candidate") return "Promo code";
	if (type === "loyalty_event_candidate") return "Loyalty";
	if (type === "payment_proof_candidate") return "Payment proof";
	if (type === "privacy_signal_candidate") return "Privacy signal";
	if (type === "merge_candidate") return "Possible duplicate";
	if (type === "supporting_document_candidate") return "Supporting document";
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

const candidateData = (candidate: DocumentCandidate): Record<string, unknown> =>
	toRecord(candidate.structured_data);

const isBenefitReviewCandidate = (candidate: DocumentCandidate): boolean =>
	candidate.candidate_type === "promo_code_candidate" ||
	candidate.candidate_type === "loyalty_event_candidate";

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
	candidate: DocumentCandidate,
): {
	detail: string;
	fields: Array<{ label: string; value: string }>;
	itemLabels: string[];
} => {
	const data = candidateData(candidate);
	const type = candidate.candidate_type;
	const fields: Array<{ label: string; value: string }> = [];
	if (type === "expense_candidate") {
		const expenseData = data;
		const merchant = firstCandidateText(expenseData, [
			"merchant",
			"merchant_name",
			"vendor",
			"payee",
			"payee_text",
		]);
		const amount = firstCandidateText(expenseData, [
			"total",
			"total_amount",
			"amount",
		]);
		appendField(fields, "Merchant", merchant);
		appendField(fields, "Amount", amount);
		appendField(
			fields,
			"Currency",
			firstCandidateText(expenseData, ["currency"]),
		);
		appendField(
			fields,
			"Date",
			firstCandidateText(expenseData, ["date", "expense_date"]),
		);
		appendItemsField(fields, expenseData);
		const itemLabels = candidateItemLabels(expenseData);
		const itemSummary =
			itemLabels.length > 1
				? `${itemLabels.slice(0, 2).join(", ")}${
						itemLabels.length > 2 ? ` +${itemLabels.length - 2}` : ""
					}`
				: itemLabels[0];
		return {
			detail:
				[merchant || itemSummary, amount].filter(Boolean).join(" • ") ||
				"Expense candidate created from this capture",
			fields,
			itemLabels,
		};
	}
	if (type === "expense_item_candidate") {
		const item = nestedCandidateData(data, ["item"]);
		const name =
			firstCandidateText(item, ["name", "title", "description"]) ??
			"Extracted line item";
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
		const code = firstCandidateText(data, [
			"promo_code",
			"code",
			"coupon",
			"discount_code",
		]);
		appendField(
			fields,
			"Discount",
			firstCandidateText(data, ["discount_type"]),
		);
		appendField(
			fields,
			"Value",
			firstCandidateText(data, ["discount_value", "discount_amount", "value"]),
		);
		appendField(fields, "Until", firstCandidateText(data, ["valid_until"]));
		appendField(
			fields,
			"Redeem",
			firstCandidateText(data, ["redeem_platform", "redeem_merchant_name"]),
		);
		return {
			detail: code ?? "Promo code needs review",
			fields,
			itemLabels: [],
		};
	}
	if (type === "loyalty_event_candidate") {
		const program = firstCandidateText(data, [
			"program_name",
			"loyalty_program",
			"name",
		]);
		const balance = firstCandidateText(data, [
			"available_balance",
			"points_earned",
			"points_spent",
		]);
		appendField(
			fields,
			"Balance",
			firstCandidateText(data, ["available_balance"]),
		);
		appendField(fields, "Earned", firstCandidateText(data, ["points_earned"]));
		appendField(fields, "Spent", firstCandidateText(data, ["points_spent"]));
		appendField(fields, "Card", firstCandidateText(data, ["card_mask"]));
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

const isPendingReviewStatus = (status?: string | null): boolean =>
	(status?.trim() || "pending_review").toLowerCase() === "pending_review";

const toCandidateReviewItem = (
	source: CandidateReviewSource,
	candidate: DocumentCandidate,
): CandidateReviewItem => {
	const summary = candidateSummary(candidate);
	const isSelfParticipant =
		source === "document" && isSelfParticipantCandidate(candidate);
	const status = candidate.status?.trim() || "pending_review";
	const isPendingReview = isPendingReviewStatus(status);
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
				? documentCandidateMeta(candidate)
				: [candidate.source_type, candidate.input_kind, candidate.merchant_text]
						.map((value) => value?.trim())
						.filter(Boolean)
						.join(" • ") || "Benefits intelligence",
		sourceType: candidate.source_type,
		inputKind: candidate.input_kind,
		documentType: candidate.document_type,
		merchantText: candidate.merchant_text,
		projectedExpenseId:
			source === "document" ? candidate.projected_expense_id : null,
		detail: summary.detail,
		fields: summary.fields,
		itemLabels: summary.itemLabels,
		tone: candidateTone(candidate.candidate_type),
		confidenceLabel: confidenceLabel(candidate.confidence),
		canMarkReviewed:
			isPendingReview &&
			source === "document" &&
			(isSelfParticipant ||
				canMarkDocumentCandidateReviewed(candidate.candidate_type)),
		canCreateParticipant:
			isPendingReview &&
			source === "document" &&
			canCreateParticipantFromCandidate(candidate.candidate_type) &&
			!isSelfParticipant,
		canCreateRecurring:
			isPendingReview &&
			source === "document" &&
			canCreateRecurringFromCandidate(candidate.candidate_type),
		canOpenSplitReview:
			isPendingReview &&
			source === "document" &&
			canOpenSplitReviewFromCandidate(candidate.candidate_type),
		canSavePromo:
			isPendingReview && candidate.candidate_type === "promo_code_candidate",
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
			pendingCount: packet.candidates.filter((candidate) =>
				isPendingReviewStatus(candidate.status),
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

const packetOpenReviewCount = (packet: CapturePacket): number =>
	packet.candidates.filter((candidate) =>
		isPendingReviewStatus(candidate.status),
	).length || Number(packet.pendingCount ?? 0);

const packetCreatedRecordCount = (packet: CapturePacket): number => {
	const records = packet.records;
	return (
		(records?.expenses ?? []).length +
		(records?.benefits ?? []).length +
		(records?.participants ?? []).length +
		(records?.splits ?? []).length +
		(records?.recurring ?? []).length
	);
};

const packetReviewStatus = (packet: CapturePacket): string => {
	const open = packetOpenReviewCount(packet);
	if (open > 0) return `${open} needs review`;
	const created = packetCreatedRecordCount(packet);
	if (created > 0) return "Complete";
	if (Number(packet.ignoredCount ?? 0) > 0) return "No action needed";
	return "Ready";
};

const packetOutputRows = (
	packet: CapturePacket,
): Array<{ label: string; value: number }> =>
	[
		{
			label: "Expense records",
			value: (packet.records?.expenses ?? []).length,
		},
		{
			label: "Benefit records",
			value: (packet.records?.benefits ?? []).length,
		},
		{
			label: "People",
			value: (packet.records?.participants ?? []).length,
		},
		{
			label: "Split records",
			value: (packet.records?.splits ?? []).length,
		},
		{
			label: "Future rules",
			value: (packet.records?.recurring ?? []).length,
		},
	].filter((row) => row.value > 0);

const packetRemainingRows = (
	packet: CapturePacket,
): Array<{ label: string; value: number }> =>
	[
		{ label: "Expense/item signals", value: packet.counts.expenses },
		{ label: "Benefit signals", value: packet.counts.benefits },
		{ label: "People signals", value: packet.counts.people },
		{ label: "Split signals", value: packet.counts.splits },
		{ label: "Future hints", value: packet.counts.future },
		{ label: "Document signals", value: packet.counts.documents },
	].filter((row) => row.value > 0);

const sourceFromExpense = (
	tx: ExpenseRecord | undefined,
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

const humanTitle = (tx?: ExpenseRecord, fallback?: string) => {
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
const CAPTURE_PACKET_PAGE_SIZE = 50;

const mergeCapturePacketPages = (
	current: ApiCapturePacket[],
	incoming: ApiCapturePacket[],
): ApiCapturePacket[] => {
	const bySourceDocument = new Map<number, ApiCapturePacket>();
	for (const packet of current) {
		bySourceDocument.set(Number(packet.source_document_id), packet);
	}
	for (const packet of incoming) {
		bySourceDocument.set(Number(packet.source_document_id), packet);
	}
	return Array.from(bySourceDocument.values()).sort((left, right) => {
		const leftTime = Date.parse(left.created_at ?? "");
		const rightTime = Date.parse(right.created_at ?? "");
		if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
			if (leftTime !== rightTime) return rightTime - leftTime;
		}
		return Number(right.source_document_id) - Number(left.source_document_id);
	});
};

export const CeitsReviewFlowPage = () => {
	const { spaces, selectedSpaceId, setSelectedSpaceId } = useWorkspaceSpaces();
	const globalComposerDock = useGlobalComposerDock();
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
		DocumentCandidate[]
	>([]);
	const [spaceCapturePackets, setSpaceCapturePackets] = useState<
		ApiCapturePacket[]
	>([]);
	const [capturePacketsHasMore, setCapturePacketsHasMore] = useState(false);
	const [capturePacketsNextOffset, setCapturePacketsNextOffset] = useState<
		number | null
	>(null);
	const [capturePacketsLoadingMore, setCapturePacketsLoadingMore] =
		useState(false);
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
				const txRes = await apiClient.spaces.expenses.list(spaceId, {
					limit: 120,
				});
				const tx: ExpenseRecord[] = txRes.expenses ?? [];
				const txById = new Map<number, ExpenseRecord>(
					tx.map((t) => [Number(t.id), t]),
				);

				const needsConfirmationIds = tx
					.filter((t) => {
						const s = (t.status ?? "").toLowerCase();
						return (
							s.includes("review") ||
							s.includes("question") ||
							s.includes("pending")
						);
					})
					.map((t) => Number(t.id))
					.filter(Number.isFinite);

				const built: ReviewItem[] = [];

				for (const id of needsConfirmationIds) {
					if (built.some((b) => b.expenseId === id)) continue;
					const tr = txById.get(id);
					if (!tr) continue;
					const source = sourceFromExpense(tr);
					built.push({
						id: `needs-${id}`,
						expenseId: id,
						spaceId: Number(spaceId),
						spaceName: activeSpace?.name ?? "Space",
						title: humanTitle(tr, "Needs confirmation"),
						amount: Number(tr.total ?? 0),
						status: tr.status ?? "needs confirmation",
						dateLabel: tr.expense_date ?? "—",
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
		setCapturePacketsHasMore(false);
		setCapturePacketsNextOffset(null);
		setCapturePacketsLoadingMore(false);
		setSpaceMembers([]);
		void (async () => {
			try {
				const [capturePacketRes, documentCandidateRes, membersRes] =
					await Promise.all([
						apiClient.spaces
							.listCapturePackets(spaceId, {
								includeRecords: true,
								limit: CAPTURE_PACKET_PAGE_SIZE,
								offset: 0,
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
					setCapturePacketsHasMore(capturePacketRes?.has_more === true);
					setCapturePacketsNextOffset(
						typeof capturePacketRes?.next_offset === "number"
							? capturePacketRes.next_offset
							: null,
					);
					setBenefitCandidates(
						(documentCandidateRes?.candidates ?? []).filter(
							isBenefitReviewCandidate,
						),
					);
					setDocumentCandidates(documentCandidateRes?.candidates ?? []);
					setSpaceMembers(membersRes?.members ?? []);
					if (capturePacketRes == null || documentCandidateRes == null) {
						setDocumentCandidateError(
							"Some capture review data could not be loaded. Expense review is still available.",
						);
					}
				}
			} catch (e) {
				if (!cancelled) {
					setSpaceCapturePackets([]);
					setCapturePacketsHasMore(false);
					setCapturePacketsNextOffset(null);
					setCapturePacketsLoadingMore(false);
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
	const activeRailCapturePacket = useMemo(() => {
		if (capturePackets.length === 0) return null;
		if (effectiveFocusedSourceDocumentId != null) {
			const focused = capturePackets.find(
				(packet) =>
					Number(packet.sourceDocumentId) ===
					Number(effectiveFocusedSourceDocumentId),
			);
			if (focused) return focused;
		}
		return (
			capturePackets.find((packet) => packetOpenReviewCount(packet) > 0) ??
			capturePackets[0]
		);
	}, [capturePackets, effectiveFocusedSourceDocumentId]);
	const activeRailCaptureOutputRows = useMemo(
		() =>
			activeRailCapturePacket ? packetOutputRows(activeRailCapturePacket) : [],
		[activeRailCapturePacket],
	);
	const activeRailCaptureRemainingRows = useMemo(
		() =>
			activeRailCapturePacket
				? packetRemainingRows(activeRailCapturePacket)
				: [],
		[activeRailCapturePacket],
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

	const handleLoadMoreCapturePackets = useCallback(async () => {
		if (
			spaceId == null ||
			focusedSourceDocumentId != null ||
			capturePacketsLoadingMore ||
			capturePacketsNextOffset == null
		) {
			return;
		}
		setCapturePacketsLoadingMore(true);
		setDocumentCandidateError(null);
		try {
			const res = await apiClient.spaces.listCapturePackets(spaceId, {
				includeRecords: true,
				limit: CAPTURE_PACKET_PAGE_SIZE,
				offset: capturePacketsNextOffset,
			});
			setSpaceCapturePackets((prev) =>
				mergeCapturePacketPages(prev, res.captures ?? []),
			);
			setCapturePacketsHasMore(res.has_more === true);
			setCapturePacketsNextOffset(
				typeof res.next_offset === "number" ? res.next_offset : null,
			);
		} catch (e) {
			setDocumentCandidateError(
				e instanceof Error ? e.message : "Failed to load more captures",
			);
		} finally {
			setCapturePacketsLoadingMore(false);
		}
	}, [
		capturePacketsLoadingMore,
		capturePacketsNextOffset,
		focusedSourceDocumentId,
		spaceId,
	]);

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

	const handleSavePromoCandidate = async (candidate: DocumentCandidate) => {
		if (spaceId == null) return;
		setBenefitCandidateActingId(candidate.id);
		setDocumentCandidateError(null);
		try {
			await apiClient.spaces.review.savePromoCandidate(spaceId, candidate.id);
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
				await apiClient.spaces.review.savePromoCandidate(spaceId, candidate.id);
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
				const expenseCandidate = packet.candidates.find(
					(candidate) =>
						isPendingReviewStatus(candidate.status) &&
						candidate.candidateType === "expense_candidate",
				);
				if (!expenseCandidate) {
					throw new Error(
						"No expense candidate is available to save from this capture.",
					);
				}
				const created =
					await apiClient.spaces.review.createExpenseFromCandidate(
						spaceId,
						expenseCandidate.id,
					);
				const createdExpense = captureExpenseRecordFromExpenseDetail(
					created.expense,
					packet.title,
				);
				const createdExpenseId = Number(createdExpense.id);
				if (!Number.isFinite(createdExpenseId) || createdExpenseId <= 0) {
					throw new Error(
						"Expense was created but no expense id was returned.",
					);
				}
				reviewExpenses = [createdExpense];
			}
			if (hadExistingExpenses) {
				for (const candidate of packet.candidates.filter(
					(item) =>
						isPendingReviewStatus(item.status) &&
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
						? { ...item, status: "approved" }
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

	const handleIgnoreBenefitCandidate = async (candidate: DocumentCandidate) => {
		if (spaceId == null) return;
		setBenefitCandidateActingId(candidate.id);
		setDocumentCandidateError(null);
		try {
			await apiClient.spaces.review.ignoreDocumentCandidate(
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
			await handleIgnoreBenefitCandidate(candidate.raw);
			return;
		}
		await handleIgnoreDocumentCandidate(candidate.raw);
	};

	const handleDeleteCapture = async (sourceDocumentId: number) => {
		if (spaceId == null || !Number.isFinite(spaceId)) return;
		const confirmed = window.confirm(
			"Remove this capture's review data and extracted candidates?\n\nThe original chat message/media and any records already saved from it stay in the space.",
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

	const composerDock = globalComposerDock?.shouldShow ? (
		<GlobalComposerDock
			isCollapsed={globalComposerDock.isCollapsed}
			onCollapsedChange={globalComposerDock.onCollapsedChange}
			variant="inline"
		/>
	) : null;

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
			<header className="shrink-0 border-b border-border/80 bg-background px-4 py-3 lg:px-8">
				<SpaceTabs />
			</header>
			<div className="flex min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#faf7f2_0%,#f4efe6_100%)]">
				<main
					className={
						composerDock
							? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
							: "min-h-0 min-w-0 flex-1 overflow-y-auto"
					}
				>
					<div
						className={
							composerDock ? "min-h-0 flex-1 overflow-y-auto" : "contents"
						}
					>
						{isReviewLoading ? (
							<p className="px-4 pb-2 pt-5 text-sm text-muted-foreground lg:px-8">
								Loading capture review...
							</p>
						) : null}
						{error ? (
							<p className="mx-4 mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive lg:mx-8">
								{error}
							</p>
						) : null}
						{!candidateLoading &&
						documentCandidateError &&
						capturePackets.length === 0 ? (
							<p className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive lg:mx-8">
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
								hasMorePackets={
									focusedSourceDocumentId == null && capturePacketsHasMore
								}
								isLoadingMorePackets={capturePacketsLoadingMore}
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
								onLoadMorePackets={() => void handleLoadMoreCapturePackets()}
								onSavePromoCandidate={(candidate) =>
									handleSavePromoCandidate(candidate.raw)
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
										: "Review now starts from captures and candidates only. Saved records live in their workspace tabs."}
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
								</div>
							</section>
						) : null}
					</div>
					{composerDock}
				</main>
				<aside className="hidden w-[21rem] shrink-0 border-l border-[rgba(120,100,80,0.2)] bg-[rgba(255,252,246,0.92)] lg:block">
					<div className="h-full overflow-y-auto px-4 pb-40 pt-5">
						<p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
							Capture queue
						</p>
						<p className="mt-2 text-sm font-semibold text-foreground">
							{captureSummary.total === 0
								? "No captures waiting for review"
								: `${captureSummary.total} ${captureSummary.total === 1 ? "capture" : "captures"} waiting`}
						</p>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							Review starts from the selected capture. Saved records move to
							their workspace tabs after the capture work is resolved.
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
						<div className="mt-5 rounded-2xl border border-border/70 bg-background/72 p-4 shadow-sm">
							<p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
								Active capture
							</p>
							{activeRailCapturePacket ? (
								<>
									<div className="mt-2 flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="text-base font-semibold leading-snug text-foreground">
												{activeRailCapturePacket.title}
											</p>
											<p className="mt-1 text-xs text-muted-foreground">
												{activeRailCapturePacket.createdByLabel
													? `By ${activeRailCapturePacket.createdByLabel}`
													: `Capture #${activeRailCapturePacket.sourceDocumentId}`}
											</p>
										</div>
										<span
											className={[
												"shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold",
												packetOpenReviewCount(activeRailCapturePacket) > 0
													? "border-[rgba(194,131,48,0.38)] bg-[rgba(255,236,194,0.6)] text-[#6d4611]"
													: "border-[rgba(91,142,96,0.3)] bg-[rgba(224,245,226,0.74)] text-[#2d5933]",
											].join(" ")}
										>
											{packetReviewStatus(activeRailCapturePacket)}
										</span>
									</div>
									<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
										{activeRailCapturePacket.summary}
									</p>
									<div className="mt-4 space-y-3">
										<section>
											<p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
												Saved output
											</p>
											{activeRailCaptureOutputRows.length ? (
												<div className="mt-2 space-y-1.5">
													{activeRailCaptureOutputRows.map((row) => (
														<div
															className="flex items-center justify-between rounded-lg border border-[rgba(92,132,92,0.18)] bg-[rgba(238,248,239,0.65)] px-3 py-2 text-xs"
															key={row.label}
														>
															<span className="text-muted-foreground">
																{row.label}
															</span>
															<span className="font-semibold tabular-nums text-foreground">
																{row.value}
															</span>
														</div>
													))}
												</div>
											) : (
												<p className="mt-2 rounded-lg border border-border/60 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
													No saved records from this capture yet.
												</p>
											)}
										</section>
										<section>
											<p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
												Review map
											</p>
											{activeRailCaptureRemainingRows.length ? (
												<div className="mt-2 space-y-1.5">
													{activeRailCaptureRemainingRows.map((row) => (
														<div
															className="flex items-center justify-between rounded-lg border border-border/60 bg-white/62 px-3 py-2 text-xs"
															key={row.label}
														>
															<span className="text-muted-foreground">
																{row.label}
															</span>
															<span className="font-semibold tabular-nums text-foreground">
																{row.value}
															</span>
														</div>
													))}
												</div>
											) : (
												<p className="mt-2 rounded-lg border border-border/60 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
													No review signals remain attached to this capture.
												</p>
											)}
										</section>
									</div>
									{effectiveFocusedSourceDocumentId !==
									activeRailCapturePacket.sourceDocumentId ? (
										<Link
											className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg border border-border/70 bg-white px-3 text-xs font-semibold text-foreground transition hover:bg-accent"
											to={captureQueueHref(
												spaceId,
												activeRailCapturePacket.sourceDocumentId,
											)}
										>
											Focus this capture
										</Link>
									) : null}
								</>
							) : (
								<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
									Captures will appear after text, photo, or voice input is
									extracted.
								</p>
							)}
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
};
