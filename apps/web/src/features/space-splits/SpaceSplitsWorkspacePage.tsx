import type {
	DashboardResponse,
	ExpenseDetail,
	ExpenseSplitRow,
	PaymentLinkSummary,
	Space,
	SpaceActivityItem,
	SpaceMember,
	SpaceParticipant,
	Transaction,
} from "@cofi/api";
import { Copy, Link2, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceHeader } from "../../app/layout/workspaceSpaces/SpaceHeader";
import { SpaceWorkspaceLayout } from "../../app/layout/workspaceSpaces/SpaceWorkspaceLayout";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";
import { buildExpenseDetailHref } from "../../shared/lib/expenseLinks";
import {
	SpaceSplitDecisionList,
	type SplitDecisionRow,
} from "./components/SpaceSplitDecisionList";
import {
	type SelectedSplitDetail,
	SpaceSplitsRightRail,
	type SplitActivitySummary,
	type SplitMemberSummary,
} from "./components/SpaceSplitsRightRail";

type SplitDecisionRecord = SplitDecisionRow & {
	expenseId: number;
	statusLabel: "Needs confirmation" | "Split saved" | "Draft" | "Cancelled";
	totalAmount: number;
	categoryLabel: string;
	dateDisplayLabel: string;
	splitMethod: string;
	othersShareLabel: string;
	reviewTo: string;
	expenseTo: string;
	sourceDocumentId?: number;
	participantsDetailed: Array<{
		id: string;
		name: string;
		amountLabel: string;
		isCurrentUser: boolean;
	}>;
};

type PaymentLinkCandidate = {
	participantId: number;
	name: string;
	amount: number;
	amountLabel: string;
	splitCount: number;
};

const toNumericId = (value: string | number | undefined): number | null => {
	if (value == null) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const buildReviewCaptureHref = (
	spaceId: string,
	sourceDocumentId?: number | null,
): string =>
	sourceDocumentId != null
		? `/console/review?spaceId=${encodeURIComponent(spaceId)}&sourceDocumentId=${encodeURIComponent(String(sourceDocumentId))}`
		: `/console/review?spaceId=${encodeURIComponent(spaceId)}`;

const formatRelative = (iso?: string): string => {
	if (!iso) return "—";
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) return iso;
	const diffMinutes = Math.max(1, Math.round((Date.now() - ts) / 60000));
	if (diffMinutes < 60) return `${diffMinutes}m ago`;
	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	return `${Math.round(diffHours / 24)}d ago`;
};

const normalizeSourceStatus = (raw?: string | null): string => {
	const value = (raw ?? "").toLowerCase();
	if (value.includes("draft")) return "draft";
	if (value.includes("cancel")) return "cancelled";
	if (value.includes("approved") || value.includes("confirm"))
		return "approved";
	return value || "unknown";
};

const toTitleCase = (value: string): string =>
	value
		.split("_")
		.map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
		.join(" ");

const toSplitStateLabel = (
	sourceStatus: string,
	statusLabel: "Needs confirmation" | "Split saved",
): "Needs confirmation" | "Split saved" | "Draft" | "Cancelled" => {
	if (sourceStatus === "cancelled") return "Cancelled";
	if (sourceStatus === "draft") return "Draft";
	if (statusLabel === "Needs confirmation") return "Needs confirmation";
	return "Split saved";
};

const toDisplayCategory = (tag: string): string => {
	const t = tag.trim().toLowerCase();
	if (!t || t === "uncategorized") return "General";
	if (t.includes("grocery") || t.includes("groceries")) return "Groceries";
	if (t.includes("receipt")) return "Receipt capture";
	if (t.includes("subscription") || t.includes("streaming"))
		return "Subscription";
	return toTitleCase(tag.replace(/_/g, " "));
};

const formatShortDate = (value?: string): string => {
	if (!value) return "—";
	if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
		const d = new Date(`${value.slice(0, 10)}T12:00:00`);
		if (!Number.isFinite(d.getTime())) return value;
		return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	}
	return value;
};

const humanizeSourceStatusLabel = (raw: string): string => {
	const v = raw.toLowerCase();
	if (v === "draft") return "Draft";
	if (v === "cancelled" || v === "canceled") return "Cancelled";
	if (v === "approved") return "Approved";
	if (!v || v === "unknown") return "Recorded";
	return toTitleCase(raw.replace(/_/g, " "));
};

const splitParticipantId = (row: ExpenseSplitRow): string =>
	row.space_participant_id != null
		? `participant:${row.space_participant_id}`
		: row.user_id != null
			? `user:${row.user_id}`
			: "participant:unknown";

const splitParticipantName = (
	row: ExpenseSplitRow,
	members: SpaceMember[],
): string => {
	if (row.participant?.display_name?.trim()) {
		return row.participant.display_name.trim();
	}
	if (row.participant?.email?.trim()) return row.participant.email.trim();
	if (row.user_id != null) {
		const member =
			members.find((entry) => Number(entry.user_id) === Number(row.user_id)) ??
			null;
		return member?.name || member?.email || `Member ${row.user_id}`;
	}
	if (row.space_participant_id != null) {
		return `Participant ${row.space_participant_id}`;
	}
	return "Participant";
};

const participantBelongsToUser = (
	participant:
		| Pick<SpaceParticipant, "user_id" | "linked_user_id">
		| null
		| undefined,
	userId: number | null | undefined,
): boolean => {
	if (userId == null || participant == null) return false;
	return (
		Number(participant.user_id ?? participant.linked_user_id) === Number(userId)
	);
};

const splitRowBelongsToUser = (
	row: ExpenseSplitRow,
	userId: number | null | undefined,
	participantIds: Set<number>,
): boolean => {
	if (userId == null) return false;
	if (row.space_participant_id != null) {
		if (participantIds.has(Number(row.space_participant_id))) return true;
	}
	if (participantBelongsToUser(row.participant, userId)) return true;
	return row.user_id != null && Number(row.user_id) === Number(userId);
};

const buildSplitRowContextLine = (
	mappedStatus: SplitDecisionRow["statusLabel"],
	sourceStatus: string,
	participantCount: number,
	splitMethod: string,
): string => {
	if (mappedStatus === "Cancelled") {
		return "Cancelled · excluded from balances";
	}
	if (mappedStatus === "Draft" || sourceStatus === "draft") {
		return "Draft split · not confirmed yet";
	}
	if (participantCount <= 1) {
		return "Single participant — no split needed";
	}
	if (splitMethod === "Equal") {
		return participantCount === 2
			? "Split equally · between 2 people"
			: `Split equally · between ${participantCount} people`;
	}
	if (splitMethod === "Custom") {
		return participantCount === 2
			? "Between 2 people · custom amounts"
			: `Between ${participantCount} people · custom amounts`;
	}
	return `Split between ${participantCount} people`;
};

type HumanTitleInput = {
	rawTitle: string;
	categoryTag: string;
	sourceStatus: string;
	mappedStatus: SplitDecisionRow["statusLabel"];
	detail?: ExpenseDetail;
	transaction?: Transaction;
};

const toHumanSplitTitle = ({
	rawTitle,
	categoryTag,
	sourceStatus,
	mappedStatus,
	detail,
	transaction,
}: HumanTitleInput): string => {
	const raw = rawTitle.trim();
	const cat = categoryTag.toLowerCase();
	const blob =
		`${raw} ${detail?.description ?? ""} ${transaction?.description ?? ""}`.toLowerCase();

	const isBareExpenseHash = /^expense\s*#?\d*$/i.test(raw);
	const isExpenseDotGeneric =
		/^expense\s*·\s*(receipt|recurring|uncategorized)\s*$/i.test(raw);

	const recurringId = detail?.recurring_id ?? transaction?.recurring_id;
	const vendorName =
		detail?.vendor?.name?.trim() ||
		transaction?.vendor_name?.trim() ||
		detail?.payee_text?.trim();

	if (recurringId != null) {
		if (vendorName && !/^expense$/i.test(vendorName)) {
			return `${vendorName} subscription`;
		}
		return "Recurring expense";
	}

	if (cat.includes("grocery") || cat.includes("groceries")) {
		if (mappedStatus === "Draft" || sourceStatus === "draft")
			return "Receipt draft";
		return "Grocery receipt";
	}

	if (cat.includes("receipt") || sourceStatus === "draft") {
		if (mappedStatus === "Draft" || sourceStatus === "draft")
			return "Receipt draft";
		return "Receipt capture";
	}

	if (
		blob.includes("taxi") ||
		blob.includes("uber") ||
		blob.includes("lyft") ||
		blob.includes("cab")
	) {
		return "Taxi home";
	}
	if (
		blob.includes("restaurant") ||
		blob.includes("dinner") ||
		blob.includes("lunch") ||
		blob.includes("cafe")
	) {
		return "Restaurant dinner";
	}

	if (raw && !isBareExpenseHash && !isExpenseDotGeneric) {
		return raw;
	}

	if (
		sourceStatus !== "draft" &&
		sourceStatus !== "cancelled" &&
		mappedStatus !== "Draft"
	) {
		return "Text capture expense";
	}

	if (mappedStatus === "Draft" || sourceStatus === "draft") {
		return "Expense draft";
	}

	return "Split decision";
};

export const SpaceSplitsWorkspacePage = () => {
	const { spaceId } = useParams<{ spaceId: string }>();
	const { user } = useAuth();
	const { formatMoney } = useUserFormat();
	const { spaces, selectedSpaceId, setSelectedSpaceId } = useWorkspaceSpaces();
	const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(
		null,
	);
	const [members, setMembers] = useState<SpaceMember[]>([]);
	const [participants, setParticipants] = useState<SpaceParticipant[]>([]);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [spaceActivity, setSpaceActivity] = useState<SpaceActivityItem[]>([]);
	const [expenseDetails, setExpenseDetails] = useState<
		Record<number, ExpenseDetail>
	>({});
	const [splitRows, setSplitRows] = useState<Record<number, ExpenseSplitRow[]>>(
		{},
	);
	const [paymentLinks, setPaymentLinks] = useState<PaymentLinkSummary[]>([]);
	const [paymentLinksError, setPaymentLinksError] = useState<string | null>(
		null,
	);
	const [selectedPaymentParticipantId, setSelectedPaymentParticipantId] =
		useState<string>("unclaimed");
	const [selectedPaymentProofPolicy, setSelectedPaymentProofPolicy] = useState<
		"optional" | "required"
	>("optional");
	const [paymentLinkAction, setPaymentLinkAction] = useState<string | null>(
		null,
	);
	const [copiedPaymentLinkId, setCopiedPaymentLinkId] = useState<number | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(
		null,
	);

	const numericSpaceId = useMemo(() => {
		const n = Number(spaceId);
		return Number.isFinite(n) ? n : null;
	}, [spaceId]);

	const space: Space | null = useMemo(() => {
		if (!spaces || spaceId == null) return null;
		return spaces.find((entry) => String(entry.id) === String(spaceId)) ?? null;
	}, [spaces, spaceId]);

	useConsoleHeaderTitle("Splits", space?.name ?? null);

	useEffect(() => {
		if (numericSpaceId == null) return;
		if (
			selectedSpaceId == null ||
			String(selectedSpaceId) !== String(numericSpaceId)
		) {
			setSelectedSpaceId(numericSpaceId);
		}
	}, [numericSpaceId, selectedSpaceId, setSelectedSpaceId]);

	useEffect(() => {
		if (numericSpaceId == null) return;
		let cancelled = false;
		setIsLoading(true);
		setLoadError(null);
		setPaymentLinksError(null);
		void (async () => {
			try {
				const [
					dashRes,
					membersRes,
					participantsRes,
					txRes,
					activityRes,
					paymentLinksRes,
				] = await Promise.all([
					apiClient.dashboard.get({
						variant: "personal",
						period: "month",
						space_id: numericSpaceId,
					}),
					apiClient.spaces.listMembers(numericSpaceId).catch(() => null),
					apiClient.spaces.listParticipants(numericSpaceId).catch(() => null),
					apiClient.spaces.expenses.list(numericSpaceId, { limit: 60 }),
					apiClient.spaces.activity
						.list(numericSpaceId, { limit: 40 })
						.catch(() => ({ items: [] })),
					apiClient.paymentLinks
						.list(numericSpaceId)
						.catch((error: unknown) => {
							setPaymentLinksError(
								error instanceof Error
									? error.message
									: "Failed to load payment links",
							);
							return { links: [] };
						}),
				]);

				const expenseIds = Array.from(
					new Set(txRes.map((tx) => toNumericId(tx.id))),
				)
					.filter((id): id is number => id != null)
					.slice(0, 36);

				const [splitSettled, detailSettled] = await Promise.all([
					Promise.allSettled(
						expenseIds.map(async (expenseId) => {
							const data = await apiClient.spaces.expenses.listSplits(
								numericSpaceId,
								expenseId,
							);
							return { expenseId, rows: data.splits ?? [] };
						}),
					),
					Promise.allSettled(
						expenseIds.map(async (expenseId) => {
							const detail = await apiClient.spaces.expenses.get(
								numericSpaceId,
								expenseId,
							);
							return { expenseId, detail };
						}),
					),
				]);

				const splitMap: Record<number, ExpenseSplitRow[]> = {};
				for (const result of splitSettled) {
					if (result.status === "fulfilled") {
						splitMap[result.value.expenseId] = result.value.rows;
					}
				}

				const detailMap: Record<number, ExpenseDetail> = {};
				for (const result of detailSettled) {
					if (result.status === "fulfilled") {
						detailMap[result.value.expenseId] = result.value.detail;
					}
				}

				if (!cancelled) {
					setDashboardData(dashRes);
					setMembers(membersRes?.members ?? []);
					setParticipants(participantsRes?.participants ?? []);
					setTransactions(txRes);
					setSpaceActivity(activityRes.items ?? []);
					setPaymentLinks(paymentLinksRes.links ?? []);
					setSplitRows(splitMap);
					setExpenseDetails(detailMap);
				}
			} catch (error) {
				if (!cancelled) {
					setLoadError(
						error instanceof Error
							? error.message
							: "Failed to load split data",
					);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [numericSpaceId]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setSelectedDecisionId(null);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	if (numericSpaceId == null) {
		return <Navigate replace to="/console/home" />;
	}

	const sidStr = String(numericSpaceId);
	const pendingDrafts = (dashboardData?.pending_drafts ?? []).filter(
		(item) => Number(item.space_id) === Number(numericSpaceId),
	);

	const transactionByExpenseId = new Map<number, Transaction>(
		transactions
			.map((transaction) => [toNumericId(transaction.id), transaction] as const)
			.filter((entry): entry is [number, Transaction] => entry[0] != null),
	);
	const currentUserParticipantIds = new Set(
		participants
			.filter((participant) => participantBelongsToUser(participant, user?.id))
			.map((participant) => Number(participant.id)),
	);
	const paymentLinkCandidateTotals = Object.values(splitRows)
		.flat()
		.filter(
			(row) =>
				row.space_participant_id != null &&
				row.amount > 0 &&
				!splitRowBelongsToUser(row, user?.id, currentUserParticipantIds),
		)
		.reduce<Map<number, { amount: number; rows: ExpenseSplitRow[] }>>(
			(acc, row) => {
				const participantId = Number(row.space_participant_id);
				const current = acc.get(participantId) ?? { amount: 0, rows: [] };
				current.amount += row.amount;
				current.rows.push(row);
				acc.set(participantId, current);
				return acc;
			},
			new Map(),
		);
	const paymentLinkCandidateRows: PaymentLinkCandidate[] = Array.from(
		paymentLinkCandidateTotals.entries(),
	)
		.map(([participantId, exposure]) => {
			const participant = participants.find(
				(entry) => Number(entry.id) === participantId,
			);
			const firstRow = exposure.rows[0];
			return {
				participantId,
				name:
					participant?.display_name?.trim() ||
					(firstRow ? splitParticipantName(firstRow, members) : "Participant"),
				amount: exposure.amount,
				amountLabel: formatMoney(exposure.amount),
				splitCount: exposure.rows.length,
			};
		})
		.sort((a, b) => b.amount - a.amount);
	const activePaymentLinks = paymentLinks.filter(
		(link) => link.status === "active",
	);
	const paymentLinkByParticipantId = new Map(
		activePaymentLinks
			.filter((link) => link.bound_participant != null)
			.map((link) => [Number(link.bound_participant?.id), link] as const),
	);
	const coveredPaymentLinkByParticipantId = new Map<
		number,
		PaymentLinkSummary
	>();
	for (const link of activePaymentLinks) {
		if (link.bound_participant != null) {
			coveredPaymentLinkByParticipantId.set(
				Number(link.bound_participant.id),
				link,
			);
		}
		for (const obligation of link.obligations ?? []) {
			coveredPaymentLinkByParticipantId.set(
				obligation.payer_participant_id,
				link,
			);
			coveredPaymentLinkByParticipantId.set(
				obligation.recipient_participant_id,
				link,
			);
		}
	}
	const unclaimedPaymentLink =
		activePaymentLinks.find((link) => link.claim_required) ?? null;

	const coverageIds = Array.from(
		new Set([
			...Object.keys(splitRows).map((id) => Number(id)),
			...Object.keys(expenseDetails).map((id) => Number(id)),
			...Array.from(transactionByExpenseId.keys()),
		]),
	).filter((id) => Number.isFinite(id));

	const splitDecisionRecords: SplitDecisionRecord[] = coverageIds.flatMap(
		(expenseId) => {
			const transaction = transactionByExpenseId.get(expenseId);
			const rows = splitRows[expenseId] ?? [];
			const detail = expenseDetails[expenseId];
			const sourceDocumentId =
				rows.find((row) => row.source_document_id != null)
					?.source_document_id ?? detail?.source_document_id;
			const statusLabel = rows.length > 0 ? "Split saved" : "Missing splits";
			if (statusLabel === "Missing splits") return [];

			const participantsDetailed = rows.map((row) => {
				return {
					id: splitParticipantId(row),
					name: splitParticipantName(row, members),
					amountLabel: formatMoney(row.amount),
					isCurrentUser: splitRowBelongsToUser(
						row,
						user?.id,
						currentUserParticipantIds,
					),
				};
			});
			const myShare =
				rows.find((row) =>
					splitRowBelongsToUser(row, user?.id, currentUserParticipantIds),
				)?.amount ?? 0;
			const othersShareAmount = rows
				.filter(
					(row) =>
						!splitRowBelongsToUser(row, user?.id, currentUserParticipantIds),
				)
				.reduce((sum, row) => sum + row.amount, 0);
			const total = detail?.amount ?? transaction?.total ?? 0;
			const rawTitle =
				detail?.title?.trim() ||
				transaction?.title?.trim() ||
				detail?.payee_text?.trim() ||
				transaction?.description?.trim() ||
				`Expense #${expenseId}`;
			const sourceStatus = normalizeSourceStatus(
				detail?.status || transaction?.status || undefined,
			);
			const dateLabel =
				detail?.txn_date ||
				transaction?.txn_date ||
				formatRelative(transaction?.created_at);
			const splitMethod =
				rows.length <= 1
					? "Text capture"
					: rows.every((row) => Math.abs(row.amount - rows[0].amount) < 0.0001)
						? "Equal"
						: "Custom";
			const categoryTag =
				detail?.items?.[0]?.tags?.[0]?.name ||
				detail?.business_meta?.invoice_ref ||
				"Uncategorized";
			const displayCategory = toDisplayCategory(categoryTag);
			const mappedStatusLabel = toSplitStateLabel(sourceStatus, statusLabel);
			const title = toHumanSplitTitle({
				rawTitle,
				categoryTag,
				sourceStatus,
				mappedStatus: mappedStatusLabel,
				detail,
				transaction,
			});
			const dateForDisplay =
				detail?.txn_date ||
				transaction?.txn_date ||
				(transaction?.created_at
					? String(transaction.created_at).slice(0, 10)
					: undefined) ||
				(detail?.created_at
					? String(detail.created_at).slice(0, 10)
					: undefined);
			const dateDisplayLabel = dateForDisplay
				? formatShortDate(dateForDisplay)
				: formatRelative(transaction?.created_at);
			const contextLine = buildSplitRowContextLine(
				mappedStatusLabel,
				sourceStatus,
				participantsDetailed.length,
				splitMethod,
			);

			return [
				{
					id: String(expenseId),
					expenseId,
					title,
					dateLabel,
					contextLine,
					sourceStatus,
					sourceStatusShort: humanizeSourceStatusLabel(sourceStatus),
					spaceLabel: space?.name ?? "Space",
					participantsPreview: participantsDetailed.map((participant) => ({
						id: participant.id,
						name: participant.name,
					})),
					participantsCount: participantsDetailed.length,
					participantsFallback: "No splits saved",
					myShareLabel: formatMoney(myShare),
					totalLabel: formatMoney(total),
					statusLabel: mappedStatusLabel,
					totalAmount: total,
					categoryLabel: displayCategory,
					dateDisplayLabel,
					splitMethod,
					othersShareLabel: formatMoney(othersShareAmount),
					reviewTo: buildReviewCaptureHref(sidStr, sourceDocumentId),
					expenseTo: buildExpenseDetailHref(sidStr, expenseId),
					sourceDocumentId,
					participantsDetailed,
				},
			];
		},
	);

	const pendingSplitRecords = splitDecisionRecords.filter(
		(row) =>
			row.statusLabel === "Needs confirmation" ||
			row.statusLabel === "Draft" ||
			row.statusLabel === "Cancelled",
	);
	const confirmedSplitRecords = splitDecisionRecords.filter(
		(row) => row.statusLabel === "Split saved",
	);
	const needsConfirmationCount = splitDecisionRecords.filter(
		(row) => row.statusLabel === "Needs confirmation",
	).length;
	const totalTrackedShare = formatMoney(
		Object.values(splitRows)
			.flat()
			.filter((row) =>
				splitRowBelongsToUser(row, user?.id, currentUserParticipantIds),
			)
			.reduce((sum, row) => sum + row.amount, 0),
	);
	const splitCoveragePercent =
		splitDecisionRecords.length > 0
			? Math.round(
					(confirmedSplitRecords.length / splitDecisionRecords.length) * 100,
				)
			: 0;
	const unconfirmedAmountLabel = formatMoney(
		splitDecisionRecords
			.filter((row) => row.statusLabel === "Needs confirmation")
			.reduce((sum, row) => sum + row.totalAmount, 0),
	);

	const memberExposure = Object.values(splitRows)
		.flat()
		.reduce<Record<string, { amount: number; row: ExpenseSplitRow }>>(
			(acc, row) => {
				const id = splitParticipantId(row);
				acc[id] = {
					amount: (acc[id]?.amount ?? 0) + row.amount,
					row,
				};
				return acc;
			},
			{},
		);
	const membersSummary: SplitMemberSummary[] = Object.entries(memberExposure)
		.map(([id, exposure]) => {
			const isCurrentUser = splitRowBelongsToUser(
				exposure.row,
				user?.id,
				currentUserParticipantIds,
			);
			return {
				id,
				name: splitParticipantName(exposure.row, members),
				exposureLabel: formatMoney(exposure.amount),
				directionLabel: isCurrentUser
					? "Your current exposure"
					: "Direction TBD",
			};
		})
		.slice(0, 6);

	const recentActivity: SplitActivitySummary[] = spaceActivity
		.filter(
			(item) => item.action.includes("split") || item.action.includes("draft"),
		)
		.slice(0, 6)
		.map((item) => ({
			id: String(item.id),
			label: toTitleCase(item.action),
			timeLabel: formatRelative(item.created_at),
		}));

	const selectedDecision = splitDecisionRecords.find(
		(row) => row.id === selectedDecisionId,
	);
	const selectedDetail: SelectedSplitDetail | null = selectedDecision
		? {
				id: selectedDecision.id,
				title: selectedDecision.title,
				dateLabel: selectedDecision.dateLabel,
				dateDisplayLabel: selectedDecision.dateDisplayLabel,
				categoryLabel: selectedDecision.categoryLabel,
				spaceLabel: selectedDecision.spaceLabel || (space?.name ?? "Space"),
				totalLabel: selectedDecision.totalLabel,
				myShareLabel: selectedDecision.myShareLabel,
				othersShareLabel: selectedDecision.othersShareLabel,
				participantCount: selectedDecision.participantsDetailed.length,
				splitMethod: selectedDecision.splitMethod,
				sourceStatus: selectedDecision.sourceStatus,
				statusLabel: selectedDecision.statusLabel,
				participants: selectedDecision.participantsDetailed,
				currentUserId: user?.id ?? null,
				reviewTo: selectedDecision.reviewTo,
				expenseTo: selectedDecision.expenseTo,
				sourceDocumentId: selectedDecision.sourceDocumentId,
			}
		: null;

	const moneyFlowNet = 44.2;
	const moneyFlow = {
		// TODO: replace placeholder amounts with dedicated balances endpoint.
		youOweLabel: formatMoney(75.8),
		youAreOwedLabel: formatMoney(120),
		netLabel:
			moneyFlowNet >= 0
				? `+${formatMoney(moneyFlowNet)}`
				: `-${formatMoney(Math.abs(moneyFlowNet))}`,
		netTone:
			moneyFlowNet > 0
				? ("positive" as const)
				: moneyFlowNet < 0
					? ("negative" as const)
					: ("neutral" as const),
	};

	const refreshPaymentLinks = async () => {
		if (numericSpaceId == null) return;
		try {
			const res = await apiClient.paymentLinks.list(numericSpaceId);
			setPaymentLinks(res.links ?? []);
			setPaymentLinksError(null);
		} catch (error) {
			setPaymentLinksError(
				error instanceof Error ? error.message : "Failed to load payment links",
			);
		}
	};

	const createPaymentLink = async () => {
		if (numericSpaceId == null) return;
		setPaymentLinkAction("create");
		setPaymentLinksError(null);
		try {
			const participantId =
				selectedPaymentParticipantId === "unclaimed"
					? null
					: Number(selectedPaymentParticipantId);
			const created = await apiClient.paymentLinks.create(
				numericSpaceId,
				participantId == null
					? {
							expires_in_hours: 24 * 14,
							proof_policy: selectedPaymentProofPolicy,
						}
					: {
							space_participant_id: participantId,
							expires_in_hours: 24 * 14,
							proof_policy: selectedPaymentProofPolicy,
						},
			);
			await navigator.clipboard?.writeText(created.url);
			const refreshed = await apiClient.paymentLinks.list(numericSpaceId);
			setPaymentLinks(refreshed.links ?? []);
			setCopiedPaymentLinkId(null);
		} catch (error) {
			setPaymentLinksError(
				error instanceof Error
					? error.message
					: "Failed to create payment link",
			);
		} finally {
			setPaymentLinkAction(null);
		}
	};

	const revokePaymentLink = async (linkId: number) => {
		if (numericSpaceId == null) return;
		setPaymentLinkAction(`revoke:${linkId}`);
		setPaymentLinksError(null);
		try {
			const revoked = await apiClient.paymentLinks.revoke(
				numericSpaceId,
				linkId,
			);
			setPaymentLinks((current) =>
				current.map((link) => (link.id === linkId ? revoked : link)),
			);
		} catch (error) {
			setPaymentLinksError(
				error instanceof Error
					? error.message
					: "Failed to revoke payment link",
			);
		} finally {
			setPaymentLinkAction(null);
		}
	};

	const copyPaymentLink = async (link: PaymentLinkSummary) => {
		await navigator.clipboard?.writeText(link.url);
		setCopiedPaymentLinkId(link.id);
	};

	return (
		<SpaceWorkspaceLayout
			rightRail={
				<SpaceSplitsRightRail
					draftCount={pendingDrafts.length}
					memberExposureCount={membersSummary.length}
					membersSummary={membersSummary}
					onCloseDetail={() => setSelectedDecisionId(null)}
					recentActivity={recentActivity}
					reviewCount={needsConfirmationCount}
					selectedDetail={selectedDetail}
					splitActivityCount={recentActivity.length}
					splitCoveragePercent={splitCoveragePercent}
					spaceId={numericSpaceId}
					moneyFlow={moneyFlow}
					unconfirmedAmountLabel={unconfirmedAmountLabel}
				/>
			}
			rightRailLabel={`${space?.name ?? "Space"} splits rail`}
			rightRailClassName="border-border/60 bg-muted/30"
		>
			<SpaceHeader
				currentUserId={user?.id ?? null}
				space={
					space ??
					({ id: numericSpaceId, name: "Space", tenant_id: 0 } as Space)
				}
			/>
			{loadError ? (
				<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{loadError}
				</div>
			) : null}
			<section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{[
					{
						key: "needs",
						label: "Needs confirmation",
						value: String(needsConfirmationCount),
						note: "Decisions waiting for people to confirm.",
					},
					{
						key: "drafts",
						label: "Drafts pending",
						value: String(pendingDrafts.length),
						note: "Expense records created by captures and waiting for split review.",
					},
					{
						key: "coverage",
						label: "Split coverage",
						value: `${splitCoveragePercent}%`,
						note: "Confirmed split rows across loaded decisions.",
					},
					{
						key: "my-share",
						label: "My tracked share",
						value: totalTrackedShare,
						note: "Your currently tracked split exposure.",
					},
				].map((widget) => (
					<div
						className="rounded-xl border border-border/60 bg-card px-4 py-3 soft-shadow"
						key={widget.key}
					>
						<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
							{widget.label}
						</p>
						<p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
							{widget.value}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">{widget.note}</p>
					</div>
				))}
			</section>

			{isLoading ? (
				<section className="rounded-xl border border-border/60 bg-card px-4 py-5 text-sm text-muted-foreground">
					Loading split decisions...
				</section>
			) : null}

			<SpacePaymentLinksPanel
				action={paymentLinkAction}
				candidates={paymentLinkCandidateRows}
				coveredPaymentLinkByParticipantId={coveredPaymentLinkByParticipantId}
				copiedLinkId={copiedPaymentLinkId}
				error={paymentLinksError}
				links={activePaymentLinks}
				onCopy={(link) => void copyPaymentLink(link)}
				onCreate={() => void createPaymentLink()}
				onRefresh={() => void refreshPaymentLinks()}
				onRevoke={(linkId) => void revokePaymentLink(linkId)}
				onSelectParticipant={setSelectedPaymentParticipantId}
				onSelectProofPolicy={setSelectedPaymentProofPolicy}
				paymentLinkByParticipantId={paymentLinkByParticipantId}
				proofPolicy={selectedPaymentProofPolicy}
				selectedParticipantId={selectedPaymentParticipantId}
				unclaimedLink={unclaimedPaymentLink}
			/>

			<SpaceSplitDecisionList
				description="Actionable split decisions that still need confirmation."
				emptySubtitle="New split reviews will appear here."
				emptyTitle="All splits are clear"
				eyebrow="Pending split approvals"
				onSelect={setSelectedDecisionId}
				rows={pendingSplitRecords}
				selectedId={selectedDecisionId}
				title={`Pending confirmations in ${space?.name ?? "this space"}`}
				variant="pending"
			/>
			<SpaceSplitDecisionList
				description="Saved split decisions with lower urgency."
				emptySubtitle="Confirmed rows will show once approvals are saved."
				emptyTitle="No confirmed splits yet."
				eyebrow="Confirmed splits"
				onSelect={setSelectedDecisionId}
				rows={confirmedSplitRecords}
				selectedId={selectedDecisionId}
				title={`Confirmed split history in ${space?.name ?? "this space"}`}
				variant="confirmed"
			/>
		</SpaceWorkspaceLayout>
	);
};

const formatPaymentLinkExpiry = (value: string): string => {
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return "Expires later";
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};

const paymentLinkParticipantLabel = (link: PaymentLinkSummary): string => {
	if (link.bound_participant) return link.bound_participant.display_name;
	if (link.claimed_participant) return link.claimed_participant.display_name;
	return "Unclaimed";
};

const formatPaymentLinkMoney = (amount: number, currency = "USD"): string =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency === "MIXED" ? "USD" : currency || "USD",
	}).format(amount);

const paymentLinkCoverageLabel = (link: PaymentLinkSummary): string => {
	const count = link.obligation_count ?? link.obligations?.length ?? 0;
	const total = formatPaymentLinkMoney(link.snapshot_total ?? 0, link.currency);
	return `${total} · ${count} split${count === 1 ? "" : "s"}`;
};

const paymentLinkLifecycleChips = (link: PaymentLinkSummary) =>
	[
		link.missing_required_proof_count > 0
			? {
					key: "missing-proof",
					label: `Missing proof ${link.missing_required_proof_count}`,
					className: "bg-amber-100 text-amber-800",
				}
			: null,
		link.needs_confirmation_count > 0
			? {
					key: "needs-confirmation",
					label: `Needs confirmation ${link.needs_confirmation_count}`,
					className: "bg-blue-100 text-blue-800",
				}
			: null,
		link.sent_with_proof_count > 0
			? {
					key: "sent-proof",
					label: `Sent + proof ${link.sent_with_proof_count}`,
					className: "bg-emerald-100 text-emerald-800",
				}
			: null,
		link.sent_count > 0 && link.sent_with_proof_count < link.sent_count
			? {
					key: "sent",
					label: `Sent ${link.sent_count}`,
					className: "bg-muted text-muted-foreground",
				}
			: null,
		link.confirmed_count > 0
			? {
					key: "confirmed",
					label: `Confirmed ${link.confirmed_count}`,
					className: "bg-foreground text-background",
				}
			: null,
		link.unpaid_count > 0
			? {
					key: "unpaid",
					label: `Unpaid ${link.unpaid_count}`,
					className: "bg-muted text-muted-foreground",
				}
			: null,
		link.proof_count > 0
			? {
					key: "proofs",
					label: `Proofs ${link.proof_count}`,
					className: "bg-sky-100 text-sky-800",
				}
			: null,
	].filter(
		(chip): chip is { key: string; label: string; className: string } =>
			chip != null,
	);

const SpacePaymentLinksPanel = ({
	action,
	candidates,
	coveredPaymentLinkByParticipantId,
	copiedLinkId,
	error,
	links,
	onCopy,
	onCreate,
	onRefresh,
	onRevoke,
	onSelectParticipant,
	onSelectProofPolicy,
	paymentLinkByParticipantId,
	proofPolicy,
	selectedParticipantId,
	unclaimedLink,
}: {
	action: string | null;
	candidates: PaymentLinkCandidate[];
	coveredPaymentLinkByParticipantId: Map<number, PaymentLinkSummary>;
	copiedLinkId: number | null;
	error: string | null;
	links: PaymentLinkSummary[];
	onCopy: (link: PaymentLinkSummary) => void;
	onCreate: () => void;
	onRefresh: () => void;
	onRevoke: (linkId: number) => void;
	onSelectParticipant: (id: string) => void;
	onSelectProofPolicy: (policy: "optional" | "required") => void;
	paymentLinkByParticipantId: Map<number, PaymentLinkSummary>;
	proofPolicy: "optional" | "required";
	selectedParticipantId: string;
	unclaimedLink: PaymentLinkSummary | null;
}) => {
	const selectedCandidate =
		selectedParticipantId === "unclaimed"
			? null
			: (candidates.find(
					(candidate) =>
						String(candidate.participantId) === selectedParticipantId,
				) ?? null);
	const existingSelectedLink =
		selectedCandidate == null
			? unclaimedLink
			: (coveredPaymentLinkByParticipantId.get(
					selectedCandidate.participantId,
				) ??
				paymentLinkByParticipantId.get(selectedCandidate.participantId) ??
				null);
	const existingSelectedLinkIsCurrent =
		existingSelectedLink != null && !existingSelectedLink.is_outdated;
	const createDisabled =
		action === "create" ||
		existingSelectedLinkIsCurrent ||
		(selectedParticipantId !== "unclaimed" && selectedCandidate == null) ||
		(selectedParticipantId === "unclaimed" && candidates.length === 0);
	const proofAttentionCount = links.reduce(
		(sum, link) =>
			sum +
			(link.needs_confirmation_count ?? 0) +
			(link.missing_required_proof_count ?? 0),
		0,
	);

	return (
		<section className="rounded-xl border border-border/60 bg-card p-4 soft-shadow">
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Payment links
					</p>
					<h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
						Send split-backed links
					</h2>
				</div>
				<button
					className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
					disabled={action === "refresh"}
					onClick={onRefresh}
					type="button"
				>
					<RefreshCw className="h-4 w-4" />
					Refresh
				</button>
			</div>

			{error ? (
				<p className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			) : null}

			<div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
					<label
						className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
						htmlFor="payment-link-participant"
					>
						Split candidate
					</label>
					<select
						className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
						id="payment-link-participant"
						onChange={(event) => onSelectParticipant(event.target.value)}
						value={selectedParticipantId}
					>
						<option value="unclaimed">Unclaimed picker</option>
						{candidates.map((candidate) => (
							<option
								key={candidate.participantId}
								value={String(candidate.participantId)}
							>
								{candidate.name} · {candidate.amountLabel}
							</option>
						))}
					</select>
					<div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-background p-1">
						{(["optional", "required"] as const).map((policy) => (
							<button
								className={`min-h-10 rounded-md px-3 text-xs font-semibold transition ${
									proofPolicy === policy
										? "bg-foreground text-background"
										: "text-muted-foreground hover:bg-muted"
								}`}
								key={policy}
								onClick={() => onSelectProofPolicy(policy)}
								type="button"
							>
								{policy === "required" ? "Proof required" : "Proof optional"}
							</button>
						))}
					</div>
					<div className="mt-3 grid gap-2">
						{candidates.length === 0 ? (
							<div className="rounded-lg border border-dashed border-border bg-background/70 p-3 text-sm text-muted-foreground">
								No confirmed split obligations are ready.
							</div>
						) : (
							candidates.slice(0, 4).map((candidate) => {
								const existing =
									coveredPaymentLinkByParticipantId.get(
										candidate.participantId,
									) ?? paymentLinkByParticipantId.get(candidate.participantId);
								return (
									<div
										className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2"
										key={candidate.participantId}
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-foreground">
												{candidate.name}
											</p>
											<p className="text-xs text-muted-foreground">
												{candidate.amountLabel} · {candidate.splitCount} split
												{candidate.splitCount === 1 ? "" : "s"}
											</p>
											{existing ? (
												<p
													className={`mt-1 text-xs font-medium ${
														existing.is_outdated
															? "text-amber-700"
															: "text-emerald-700"
													}`}
												>
													{existing.is_outdated ? "Outdated" : "Covered"} by{" "}
													{paymentLinkCoverageLabel(existing)}
												</p>
											) : null}
										</div>
										<span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
											{existing
												? existing.is_outdated
													? "Outdated"
													: "Covered"
												: "Ready"}
										</span>
									</div>
								);
							})
						)}
					</div>
					<button
						className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
						disabled={createDisabled}
						onClick={onCreate}
						type="button"
					>
						<Link2 className="h-4 w-4" />
						{action === "create"
							? "Creating"
							: existingSelectedLink
								? existingSelectedLink.is_outdated
									? "Create fresh link"
									: "Already covered"
								: "Create and copy link"}
					</button>
					{existingSelectedLink ? (
						<p className="mt-2 text-xs text-muted-foreground">
							{existingSelectedLink.is_outdated
								? "The active link still opens with its old frozen amount. Create a fresh token for the current split set, then revoke the stale one."
								: "Use the active link below, or revoke it before creating a fresh token for this split set."}
						</p>
					) : null}
				</div>

				<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
					<div className="flex items-center justify-between gap-3">
						<p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
							Active links
						</p>
						<span className="rounded-full bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">
							{proofAttentionCount > 0
								? `${proofAttentionCount} to review`
								: links.length}
						</span>
					</div>
					<div className="mt-3 grid gap-2">
						{links.length === 0 ? (
							<div className="rounded-lg border border-dashed border-border bg-background/70 p-3 text-sm text-muted-foreground">
								No active payment links.
							</div>
						) : (
							links.slice(0, 5).map((link) => (
								<div
									className="rounded-lg border border-border/50 bg-background px-3 py-2"
									key={link.id}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-foreground">
												{paymentLinkParticipantLabel(link)}
											</p>
											<p className="truncate text-xs text-muted-foreground">
												{formatPaymentLinkExpiry(link.expires_at)}
											</p>
											<p className="mt-1 text-xs font-medium text-muted-foreground">
												Proof{" "}
												{link.proof_policy === "required"
													? "required"
													: "optional"}
											</p>
											<p className="mt-1 text-xs font-medium text-muted-foreground">
												{paymentLinkCoverageLabel(link)}
											</p>
											{link.is_outdated ? (
												<p className="mt-1 text-xs font-semibold text-amber-700">
													Outdated · {link.outdated_count} changed split
													{link.outdated_count === 1 ? "" : "s"}
												</p>
											) : null}
											{paymentLinkLifecycleChips(link).length > 0 ? (
												<div className="mt-2 flex flex-wrap gap-1.5">
													{paymentLinkLifecycleChips(link).map((chip) => (
														<span
															className={`rounded-full px-2 py-1 text-[11px] font-semibold ${chip.className}`}
															key={chip.key}
														>
															{chip.label}
														</span>
													))}
												</div>
											) : null}
										</div>
										<div className="flex shrink-0 items-center gap-1">
											<button
												className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:bg-muted"
												onClick={() => onCopy(link)}
												title="Copy link"
												type="button"
											>
												<Copy className="h-4 w-4" />
											</button>
											<button
												className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
												disabled={action === `revoke:${link.id}`}
												onClick={() => onRevoke(link.id)}
												title="Revoke link"
												type="button"
											>
												<X className="h-4 w-4" />
											</button>
										</div>
									</div>
									{copiedLinkId === link.id ? (
										<p className="mt-2 text-xs font-semibold text-emerald-700">
											Link copied
										</p>
									) : null}
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</section>
	);
};
