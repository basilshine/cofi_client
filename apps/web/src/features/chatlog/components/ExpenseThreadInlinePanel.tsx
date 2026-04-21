import type {
	ExpenseThreadItemProposal,
	ExpenseThreadMessage,
	SpaceMember,
} from "@cofi/api";
import type { KeyboardEvent } from "react";
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ceitsSpaceExpenseEditUrl } from "../../../shared/lib/ceitsAppUrls";
import type { ExpenseThreadController } from "../hooks/useExpenseThreadState";
import { SendMessageIcon } from "./ComposerIcons";
import {
	DiscussionMessageComposer,
	type DiscussionMessageComposerHandle,
} from "./DiscussionMessageComposer";
import { ManualTransactionEditor } from "./ManualTransactionEditor";
import {
	ParseExpenseComposer,
	type ParseTestSnippet,
} from "./ParseExpenseComposer";
import { ThreadDiscussionRichText } from "./ThreadDiscussionRichText";
import { ThreadExpenseEditDialog } from "./ThreadExpenseEditDialog";
import { buildExpenseThreadMarkdownLink } from "./discussionLocalLinks";
import { draftLineElementId } from "./draftLineAnchors";

/** Server-prefixed thread chat line when a capture is merged into the draft (see AcceptItemProposal). */
const THREAD_MERGE_MSG_PREFIX = "[cofi:merge] ";

const THREAD_LAST_READ_PREFIX = "cofi.expenseThread.lastReadMsg.";

const threadMsgIdCompare = (a: string, b: string): number => {
	const na = Number(a);
	const nb = Number(b);
	if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
	return String(a).localeCompare(String(b));
};

const readThreadLastRead = (threadId: string | number): string | null => {
	try {
		return localStorage.getItem(THREAD_LAST_READ_PREFIX + String(threadId));
	} catch {
		return null;
	}
};

const writeThreadLastRead = (threadId: string | number, messageId: string) => {
	try {
		localStorage.setItem(THREAD_LAST_READ_PREFIX + String(threadId), messageId);
	} catch {
		/* ignore */
	}
};

const maxThreadMessageId = (
	messages: ExpenseThreadMessage[],
): string | null => {
	if (!messages.length) return null;
	let best = String(messages[0].id);
	for (let i = 1; i < messages.length; i++) {
		const s = String(messages[i].id);
		if (threadMsgIdCompare(best, s) < 0) best = s;
	}
	return best;
};

const memberLabel = (members: SpaceMember[], userId: number): string => {
	const m = members.find((x) => Number(x.user_id) === userId);
	if (!m) return `User #${userId}`;
	return m.name?.trim() || m.email?.trim() || `User #${userId}`;
};

type ProposalCaptureBubbleProps = {
	proposal: ExpenseThreadItemProposal;
	threadMembers: SpaceMember[];
	currentUserId: number | null;
	/** Thread creator or space owner — may merge captures into the draft. */
	canMergeProposals: boolean;
	/** Draft expense owner — may reject others’ proposals (with proposer). */
	isExpenseOwner: boolean;
	finalized: boolean;
	threadCaptureBusy: boolean;
	formatMoney: (n: number) => string;
	formatDateTime: (iso: string) => string;
	onAccept: (proposalId: number, currentUserId: number) => void | Promise<void>;
	onReject: (proposalId: number) => void | Promise<void>;
};

/** System-style row: right accent border; aligns with discussion timeline. */
const ProposalCaptureBubble = ({
	proposal: p,
	threadMembers,
	currentUserId,
	canMergeProposals,
	isExpenseOwner,
	finalized,
	threadCaptureBusy,
	formatMoney,
	formatDateTime,
	onAccept,
	onReject,
}: ProposalCaptureBubbleProps) => {
	const mine =
		currentUserId != null && Number(p.proposed_by_user_id) === currentUserId;
	const pid = Number(p.id);

	return (
		<article
			aria-label="Pending capture proposal"
			className="ml-auto max-w-[min(100%,36rem)] rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-2.5 py-1.5 text-[13px] shadow-sm border-r-4 border-r-amber-500 dark:border-r-amber-400"
		>
			<div className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/90 dark:text-amber-100">
				Pending capture
			</div>
			<div className="mt-1 flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="text-[10px] font-medium text-muted-foreground">
						{memberLabel(threadMembers, p.proposed_by_user_id)} ·{" "}
						{formatDateTime(p.created_at)}
					</div>
					{p.description ? (
						<div className="mt-0.5 font-medium text-foreground">
							{p.description}
						</div>
					) : null}
					{p.parsed_vendor_name || p.parsed_payee_text ? (
						<div className="mt-1 text-[10px] text-muted-foreground">
							<span className="font-semibold text-foreground/80">Parse · </span>
							{p.parsed_vendor_name ? (
								<span>Vendor: {p.parsed_vendor_name}</span>
							) : null}
							{p.parsed_vendor_name && p.parsed_payee_text ? " · " : null}
							{p.parsed_payee_text ? (
								<span>Payee: {p.parsed_payee_text}</span>
							) : null}
						</div>
					) : null}
					<ul className="mt-1 list-inside list-disc text-[11px] text-foreground/90">
						{p.items.map((it, idx) => (
							<li key={`${p.id}-${idx}-${it.name}`}>
								<span>
									{it.name} · {formatMoney(Number(it.amount))}
								</span>
								{it.notes?.trim() ? (
									<span className="mt-0.5 block text-[10px] text-muted-foreground">
										{it.notes.trim()}
									</span>
								) : null}
							</li>
						))}
					</ul>
				</div>
				<div className="flex shrink-0 flex-col gap-1">
					{canMergeProposals && currentUserId != null ? (
						<button
							className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground disabled:opacity-50"
							disabled={threadCaptureBusy || finalized}
							onClick={() => void onAccept(pid, currentUserId)}
							type="button"
						>
							Merge into draft
						</button>
					) : null}
					{(isExpenseOwner || mine) && currentUserId != null ? (
						<button
							className="rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-accent disabled:opacity-50"
							disabled={threadCaptureBusy || finalized}
							onClick={() => void onReject(pid)}
							type="button"
						>
							Reject
						</button>
					) : null}
				</div>
			</div>
		</article>
	);
};

type ReviewPendingProposalsProps = Omit<
	ProposalCaptureBubbleProps,
	"proposal"
> & {
	proposals: ExpenseThreadItemProposal[];
};

const ReviewPendingProposals = ({
	proposals,
	...bubbleRest
}: ReviewPendingProposalsProps) => {
	if (proposals.length === 0) return null;

	return (
		<section aria-label="Pending capture proposals" className="space-y-2">
			<h2 className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
				Pending parsed captures
			</h2>
			<p className="text-[11px] text-muted-foreground">
				The thread creator or space owner can merge these into the draft. The
				expense owner or proposer can reject a pending proposal.
			</p>
			<ul className="space-y-2">
				{proposals.map((p) => (
					<li key={p.id}>
						<ProposalCaptureBubble {...bubbleRest} proposal={p} />
					</li>
				))}
			</ul>
		</section>
	);
};

type DiscussionTimelineItem =
	| { kind: "message"; sortKey: number; message: ExpenseThreadMessage }
	| { kind: "proposal"; sortKey: number; proposal: ExpenseThreadItemProposal };

const buildDiscussionTimeline = (
	messages: ExpenseThreadMessage[],
	proposals: ExpenseThreadItemProposal[],
): DiscussionTimelineItem[] => {
	const items: DiscussionTimelineItem[] = [];
	for (const m of messages) {
		items.push({
			kind: "message",
			sortKey: new Date(m.created_at).getTime(),
			message: m,
		});
	}
	for (const p of proposals) {
		items.push({
			kind: "proposal",
			sortKey: new Date(p.created_at).getTime(),
			proposal: p,
		});
	}
	items.sort((a, b) => {
		if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
		const idA = a.kind === "message" ? a.message.id : a.proposal.id;
		const idB = b.kind === "message" ? b.message.id : b.proposal.id;
		return idA - idB;
	});
	return items;
};

type Props = {
	controller: ExpenseThreadController;
	currentUserId: number | null;
	onClose: () => void;
	formatMoney: (n: number) => string;
	formatDateTime: (iso: string) => string;
	spaceId: string | number;
	parseTestSnippets?: ParseTestSnippet[];
	/** One-shot scroll to a manual draft line after navigation (e.g. `?line=` deep link). */
	draftLineScrollRequest?: number | null;
	onDraftLineScrollConsumed?: () => void;
	/** Primary back control (default: back to main chat). */
	closeLabel?: string;
};

export const ExpenseThreadInlinePanel = ({
	controller,
	currentUserId,
	onClose,
	formatMoney,
	formatDateTime,
	spaceId,
	parseTestSnippets,
	draftLineScrollRequest,
	onDraftLineScrollConsumed,
	closeLabel = "← Back to space chat",
}: Props) => {
	const finalizeTitleId = useId();
	const finalizeDialogRef = useRef<HTMLDialogElement>(null);
	const [finalizeOpen, setFinalizeOpen] = useState(false);
	const [threadComposerMode, setThreadComposerMode] = useState<
		"message" | "capture"
	>("message");
	const [chatInput, setChatInput] = useState("");
	const [editingDiscussionMessageId, setEditingDiscussionMessageId] = useState<
		number | null
	>(null);
	const [editingDiscussionDraft, setEditingDiscussionDraft] = useState("");
	/** Desktop: review drawer on the right; slides closed to the edge. */
	const [reviewSidebarOpen, setReviewSidebarOpen] = useState(true);
	const [headerEditOpen, setHeaderEditOpen] = useState(false);
	const [threadReadBump, setThreadReadBump] = useState(0);
	const reviewScrollId = useId();
	const discussionScrollRef = useRef<HTMLDivElement | null>(null);
	const discussionComposerRef = useRef<DiscussionMessageComposerHandle | null>(
		null,
	);
	const discussionAtBottomRef = useRef(true);
	const didAutoScrollDiscussionRef = useRef(false);
	const prevThreadIdForScrollRef = useRef<number | null>(null);

	const {
		expense,
		proposals,
		draftDescription,
		setDraftDescription,
		draftTitle,
		setDraftTitle,
		draftPayeeText,
		setDraftPayeeText,
		draftCurrency,
		setDraftCurrency,
		draftTxnDate,
		setDraftTxnDate,
		draftInvoiceRef,
		setDraftInvoiceRef,
		draftNotes,
		setDraftNotes,
		draftVendorId,
		setDraftVendorId,
		saveExpenseHeader,
		draftItems,
		changeDraftItem,
		addDraftItem,
		removeDraftItem,
		saveDraftExpense,
		summary,
		threadMessages,
		threadMembers,
		splitRows,
		total,
		loading,
		actionError,
		loadOlderBusy,
		hasOlder,
		splitsSaving,
		finalized,
		toggleApprove,
		finalizeThread,
		setEqualSplitPercents,
		resetSplitOwnerHundred,
		setPercentChange,
		saveSplits,
		loadOlderThreadMessages,
		sendThreadMessage,
		updateThreadMessage,
		deleteThreadMessage,
		threadParseInput,
		setThreadParseInput,
		threadCaptureBusy,
		isThreadRecording,
		submitThreadParseText,
		submitThreadParsePhoto,
		toggleThreadRecording,
		handleThreadParseKeyDown,
		acceptProposal,
		rejectProposal,
		payeeMismatchNotice,
		dismissPayeeMismatchNotice,
	} = controller;

	const thread = summary?.thread;
	const approverIds = summary?.approver_user_ids ?? [];
	const iApproved =
		currentUserId != null &&
		approverIds.some((id) => Number(id) === currentUserId);
	/** Thread creator or space owner — finalize, splits, merge captures (same privilege). */
	const isThreadOrSpaceMaster =
		currentUserId != null &&
		thread != null &&
		(Number(thread.created_by_user_id) === currentUserId ||
			threadMembers.some(
				(m) => Number(m.user_id) === currentUserId && m.role === "owner",
			));
	const canMergeProposals = isThreadOrSpaceMaster;
	const isExpenseOwner =
		currentUserId != null &&
		expense?.user_id != null &&
		Number(expense.user_id) === currentUserId;
	const draftEditable =
		isExpenseOwner &&
		expense?.status === "draft" &&
		!finalized &&
		currentUserId != null;

	const currentUserSpaceRole = useMemo(() => {
		if (currentUserId == null) return null;
		const m = threadMembers.find((x) => Number(x.user_id) === currentUserId);
		return m?.role ?? null;
	}, [threadMembers, currentUserId]);

	/** Line links in discussion: any space role except viewer (draft editing stays owner-only). */
	const canAddExpenseLineLinkToChat =
		currentUserId != null &&
		expense?.id != null &&
		!finalized &&
		currentUserSpaceRole != null &&
		currentUserSpaceRole !== "viewer";

	const allMembersApproved = useMemo(() => {
		if (!threadMembers.length || !summary) return false;
		const need = new Set(threadMembers.map((m) => Number(m.user_id)));
		for (const id of summary.approver_user_ids) {
			need.delete(Number(id));
		}
		return need.size === 0;
	}, [threadMembers, summary]);

	const pendingProposals = useMemo(
		() => proposals.filter((p) => p.status === "pending"),
		[proposals],
	);

	const discussionTimeline = useMemo(
		() => buildDiscussionTimeline(threadMessages, pendingProposals),
		[threadMessages, pendingProposals],
	);

	const lineCount = expense?.items?.length ?? 0;

	const ceitsEditUrl = useMemo(
		() =>
			expense?.id != null
				? ceitsSpaceExpenseEditUrl(spaceId, expense.id)
				: null,
		[expense?.id, spaceId],
	);

	const splitSummaryShort = useMemo(() => {
		const parts = splitRows
			.map((r) => {
				const p = Number.parseFloat(r.percent);
				if (Number.isNaN(p) || p <= 0) return null;
				const label = memberLabel(threadMembers, r.user_id);
				const rounded = Math.round(p * 100) / 100;
				return `${label} ${rounded}%`;
			})
			.filter((x): x is string => x != null);
		return parts.length ? parts.join(" · ") : "—";
	}, [splitRows, threadMembers]);

	const latestThreadMsgId = useMemo(
		() => maxThreadMessageId(threadMessages),
		[threadMessages],
	);

	const discussionUnread = useMemo(() => {
		if (thread?.id == null || !latestThreadMsgId) return false;
		const last = readThreadLastRead(thread.id);
		if (!last) return threadMessages.length > 0;
		return threadMsgIdCompare(last, latestThreadMsgId) < 0;
	}, [thread?.id, latestThreadMsgId, threadReadBump, threadMessages.length]);

	/** First paint with messages for a thread: scroll discussion to bottom and treat as read. */
	useLayoutEffect(() => {
		const tid = thread?.id ?? null;
		if (tid !== prevThreadIdForScrollRef.current) {
			prevThreadIdForScrollRef.current = tid;
			didAutoScrollDiscussionRef.current = false;
			discussionAtBottomRef.current = true;
		}
		if (thread?.id == null || threadMessages.length === 0) return;
		if (didAutoScrollDiscussionRef.current) return;
		const el = discussionScrollRef.current;
		if (!el) return;
		didAutoScrollDiscussionRef.current = true;
		el.scrollTop = el.scrollHeight - el.clientHeight;
		discussionAtBottomRef.current = true;
		if (latestThreadMsgId) {
			writeThreadLastRead(thread.id, latestThreadMsgId);
			setThreadReadBump((v) => v + 1);
		}
	}, [thread?.id, threadMessages, latestThreadMsgId]);

	useEffect(() => {
		if (thread?.id == null || !latestThreadMsgId || loading) return;
		if (!discussionAtBottomRef.current) return;
		const el = discussionScrollRef.current;
		if (el) {
			requestAnimationFrame(() => {
				el.scrollTop = el.scrollHeight - el.clientHeight;
			});
		}
		writeThreadLastRead(thread.id, latestThreadMsgId);
		setThreadReadBump((v) => v + 1);
	}, [thread?.id, latestThreadMsgId, loading, threadMessages]);

	const handleDiscussionScroll = useCallback(() => {
		const el = discussionScrollRef.current;
		if (!el) return;
		const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
		discussionAtBottomRef.current = dist < 88;
		if (thread?.id == null || !latestThreadMsgId) return;
		if (discussionAtBottomRef.current) {
			writeThreadLastRead(thread.id, latestThreadMsgId);
			setThreadReadBump((v) => v + 1);
		}
	}, [thread?.id, latestThreadMsgId]);

	useEffect(() => {
		const handleShowReview = () => {
			requestAnimationFrame(() => handleDiscussionScroll());
		};
		window.addEventListener("resize", handleShowReview);
		return () => window.removeEventListener("resize", handleShowReview);
	}, [handleDiscussionScroll]);

	useEffect(() => {
		const d = finalizeDialogRef.current;
		if (!d) return;
		if (finalizeOpen) {
			if (!d.open) d.showModal();
		} else if (d.open) {
			d.close();
		}
	}, [finalizeOpen]);

	const handleFinalize = async () => {
		const ok = await finalizeThread();
		if (ok) setFinalizeOpen(false);
	};

	const handleSendDiscussion = async () => {
		const t = chatInput.trim();
		if (!t) return;
		await sendThreadMessage(t);
		setChatInput("");
	};

	const handleDiscussionKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			void handleSendDiscussion();
		}
	};

	const scrollToDraftLine = useCallback(
		(lineOneBased: number) => {
			if (expense?.id == null || lineOneBased < 1) return;
			setReviewSidebarOpen(true);
			const id = draftLineElementId(expense.id, lineOneBased);
			const run = () => {
				const el = document.getElementById(id);
				if (el) {
					el.scrollIntoView({ behavior: "smooth", block: "center" });
					return true;
				}
				return false;
			};
			requestAnimationFrame(() => {
				if (run()) return;
				window.setTimeout(run, 320);
			});
		},
		[expense?.id],
	);

	const handleInsertLineInDiscussion = useCallback(
		(lineOneBased: number) => {
			if (expense?.id == null) return;
			setThreadComposerMode("message");
			const md = buildExpenseThreadMarkdownLink(
				spaceId,
				expense.id,
				lineOneBased,
			);
			setChatInput((prev) => {
				const sep = prev.length > 0 && !/\s$/.test(prev) ? " " : "";
				return `${prev}${sep}${md}`;
			});
			requestAnimationFrame(() => {
				discussionComposerRef.current?.focus();
			});
		},
		[expense?.id, spaceId],
	);

	const handleDeleteDiscussionMessage = useCallback(
		(messageId: string | number) => {
			if (!window.confirm("Delete this message?")) return;
			void deleteThreadMessage(messageId);
		},
		[deleteThreadMessage],
	);

	const handleSaveDiscussionEdit = useCallback(async () => {
		if (editingDiscussionMessageId == null) return;
		const t = editingDiscussionDraft.trim();
		if (!t) return;
		await updateThreadMessage(editingDiscussionMessageId, t);
		setEditingDiscussionMessageId(null);
		setEditingDiscussionDraft("");
	}, [editingDiscussionDraft, editingDiscussionMessageId, updateThreadMessage]);

	const handleCancelDiscussionEdit = useCallback(() => {
		setEditingDiscussionMessageId(null);
		setEditingDiscussionDraft("");
	}, []);

	useLayoutEffect(() => {
		if (
			draftLineScrollRequest == null ||
			draftLineScrollRequest < 1 ||
			expense?.id == null ||
			loading
		) {
			return;
		}
		const line = draftLineScrollRequest;
		setReviewSidebarOpen(true);
		const id = draftLineElementId(expense.id, line);
		let cancelled = false;
		let timeoutId: number | undefined;
		const tryScroll = (): boolean => {
			const el = document.getElementById(id);
			if (!el) return false;
			el.scrollIntoView({ behavior: "smooth", block: "center" });
			return true;
		};
		const finish = () => {
			if (!cancelled) onDraftLineScrollConsumed?.();
		};
		const rafId = requestAnimationFrame(() => {
			if (cancelled) return;
			if (tryScroll()) {
				finish();
				return;
			}
			timeoutId = window.setTimeout(() => {
				if (cancelled) return;
				tryScroll();
				finish();
			}, 500);
		});
		return () => {
			cancelled = true;
			cancelAnimationFrame(rafId);
			if (timeoutId != null) window.clearTimeout(timeoutId);
		};
	}, [
		draftLineScrollRequest,
		expense?.id,
		loading,
		onDraftLineScrollConsumed,
		draftItems.length,
	]);

	if (loading && !expense && !actionError) {
		return (
			<p aria-live="polite" className="px-2 py-6 text-sm text-muted-foreground">
				Loading review thread…
			</p>
		);
	}

	if (actionError && !expense && !summary) {
		return (
			<div className="space-y-3 px-2 py-4">
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{actionError}
				</div>
				<button
					className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
					onClick={onClose}
					type="button"
				>
					{closeLabel}
				</button>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-[min(520px,75vh)] flex-col overflow-hidden rounded-xl bg-background/40 px-0.5 sm:px-1">
			{/* Full-width thread chrome */}
			<div className="shrink-0 border-b border-border/80 bg-gradient-to-b from-muted/30 to-background/95 px-2 pb-3 pt-2 sm:px-3">
				<header className="space-y-2.5">
					<div className="flex items-center gap-3">
						<button
							className="shrink-0 text-left text-xs font-medium text-primary hover:underline"
							onClick={onClose}
							type="button"
						>
							{closeLabel}
						</button>
					</div>
					<div className="min-w-0">
						<h2 className="truncate text-base font-semibold leading-snug tracking-tight text-foreground">
							{expense?.description?.trim() || "Expense"}{" "}
							<span className="font-normal text-muted-foreground">
								· {formatMoney(total)}
							</span>
						</h2>
						<div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
							<span className="rounded-md bg-muted/80 px-1.5 py-0.5 font-medium text-foreground/80">
								Space {String(spaceId)}
							</span>
							{thread ? (
								<span className="rounded-md bg-muted/80 px-1.5 py-0.5 font-medium text-foreground/80">
									Thread #{thread.id}
								</span>
							) : null}
							{finalized ? (
								<span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-medium">
									Finalized
								</span>
							) : null}
						</div>
						{ceitsEditUrl ? (
							<div className="mt-2">
								<a
									className="text-xs font-medium text-primary underline-offset-2 hover:underline"
									href={ceitsEditUrl}
									rel="noopener noreferrer"
									target="_blank"
								>
									Open in Ceits app
								</a>
							</div>
						) : null}
					</div>
				</header>

				{allMembersApproved && !finalized ? (
					<div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-900 dark:text-emerald-100">
						All members have approved — ready to finalize when the creator is
						satisfied with splits.
					</div>
				) : null}

				{actionError ? (
					<div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
						{actionError}
					</div>
				) : null}
				{payeeMismatchNotice?.mismatch ? (
					<div
						className="mt-2 flex flex-col gap-1 rounded-md border border-amber-500/45 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-50"
						role="status"
					>
						<div className="font-medium">
							Payee mismatch (lines still merged)
						</div>
						<p className="text-[11px] leading-snug opacity-95">
							Draft payee:{" "}
							<span className="font-semibold">
								{payeeMismatchNotice.draft_payee}
							</span>
							{" · "}
							This capture:{" "}
							<span className="font-semibold">
								{payeeMismatchNotice.incoming_payee}
							</span>
							. Review vendor on the expense or split into a new draft if
							needed.
						</p>
						<button
							className="self-end text-[10px] font-semibold uppercase tracking-wide text-amber-900/90 underline-offset-2 hover:underline dark:text-amber-100"
							onClick={() => dismissPayeeMismatchNotice()}
							type="button"
						>
							Dismiss
						</button>
					</div>
				) : null}
			</div>

			{/* Split: discussion (main) · review drawer from the right on lg; mobile stacks review on top */}
			<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
				<section
					aria-label="Expense thread discussion"
					className="order-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-border/50 bg-gradient-to-b from-background to-muted/15 lg:order-1 lg:min-h-0 lg:border-t-0"
				>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<div className="shrink-0 border-b border-border/30 bg-muted/20 px-3 py-2 sm:px-4">
							<div className="flex flex-wrap items-end justify-between gap-2">
								<h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
									Discussion
									{discussionUnread ? (
										<span
											aria-label="New discussion activity"
											className="h-2 w-2 rounded-full bg-primary"
											title="Unread discussion messages"
										/>
									) : null}
								</h2>
								<div className="flex flex-wrap items-center justify-end gap-2">
									{!reviewSidebarOpen ? (
										<button
											aria-label={
												discussionUnread
													? "Show review panel, unread in discussion"
													: "Show review panel"
											}
											className="hidden items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm transition hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:inline-flex"
											onClick={() => setReviewSidebarOpen(true)}
											type="button"
										>
											Show review
											{discussionUnread ? (
												<span
													aria-hidden
													className="h-2 w-2 rounded-full bg-primary"
												/>
											) : null}
										</button>
									) : null}
									{!finalized ? (
										<span className="text-[10px] text-muted-foreground">
											Messages & composer
										</span>
									) : null}
								</div>
							</div>
							{finalized ? (
								<p className="mb-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
									Finalized — no new messages.
								</p>
							) : null}
						</div>
						<div
							className="scrollbar-chat min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:px-3"
							onScroll={handleDiscussionScroll}
							ref={discussionScrollRef}
						>
							{hasOlder ? (
								<div className="mb-2">
									<button
										className="text-[11px] font-medium text-primary underline"
										disabled={loadOlderBusy}
										onClick={() => void loadOlderThreadMessages()}
										type="button"
									>
										{loadOlderBusy ? "Loading…" : "Older messages"}
									</button>
								</div>
							) : null}
							<ul
								aria-label="Thread discussion"
								className="space-y-2 pb-2"
								role="log"
							>
								{discussionTimeline.map((entry) => {
									if (entry.kind === "message") {
										const m = entry.message;
										const isMergeNotice = m.body.startsWith(
											THREAD_MERGE_MSG_PREFIX,
										);
										const mergeBody = isMergeNotice
											? m.body.slice(THREAD_MERGE_MSG_PREFIX.length)
											: m.body;
										const mine =
											currentUserId != null &&
											Number(m.user_id) === currentUserId;
										return (
											<li key={`msg-${m.id}`}>
												{isMergeNotice ? (
													<div
														className="group relative mx-auto max-w-[min(100%,36rem)] rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-center shadow-sm"
														role="status"
													>
														{mine && !finalized ? (
															<div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
																<button
																	aria-label="Delete activity message"
																	className="rounded px-1.5 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/10"
																	onClick={() =>
																		handleDeleteDiscussionMessage(m.id)
																	}
																	type="button"
																>
																	Delete
																</button>
															</div>
														) : null}
														<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
															Activity
														</div>
														<p className="mt-1 text-[12px] leading-snug text-foreground">
															{mergeBody}
														</p>
														<div className="mt-1 text-[10px] text-muted-foreground">
															{memberLabel(threadMembers, m.user_id)} ·{" "}
															{formatDateTime(m.created_at)}
														</div>
													</div>
												) : (
													<div
														className={[
															"group relative max-w-[min(100%,36rem)] rounded-xl border px-2.5 py-1.5 text-[13px] border-l-4",
															mine
																? "ml-auto border-primary/25 bg-primary/10 border-l-primary"
																: "mr-auto border-border bg-card border-l-teal-600/90 dark:border-l-teal-400/85",
														].join(" ")}
													>
														<div className="flex items-start justify-between gap-2">
															<div className="min-w-0 text-[10px] font-medium text-muted-foreground">
																{memberLabel(threadMembers, m.user_id)} ·{" "}
																{formatDateTime(m.created_at)}
															</div>
															{mine && !finalized ? (
																<div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
																	<button
																		aria-label="Edit message"
																		className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
																		onClick={() => {
																			setEditingDiscussionMessageId(
																				Number(m.id),
																			);
																			setEditingDiscussionDraft(m.body);
																		}}
																		type="button"
																	>
																		Edit
																	</button>
																	<button
																		aria-label="Delete message"
																		className="rounded px-1.5 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/10"
																		onClick={() =>
																			handleDeleteDiscussionMessage(m.id)
																		}
																		type="button"
																	>
																		Delete
																	</button>
																</div>
															) : null}
														</div>
														{editingDiscussionMessageId != null &&
														Number(editingDiscussionMessageId) ===
															Number(m.id) ? (
															<div className="mt-2 space-y-2">
																<label className="grid gap-1">
																	<span className="sr-only">
																		Edit discussion message
																	</span>
																	<textarea
																		className="min-h-[5rem] w-full resize-y rounded-md border border-border bg-background p-2 text-sm text-foreground"
																		onChange={(e) =>
																			setEditingDiscussionDraft(e.target.value)
																		}
																		rows={5}
																		value={editingDiscussionDraft}
																	/>
																</label>
																<div className="flex flex-wrap gap-2">
																	<button
																		className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
																		onClick={() =>
																			void handleSaveDiscussionEdit()
																		}
																		type="button"
																	>
																		Save
																	</button>
																	<button
																		className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
																		onClick={handleCancelDiscussionEdit}
																		type="button"
																	>
																		Cancel
																	</button>
																</div>
															</div>
														) : (
															<div className="mt-0.5 whitespace-pre-wrap text-foreground">
																<ThreadDiscussionRichText
																	body={m.body}
																	expenseId={expense?.id}
																	onJumpToLine={scrollToDraftLine}
																	spaceId={spaceId}
																/>
															</div>
														)}
													</div>
												)}
											</li>
										);
									}

									const p = entry.proposal;
									return (
										<li key={`proposal-${p.id}`}>
											<ProposalCaptureBubble
												canMergeProposals={canMergeProposals}
												currentUserId={currentUserId}
												finalized={finalized}
												formatDateTime={formatDateTime}
												formatMoney={formatMoney}
												isExpenseOwner={isExpenseOwner}
												onAccept={acceptProposal}
												onReject={rejectProposal}
												proposal={p}
												threadCaptureBusy={threadCaptureBusy}
												threadMembers={threadMembers}
											/>
										</li>
									);
								})}
							</ul>
						</div>

						<div className="shrink-0 border-t border-border/60 bg-card/95 p-2 backdrop-blur-sm dark:bg-background/90 sm:p-3">
							{finalized ? null : (
								<div className="space-y-2">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="flex flex-wrap items-center gap-1.5">
											{thread && !finalized && currentUserId != null ? (
												iApproved ? (
													<button
														className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-[11px] font-semibold hover:bg-accent disabled:opacity-50"
														disabled={threadCaptureBusy}
														onClick={() => void toggleApprove(currentUserId)}
														type="button"
													>
														Decline
													</button>
												) : (
													<button
														className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
														disabled={threadCaptureBusy}
														onClick={() => void toggleApprove(currentUserId)}
														type="button"
													>
														Approve
													</button>
												)
											) : null}
											{isThreadOrSpaceMaster && thread && !finalized ? (
												<button
													className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-[11px] font-semibold hover:bg-accent disabled:opacity-50"
													disabled={threadCaptureBusy}
													onClick={() => setFinalizeOpen(true)}
													type="button"
												>
													Finalize
												</button>
											) : null}
										</div>
										<div className="flex flex-wrap items-center justify-end gap-2">
											<button
												aria-label={
													threadComposerMode === "message"
														? "Switch to capture composer"
														: "Switch to discussion message"
												}
												aria-pressed={threadComposerMode === "capture"}
												className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-[11px] font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-50"
												disabled={threadCaptureBusy}
												onClick={() =>
													setThreadComposerMode((m) =>
														m === "message" ? "capture" : "message",
													)
												}
												type="button"
											>
												{threadComposerMode === "message" ? "Capture" : "Chat"}
											</button>
										</div>
									</div>
									{threadComposerMode === "capture" ? (
										<div className="space-y-1">
											<p className="text-[11px] leading-snug text-muted-foreground">
												Parse text, photo, or voice — submits a pending proposal
												for the thread creator or space owner to merge into the
												draft.
											</p>
											<ParseExpenseComposer
												disabled={threadCaptureBusy || finalized}
												isRecording={isThreadRecording}
												onParseInputChange={setThreadParseInput}
												onParseKeyDown={handleThreadParseKeyDown}
												onParseSubmit={() => void submitThreadParseText()}
												onPhotoFile={(f) => void submitThreadParsePhoto(f)}
												onToggleRecording={() => void toggleThreadRecording()}
												parseInput={threadParseInput}
												testSnippets={parseTestSnippets}
											/>
										</div>
									) : (
										<div className="flex items-end gap-2">
											<div className="grid min-w-0 flex-1 gap-1">
												<span className="text-xs font-medium text-muted-foreground">
													Message (Ctrl/⌘ + Enter) — links are WYSIWYG; only
													local{" "}
													<code className="rounded bg-muted px-0.5 text-[10px]">
														/console/…
													</code>{" "}
													paths
												</span>
												<DiscussionMessageComposer
													aria-label="Thread discussion message"
													disabled={threadCaptureBusy}
													onChange={setChatInput}
													onKeyDown={handleDiscussionKeyDown}
													placeholder="Write to the thread…"
													ref={discussionComposerRef}
													value={chatInput}
												/>
											</div>
											<button
												aria-label="Send message"
												className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
												disabled={threadCaptureBusy || !chatInput.trim()}
												onClick={() => void handleSendDiscussion()}
												type="button"
											>
												<SendMessageIcon />
											</button>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</section>

				<div
					className={[
						"relative order-1 flex min-h-0 flex-col overflow-hidden border-b border-border/60 bg-muted/10",
						"max-h-[46vh] lg:order-2 lg:max-h-none",
						"lg:border-l lg:border-border/60 lg:transition-[width,max-width] lg:duration-300 lg:ease-in-out",
						reviewSidebarOpen
							? "lg:w-[min(100%,24rem)] lg:max-w-xl lg:shrink-0 xl:max-w-md"
							: "lg:w-0 lg:max-w-0 lg:shrink-0 lg:overflow-hidden lg:border-0",
					].join(" ")}
				>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:min-w-0">
						<div className="shrink-0 px-2 py-2 sm:px-3">
							<div className="flex gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
								<div className="min-w-0 flex-1">
									<span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
										Review — draft & splits
										{discussionUnread && reviewSidebarOpen ? (
											<span
												aria-label="Unread messages in discussion"
												className="h-2 w-2 rounded-full bg-primary"
												title="New messages in discussion"
											/>
										) : null}
									</span>
									<span className="mt-1 block text-sm font-medium text-foreground">
										{lineCount} line{lineCount === 1 ? "" : "s"} ·{" "}
										{formatMoney(total)}
									</span>
									<span className="mt-0.5 block text-[11px] text-muted-foreground">
										Split: {splitSummaryShort}
									</span>
									{pendingProposals.length > 0 ? (
										<span className="mt-0.5 block text-[11px] font-medium text-amber-800 dark:text-amber-200">
											{pendingProposals.length} pending capture
											{pendingProposals.length === 1 ? "" : "s"} — merge in
											discussion
										</span>
									) : null}
									<span className="mt-1 block text-[10px] leading-snug text-muted-foreground">
										New threads default to the draft owner at 100%; after others
										add lines (capture), adjust % and save splits.
									</span>
								</div>
								<button
									aria-label="Hide review panel"
									className="hidden h-8 shrink-0 self-start rounded-md border border-border bg-background px-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm transition hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:inline-flex lg:items-center"
									onClick={() => setReviewSidebarOpen(false)}
									type="button"
								>
									Hide
								</button>
							</div>
						</div>

						<div
							className="scrollbar-chat min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:px-3"
							id={reviewScrollId}
						>
							<section
								aria-labelledby="inline-thread-approvals"
								className="mb-3 rounded-lg border border-border bg-card px-3 py-2"
							>
								<h2
									className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
									id="inline-thread-approvals"
								>
									Approvals
								</h2>
								<ul className="mt-1 space-y-1 text-[11px]">
									{threadMembers.map((m) => {
										const uid = Number(m.user_id);
										const ok = approverIds.some((id) => Number(id) === uid);
										return (
											<li className="flex justify-between gap-2" key={uid}>
												<span className="truncate">
													{memberLabel(threadMembers, uid)}
												</span>
												<span
													className={
														ok
															? "font-semibold text-emerald-700 dark:text-emerald-400"
															: "text-muted-foreground"
													}
												>
													{ok ? "Approved" : "Pending"}
												</span>
											</li>
										);
									})}
								</ul>
								<p className="mt-1.5 text-[10px] text-muted-foreground">
									Creator:{" "}
									{thread
										? memberLabel(threadMembers, thread.created_by_user_id)
										: "—"}
								</p>
							</section>

							<section aria-labelledby="inline-thread-splits" className="mb-3">
								<h2
									className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
									id="inline-thread-splits"
								>
									Split (% — must sum to 100%)
								</h2>
								<div className="mt-1 overflow-x-auto rounded-lg border border-border">
									<table className="w-full min-w-[260px] text-left text-[11px]">
										<thead>
											<tr className="border-b border-border bg-muted/40 text-muted-foreground">
												<th className="px-2 py-1.5 font-medium">Member</th>
												<th className="px-2 py-1.5 font-medium">%</th>
												<th className="px-2 py-1.5 font-medium">≈</th>
											</tr>
										</thead>
										<tbody>
											{splitRows.map((row) => {
												const pct = Number.parseFloat(row.percent);
												const approx =
													!Number.isNaN(pct) && total > 0
														? formatMoney((total * pct) / 100)
														: "—";
												return (
													<tr
														className="border-b border-border/60"
														key={row.user_id}
													>
														<td className="px-2 py-1">
															{memberLabel(threadMembers, row.user_id)}
														</td>
														<td className="px-2 py-1">
															{isThreadOrSpaceMaster && !finalized ? (
																<input
																	aria-label={`Percent for ${memberLabel(threadMembers, row.user_id)}`}
																	className="w-14 rounded border border-border bg-background px-1 py-0.5 font-mono"
																	inputMode="decimal"
																	onChange={(e) =>
																		setPercentChange(
																			row.user_id,
																			e.target.value,
																		)
																	}
																	type="text"
																	value={row.percent}
																/>
															) : (
																<span className="font-mono">
																	{row.percent}%
																</span>
															)}
														</td>
														<td className="px-2 py-1 text-muted-foreground">
															{approx}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
								{isThreadOrSpaceMaster &&
								!finalized &&
								currentUserId != null ? (
									<div className="mt-1.5 flex flex-wrap gap-2">
										<button
											className="rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-accent"
											onClick={resetSplitOwnerHundred}
											type="button"
										>
											Owner 100%
										</button>
										<button
											className="rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-accent"
											onClick={setEqualSplitPercents}
											type="button"
										>
											Equal %
										</button>
										<button
											className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground disabled:opacity-50"
											disabled={splitsSaving}
											onClick={() => void saveSplits(currentUserId)}
											type="button"
										>
											{splitsSaving ? "Saving…" : "Save splits"}
										</button>
									</div>
								) : null}
							</section>

							<section className="mb-3 rounded-lg border border-dashed border-border/80 bg-card/50 px-2 py-2">
								<div className="mb-2 flex flex-wrap items-start justify-between gap-2">
									<div className="min-w-0">
										<h2 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
											Draft expense
										</h2>
										{expense ? (
											<p className="mt-0.5 text-[11px] text-foreground">
												<span className="font-medium">{draftTitle || "—"}</span>
												{" · "}
												<span className="font-mono text-muted-foreground">
													{draftCurrency || "USD"}
												</span>
												{expense.vendor?.name ? (
													<>
														{" · "}
														<span className="text-muted-foreground">
															{expense.vendor.name}
														</span>
													</>
												) : null}
											</p>
										) : null}
										<p className="mt-1 text-[11px] text-muted-foreground">
											<strong>Required</strong> title and currency live in{" "}
											<strong>Edit expense</strong>. Line amounts are below.{" "}
											<strong>Optional</strong> vendor / invoice / notes are in
											Edit — expand there.
										</p>
									</div>
									{draftEditable ? (
										<button
											className="shrink-0 rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
											disabled={threadCaptureBusy}
											onClick={() => setHeaderEditOpen(true)}
											type="button"
										>
											Edit expense
										</button>
									) : null}
								</div>
								<p className="mb-2 text-[11px] text-muted-foreground">
									Line items: same as the main chat workspace. Save updates this
									draft for everyone in the thread.
								</p>
								<ManualTransactionEditor
									addLineToChatDisabled={
										!canAddExpenseLineLinkToChat || threadCaptureBusy
									}
									anchorExpenseId={expense?.id}
									description={draftDescription}
									disabled={!draftEditable || threadCaptureBusy}
									items={draftItems}
									onAddItem={addDraftItem}
									onChangeDescription={setDraftDescription}
									onChangeItem={changeDraftItem}
									onInsertLineInDiscussion={handleInsertLineInDiscussion}
									onRemoveItem={removeDraftItem}
									onSaveDraft={() => {
										if (currentUserId != null)
											void saveDraftExpense(currentUserId);
									}}
									variant="thread"
								/>
							</section>

							{pendingProposals.length > 0 ? (
								<ReviewPendingProposals
									canMergeProposals={canMergeProposals}
									currentUserId={currentUserId}
									finalized={finalized}
									formatDateTime={formatDateTime}
									formatMoney={formatMoney}
									isExpenseOwner={isExpenseOwner}
									onAccept={acceptProposal}
									onReject={rejectProposal}
									proposals={pendingProposals}
									threadCaptureBusy={threadCaptureBusy}
									threadMembers={threadMembers}
								/>
							) : null}
						</div>
					</div>
				</div>
			</div>

			<ThreadExpenseEditDialog
				busy={threadCaptureBusy}
				canEdit={draftEditable}
				currentUserId={currentUserId}
				draftCurrency={draftCurrency}
				draftInvoiceRef={draftInvoiceRef}
				draftNotes={draftNotes}
				draftPayeeText={draftPayeeText}
				draftTitle={draftTitle}
				draftTxnDate={draftTxnDate}
				draftVendorId={draftVendorId}
				linkedVendor={expense?.vendor ?? null}
				onOpenChange={setHeaderEditOpen}
				onSave={async () => {
					if (currentUserId == null) return false;
					return saveExpenseHeader(currentUserId);
				}}
				open={headerEditOpen}
				setDraftCurrency={setDraftCurrency}
				setDraftInvoiceRef={setDraftInvoiceRef}
				setDraftNotes={setDraftNotes}
				setDraftPayeeText={setDraftPayeeText}
				setDraftTitle={setDraftTitle}
				setDraftTxnDate={setDraftTxnDate}
				setDraftVendorId={setDraftVendorId}
				spaceId={spaceId}
			/>

			<dialog
				aria-labelledby={finalizeTitleId}
				className="fixed inset-0 z-[60] max-h-none w-full max-w-none border-0 bg-transparent p-4 backdrop:bg-black/50"
				onCancel={(e) => {
					e.preventDefault();
					setFinalizeOpen(false);
				}}
				ref={finalizeDialogRef}
			>
				<div className="flex min-h-[min(100vh,100dvh)] w-full items-center justify-center">
					<div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
						<h2 className="text-base font-semibold" id={finalizeTitleId}>
							Finalize thread?
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							This locks the thread. If the expense is still a draft, it will be
							confirmed.
						</p>
						<div className="mt-6 flex justify-end gap-2">
							<button
								className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
								onClick={() => setFinalizeOpen(false)}
								type="button"
							>
								Cancel
							</button>
							<button
								className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
								onClick={() => void handleFinalize()}
								type="button"
							>
								Finalize
							</button>
						</div>
					</div>
				</div>
			</dialog>
		</div>
	);
};
