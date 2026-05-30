import type {
	DashboardExpenseThreadApprovalItem,
	DashboardReviewQueueItem,
	DocumentCandidate,
	ExpenseDetail,
	ExpenseSplitRow,
	Space,
	SpaceMember,
	SpaceParticipant,
	Transaction,
} from "@cofi/api";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceTabs } from "../../app/layout/workspaceSpaces/SpaceTabs";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";

type ReviewKind = "draft" | "split_approval" | "needs_confirmation";
type ReviewFilter = "all" | "draft" | "split_approval" | "needs_confirmation";

type ReviewItem = {
	id: string;
	kind: ReviewKind;
	expenseId: number;
	threadId?: number;
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
};

const documentCandidateLabel = (type: string): string => {
	if (type === "payment_proof_candidate") return "Payment proof";
	if (type === "privacy_signal_candidate") return "Privacy signal";
	if (type === "merge_candidate") return "Merge candidate";
	if (type === "supporting_document_candidate") return "Supporting document";
	if (type === "space_suggestion_candidate") return "Space suggestion";
	if (type === "recurring_candidate") return "Recurring hint";
	if (type === "membership_candidate") return "Membership hint";
	if (type === "reminder_candidate") return "Reminder hint";
	return type.replace(/_/g, " ");
};

const documentCandidateTitle = (candidate: DocumentCandidate): string =>
	candidate.title?.trim() ||
	candidate.merchant_text?.trim() ||
	documentCandidateLabel(candidate.candidate_type);

const documentCandidateMeta = (candidate: DocumentCandidate): string => {
	const parts = [
		candidate.source_type,
		candidate.document_type,
		candidate.merchant_text,
	]
		.map((value) => value?.trim())
		.filter(Boolean);
	return parts.length ? parts.join(" • ") : "Document intelligence";
};

const isThreadApproval = (
	item: DashboardReviewQueueItem,
): item is DashboardExpenseThreadApprovalItem =>
	item != null &&
	typeof item === "object" &&
	!Array.isArray(item) &&
	(item as { kind?: string }).kind === "expense_thread_approval";

const sourceFromExpense = (
	exp: ExpenseDetail | undefined,
	tx: Transaction | undefined,
): ReviewItem["source"] => {
	const blob =
		`${exp?.description ?? ""} ${tx?.description ?? ""} ${tx?.title ?? ""}`.toLowerCase();
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

const humanTitle = (
	exp?: ExpenseDetail,
	tx?: Transaction,
	fallback?: string,
) => {
	const title = (exp?.title ?? tx?.title ?? fallback ?? "").trim();
	if (title && title.toLowerCase() !== "expense") return title;
	const firstLine = (exp?.items ?? tx?.items ?? [])
		.map((it) => (it.name ?? "").trim())
		.find(Boolean);
	if (firstLine) return firstLine;
	const descLine = (exp?.description ?? tx?.description ?? "")
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

export const CeitsReviewFlowPage = () => {
	const { spaces, selectedSpaceId, setSelectedSpaceId } = useWorkspaceSpaces();
	const { formatMoney } = useUserFormat();
	const [searchParams] = useSearchParams();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [members, setMembers] = useState<SpaceMember[]>([]);
	const [participants, setParticipants] = useState<SpaceParticipant[]>([]);
	const [queue, setQueue] = useState<ReviewItem[]>([]);
	const [documentCandidates, setDocumentCandidates] = useState<
		DocumentCandidate[]
	>([]);
	const [currentId, setCurrentId] = useState<string | null>(null);
	const [filter, setFilter] = useState<ReviewFilter>("all");
	const [acting, setActing] = useState(false);

	const spaceIdParam = searchParams.get("spaceId");
	const spaceId =
		spaceIdParam != null
			? Number(spaceIdParam)
			: selectedSpaceId != null
				? Number(selectedSpaceId)
				: null;
	const activeSpace: Space | null = useMemo(() => {
		if (spaces == null || spaceId == null) return null;
		return spaces.find((s) => Number(s.id) === Number(spaceId)) ?? null;
	}, [spaces, spaceId]);

	useConsoleHeaderTitle("Review Flow", activeSpace?.name ?? null);

	useEffect(() => {
		if (spaceId != null && Number.isFinite(spaceId))
			setSelectedSpaceId(spaceId);
	}, [spaceId, setSelectedSpaceId]);

	useEffect(() => {
		if (spaceId == null || !Number.isFinite(spaceId)) return;
		let cancelled = false;
		setLoading(true);
		setError(null);
		void (async () => {
			try {
				const [dash, tx, mem, participantRes, documentCandidateRes] =
					await Promise.all([
						apiClient.dashboard.get({
							variant: "personal",
							period: "month",
							space_id: spaceId,
						}),
						apiClient.spaces.listTransactions(spaceId, { limit: 120 }),
						apiClient.spaces.listMembers(spaceId).catch(() => null),
						apiClient.spaces.listParticipants(spaceId).catch(() => null),
						apiClient.spaces
							.listDocumentCandidates(spaceId, { limit: 50 })
							.catch(() => null),
					]);

				const txById = new Map<number, Transaction>(
					tx
						.map((t) => [Number(t.id), t])
						.filter((e): e is [number, Transaction] => Number.isFinite(e[0])),
				);
				const draftIds = (dash.pending_drafts ?? [])
					.filter((d) => Number(d.space_id) === Number(spaceId))
					.map((d) => Number(d.id))
					.filter(Number.isFinite);
				const approvalItems = (dash.review_queue?.items ?? [])
					.filter(isThreadApproval)
					.filter((i) => Number(i.space_id) === Number(spaceId));
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

				const expenseIds = Array.from(
					new Set([
						...draftIds,
						...approvalItems.map((i) => Number(i.expense_id)),
						...needsConfirmationIds,
					]),
				);

				const [detailSettled, splitSettled] = await Promise.all([
					Promise.allSettled(
						expenseIds.map(async (id) => ({
							id,
							detail: await apiClient.finances.expenses.get(id),
						})),
					),
					Promise.allSettled(
						expenseIds.map(async (id) => ({
							id,
							splits:
								(await apiClient.finances.expenses.listSplits(id)).splits ?? [],
						})),
					),
				]);

				const detailMap: Record<number, ExpenseDetail> = {};
				const splitMap: Record<number, ExpenseSplitRow[]> = {};
				for (const r of detailSettled)
					if (r.status === "fulfilled") detailMap[r.value.id] = r.value.detail;
				for (const r of splitSettled)
					if (r.status === "fulfilled") splitMap[r.value.id] = r.value.splits;

				const built: ReviewItem[] = [];

				for (const id of draftIds) {
					const exp = detailMap[id];
					const tr = txById.get(id);
					if (!exp && !tr) continue;
					const source = sourceFromExpense(exp, tr);
					const linePreview = (exp?.items ?? tr?.items ?? [])
						.slice(0, 3)
						.map((it) => ({
							name: it.name,
							amount: Number(it.amount) || 0,
						}));
					built.push({
						id: `draft-${id}`,
						kind: "draft",
						expenseId: id,
						spaceId: Number(spaceId),
						spaceName: activeSpace?.name ?? "Space",
						title: humanTitle(exp, tr, "Draft expense"),
						amount: Number(exp?.amount ?? tr?.total ?? 0),
						status: (exp?.status ?? tr?.status ?? "draft").toString(),
						dateLabel: exp?.txn_date ?? tr?.txn_date ?? "—",
						source,
						confidenceLabel: source === "manual" ? "Medium" : "High",
						confidenceReason:
							source === "manual"
								? "Manual draft with parsed lines."
								: "Ceits parsed receipt/voice details with structured lines.",
						summaryReason:
							"Approving records this draft and applies split logic.",
						whoAffected: `People in ${activeSpace?.name ?? "this space"}.`,
						tags: (exp?.items ?? [])
							.flatMap((it) => (it.tags ?? []).map((t) => t.name))
							.filter(Boolean)
							.slice(0, 5),
						linePreview,
						splits: splitMap[id] ?? [],
						splitMethod: splitMethodFromRows(splitMap[id] ?? []),
						isDraftLike: true,
					});
				}

				for (const item of approvalItems) {
					const id = Number(item.expense_id);
					const exp = detailMap[id];
					const tr = txById.get(id);
					const source = sourceFromExpense(exp, tr);
					built.push({
						id: `approval-${item.thread_id}-${id}`,
						kind: "split_approval",
						expenseId: id,
						threadId: Number(item.thread_id),
						spaceId: Number(spaceId),
						spaceName: item.space_name || activeSpace?.name || "Space",
						title: humanTitle(exp, tr, item.label || "Split approval"),
						amount: Number(exp?.amount ?? tr?.total ?? item.total ?? 0),
						status: exp?.status ?? "pending approval",
						dateLabel: exp?.txn_date ?? tr?.txn_date ?? "—",
						source,
						confidenceLabel: "High",
						confidenceReason:
							"Split participants and amounts are already mapped.",
						summaryReason: `Confirming this updates balances in ${item.space_name || activeSpace?.name || "this space"}.`,
						whoAffected: "All split participants in this expense.",
						tags: (exp?.items ?? [])
							.flatMap((it) => (it.tags ?? []).map((t) => t.name))
							.filter(Boolean)
							.slice(0, 5),
						linePreview: (exp?.items ?? tr?.items ?? [])
							.slice(0, 3)
							.map((it) => ({
								name: it.name,
								amount: Number(it.amount) || 0,
							})),
						splits: splitMap[id] ?? [],
						splitMethod: splitMethodFromRows(splitMap[id] ?? []),
						isDraftLike: false,
					});
				}

				for (const id of needsConfirmationIds) {
					if (built.some((b) => b.expenseId === id)) continue;
					const exp = detailMap[id];
					const tr = txById.get(id);
					if (!exp && !tr) continue;
					const source = sourceFromExpense(exp, tr);
					built.push({
						id: `needs-${id}`,
						kind: "needs_confirmation",
						expenseId: id,
						spaceId: Number(spaceId),
						spaceName: activeSpace?.name ?? "Space",
						title: humanTitle(exp, tr, "Needs confirmation"),
						amount: Number(exp?.amount ?? tr?.total ?? 0),
						status: exp?.status ?? tr?.status ?? "needs confirmation",
						dateLabel: exp?.txn_date ?? tr?.txn_date ?? "—",
						source,
						confidenceLabel: "Medium",
						confidenceReason: "This item has unresolved confirmation signals.",
						summaryReason:
							"Confirming finalizes this decision and clears queue pressure.",
						whoAffected: `People sharing ${activeSpace?.name ?? "this space"}.`,
						tags: (exp?.items ?? [])
							.flatMap((it) => (it.tags ?? []).map((t) => t.name))
							.filter(Boolean)
							.slice(0, 5),
						linePreview: (exp?.items ?? tr?.items ?? [])
							.slice(0, 3)
							.map((it) => ({
								name: it.name,
								amount: Number(it.amount) || 0,
							})),
						splits: splitMap[id] ?? [],
						splitMethod: splitMethodFromRows(splitMap[id] ?? []),
						isDraftLike: false,
					});
				}

				if (!cancelled) {
					setMembers(mem?.members ?? []);
					setParticipants(participantRes?.participants ?? []);
					setDocumentCandidates(documentCandidateRes?.candidates ?? []);
					setQueue(built);
					setCurrentId(built[0]?.id ?? null);
				}
			} catch (e) {
				if (!cancelled)
					setError(
						e instanceof Error ? e.message : "Failed to load review queue",
					);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [spaceId, activeSpace?.name]);

	const filteredQueue = useMemo(() => {
		if (filter === "all") return queue;
		return queue.filter((q) => q.kind === filter);
	}, [queue, filter]);
	const current = useMemo(
		() =>
			filteredQueue.find((q) => q.id === currentId) ?? filteredQueue[0] ?? null,
		[filteredQueue, currentId],
	);
	const idx = useMemo(
		() => (current ? filteredQueue.findIndex((q) => q.id === current.id) : -1),
		[filteredQueue, current],
	);
	const progress =
		filteredQueue.length > 0 && idx >= 0
			? Math.round(((idx + 1) / filteredQueue.length) * 100)
			: 0;
	const groupedQueue = useMemo(
		() => ({
			draft: filteredQueue.filter((q) => q.kind === "draft"),
			split: filteredQueue.filter((q) => q.kind === "split_approval"),
			needs: filteredQueue.filter((q) => q.kind === "needs_confirmation"),
		}),
		[filteredQueue],
	);

	const participantName = (split: ExpenseSplitRow) => {
		if (split.participant?.display_name?.trim()) {
			return split.participant.display_name.trim();
		}
		if (split.participant?.email?.trim()) return split.participant.email.trim();
		if (split.user_id != null) {
			const member = members.find(
				(m) => Number(m.user_id) === Number(split.user_id),
			);
			return member?.name || member?.email || `Member ${split.user_id}`;
		}
		if (split.space_participant_id != null) {
			return `Participant ${split.space_participant_id}`;
		}
		return "Participant";
	};
	const splitPct = (amount: number, total: number): string => {
		if (!Number.isFinite(total) || total <= 0) return "—";
		return `${Math.round((amount / total) * 100)}%`;
	};
	const heroStatusLabel = (item: ReviewItem): string => {
		if (item.isDraftLike) return "Draft";
		return item.splits.length > 0 ? "Pending" : "Confirmed";
	};
	const heroStatusClass = (item: ReviewItem): string =>
		item.isDraftLike
			? "border-[rgba(150,128,86,0.35)] bg-[rgba(214,188,142,0.16)] text-[rgba(110,82,40,0.95)]"
			: item.splits.length > 0
				? "border-amber-500/35 bg-amber-500/10 text-amber-900"
				: "border-emerald-500/35 bg-emerald-500/10 text-emerald-800";

	const moveNext = () => {
		if (!current) return;
		const rest = queue.filter((q) => q.id !== current.id);
		setQueue(rest);
		const nextFiltered =
			filter === "all" ? rest : rest.filter((q) => q.kind === filter);
		setCurrentId(nextFiltered[0]?.id ?? null);
	};

	const handleApprove = async () => {
		if (!current) return;
		setActing(true);
		try {
			if (current.kind === "split_approval" && current.threadId != null) {
				await apiClient.threads.approve(current.threadId);
			} else {
				await apiClient.finances.expenses.update(current.expenseId, {
					status: "approved",
				});
			}
			moveNext();
		} finally {
			setActing(false);
		}
	};

	const handleReject = async () => {
		if (!current) return;
		setActing(true);
		try {
			if (current.kind === "split_approval" && current.threadId != null) {
				await apiClient.threads.unapprove(current.threadId);
			} else {
				await apiClient.finances.expenses.update(current.expenseId, {
					status: "cancelled",
				});
			}
			moveNext();
		} finally {
			setActing(false);
		}
	};
	const handleSplitEqually = async () => {
		if (!current) return;
		const lines =
			participants.length > 0
				? participants.map((participant) => ({
						space_participant_id: Number(participant.id),
						amount: current.amount / participants.length,
					}))
				: members.map((member) => ({
						user_id: Number(member.user_id),
						amount: current.amount / members.length,
					}));
		if (lines.length === 0) return;
		setActing(true);
		try {
			await apiClient.finances.expenses.putSplits(current.expenseId, lines);
			const refreshed = await apiClient.finances.expenses.listSplits(
				current.expenseId,
			);
			const rows = refreshed.splits ?? [];
			setQueue((prev) =>
				prev.map((q) =>
					q.id === current.id
						? {
								...q,
								splits: rows,
								splitMethod: splitMethodFromRows(rows),
							}
						: q,
				),
			);
		} finally {
			setActing(false);
		}
	};

	if (spaceId == null || !Number.isFinite(spaceId))
		return <Navigate replace to="/console/chat/expenses" />;

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
			<header className="shrink-0 border-b border-border/80 bg-background px-4 py-3 lg:px-8">
				<SpaceTabs />
			</header>
			<div className="flex min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#faf7f2_0%,#f4efe6_100%)]">
				<main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-8">
					{loading ? (
						<p className="text-sm text-muted-foreground">
							Loading Ceits review flow…
						</p>
					) : null}
					{error ? (
						<p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{error}
						</p>
					) : null}
					{!loading && !error && documentCandidates.length > 0 ? (
						<section className="mx-auto mb-5 max-w-5xl rounded-[1.35rem] border border-[rgba(120,100,80,0.2)] bg-[rgba(255,252,246,0.92)] p-4 shadow-sm">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
										Document intelligence
									</p>
									<h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
										Document signals waiting for review
									</h2>
									<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
										These are not expenses yet. Review them before attaching,
										merging, or projecting anything into the space.
									</p>
								</div>
								<span className="rounded-full border border-[rgba(120,100,80,0.22)] bg-white px-2.5 py-1 text-xs font-semibold text-foreground/75">
									{documentCandidates.length} pending
								</span>
							</div>
							<div className="mt-4 grid gap-2 md:grid-cols-2">
								{documentCandidates.slice(0, 6).map((candidate) => (
									<article
										className="rounded-xl border border-[rgba(120,100,80,0.16)] bg-white/80 p-3"
										key={candidate.id}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
													{documentCandidateLabel(candidate.candidate_type)}
												</p>
												<h3 className="mt-1 truncate text-sm font-semibold text-foreground">
													{documentCandidateTitle(candidate)}
												</h3>
											</div>
											<span className="shrink-0 rounded-full border border-[rgba(102,134,108,0.28)] bg-[rgba(237,247,239,0.82)] px-2 py-0.5 text-[11px] font-semibold text-[#58745f]">
												Draft
											</span>
										</div>
										<p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
											{documentCandidateMeta(candidate)}
										</p>
									</article>
								))}
							</div>
							{documentCandidates.length > 6 ? (
								<p className="mt-3 text-xs text-muted-foreground">
									Showing 6 newest document signals. Full resolution controls
									come with the unified candidate review surface.
								</p>
							) : null}
						</section>
					) : null}
					{!loading &&
					!error &&
					current == null &&
					documentCandidates.length === 0 ? (
						<section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-[rgba(120,100,80,0.22)] bg-[rgba(255,252,246,0.9)] px-6 py-8 text-center shadow-sm">
							<h2 className="text-2xl font-semibold tracking-tight text-foreground">
								All caught up
							</h2>
							<p className="mt-2 text-sm text-muted-foreground">
								Everything pending in {activeSpace?.name ?? "this space"} has
								been reviewed.
							</p>
							<div className="mt-5 flex items-center justify-center gap-2">
								<Link
									className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-accent"
									to={`/console/spaces/${spaceId}/overview`}
								>
									Return to space
								</Link>
								<Link
									className="rounded-lg bg-[rgba(55,45,30,0.92)] px-4 py-2 text-sm font-semibold text-[#fffaf0] hover:bg-[rgba(45,38,28,0.95)]"
									to={`/console/chat/expenses?spaceId=${spaceId}`}
								>
									View activity
								</Link>
							</div>
						</section>
					) : null}
					{current ? (
						<section className="mx-auto max-w-5xl pb-28">
							<article
								className="rounded-[1.35rem] border border-[rgba(120,100,80,0.24)] bg-[linear-gradient(180deg,rgba(255,253,249,0.98)_0%,rgba(255,249,240,0.96)_100%)] p-5 shadow-[0_20px_44px_-28px_rgba(48,40,28,0.32)] transition-all duration-300"
								key={current.id}
							>
								<div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(120,100,80,0.16)] pb-4">
									<div className="min-w-0">
										<h2 className="mt-0.5 truncate text-3xl font-semibold tracking-tight text-foreground">
											{current.title}
										</h2>
										<p className="mt-2 text-sm text-foreground/75">
											{current.spaceName} • {current.dateLabel || "—"} •{" "}
											<span className="capitalize">{current.source}</span>
										</p>
									</div>
									<div className="rounded-xl border border-[rgba(120,100,80,0.22)] bg-white/85 px-4 py-3 text-right">
										<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
											Amount
										</p>
										<p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
											{formatMoney(current.amount)}
										</p>
										<span
											className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${heroStatusClass(current)}`}
										>
											{heroStatusLabel(current)}
										</span>
									</div>
								</div>

								<div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_1fr]">
									<section className="rounded-2xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,255,255,0.78)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
										<div className="flex items-center justify-between gap-2 border-b border-[rgba(120,100,80,0.15)] pb-2">
											<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
												Ceits parsed this receipt
											</p>
											<span className="rounded-full border border-[rgba(102,134,108,0.35)] bg-[rgba(120,154,124,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[#4f6e54]">
												Ceits is confident in this
											</span>
										</div>
										<div className="mt-3 rounded-xl border border-[rgba(120,100,80,0.14)] bg-[linear-gradient(180deg,#fffdf9_0%,#fbf8f2_100%)] p-3">
											<div className="flex items-center justify-between border-b border-dashed border-[rgba(120,100,80,0.18)] pb-2 text-sm">
												<span className="font-medium text-foreground/80">
													Receipt preview
												</span>
												<span className="capitalize text-muted-foreground">
													{current.source}
												</span>
											</div>
											<ul className="mt-2 space-y-1.5">
												{current.linePreview.map((l, i) => (
													<li
														className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-[rgba(120,100,80,0.06)]"
														key={`${l.name}-${i}`}
													>
														<span className="truncate pr-2 text-foreground/88">
															{l.name}
														</span>
														<span className="tabular-nums text-foreground/72">
															{formatMoney(l.amount)}
														</span>
													</li>
												))}
											</ul>
											<div className="mt-2 border-t border-dashed border-[rgba(120,100,80,0.2)] pt-2">
												<div className="flex items-center justify-between text-sm font-semibold">
													<span>Total</span>
													<span className="tabular-nums">
														{formatMoney(current.amount)}
													</span>
												</div>
											</div>
											<div className="mt-2 flex flex-wrap gap-1.5">
												{current.tags.length ? (
													current.tags.map((t) => (
														<span
															className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-xs"
															key={t}
														>
															{t}
														</span>
													))
												) : (
													<span className="text-xs text-muted-foreground">
														No tags parsed
													</span>
												)}
											</div>
										</div>
										<p className="mt-2 text-xs text-muted-foreground">
											{current.confidenceReason}
										</p>
										<Link
											className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-2 hover:underline"
											to={`/console/chat/thread?spaceId=${current.spaceId}&expenseId=${current.expenseId}`}
										>
											View all items
										</Link>
									</section>

									<section className="space-y-3">
										<div className="rounded-2xl border border-[rgba(120,100,80,0.16)] bg-white/80 p-4">
											<div className="flex items-center justify-between">
												<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
													Suggested split
												</p>
												<span className="capitalize text-xs text-muted-foreground">
													{current.splitMethod}
												</span>
											</div>
											<p className="mt-2 text-sm font-medium text-foreground/88">
												Who should pay?
											</p>
											<div className="mt-3 space-y-2">
												{current.splits.length ? (
													current.splits.map((s) => (
														<div
															className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 px-3 py-2"
															key={`${s.user_id ?? s.space_participant_id ?? "participant"}-${s.amount}`}
														>
															<div className="flex min-w-0 items-center gap-2">
																<span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(100,110,126,0.2)] text-[11px] font-semibold text-foreground/80">
																	{participantName(s).slice(0, 1).toUpperCase()}
																</span>
																<span className="truncate text-sm">
																	{participantName(s)}
																</span>
															</div>
															<span className="text-sm text-muted-foreground">
																{splitPct(s.amount, current.amount)} •{" "}
																{formatMoney(s.amount)}
															</span>
														</div>
													))
												) : (
													<div className="rounded-xl border border-dashed border-border/60 bg-background/65 px-3 py-3">
														<p className="text-sm text-foreground/85">
															No split defined yet
														</p>
														<p className="mt-1 text-xs text-muted-foreground">
															Let’s decide how to split this.
														</p>
														<div className="mt-3 flex flex-wrap gap-2">
															<button
																className="inline-flex h-8 items-center rounded-lg border border-border bg-white px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
																disabled={acting}
																onClick={() => void handleSplitEqually()}
																type="button"
															>
																Split equally
															</button>
															<Link
																className="inline-flex h-8 items-center rounded-lg border border-border bg-white px-3 text-xs font-medium hover:bg-accent"
																to={`/console/chat/thread?spaceId=${current.spaceId}&expenseId=${current.expenseId}`}
															>
																Create split
															</Link>
														</div>
													</div>
												)}
											</div>
											<p className="mt-3 text-sm text-foreground/85">
												Approving this updates balances in {current.spaceName}.
											</p>
										</div>
										<div className="rounded-2xl border border-[rgba(102,134,108,0.24)] bg-[rgba(237,247,239,0.82)] p-4">
											<p className="text-xs font-semibold uppercase tracking-wide text-[#58745f]">
												Decision impact
											</p>
											<p className="mt-2 text-sm font-medium text-foreground/88">
												This will update balances in {current.spaceName}.
											</p>
											<p className="mt-1 text-sm text-foreground/72">
												{current.summaryReason}
											</p>
											<p className="mt-2 text-xs text-muted-foreground">
												Who is affected: {current.whoAffected}
											</p>
										</div>
									</section>
								</div>
							</article>
						</section>
					) : null}
				</main>
				<aside className="hidden w-[21rem] shrink-0 border-l border-[rgba(120,100,80,0.2)] bg-[rgba(255,252,246,0.92)] lg:block">
					<div className="h-full overflow-y-auto px-4 py-5">
						<p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
							Review queue
						</p>
						<p className="mt-2 text-sm text-foreground">
							{idx >= 0
								? `${idx + 1} of ${filteredQueue.length} reviewed`
								: `0 of ${filteredQueue.length} reviewed`}
						</p>
						<div className="mt-2 h-2 overflow-hidden rounded-full bg-muted/30">
							<div
								className="h-full bg-[rgba(75,88,66,0.7)] transition-all duration-300"
								style={{ width: `${progress}%` }}
							/>
						</div>
						<div className="mt-3 flex flex-wrap gap-1.5">
							{(
								[
									["all", "All"],
									["draft", "Drafts"],
									["split_approval", "Splits"],
									["needs_confirmation", "Needs approval"],
								] as const
							).map(([k, label]) => (
								<button
									className={
										filter === k
											? "rounded-full border border-[rgba(120,100,80,0.3)] bg-white px-2.5 py-1 text-xs font-semibold"
											: "rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground"
									}
									key={k}
									onClick={() => setFilter(k)}
									type="button"
								>
									{label}
								</button>
							))}
						</div>
						<div className="mt-4 space-y-4">
							{(
								[
									["Draft expenses", groupedQueue.draft],
									["Split approvals", groupedQueue.split],
									["Needs confirmation", groupedQueue.needs],
								] as const
							).map(([groupLabel, items]) => (
								<div key={groupLabel}>
									<p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
										{groupLabel}
									</p>
									<ul className="space-y-2">
										{items.map((q) => (
											<li key={q.id}>
												<button
													className={
														current?.id === q.id
															? "w-full rounded-xl border border-[rgba(120,100,80,0.45)] bg-white px-3 py-2 text-left shadow-[0_8px_20px_-16px_rgba(0,0,0,0.25)] ring-1 ring-[rgba(120,100,80,0.2)]"
															: "w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-left"
													}
													onClick={() => setCurrentId(q.id)}
													type="button"
												>
													<p className="truncate text-sm font-medium text-foreground">
														{q.title}
													</p>
													<p className="mt-1 text-xs text-muted-foreground">
														{formatMoney(q.amount)} • {q.spaceName}
													</p>
													<p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
														{q.status}
													</p>
												</button>
											</li>
										))}
										{items.length === 0 ? (
											<li className="rounded-lg border border-dashed border-border/60 px-2.5 py-2 text-xs text-muted-foreground">
												No items
											</li>
										) : null}
									</ul>
								</div>
							))}
						</div>
					</div>
				</aside>
			</div>
			{current ? (
				<div className="sticky bottom-0 z-20 border-t border-[rgba(120,100,80,0.24)] bg-[rgba(255,252,246,0.96)] px-4 py-3 shadow-[0_-10px_24px_-14px_rgba(0,0,0,0.15)] lg:px-8">
					<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
						<p className="mr-2 text-sm text-foreground/75">
							Reviewing {idx >= 0 ? idx + 1 : 0} of {filteredQueue.length}
						</p>
						<button
							className="inline-flex h-10 items-center rounded-lg bg-[rgba(55,45,30,0.92)] px-4 text-sm font-semibold text-[#fffaf0] disabled:opacity-50"
							disabled={acting}
							onClick={() => void handleApprove()}
							type="button"
						>
							Approve and continue
						</button>
						<Link
							className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
							to={`/console/chat/thread?spaceId=${current.spaceId}&expenseId=${current.expenseId}`}
						>
							Edit
						</Link>
						<button
							className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
							onClick={moveNext}
							type="button"
						>
							Skip
						</button>
						<button
							className="ml-auto inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
							disabled={acting}
							onClick={() => void handleReject()}
							type="button"
						>
							Reject
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
};
