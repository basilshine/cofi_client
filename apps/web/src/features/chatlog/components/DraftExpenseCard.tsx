import type { ExpenseSplitRow, StandardRecurringInterval } from "@cofi/api";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useUserFormat } from "../../../shared/hooks/useUserFormat";
import { apiClient } from "../../../shared/lib/apiClient";
import { isNotFoundHttpError } from "../../../shared/lib/apiErrors";
import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";
import { httpClient } from "../../../shared/lib/httpClient";
import { TransactionInlineActions } from "../../transactions/components/RecurringScheduleInlineActions";
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

export const DraftExpenseCard = ({
	expenseId,
	spaceId,
	chatWorkspace,
	originMessageId,
	onExpenseOrphaned,
	onOpenExpenseThread,
	relatedExpenseStatusHint,
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
}) => {
	const navigate = useNavigate();
	const { user } = useAuth();
	const { formatMoney } = useUserFormat();
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
		}
	};

	const yourShareAmount = useMemo(() => {
		if (user?.id == null || !splitRows?.length) return null;
		const row = splitRows.find((s) => Number(s.user_id) === Number(user.id));
		return row != null ? Number(row.amount) : null;
	}, [splitRows, user?.id]);

	useEffect(() => {
		setIsCancelledExpanded(false);
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
			</div>
		);
	}

	return (
		<div className={cardClassName}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="text-xs font-semibold text-muted-foreground">
						{isDraft ? (
							"DRAFT"
						) : (
							<>
								EXPENSE
								{expense?.status ? (
									<span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-normal text-foreground">
										{expense.status}
									</span>
								) : null}
							</>
						)}
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
									className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent disabled:opacity-50"
									disabled={isActing}
									onClick={() => setSplitDialogOpen(true)}
									type="button"
								>
									Split
								</button>
							) : null}
							<button
								aria-label="Confirm draft expense"
								className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
								disabled={isActing}
								onClick={() => void handleConfirm()}
								type="button"
							>
								{isActing ? "…" : "Confirm"}
							</button>
							<button
								aria-label="Cancel draft expense"
								className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent disabled:opacity-50"
								disabled={isActing}
								onClick={() => void handleCancel()}
								type="button"
							>
								{isActing ? "…" : "Cancel"}
							</button>
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
							{expense && !isDraft && !isCancelled ? (
								<TransactionInlineActions
									className="max-w-[14rem]"
									expenseId={expense.id}
									onAfterChange={() => void handleLoad()}
									onResourceGone={onExpenseOrphaned}
									recurringId={
										expense.recurring_id != null &&
										Number(expense.recurring_id) > 0
											? Number(expense.recurring_id)
											: undefined
									}
									recurringPaused={expense.recurring_paused}
								/>
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
		</div>
	);
};
