import type {
	DashboardResponse,
	ExpenseDetail,
	ExpenseSplitRow,
	Space,
	SpaceActivityItem,
	SpaceMember,
	SpaceParticipant,
	Transaction,
} from "@cofi/api";
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

type ApprovalReviewItem = {
	kind: "expense_thread_approval";
	expense_id: number;
	space_id: number;
	label: string;
	total: number;
	updated_at: string;
};

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
	participantsDetailed: Array<{
		id: string;
		name: string;
		amountLabel: string;
		isCurrentUser: boolean;
	}>;
};

const isApprovalItem = (it: unknown): it is ApprovalReviewItem =>
	it != null &&
	typeof it === "object" &&
	"kind" in it &&
	(it as { kind: string }).kind === "expense_thread_approval";

const toNumericId = (value: string | number | undefined): number | null => {
	if (value == null) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

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
	if (t.includes("receipt")) return "Receipt";
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
		return "Receipt";
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
		return "Manual expense";
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
		void (async () => {
			try {
				const [dashRes, membersRes, participantsRes, txRes, activityRes] =
					await Promise.all([
						apiClient.dashboard.get({
							variant: "personal",
							period: "month",
							space_id: numericSpaceId,
						}),
						apiClient.spaces.listMembers(numericSpaceId).catch(() => null),
						apiClient.spaces.listParticipants(numericSpaceId).catch(() => null),
						apiClient.spaces.listTransactions(numericSpaceId, { limit: 60 }),
						apiClient.spaces.activity
							.list(numericSpaceId, { limit: 40 })
							.catch(() => ({ items: [] })),
					]);

				const reviewExpenseIds = (dashRes.review_queue?.items ?? [])
					.flatMap((item) => (isApprovalItem(item) ? [item] : []))
					.filter((item) => Number(item.space_id) === Number(numericSpaceId))
					.map((item) => Number(item.expense_id))
					.filter((id) => Number.isFinite(id));

				const expenseIds = Array.from(
					new Set([
						...txRes.map((tx) => toNumericId(tx.id)),
						...reviewExpenseIds,
					]),
				)
					.filter((id): id is number => id != null)
					.slice(0, 36);

				const [splitSettled, detailSettled] = await Promise.all([
					Promise.allSettled(
						expenseIds.map(async (expenseId) => {
							const data =
								await apiClient.finances.expenses.listSplits(expenseId);
							return { expenseId, rows: data.splits ?? [] };
						}),
					),
					Promise.allSettled(
						expenseIds.map(async (expenseId) => {
							const detail = await apiClient.finances.expenses.get(expenseId);
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
	const reviewItems = (dashboardData?.review_queue?.items ?? [])
		.flatMap((item) => (isApprovalItem(item) ? [item] : []))
		.filter((item) => Number(item.space_id) === Number(numericSpaceId));
	const pendingDrafts = (dashboardData?.pending_drafts ?? []).filter(
		(item) => Number(item.space_id) === Number(numericSpaceId),
	);

	const transactionByExpenseId = new Map<number, Transaction>(
		transactions
			.map((transaction) => [toNumericId(transaction.id), transaction] as const)
			.filter((entry): entry is [number, Transaction] => entry[0] != null),
	);
	const reviewByExpenseId = new Map<number, ApprovalReviewItem>(
		reviewItems.map((item) => [Number(item.expense_id), item]),
	);
	const currentUserParticipantIds = new Set(
		participants
			.filter((participant) => participantBelongsToUser(participant, user?.id))
			.map((participant) => Number(participant.id)),
	);

	const coverageIds = Array.from(
		new Set([
			...Object.keys(splitRows).map((id) => Number(id)),
			...Object.keys(expenseDetails).map((id) => Number(id)),
			...Array.from(transactionByExpenseId.keys()),
			...Array.from(reviewByExpenseId.keys()),
		]),
	).filter((id) => Number.isFinite(id));

	const splitDecisionRecords: SplitDecisionRecord[] = coverageIds.flatMap(
		(expenseId) => {
			const transaction = transactionByExpenseId.get(expenseId);
			const review = reviewByExpenseId.get(expenseId);
			const rows = splitRows[expenseId] ?? [];
			const detail = expenseDetails[expenseId];
			const statusLabel = review
				? "Needs confirmation"
				: rows.length > 0
					? "Split saved"
					: "Missing splits";
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
			const total = detail?.amount ?? transaction?.total ?? review?.total ?? 0;
			const rawTitle =
				detail?.title?.trim() ||
				transaction?.title?.trim() ||
				review?.label?.trim() ||
				detail?.payee_text?.trim() ||
				transaction?.description?.trim() ||
				`Expense #${expenseId}`;
			const sourceStatus = normalizeSourceStatus(
				detail?.status || transaction?.status || undefined,
			);
			const dateLabel =
				detail?.txn_date ||
				transaction?.txn_date ||
				formatRelative(transaction?.created_at || review?.updated_at);
			const splitMethod =
				rows.length <= 1
					? "Manual"
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
				: formatRelative(transaction?.created_at || review?.updated_at);
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
					participantsFallback:
						review != null
							? "Participants pending confirmation"
							: "No splits saved",
					myShareLabel: formatMoney(myShare),
					totalLabel: formatMoney(total),
					statusLabel: mappedStatusLabel,
					totalAmount: total,
					categoryLabel: displayCategory,
					dateDisplayLabel,
					splitMethod,
					othersShareLabel: formatMoney(othersShareAmount),
					reviewTo: `/console/review?spaceId=${encodeURIComponent(sidStr)}`,
					expenseTo: buildExpenseDetailHref(sidStr, expenseId),
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
						note: "Draft expenses likely to become split decisions.",
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
