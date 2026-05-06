import type { Transaction } from "@cofi/api";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useUserFormat } from "../../../shared/hooks/useUserFormat";
import type { ExpenseThreadController } from "../hooks/useExpenseThreadState";
import { ExpenseThreadInlinePanel } from "./ExpenseThreadInlinePanel";
import type { ParseTestSnippet } from "./ParseExpenseComposer";

const listHeading = (tx: Transaction): string => {
	const t = (tx.title ?? "").trim();
	const generic = !t || t.toLowerCase() === "expense";
	const firstLineName = (tx.items ?? [])
		.map((it) => (it.name ?? "").trim())
		.find((n) => n.length > 0);
	if (!generic) return t;
	if (firstLineName) {
		return firstLineName.length > 72
			? `${firstLineName.slice(0, 69)}…`
			: firstLineName;
	}
	const d = (tx.description ?? "").trim();
	if (d) {
		const line = d.split(/\r?\n/).find((l) => l.trim().length > 0) ?? d;
		const one = line.trim();
		return one.length > 72 ? `${one.slice(0, 69)}…` : one;
	}
	return `Expense #${String(tx.id)}`;
};

const statusTone = (raw?: string): string => {
	const s = (raw ?? "").toLowerCase();
	if (s === "draft") return "draft";
	if (s === "approved") return "approved";
	if (s === "cancelled" || s === "canceled") return "cancelled";
	if (
		s.includes("review") ||
		s.includes("question") ||
		(s.includes("pending") && !s.includes("draft"))
	) {
		return "needs_review";
	}
	return "other";
};

type Props = {
	spaceId: string | number;
	spaceTransactions: Transaction[] | null;
	listLoading: boolean;
	listError: string | null;
	onReloadList: () => void;
	sidebarThreadExpenseId: string | number | null;
	onSelectExpense: (expenseId: string | number) => void;
	onCloseThread: () => void;
	expenseThreadCtrl: ExpenseThreadController;
	currentUserId: number | null;
	draftLineScrollRequest: number | null;
	onDraftLineScrollConsumed: () => void;
	parseTestSnippets: ParseTestSnippet[];
	onInsertLineLinkToMainChat?: (markdown: string) => void;
	/** When true, expense thread uses inspector-first layout (Space Expenses route). */
	expensesWorkspaceRoute?: boolean;
	spaceName?: string | null;
	/** Space Expenses: workspace edit mode active (dim main column from parent). */
	onWorkspaceEditModeChange?: (editing: boolean) => void;
	/** Highlight right rail when expense is in workspace edit mode. */
	workspaceEditSurfaceActive?: boolean;
};

export const ChatExpenseRightPanelContent = ({
	spaceId,
	spaceTransactions,
	listLoading,
	listError,
	onReloadList,
	sidebarThreadExpenseId,
	onSelectExpense,
	onCloseThread,
	expenseThreadCtrl,
	currentUserId,
	draftLineScrollRequest,
	onDraftLineScrollConsumed,
	parseTestSnippets,
	onInsertLineLinkToMainChat,
	expensesWorkspaceRoute = false,
	spaceName = null,
	onWorkspaceEditModeChange,
	workspaceEditSurfaceActive = false,
}: Props) => {
	const { formatMoney, formatDateTime } = useUserFormat();
	const spaceLabel = spaceName?.trim() || "this space";
	const chatHref = `/console/chat?spaceId=${encodeURIComponent(String(spaceId))}`;

	const stats = useMemo(() => {
		const list = spaceTransactions ?? [];
		let draft = 0;
		let needsReview = 0;
		let approved = 0;
		for (const tx of list) {
			const tone = statusTone(tx.status);
			if (tone === "draft") draft += 1;
			else if (tone === "needs_review") needsReview += 1;
			else if (tone === "approved") approved += 1;
		}
		const approvedRecent = list
			.filter((tx) => statusTone(tx.status) === "approved")
			.slice()
			.sort((a, b) => {
				const ta = a.created_at ? Date.parse(a.created_at) : 0;
				const tb = b.created_at ? Date.parse(b.created_at) : 0;
				return tb - ta;
			})
			.slice(0, 4);
		return { total: list.length, draft, needsReview, approved, approvedRecent };
	}, [spaceTransactions]);

	if (sidebarThreadExpenseId != null) {
		return (
			<div
				className={
					workspaceEditSurfaceActive
						? "flex h-full min-h-0 flex-col border-l border-amber-400/35 bg-[linear-gradient(180deg,#fffbf5_0%,#fff4e5_55%,#faf6f0_100%)] pb-3 pt-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-amber-600/35 dark:bg-[linear-gradient(180deg,#1c1410_0%,#231a14_100%)]"
						: "flex h-full min-h-0 flex-col border-l border-[rgba(120,100,80,0.09)] bg-[linear-gradient(180deg,#fdfbf8_0%,#f8f4ee_100%)] pb-3 pt-1"
				}
			>
				<ExpenseThreadInlinePanel
					closeLabel="← Back to expenses"
					controller={expenseThreadCtrl}
					currentUserId={currentUserId}
					draftLineScrollRequest={draftLineScrollRequest}
					formatDateTime={formatDateTime}
					formatMoney={formatMoney}
					onClose={onCloseThread}
					onDraftLineScrollConsumed={onDraftLineScrollConsumed}
					onInsertLineLinkToMainChat={onInsertLineLinkToMainChat}
					onWorkspaceEditModeChange={
						expensesWorkspaceRoute ? onWorkspaceEditModeChange : undefined
					}
					panelLayout="expensesInspector"
					parseTestSnippets={parseTestSnippets}
					reviewDraftOpensFlow={expensesWorkspaceRoute}
					spaceId={spaceId}
				/>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-y-auto border-l border-[rgba(120,100,80,0.12)] bg-[linear-gradient(180deg,#fdfaf5_0%,#f5f0e8_100%)] px-4 py-5 sm:px-5">
			<div className="mx-auto w-full max-w-md space-y-5">
				<div>
					<h2 className="font-display text-lg font-bold tracking-tight text-foreground">
						Expenses in {spaceLabel}
					</h2>
					<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
						Select an expense from the list to review splits, line items, and
						approvals in this panel.
					</p>
				</div>

				{listError ? (
					<div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{listError}
					</div>
				) : null}

				{listLoading && !spaceTransactions?.length ? (
					<p className="text-sm text-muted-foreground">Loading expenses…</p>
				) : null}

				{!listLoading && spaceTransactions && spaceTransactions.length === 0 ? (
					<p className="text-sm leading-relaxed text-muted-foreground">
						No expenses in this space yet. Capture from chat or add one below.
					</p>
				) : null}

				{spaceTransactions && spaceTransactions.length > 0 ? (
					<section
						aria-labelledby="exp-rail-summary"
						className="rounded-2xl border border-[rgba(120,100,80,0.18)] bg-[rgba(255,252,246,0.85)] p-4 shadow-sm"
					>
						<h3
							className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							id="exp-rail-summary"
						>
							Summary
						</h3>
						<dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
							<div>
								<dt className="text-xs font-medium text-muted-foreground">
									Total
								</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
									{stats.total}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-medium text-[#7a4510]">
									Needs review
								</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-[#5a3008]">
									{stats.needsReview}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-medium text-[#7a5210]">Drafts</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-[#5a3008]">
									{stats.draft}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-medium text-[#355a3c]">Approved</dt>
								<dd className="mt-0.5 text-lg font-bold tabular-nums text-[#2d4a32]">
									{stats.approved}
								</dd>
							</div>
						</dl>

						{stats.approvedRecent.length > 0 ? (
							<div className="mt-4 border-t border-[rgba(120,100,80,0.12)] pt-3">
								<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Recently approved
								</h4>
								<ul className="mt-2 space-y-2">
									{stats.approvedRecent.map((tx) => (
										<li key={`ap-${String(tx.id)}`}>
											<button
												className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm transition hover:border-[rgba(120,100,80,0.15)] hover:bg-white/80"
												onClick={() => onSelectExpense(tx.id)}
												type="button"
											>
												<span className="min-w-0 truncate font-medium text-foreground">
													{listHeading(tx)}
												</span>
												<span className="shrink-0 tabular-nums text-muted-foreground">
													{formatMoney(tx.total)}
												</span>
											</button>
										</li>
									))}
								</ul>
							</div>
						) : null}

						<div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[rgba(120,100,80,0.12)] pt-3">
							<button
								aria-label="Reload expense list"
								className="inline-flex h-10 items-center rounded-lg border border-[rgba(120,100,80,0.22)] bg-white/90 px-4 text-sm font-medium text-foreground transition hover:bg-white disabled:opacity-50"
								disabled={listLoading}
								onClick={() => onReloadList()}
								type="button"
							>
								{listLoading ? "Refreshing…" : "Refresh list"}
							</button>
							<Link
								className="inline-flex h-10 items-center rounded-lg bg-[rgba(55,45,30,0.9)] px-4 text-sm font-semibold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(45,38,28,0.95)]"
								to={chatHref}
							>
								Add expense
							</Link>
						</div>
					</section>
				) : null}
			</div>
		</div>
	);
};
