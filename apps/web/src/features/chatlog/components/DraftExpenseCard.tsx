import type { ExpenseSplitRow, StandardRecurringInterval } from "@cofi/api";
import { ConfirmIcon, ReviewIcon, SplitExpenseIcon } from "@cofi/ceits-icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useUserFormat } from "../../../shared/hooks/useUserFormat";
import { apiClient } from "../../../shared/lib/apiClient";
import { isNotFoundHttpError } from "../../../shared/lib/apiErrors";
import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";
import { EntityMicro } from "../../../shared/lib/entityPresentation";
import {
	expenseStatusLabel,
	expenseStatusPillClass,
} from "../../../shared/lib/expensePresentation";
import { httpClient } from "../../../shared/lib/httpClient";
import { ExpenseItemRecurringControls } from "./ExpenseItemRecurringControls";
import { ExpenseSplitDialog } from "./ExpenseSplitDialog";

type ItemRecurringConfig = {
	enabled: boolean;
	interval: StandardRecurringInterval;
};

type ExpenseTag = { id: number; name: string };

type ExpenseItem = {
	id: number;
	name: string;
	amount: number;
	emotion?: string;
	tags?: ExpenseTag[];
};

type Expense = {
	id: number;
	user_id?: number;
	description?: string;
	status?: string;
	items?: ExpenseItem[];
	created_at?: string;
	recurring_id?: number;
	recurring_paused?: boolean;
};

const splitRowBelongsToUser = (
	row: ExpenseSplitRow,
	userId: number | null | undefined,
): boolean => {
	if (userId == null) return false;
	if (row.user_id != null && Number(row.user_id) === Number(userId))
		return true;
	const participant = row.participant;
	if (participant == null) return false;
	return (
		Number(participant.user_id ?? participant.linked_user_id) === Number(userId)
	);
};

export const DraftExpenseCard = ({
	expenseId,
	spaceId,
	chatWorkspace,
	originMessageId,
	onExpenseOrphaned,
	onOpenExpenseThread,
	relatedExpenseStatusHint,
	compact = false,
	isSelected = false,
	inspectorOpen = false,
}: {
	expenseId: string | number;
	/** Required to attach web Chat context when saving a recurring schedule. */
	spaceId?: string | number;
	/** Active chat workspace (passed through thread deep links). */
	chatWorkspace?: ChatWorkspaceScope;
	/** Chat message containing this draft (for server validation). */
	originMessageId?: string | number;
	/** When the expense no longer exists (404) after delete or on load; parent may remove the chat row. */
	onExpenseOrphaned?: () => void;
	/** When set (e.g. ChatLogPage), opens the expense review thread inline instead of navigating. */
	onOpenExpenseThread?: (expenseId: string | number) => void;
	/** From chat list: `gone` / `inaccessible` skips GET (deleted or not yours). */
	relatedExpenseStatusHint?: string;
	/** Narrow summary; tap opens the workspace expense thread panel. */
	compact?: boolean;
	/** Chat-selected visual state when inspector is open for this expense. */
	isSelected?: boolean;
	/** Whether the shared inspector is currently open in chat. */
	inspectorOpen?: boolean;
}) => {
	const navigate = useNavigate();
	const { user } = useAuth();
	const { formatMoney, formatDateTime } = useUserFormat();
	const [expense, setExpense] = useState<Expense | null>(null);
	const [creatorLabel, setCreatorLabel] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [orphanNotice, setOrphanNotice] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isActing, setIsActing] = useState(false);
	const [isCancelledExpanded, setIsCancelledExpanded] = useState(false);
	const [itemRecurring, setItemRecurring] = useState<
		Record<number, ItemRecurringConfig>
	>({});
	const [splitDialogOpen, setSplitDialogOpen] = useState(false);
	const [splitRows, setSplitRows] = useState<ExpenseSplitRow[] | null>(null);
	const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
	const [showDangerActions, setShowDangerActions] = useState(false);

	const total = useMemo(() => {
		const items = expense?.items ?? [];
		return items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
	}, [expense]);

	const isDraft = expense?.status === "draft";
	const isCancelled = expense?.status === "cancelled";
	const itemCount = expense?.items?.length ?? 0;

	const handleLoad = async () => {
		setIsLoading(true);
		setError(null);
		setOrphanNotice(null);
		try {
			const res = await httpClient.get<Expense>(
				`/api/v1/finances/expenses/${String(expenseId)}`,
			);
			setExpense(res.data);
			try {
				const sr = await apiClient.finances.expenses.listSplits(expenseId);
				setSplitRows(sr.splits ?? []);
			} catch {
				setSplitRows(null);
			}
		} catch (e) {
			setExpense(null);
			if (isNotFoundHttpError(e)) {
				setOrphanNotice("This expense was removed or is no longer available.");
			} else {
				setError(e instanceof Error ? e.message : "Failed to load draft");
			}
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		const items = expense?.items ?? [];
		setItemRecurring((prev) => {
			const next: Record<number, ItemRecurringConfig> = { ...prev };
			const ids = new Set(items.map((i) => i.id));
			for (const it of items) {
				if (next[it.id] === undefined) {
					next[it.id] = { enabled: false, interval: "monthly" };
				}
			}
			for (const k of Object.keys(next)) {
				const id = Number(k);
				if (!ids.has(id)) delete next[id];
			}
			return next;
		});
	}, [expense?.items]);

	useEffect(() => {
		let cancelled = false;
		const creatorId = Number(expense?.user_id ?? 0);
		if (!creatorId) {
			setCreatorLabel(null);
			return;
		}
		if (user?.id != null && creatorId === user.id) {
			setCreatorLabel("You");
			return;
		}
		if (spaceId == null) {
			setCreatorLabel(`User ${creatorId}`);
			return;
		}
		void (async () => {
			try {
				const res = await apiClient.spaces.listMembers(spaceId);
				if (cancelled) return;
				const m = res.members.find((x) => Number(x.user_id) === creatorId);
				const name =
					(m?.name ?? "").trim() ||
					(m?.email ?? "").trim() ||
					`User ${creatorId}`;
				setCreatorLabel(name);
			} catch {
				if (!cancelled) setCreatorLabel(`User ${creatorId}`);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [expense?.user_id, spaceId, user?.id]);

	const handleConfirm = async () => {
		setIsActing(true);
		setError(null);
		setSuccessMessage(null);
		try {
			if (!expense) {
				setError("Draft is still loading.");
				return;
			}
			await httpClient.post(
				`/api/v1/finances/expenses/${String(expenseId)}/confirm`,
			);
			let recurringCreated = 0;
			if (spaceId != null && expense.items?.length) {
				for (const it of expense.items) {
					const cfg = itemRecurring[it.id];
					if (!cfg?.enabled) continue;
					if (!(it.name ?? "").trim() || Number(it.amount) === 0) continue;
					const tagLabel = it.tags?.[0]?.name ?? "recurring";
					await apiClient.finances.recurring.create({
						name: it.name,
						amount: it.amount,
						interval: cfg.interval,
						tag_label: tagLabel,
						space_id: Number(spaceId),
						...(originMessageId != null &&
						String(originMessageId).length > 0 &&
						!Number.isNaN(Number(originMessageId))
							? { origin_message_id: Number(originMessageId) }
							: {}),
					});
					recurringCreated += 1;
				}
			}
			await handleLoad();
			setSuccessMessage(
				recurringCreated > 0
					? `Expense confirmed. ${recurringCreated} recurring line(s) scheduled.`
					: "Expense confirmed.",
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to confirm draft");
		} finally {
			setIsActing(false);
		}
	};

	const handleCancel = async () => {
		setIsActing(true);
		setError(null);
		setSuccessMessage(null);
		try {
			await httpClient.post(
				`/api/v1/finances/expenses/${String(expenseId)}/cancel`,
			);
			await handleLoad();
			setSuccessMessage("Draft cancelled.");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to cancel draft");
		} finally {
			setIsActing(false);
			setConfirmCancelOpen(false);
		}
	};

	const yourShareAmount = useMemo(() => {
		if (user?.id == null || !splitRows?.length) return null;
		const row = splitRows.find((s) => splitRowBelongsToUser(s, user.id));
		return row != null ? Number(row.amount) : null;
	}, [splitRows, user?.id]);

	useEffect(() => {
		setIsCancelledExpanded(false);
		setShowDangerActions(false);
		if (
			relatedExpenseStatusHint === "gone" ||
			relatedExpenseStatusHint === "inaccessible"
		) {
			setExpense(null);
			setError(null);
			setOrphanNotice(
				relatedExpenseStatusHint === "inaccessible"
					? "This expense is not available to your account."
					: "This expense was removed or is no longer available.",
			);
			return;
		}
		void handleLoad();
	}, [expenseId, relatedExpenseStatusHint]);

	useEffect(() => {
		if (!orphanNotice || !onExpenseOrphaned) return;
		const t = window.setTimeout(() => onExpenseOrphaned(), 2500);
		return () => window.clearTimeout(t);
	}, [orphanNotice, onExpenseOrphaned]);

	if (orphanNotice) {
		return (
			<output
				aria-live="polite"
				className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
			>
				{orphanNotice}
				{onExpenseOrphaned ? (
					<span className="mt-1 block text-[10px] text-muted-foreground">
						This chat line will be removed in a moment.
					</span>
				) : null}
			</output>
		);
	}

	if (isLoading && !expense) {
		return (
			<div className="rounded-md border border-border bg-muted px-3 py-2 text-xs">
				Loading draft…
			</div>
		);
	}

	if (error && !expense) {
		return (
			<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
				{error}
			</div>
		);
	}

	const items = expense?.items ?? [];

	const cardClassName = [
		"rounded-md border p-3",
		expense?.status === "approved"
			? "border-emerald-500/40 bg-emerald-500/5"
			: expense?.status === "cancelled"
				? "border-muted-foreground/30 bg-muted/50 opacity-90"
				: "border-border bg-card",
	].join(" ");
	const cancelConfirmDialog = confirmCancelOpen ? (
		<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4">
			<div
				aria-modal="true"
				className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-xl"
				role="dialog"
			>
				<h3 className="text-sm font-semibold text-foreground">
					Cancel draft expense?
				</h3>
				<p className="mt-2 text-sm text-muted-foreground">
					This draft will be marked as cancelled and removed from active flows.
					You can still view it in cancelled state.
				</p>
				<div className="mt-4 flex items-center justify-end gap-2">
					<button
						className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
						disabled={isActing}
						onClick={() => setConfirmCancelOpen(false)}
						type="button"
					>
						Keep draft
					</button>
					<button
						className="inline-flex h-9 items-center rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
						disabled={isActing}
						onClick={() => void handleCancel()}
						type="button"
					>
						{isActing ? "Cancelling…" : "Cancel expense"}
					</button>
				</div>
			</div>
		</div>
	) : null;

	if (isCancelled && !isCancelledExpanded) {
		return (
			<div className={cardClassName}>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="min-w-0 flex-1">
						<div className="text-xs font-semibold text-muted-foreground">
							Cancelled expense
							<span className="ml-2 font-normal text-muted-foreground">
								#{String(expense?.id ?? expenseId)}
							</span>
						</div>
						<div className="mt-0.5 truncate text-sm font-medium text-muted-foreground">
							{expense?.description || "Draft transaction"}
						</div>
						<div className="mt-0.5 text-xs text-muted-foreground">
							Total{" "}
							<span className="font-semibold text-foreground">
								{formatMoney(total)}
							</span>
						</div>
					</div>
					<button
						aria-expanded={false}
						aria-label="Show cancelled expense details"
						className="inline-flex h-9 shrink-0 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent"
						onClick={() => setIsCancelledExpanded(true)}
						type="button"
					>
						Show details
					</button>
				</div>
				{cancelConfirmDialog}
			</div>
		);
	}

	if (compact && expense && onOpenExpenseThread && spaceId != null) {
		const handleOpenPanel = () => {
			onOpenExpenseThread(expense.id);
		};
		const previewRows = items.slice(0, 3);
		const moreCount = items.length - previewRows.length;

		const chatToolbarBtn =
			"inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 sm:h-8";
		const rawStatus = (expense.status ?? "").toLowerCase();
		const isApproved = rawStatus === "approved";
		const isNeedsReview = !isDraft && !isApproved;
		const compactCardTone = isDraft
			? "border-amber-300/40 bg-[linear-gradient(180deg,#fffaf1_0%,#fff6ea_100%)] ring-amber-300/30"
			: isApproved
				? "border-emerald-300/40 bg-[linear-gradient(180deg,#f5fbf6_0%,#eff8f1_100%)] ring-emerald-300/25"
				: "border-amber-200/45 bg-[linear-gradient(180deg,#fff9ef_0%,#fdf3dd_100%)] ring-amber-200/30";
		const statusLabel = isDraft
			? "Draft"
			: isApproved
				? "Approved"
				: "Needs review";
		const sourceLabel = isDraft
			? "Ceits parsed this"
			: isNeedsReview
				? "Needs agreement"
				: "Ceits saved this";
		const selectedInInspector = inspectorOpen && isSelected;
		const canReviewFlow = isDraft || isNeedsReview;
		const handleReview = () => {
			if (canReviewFlow) {
				window.location.assign(
					`/console/review?spaceId=${encodeURIComponent(String(spaceId))}`,
				);
				return;
			}
			handleOpenPanel();
		};

		return (
			<div className="w-full min-w-0 max-w-full">
				<div
					className={`space-y-1.5 rounded-xl border px-2.5 py-2 shadow-sm ${compactCardTone} ${
						isSelected
							? "border-[rgba(120,98,62,0.42)] bg-[linear-gradient(180deg,#fffbf3_0%,#f8efe2_100%)] shadow-[0_4px_12px_-10px_rgba(70,55,30,0.42)]"
							: ""
					}`}
				>
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
								<EntityMicro
									entity={{ label: "Expense", visualKey: "expense" }}
								/>
								<span>{sourceLabel}</span>
								<span>·</span>
								<span className={expenseStatusPillClass(expense.status)}>
									{statusLabel}
								</span>
							</div>
							<div className="mt-1 flex items-start justify-between gap-3">
								<div className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
									{expense.description?.trim() || "Draft transaction"}
								</div>
								<div className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
									{formatMoney(total)}
								</div>
							</div>
							<div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
								<span>{itemCount} items</span>
								{creatorLabel ? <span>· {creatorLabel}</span> : null}
								{!isDraft && isApproved ? (
									<span>· Updated after confirmation</span>
								) : null}
								{expense.created_at ? (
									<span>
										· {isDraft ? "Parsed" : "Saved"}{" "}
										{formatDateTime(expense.created_at)}
									</span>
								) : null}
							</div>
						</div>
					</div>

					{previewRows.length > 0 ? (
						<div className="space-y-0.5 rounded-lg bg-[rgba(255,255,255,0.34)] px-2 py-1.5">
							<div className="space-y-0.5">
								{previewRows.map((it) => (
									<div
										className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-[11px] text-foreground/90 transition-colors hover:bg-[rgba(120,100,80,0.06)]"
										key={it.id}
									>
										<span className="line-clamp-1 min-w-0 flex-1">
											{it.name}
										</span>
										<span className="shrink-0 tabular-nums text-muted-foreground">
											{formatMoney(it.amount)}
										</span>
									</div>
								))}
							</div>
							{moreCount > 0 ? (
								<div className="px-1 pt-0.5 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2">
									+{moreCount} more line{moreCount === 1 ? "" : "s"}
								</div>
							) : null}
						</div>
					) : (
						<p className="rounded-md border border-dashed border-[rgba(120,100,80,0.22)] bg-[rgba(255,255,255,0.48)] px-2.5 py-2 text-[11px] text-muted-foreground">
							No line items on this expense yet.
						</p>
					)}
				</div>
				<div
					aria-label="Expense actions"
					className="mt-1 flex flex-wrap items-center gap-1.5"
					role="group"
				>
					<button
						aria-label={
							canReviewFlow && !selectedInInspector
								? "Open review flow for this expense"
								: "Open expense inspector"
						}
						className={`${chatToolbarBtn} inline-flex items-center gap-1 border-border bg-background hover:bg-accent`}
						onClick={selectedInInspector ? handleOpenPanel : handleReview}
						type="button"
					>
						<ReviewIcon className="h-3.5 w-3.5 shrink-0 opacity-90" size={14} />
						{canReviewFlow && !selectedInInspector ? "Review" : "View"}
					</button>
					{isDraft && !selectedInInspector ? (
						<>
							<button
								aria-label="Split expense between space members"
								className={`${chatToolbarBtn} inline-flex items-center gap-1 border-border bg-background hover:bg-accent`}
								disabled={isActing}
								onClick={() => setSplitDialogOpen(true)}
								type="button"
							>
								<SplitExpenseIcon
									className="h-3.5 w-3.5 shrink-0 opacity-90"
									size={14}
								/>
								Split
							</button>
							<button
								aria-label="Confirm draft expense"
								className={`${chatToolbarBtn} inline-flex items-center gap-1 border-primary bg-primary text-primary-foreground hover:bg-primary/90`}
								disabled={isActing}
								onClick={() => void handleConfirm()}
								type="button"
							>
								{isActing ? (
									"…"
								) : (
									<>
										<ConfirmIcon
											className="h-3.5 w-3.5 shrink-0 text-primary-foreground"
											positiveColor="hsl(var(--primary-foreground))"
											size={14}
										/>
										Confirm
									</>
								)}
							</button>
							<button
								aria-expanded={showDangerActions}
								aria-label="Toggle more actions"
								className={`${chatToolbarBtn} border-border bg-background hover:bg-accent`}
								onClick={() => setShowDangerActions((v) => !v)}
								type="button"
							>
								More
							</button>
							{showDangerActions ? (
								<button
									aria-label="Cancel draft expense"
									className={`${chatToolbarBtn} border-destructive/35 bg-background text-destructive hover:bg-destructive/10`}
									disabled={isActing}
									onClick={() => setConfirmCancelOpen(true)}
									type="button"
								>
									{isActing ? "…" : "Cancel"}
								</button>
							) : null}
						</>
					) : !selectedInInspector ? (
						<>
							<button
								aria-label="Review split details"
								className={`${chatToolbarBtn} border-border bg-background hover:bg-accent`}
								onClick={handleOpenPanel}
								type="button"
							>
								Split
							</button>
							<button
								aria-label="Open more expense options"
								className={`${chatToolbarBtn} border-border bg-background hover:bg-accent`}
								onClick={handleOpenPanel}
								type="button"
							>
								More
							</button>
						</>
					) : (
						<button
							aria-label="Open more expense options"
							className={`${chatToolbarBtn} border-border bg-background hover:bg-accent`}
							onClick={handleOpenPanel}
							type="button"
						>
							More
						</button>
					)}
				</div>

				{successMessage ? (
					<output
						aria-live="polite"
						className="block rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100"
					>
						{successMessage}
					</output>
				) : null}

				{error ? (
					<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
						{error}
					</div>
				) : null}

				<ExpenseSplitDialog
					currentUserId={user?.id ?? null}
					expenseId={expense.id}
					expenseOwnerUserId={Number(expense.user_id ?? user?.id ?? 0)}
					expenseTotal={total}
					formatMoney={formatMoney}
					onOpenChange={setSplitDialogOpen}
					onSaved={() => void handleLoad()}
					open={splitDialogOpen}
					spaceId={spaceId}
				/>
				{cancelConfirmDialog}
			</div>
		);
	}

	return (
		<div className={cardClassName}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-1.5">
						<EntityMicro entity={{ label: "Expense", visualKey: "expense" }} />
						{expense?.status ? (
							<span className={expenseStatusPillClass(expense.status)}>
								{expenseStatusLabel(expense.status)}
							</span>
						) : null}
					</div>
					<div className="mt-1 truncate text-sm font-medium">
						{expense?.description || "Draft transaction"}
					</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Total:{" "}
						<span className="font-semibold text-foreground">
							{formatMoney(total)}
						</span>
						{isDraft &&
						spaceId != null &&
						yourShareAmount != null &&
						!Number.isNaN(yourShareAmount) ? (
							<span className="ml-2">
								· Your share:{" "}
								<span className="font-semibold text-foreground">
									{formatMoney(yourShareAmount)}
								</span>
							</span>
						) : null}
					</div>
					<div className="mt-1 flex flex-wrap items-center gap-1.5">
						{itemCount > 0 ? (
							<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
								{itemCount} item{itemCount === 1 ? "" : "s"}
							</span>
						) : null}
						{creatorLabel ? (
							<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
								{creatorLabel === "You" ? "You" : `By ${creatorLabel}`}
							</span>
						) : null}
					</div>
				</div>

				<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
					{spaceId != null && expense ? (
						<button
							aria-label={
								isDraft
									? "Review and edit expense in thread"
									: "Open expense discussion thread"
							}
							className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent"
							onClick={() =>
								onOpenExpenseThread
									? onOpenExpenseThread(expense.id)
									: navigate(
											`/console/chat/thread?spaceId=${encodeURIComponent(String(spaceId))}&expenseId=${encodeURIComponent(String(expense.id))}`,
											{
												state: chatWorkspace ? { chatWorkspace } : undefined,
											},
										)
							}
							type="button"
						>
							{isDraft ? "Review & edit" : "Discuss"}
						</button>
					) : null}
					{isDraft ? (
						<>
							{spaceId != null ? (
								<button
									aria-label="Split expense between space members"
									className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent disabled:opacity-50"
									disabled={isActing}
									onClick={() => setSplitDialogOpen(true)}
									type="button"
								>
									<SplitExpenseIcon
										className="h-3.5 w-3.5 shrink-0 opacity-90"
										size={14}
									/>
									Split
								</button>
							) : null}
							<button
								aria-label="Confirm draft expense"
								className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
								disabled={isActing}
								onClick={() => void handleConfirm()}
								type="button"
							>
								{isActing ? (
									"…"
								) : (
									<>
										<ConfirmIcon
											className="h-3.5 w-3.5 shrink-0 text-primary-foreground"
											positiveColor="hsl(var(--primary-foreground))"
											size={14}
										/>
										Confirm
									</>
								)}
							</button>
							<button
								aria-expanded={showDangerActions}
								aria-label="Toggle more actions"
								className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent disabled:opacity-50"
								onClick={() => setShowDangerActions((v) => !v)}
								type="button"
							>
								More
							</button>
							{showDangerActions ? (
								<button
									aria-label="Cancel draft expense"
									className="inline-flex h-9 items-center rounded-md border border-destructive/35 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
									disabled={isActing}
									onClick={() => setConfirmCancelOpen(true)}
									type="button"
								>
									{isActing ? "…" : "Cancel"}
								</button>
							) : null}
						</>
					) : (
						<>
							{isCancelled ? (
								<button
									aria-expanded={true}
									aria-label="Hide cancelled expense details"
									className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent"
									onClick={() => setIsCancelledExpanded(false)}
									type="button"
								>
									Hide details
								</button>
							) : null}
						</>
					)}
				</div>
			</div>

			{successMessage ? (
				<output
					aria-live="polite"
					className="mt-2 block rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100"
				>
					{successMessage}
				</output>
			) : null}

			{error ? (
				<div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					{error}
				</div>
			) : null}

			{items.length ? (
				<ul className="mt-3 space-y-2">
					{(isDraft && spaceId != null ? items : items.slice(0, 8)).map(
						(it) => (
							<li
								className="rounded-md border border-border bg-background px-3 py-2"
								key={it.id}
							>
								<div className="flex items-center justify-between gap-3">
									<div className="min-w-0 truncate text-sm font-medium">
										{it.name}
									</div>
									<div className="shrink-0 text-sm font-semibold">
										{formatMoney(it.amount)}
									</div>
								</div>
								<div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
									{it.emotion ? <span>emotion: {it.emotion}</span> : null}
									{it.tags?.length ? (
										<span className="truncate">
											tags: {it.tags.map((t) => t.name).join(", ")}
										</span>
									) : null}
								</div>
								{isDraft && spaceId != null ? (
									<ExpenseItemRecurringControls
										disabled={isActing}
										enabled={itemRecurring[it.id]?.enabled ?? false}
										idPrefix={`draft-${String(expenseId)}-item-${String(it.id)}`}
										interval={itemRecurring[it.id]?.interval ?? "monthly"}
										onEnabledChange={(v) =>
											setItemRecurring((prev) => ({
												...prev,
												[it.id]: {
													enabled: v,
													interval: prev[it.id]?.interval ?? "monthly",
												},
											}))
										}
										onIntervalChange={(iv) =>
											setItemRecurring((prev) => ({
												...prev,
												[it.id]: {
													enabled: prev[it.id]?.enabled ?? false,
													interval: iv,
												},
											}))
										}
									/>
								) : null}
							</li>
						),
					)}
					{!(isDraft && spaceId != null) && items.length > 8 ? (
						<li className="text-xs text-muted-foreground">
							…and {items.length - 8} more items
						</li>
					) : null}
				</ul>
			) : (
				<div className="mt-3 text-xs text-muted-foreground">
					No items found.
				</div>
			)}

			{spaceId != null && expense != null ? (
				<ExpenseSplitDialog
					currentUserId={user?.id ?? null}
					expenseId={expense.id}
					expenseOwnerUserId={Number(expense.user_id ?? user?.id ?? 0)}
					expenseTotal={total}
					formatMoney={formatMoney}
					onOpenChange={setSplitDialogOpen}
					onSaved={() => void handleLoad()}
					open={splitDialogOpen}
					spaceId={spaceId}
				/>
			) : null}
			{cancelConfirmDialog}
		</div>
	);
};
