import type { ExpenseDetail, ExpenseSplitRow } from "@cofi/api";
import { Calendar, ReceiptText, Split } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../shared/lib/apiClient";
import {
	EntityIcon,
	EntityMicro,
} from "../../../shared/lib/entityPresentation";
import {
	expenseStatusLabel,
	expenseStatusPillClass,
} from "../../../shared/lib/expensePresentation";

type SpaceExpenseDetailPanelProps = {
	expenseId: string | number;
	formatDateTime: (value: string) => string;
	formatMoney: (value: number) => string;
	onClose: () => void;
	onReloadList: () => void;
	spaceId: string | number;
};

const splitDisplayName = (row: ExpenseSplitRow): string => {
	const participant = row.participant;
	if (participant?.display_name?.trim()) return participant.display_name.trim();
	if (participant?.email?.trim()) return participant.email.trim();
	if (row.user_id != null) return `User ${row.user_id}`;
	if (row.space_participant_id != null) {
		return `Participant ${row.space_participant_id}`;
	}
	return "Participant";
};

const expenseTitle = (expense: ExpenseDetail): string => {
	const title = expense.title?.trim();
	if (title && title.toLowerCase() !== "expense") return title;
	const description = expense.description?.trim();
	if (description) return description;
	const firstItem = expense.items?.find((item) => item.name?.trim());
	return firstItem?.name?.trim() || `Expense #${expense.id}`;
};

export const SpaceExpenseDetailPanel = ({
	expenseId,
	formatDateTime,
	formatMoney,
	onClose,
	onReloadList,
	spaceId,
}: SpaceExpenseDetailPanelProps) => {
	const [expense, setExpense] = useState<ExpenseDetail | null>(null);
	const [splits, setSplits] = useState<ExpenseSplitRow[] | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const [detail, splitResult] = await Promise.all([
				apiClient.spaces.expenses.get(spaceId, expenseId),
				apiClient.spaces.expenses
					.listSplits(spaceId, expenseId)
					.catch(() => null),
			]);
			setExpense(detail);
			setSplits(splitResult?.splits ?? null);
		} catch (err) {
			setExpense(null);
			setSplits(null);
			setError(
				err instanceof Error ? err.message : "Failed to load expense detail.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		void load();
	}, [expenseId, spaceId]);

	const total = useMemo(() => {
		const explicit = Number(expense?.amount ?? 0);
		if (Number.isFinite(explicit) && explicit > 0) return explicit;
		return (expense?.items ?? []).reduce(
			(sum, item) => sum + (Number(item.amount) || 0),
			0,
		);
	}, [expense]);

	const status = expense?.status?.trim() || "draft";
	const reviewHref =
		expense?.source_document_id != null
			? `/console/review?spaceId=${encodeURIComponent(String(spaceId))}&sourceDocumentId=${encodeURIComponent(String(expense.source_document_id))}`
			: `/console/review?spaceId=${encodeURIComponent(String(spaceId))}`;

	return (
		<aside className="flex h-full min-h-0 flex-col border-l border-[rgba(120,100,80,0.12)] bg-[linear-gradient(180deg,#fdfaf5_0%,#f5f0e8_100%)]">
			<div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(120,100,80,0.12)] px-4 py-3">
				<div className="min-w-0">
					<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
						Expense record
					</p>
					<h2 className="mt-0.5 truncate font-display text-lg font-bold tracking-tight text-foreground">
						{expense ? expenseTitle(expense) : `Expense #${expenseId}`}
					</h2>
				</div>
				<button
					className="inline-flex h-8 shrink-0 items-center rounded-full border border-[rgba(120,100,80,0.2)] bg-white/80 px-3 text-xs font-semibold text-muted-foreground transition hover:bg-white hover:text-foreground"
					onClick={onClose}
					type="button"
				>
					Back
				</button>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
				{error ? (
					<div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</div>
				) : null}

				{isLoading && !expense ? (
					<p className="text-sm text-muted-foreground">Loading expense…</p>
				) : null}

				{expense ? (
					<div className="space-y-4">
						<section className="rounded-2xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.88)] p-4 shadow-sm">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<EntityMicro
										entity={{ label: "Expense", visualKey: "expense" }}
									/>
									<p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
										{formatMoney(total)}
									</p>
									<div className="mt-2 flex flex-wrap items-center gap-2">
										<span className={expenseStatusPillClass(status)}>
											{expenseStatusLabel(status)}
										</span>
										{expense.txn_date ? (
											<span className="inline-flex items-center gap-1 rounded-full border border-[rgba(120,100,80,0.16)] bg-white/65 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
												<Calendar className="h-3.5 w-3.5" />
												{expense.txn_date}
											</span>
										) : null}
									</div>
								</div>
								<EntityIcon size="md" visualKey="expense" />
							</div>
							{expense.payee_text || expense.vendor?.name ? (
								<p className="mt-3 text-sm text-muted-foreground">
									{expense.vendor?.name ?? expense.payee_text}
								</p>
							) : null}
							{expense.created_at ? (
								<p className="mt-2 text-xs text-muted-foreground">
									Created {formatDateTime(expense.created_at)}
								</p>
							) : null}
							{expense.source_document_id != null ? (
								<Link
									className="mt-3 inline-flex items-center rounded-lg border border-[rgba(48,83,120,0.2)] bg-[rgba(239,247,255,0.72)] px-2.5 py-1 text-xs font-semibold text-[rgba(34,72,108,0.92)] transition hover:bg-[rgba(232,242,255,0.95)]"
									to={reviewHref}
								>
									Source capture #{expense.source_document_id}
								</Link>
							) : null}
						</section>

						<section className="rounded-2xl border border-[rgba(120,100,80,0.14)] bg-white/72 p-4 shadow-sm">
							<div className="flex items-center justify-between gap-2">
								<h3 className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
									<ReceiptText className="h-4 w-4 text-muted-foreground" />
									Line items
								</h3>
								<span className="text-xs font-semibold text-muted-foreground">
									{expense.items?.length ?? 0}
								</span>
							</div>
							<ul className="mt-3 space-y-2">
								{(expense.items ?? []).map((item, index) => (
									<li
										className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.78)] px-3 py-2"
										key={item.id ?? `${item.name}-${index}`}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="truncate text-sm font-semibold text-foreground">
													{item.name || `Line ${index + 1}`}
												</p>
												{item.tags?.length ? (
													<p className="mt-1 truncate text-xs text-muted-foreground">
														{item.tags.map((tag) => tag.name).join(" · ")}
													</p>
												) : null}
											</div>
											<span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
												{formatMoney(Number(item.amount) || 0)}
											</span>
										</div>
									</li>
								))}
								{!expense.items?.length ? (
									<li className="rounded-xl border border-dashed border-[rgba(120,100,80,0.18)] px-3 py-3 text-sm text-muted-foreground">
										No line items yet.
									</li>
								) : null}
							</ul>
						</section>

						<section className="rounded-2xl border border-[rgba(120,100,80,0.14)] bg-white/72 p-4 shadow-sm">
							<div className="flex items-center justify-between gap-2">
								<h3 className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
									<Split className="h-4 w-4 text-muted-foreground" />
									Splits
								</h3>
								<span className="text-xs font-semibold text-muted-foreground">
									{splits?.length ?? 0}
								</span>
							</div>
							<ul className="mt-3 space-y-2">
								{(splits ?? []).map((row, index) => (
									<li
										className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.78)] px-3 py-2"
										key={`${row.user_id ?? "p"}-${row.space_participant_id ?? index}`}
									>
										<span className="min-w-0 truncate text-sm font-semibold text-foreground">
											{splitDisplayName(row)}
										</span>
										<span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
											{formatMoney(Number(row.amount) || 0)}
										</span>
									</li>
								))}
								{!splits?.length ? (
									<li className="rounded-xl border border-dashed border-[rgba(120,100,80,0.18)] px-3 py-3 text-sm text-muted-foreground">
										No split rows saved yet.
									</li>
								) : null}
							</ul>
						</section>
					</div>
				) : null}
			</div>

			<div className="shrink-0 border-t border-[rgba(120,100,80,0.12)] bg-[rgba(253,250,245,0.92)] px-4 py-3">
				<div className="flex flex-wrap items-center gap-2">
					<button
						className="inline-flex h-9 items-center rounded-lg border border-[rgba(120,100,80,0.22)] bg-white/90 px-3 text-xs font-semibold text-foreground transition hover:bg-white disabled:opacity-50"
						disabled={isLoading}
						onClick={() => {
							void load();
							onReloadList();
						}}
						type="button"
					>
						Refresh
					</button>
					<Link
						className="inline-flex h-9 items-center rounded-lg bg-[rgba(55,45,30,0.9)] px-3 text-xs font-semibold text-[#fffaf0] transition hover:bg-[rgba(45,38,28,0.95)]"
						to={reviewHref}
					>
						{expense?.source_document_id != null
							? "Review source capture"
							: "Open review"}
					</Link>
				</div>
			</div>
		</aside>
	);
};
