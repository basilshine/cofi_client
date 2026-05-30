import type {
	ExpenseDetail,
	ExpenseThreadItemProposal,
	ExpenseThreadMessage,
	SpaceMember,
} from "@cofi/api";
import type { KeyboardEvent } from "react";
import {
	Fragment,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../shared/lib/apiClient";
import type { ExpenseThreadController } from "../hooks/useExpenseThreadState";
import { splitRowKey } from "../hooks/useExpenseThreadState";
import { ChatComposerDock, type ChatComposerMode } from "./ChatComposerDock";
import { ComposerHorizontalBar } from "./ComposerHorizontalBar";
import { ComposerVoiceRecording } from "./ComposerVoiceRecording";
import { ManualTransactionEditor } from "./ManualTransactionEditor";
import {
	ParseExpenseComposer,
	type ParseTestSnippet,
} from "./ParseExpenseComposer";
import { ThreadDiscussionRichText } from "./ThreadDiscussionRichText";
import { buildExpenseThreadMarkdownLink } from "./discussionLocalLinks";
import { draftLineElementId } from "./draftLineAnchors";

/** Server-prefixed thread chat line when a capture is merged into the draft (see AcceptItemProposal). */
const THREAD_MERGE_MSG_PREFIX = "[cofi:merge] ";

const THREAD_LAST_READ_PREFIX = "cofi.expenseThread.lastReadMsg.";

const expenseHeadingLabel = (exp: ExpenseDetail | null): string => {
	if (!exp) return "Expense";
	const title = (exp.title ?? "").trim();
	if (title && title.toLowerCase() !== "expense") return title;
	const descFirst =
		(exp.description ?? "")
			.split(/\r?\n/)
			.map((l) => l.trim())
			.find((l) => l.length > 0) ?? "";
	if (descFirst) return descFirst;
	const firstItem = (exp.items ?? [])
		.map((it) => (it.name ?? "").trim())
		.find((n) => n.length > 0);
	if (firstItem) return firstItem;
	return title || "Expense";
};

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
	onInsertLineLinkToMainChat?: (markdown: string) => void;
	/** Primary back control (default: back to main chat). */
	closeLabel?: string;
	/**
	 * Space Expenses route: inspector-first layout; full draft editor only after
	 * "Edit details & lines".
	 */
	panelLayout?: "default" | "expensesInspector";
	/** Expenses route: review primary opens Ceits Review Flow. */
	reviewDraftOpensFlow?: boolean;
	/** Space Expenses: notify parent when workspace edit mode toggles (e.g. dim main list). */
	onWorkspaceEditModeChange?: (editing: boolean) => void;
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
	onInsertLineLinkToMainChat,
	closeLabel = "← Back to space chat",
	panelLayout = "default",
	reviewDraftOpensFlow = false,
	onWorkspaceEditModeChange,
}: Props) => {
	const finalizeTitleId = useId();
	const finalizeDialogRef = useRef<HTMLDialogElement>(null);
	const cancelTitleId = useId();
	const cancelDialogRef = useRef<HTMLDialogElement>(null);
	const deleteTitleId = useId();
	const deleteDialogRef = useRef<HTMLDialogElement>(null);
	const [finalizeOpen, setFinalizeOpen] = useState(false);
	const [cancelOpen, setCancelOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [destructiveBusy, setDestructiveBusy] = useState(false);
	const [threadComposerMode, setThreadComposerMode] =
		useState<ChatComposerMode>("message");
	const [showExpenseDetails, setShowExpenseDetails] = useState(true);
	const [workspaceEditMode, setWorkspaceEditMode] = useState(false);
	/** In expenses inspector inspect mode: show all line rows without entering edit. */
	const [inspectShowAllLines, setInspectShowAllLines] = useState(false);
	/** Expenses workspace edit: line editor collapsed until expanded. */
	const [editLinesExpanded, setEditLinesExpanded] = useState(false);
	const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
	const [highlightedDraftLineId, setHighlightedDraftLineId] = useState<
		string | null
	>(null);
	const [chatInput, setChatInput] = useState("");
	const [editingDiscussionMessageId, setEditingDiscussionMessageId] = useState<
		number | null
	>(null);
	const [editingDiscussionDraft, setEditingDiscussionDraft] = useState("");
	const [threadReadBump, setThreadReadBump] = useState(0);
	const reviewScrollId = useId();
	const onWorkspaceEditModeChangeRef = useRef(onWorkspaceEditModeChange);
	onWorkspaceEditModeChangeRef.current = onWorkspaceEditModeChange;
	const discussionScrollRef = useRef<HTMLDivElement | null>(null);
	const threadMessageTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const threadMessagePhotoInputRef = useRef<HTMLInputElement | null>(null);
	const threadMessagePhotoCameraInputRef = useRef<HTMLInputElement | null>(
		null,
	);
	const discussionAtBottomRef = useRef(true);
	const didAutoScrollDiscussionRef = useRef(false);
	const prevThreadIdForScrollRef = useRef<number | null>(null);
	const highlightClearTimerRef = useRef<number | null>(null);

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

	const isExpensesInspector = panelLayout === "expensesInspector";
	const inspectorReadOnly = isExpensesInspector && !workspaceEditMode;
	const expenseWorkspaceEditing = isExpensesInspector && workspaceEditMode;

	const expenseStatusNorm = (expense?.status ?? "").toLowerCase();
	const isExpenseDraft = expense?.status === "draft";
	const isExpenseApproved = expenseStatusNorm === "approved";
	const isExpenseCancelled = expenseStatusNorm.includes("cancel");

	useEffect(() => {
		setWorkspaceEditMode(false);
	}, [expense?.id, panelLayout]);

	useEffect(() => {
		setInspectShowAllLines(false);
	}, [expense?.id]);

	useEffect(() => {
		if (workspaceEditMode) setInspectShowAllLines(false);
	}, [workspaceEditMode]);

	useEffect(() => {
		if (!expenseWorkspaceEditing) setEditLinesExpanded(false);
	}, [expenseWorkspaceEditing, expense?.id]);

	useEffect(() => {
		onWorkspaceEditModeChangeRef.current?.(expenseWorkspaceEditing);
	}, [expenseWorkspaceEditing]);

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

	const headingTitle = useMemo(() => expenseHeadingLabel(expense), [expense]);

	const expenseThreadHref =
		expense?.id != null
			? `/console/chat/thread?spaceId=${encodeURIComponent(String(spaceId))}&expenseId=${encodeURIComponent(String(expense.id))}`
			: null;

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

	useEffect(() => {
		const d = cancelDialogRef.current;
		if (!d) return;
		if (cancelOpen) {
			if (!d.open) d.showModal();
		} else if (d.open) {
			d.close();
		}
	}, [cancelOpen]);

	useEffect(() => {
		const d = deleteDialogRef.current;
		if (!d) return;
		if (deleteOpen) {
			if (!d.open) d.showModal();
		} else if (d.open) {
			d.close();
		}
	}, [deleteOpen]);

	const handleFinalize = async () => {
		const ok = await finalizeThread();
		if (ok) setFinalizeOpen(false);
	};

	const handleCancelDraft = useCallback(async () => {
		if (!expense?.id || !isExpenseOwner) return;
		setDestructiveBusy(true);
		try {
			await apiClient.finances.expenses.update(expense.id, {
				status: "cancelled",
			});
			setCancelOpen(false);
			await controller.load();
		} catch {
			// hook state (`actionError`) handles API errors in panel UI
		} finally {
			setDestructiveBusy(false);
		}
	}, [controller, expense?.id, isExpenseOwner]);

	const handleDeleteExpense = useCallback(async () => {
		if (!expense?.id || !isExpenseOwner) return;
		setDestructiveBusy(true);
		try {
			await apiClient.finances.expenses.delete(expense.id);
			setDeleteOpen(false);
			onClose();
		} catch {
			// hook state (`actionError`) handles API errors in panel UI
		} finally {
			setDestructiveBusy(false);
		}
	}, [expense?.id, isExpenseOwner, onClose]);

	const handleSendDiscussion = async () => {
		const t = chatInput.trim();
		if (!t) return;
		await sendThreadMessage(t);
		setChatInput("");
	};

	const handleThreadMessagePhotoFile = async (file: File) => {
		await sendThreadMessage(`📷 ${file.name}`);
	};

	const handleDiscussionKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			void handleSendDiscussion();
		}
	};

	const highlightDraftLine = useCallback((lineId: string) => {
		if (highlightClearTimerRef.current != null) {
			window.clearTimeout(highlightClearTimerRef.current);
		}
		setHighlightedDraftLineId(lineId);
		highlightClearTimerRef.current = window.setTimeout(() => {
			setHighlightedDraftLineId((prev) => (prev === lineId ? null : prev));
			highlightClearTimerRef.current = null;
		}, 1800);
	}, []);

	useEffect(() => {
		if (spaceId == null) return;
		let cancelled = false;
		void apiClient.spaces
			.listTransactionTags(spaceId)
			.then((res) => {
				if (cancelled) return;
				const tags = (res.tags ?? [])
					.map((t) => String(t).trim())
					.filter(Boolean)
					.sort((a, b) => a.localeCompare(b));
				setTagSuggestions(tags);
			})
			.catch(() => {
				if (!cancelled) setTagSuggestions([]);
			});
		return () => {
			cancelled = true;
		};
	}, [spaceId]);

	const scrollDraftLineInPanel = useCallback(
		(el: HTMLElement) => {
			const container = document.getElementById(reviewScrollId);
			if (!(container instanceof HTMLElement)) {
				el.scrollIntoView({ behavior: "smooth", block: "center" });
				return;
			}
			const containerRect = container.getBoundingClientRect();
			const elRect = el.getBoundingClientRect();
			const nextTop =
				container.scrollTop +
				(elRect.top - containerRect.top) -
				(container.clientHeight - el.clientHeight) / 2;
			container.scrollTo({
				top: Math.max(0, nextTop),
				behavior: "smooth",
			});
		},
		[reviewScrollId],
	);

	const scrollToDraftLine = useCallback(
		(lineOneBased: number) => {
			if (expense?.id == null || lineOneBased < 1) return;
			const id = draftLineElementId(expense.id, lineOneBased);
			const run = () => {
				const el = document.getElementById(id);
				if (el) {
					scrollDraftLineInPanel(el);
					highlightDraftLine(id);
					return true;
				}
				return false;
			};
			requestAnimationFrame(() => {
				if (run()) return;
				window.setTimeout(run, 320);
			});
		},
		[expense?.id, highlightDraftLine, scrollDraftLineInPanel],
	);

	const handleInsertLineInDiscussion = useCallback(
		(lineOneBased: number) => {
			if (expense?.id == null) return;
			const md = buildExpenseThreadMarkdownLink(
				spaceId,
				expense.id,
				lineOneBased,
			);
			onInsertLineLinkToMainChat?.(md);
		},
		[expense?.id, spaceId, onInsertLineLinkToMainChat],
	);

	const handleAddItemAndFocus = useCallback(() => {
		const nextLine = draftItems.length + 1;
		addDraftItem();
		requestAnimationFrame(() => {
			scrollToDraftLine(nextLine);
		});
	}, [addDraftItem, draftItems.length, scrollToDraftLine]);

	const handleReviewDraftInspect = useCallback(() => {
		setInspectShowAllLines(true);
		requestAnimationFrame(() => {
			document
				.getElementById("expense-inspect-line-items")
				?.scrollIntoView({ behavior: "smooth", block: "start" });
		});
	}, []);

	const handleExpenseWorkspaceSave = useCallback(async () => {
		if (currentUserId == null) return;
		await saveExpenseHeader(currentUserId);
		await saveDraftExpense(currentUserId);
	}, [currentUserId, saveDraftExpense, saveExpenseHeader]);

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
		const id = draftLineElementId(expense.id, line);
		let cancelled = false;
		let timeoutId: number | undefined;
		const tryScroll = (): boolean => {
			const el = document.getElementById(id);
			if (!el) return false;
			scrollDraftLineInPanel(el);
			highlightDraftLine(id);
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
		highlightDraftLine,
		scrollDraftLineInPanel,
	]);

	useEffect(() => {
		return () => {
			if (highlightClearTimerRef.current != null) {
				window.clearTimeout(highlightClearTimerRef.current);
			}
		};
	}, []);

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
		<div
			className={
				expenseWorkspaceEditing
					? "flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-amber-50/[0.42] ring-1 ring-amber-300/35 dark:bg-amber-950/30 dark:ring-amber-700/40"
					: "flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-background/40"
			}
		>
			{/* Full-width thread chrome */}
			<div className="shrink-0 border-b border-border/80 bg-gradient-to-b from-muted/30 to-background/95 px-2 pb-3 pt-2 sm:px-3">
				<header className="space-y-2.5">
					<div className="flex items-center justify-between gap-2">
						<button
							className="shrink-0 text-left text-sm font-medium text-primary hover:underline"
							onClick={onClose}
							type="button"
						>
							{closeLabel}
						</button>
						<div className="flex items-center gap-2">
							{isExpensesInspector ? (
								<button
									aria-label="Close expense panel"
									className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-background text-lg leading-none text-muted-foreground transition hover:bg-accent hover:text-foreground"
									onClick={onClose}
									type="button"
								>
									×
								</button>
							) : null}
						</div>
					</div>
					<div className="min-w-0">
						<h2 className="truncate text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
							{headingTitle}{" "}
							<span className="font-normal text-muted-foreground">
								· {formatMoney(total)}
							</span>
						</h2>
						{expense?.status ? (
							<p className="mt-1.5 inline-flex rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-semibold capitalize text-foreground/90">
								{String(expense.status).replace(/_/g, " ")}
							</p>
						) : null}
						<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
							<span>
								Space {String(spaceId)}
								{thread ? ` · Thread #${thread.id}` : ""}
							</span>
							<span>
								{lineCount} line{lineCount === 1 ? "" : "s"}
							</span>
							{pendingProposals.length > 0 ? (
								<span className="font-medium text-amber-800 dark:text-amber-200">
									{pendingProposals.length} pending capture
									{pendingProposals.length === 1 ? "" : "s"}
								</span>
							) : null}
							{finalized ? (
								<span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-medium">
									Finalized
								</span>
							) : null}
						</div>
					</div>
				</header>

				{allMembersApproved && !finalized && !inspectorReadOnly ? (
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

			{/* Review (draft & splits), then discussion + composers — single column */}
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div
					className={
						expenseWorkspaceEditing
							? "flex min-h-0 w-full flex-1 flex-col border-b border-amber-200/40 bg-amber-50/25 dark:border-amber-800/40 dark:bg-amber-950/25"
							: "flex min-h-0 w-full flex-1 flex-col border-b border-border/60 bg-muted/10"
					}
				>
					<div className="flex min-h-0 w-full flex-col overflow-hidden">
						{!inspectorReadOnly ? (
							<div className="shrink-0 px-2 pt-2 pb-2 sm:px-3">
								<section
									aria-labelledby="inline-thread-approvals"
									className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2"
								>
									<h2
										className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200"
										id="inline-thread-approvals"
									>
										Approvals
									</h2>
									<div id="inline-thread-approvals-content">
										<ul className="mt-1.5 space-y-1 text-[11px]">
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
									</div>
								</section>

								<section
									aria-labelledby="inline-thread-splits"
									className="rounded-lg border border-sky-500/30 bg-sky-500/[0.06] px-3 py-2"
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<h2
											className="text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200"
											id="inline-thread-splits"
										>
											Split (% — must sum to 100%)
										</h2>
										<span
											className={
												finalized || allMembersApproved
													? "rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200"
													: "rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100"
											}
										>
											{finalized || allMembersApproved
												? "Confirmed"
												: "Pending"}
										</span>
									</div>
									<div className="mt-1.5" id="inline-thread-splits-content">
										<div className="overflow-x-auto rounded-lg border border-border">
											<table className="w-full min-w-[260px] text-left text-[11px]">
												<thead>
													<tr className="border-b border-border bg-muted/40 text-muted-foreground">
														<th className="px-2 py-1.5 font-medium">Member</th>
														<th className="px-2 py-1.5 font-medium">%</th>
														<th className="px-2 py-1.5 font-medium">Amount</th>
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
																key={splitRowKey(row)}
															>
																<td className="px-2 py-1">{row.label}</td>
																<td className="px-2 py-1">
																	{isThreadOrSpaceMaster && !finalized ? (
																		<input
																			aria-label={`Percent for ${row.label}`}
																			className="w-14 rounded border border-border bg-background px-1 py-0.5 font-mono"
																			inputMode="decimal"
																			onChange={(e) =>
																				setPercentChange(
																					splitRowKey(row),
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
										{splitRows.length === 0 ? (
											<p className="mt-2 text-sm text-muted-foreground">
												No split assigned yet.
											</p>
										) : null}
										{!inspectorReadOnly &&
										!expenseWorkspaceEditing &&
										thread &&
										!finalized &&
										currentUserId != null ? (
											<div
												className="mt-2 border-t border-sky-500/25 pt-2"
												role="group"
												aria-label="Your approval for this expense"
											>
												<p className="mb-1.5 text-[10px] font-medium text-sky-900/80 dark:text-sky-100/80">
													Your approval
												</p>
												<div className="flex flex-wrap items-center gap-2">
													{iApproved ? (
														<button
															className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-[11px] font-semibold hover:bg-accent disabled:opacity-50"
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
													)}
													{isThreadOrSpaceMaster ? (
														<button
															className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-[11px] font-semibold hover:bg-accent disabled:opacity-50"
															disabled={threadCaptureBusy}
															onClick={() => setFinalizeOpen(true)}
															type="button"
														>
															Finalize
														</button>
													) : null}
												</div>
											</div>
										) : null}
									</div>
								</section>
							</div>
						) : null}

						<div
							className="scrollbar-chat min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:px-3"
							id={reviewScrollId}
						>
							{inspectorReadOnly ? (
								<div className="space-y-3 pb-1">
									<section
										aria-labelledby="inspect-approvals-heading"
										className="rounded-xl border border-border/50 bg-card/60 px-3 py-3 shadow-sm"
									>
										<h2
											className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
											id="inspect-approvals-heading"
										>
											Member approvals
										</h2>
										<ul className="mt-2 space-y-1.5 text-sm">
											{threadMembers.map((m) => {
												const uid = Number(m.user_id);
												const ok = approverIds.some((id) => Number(id) === uid);
												return (
													<li className="flex justify-between gap-2" key={uid}>
														<span className="truncate text-foreground/90">
															{memberLabel(threadMembers, uid)}
														</span>
														<span
															className={
																ok
																	? "shrink-0 font-medium text-emerald-700 dark:text-emerald-400"
																	: "shrink-0 text-muted-foreground"
															}
														>
															{ok ? "Approved" : "Pending"}
														</span>
													</li>
												);
											})}
										</ul>
										<p className="mt-2 text-xs text-muted-foreground">
											Creator:{" "}
											{thread
												? memberLabel(threadMembers, thread.created_by_user_id)
												: "—"}
										</p>
									</section>

									<section
										aria-labelledby="inspect-split-heading"
										className="rounded-xl border border-border/50 bg-card/60 px-3 py-3 shadow-sm"
									>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<h2
												className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
												id="inspect-split-heading"
											>
												Split
											</h2>
											<span
												className={
													finalized || allMembersApproved
														? "rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200"
														: "rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100"
												}
											>
												{finalized || allMembersApproved
													? "Confirmed"
													: "Pending"}
											</span>
										</div>
										{splitRows.length > 0 ? (
											<div className="mt-2 overflow-x-auto">
												<table className="w-full min-w-[260px] border-collapse text-left text-sm">
													<thead>
														<tr className="border-b border-border/50 text-xs font-medium text-muted-foreground">
															<th className="px-2.5 py-2 font-medium">
																Member
															</th>
															<th className="px-2.5 py-2 font-medium">%</th>
															<th className="px-2.5 py-2 font-medium">
																Amount
															</th>
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
																	className="border-b border-border/50 last:border-0"
																	key={splitRowKey(row)}
																>
																	<td className="px-2.5 py-2 text-foreground/90">
																		{row.label}
																	</td>
																	<td className="px-2.5 py-2 font-mono tabular-nums text-muted-foreground">
																		{row.percent}%
																	</td>
																	<td className="px-2.5 py-2 font-mono tabular-nums text-foreground/85">
																		{approx}
																	</td>
																</tr>
															);
														})}
													</tbody>
												</table>
											</div>
										) : (
											<p className="mt-2 text-sm text-muted-foreground">
												No split assigned yet.
											</p>
										)}
									</section>

									<section className="rounded-xl border border-border/50 bg-card/60 px-3 py-3 shadow-sm">
										<h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											Expense summary
										</h2>
										<dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
											<div>
												<dt className="text-xs font-medium text-muted-foreground">
													Date
												</dt>
												<dd className="mt-0.5 font-medium text-foreground">
													{draftTxnDate?.trim() || "—"}
												</dd>
											</div>
											<div>
												<dt className="text-xs font-medium text-muted-foreground">
													Payee
												</dt>
												<dd className="mt-0.5 text-foreground">
													{draftPayeeText?.trim() ||
														expense?.vendor?.name?.trim() ||
														"—"}
												</dd>
											</div>
											<div>
												<dt className="text-xs font-medium text-muted-foreground">
													Category / tags
												</dt>
												<dd className="mt-0.5 text-foreground">
													{expense?.items?.length
														? [
																...new Set(
																	expense.items.flatMap((it) =>
																		(it.tags ?? []).map((t) =>
																			(t.name ?? "").trim(),
																		),
																	),
																),
															]
																.filter(Boolean)
																.slice(0, 4)
																.join(", ") || "—"
														: "—"}
												</dd>
											</div>
											<div>
												<dt className="text-xs font-medium text-muted-foreground">
													Space
												</dt>
												<dd className="mt-0.5 font-medium text-foreground">
													#{String(spaceId)}
												</dd>
											</div>
											<div>
												<dt className="text-xs font-medium text-muted-foreground">
													Source
												</dt>
												<dd className="mt-0.5 capitalize text-foreground">
													{expense?.status === "draft"
														? "Draft in workspace"
														: "Recorded"}
												</dd>
											</div>
											<div className="sm:col-span-2">
												<dt className="text-xs font-medium text-muted-foreground">
													Created
												</dt>
												<dd className="mt-0.5 text-foreground">
													{expense?.created_at
														? formatDateTime(expense.created_at)
														: "—"}
												</dd>
											</div>
										</dl>
									</section>

									<section
										className="rounded-xl border border-border/50 bg-card/60 px-3 py-3 shadow-sm"
										id="expense-inspect-line-items"
									>
										<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											Line items
										</h3>
										<ul className="mt-2 space-y-2 text-sm">
											{(inspectShowAllLines
												? draftItems
												: draftItems.slice(0, 2)
											).map((it, idx) => (
												<li
													className="flex justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0"
													key={`insp-${String(it.name)}-${idx}`}
												>
													<span className="min-w-0 truncate text-foreground/90">
														{it.name}
													</span>
													<span className="shrink-0 tabular-nums text-muted-foreground">
														{formatMoney(Number(it.amount))}
													</span>
												</li>
											))}
										</ul>
										{draftItems.length > 2 && !inspectShowAllLines ? (
											<button
												className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
												onClick={() => setInspectShowAllLines(true)}
												type="button"
											>
												Show more ({draftItems.length} lines)
											</button>
										) : null}
									</section>
								</div>
							) : null}
							{!inspectorReadOnly ? (
								<div
									className={
										isExpensesInspector
											? "mb-2 rounded-xl border border-amber-300/50 bg-background/90 p-2 shadow-sm sm:p-3 dark:border-amber-600/45 dark:bg-amber-950/40"
											: "contents"
									}
								>
									{isExpensesInspector ? (
										<div className="mb-3 flex items-center gap-2 border-b border-amber-200/50 pb-2.5 dark:border-amber-800/50">
											<svg
												aria-hidden
												focusable="false"
												className="h-4 w-4 shrink-0 text-amber-800/85 dark:text-amber-200/90"
												fill="none"
												stroke="currentColor"
												strokeWidth={1.75}
												viewBox="0 0 24 24"
											>
												<title>Edit</title>
												<path
													d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
											<p className="text-sm font-semibold tracking-tight text-amber-950 dark:text-amber-50">
												Editing expense
											</p>
										</div>
									) : null}
									<Fragment>
										<section className="mb-3 rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm">
											<div className="mb-2 flex flex-wrap items-start justify-between gap-2">
												<div className="min-w-0">
													<h2 className="text-xs font-semibold text-foreground">
														Draft expense
													</h2>
													{expense ? (
														<p className="mt-0.5 text-xs text-muted-foreground">
															<span className="font-medium">
																{draftTitle || "—"}
															</span>
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
													<button
														aria-controls="inline-expense-details-content"
														aria-expanded={showExpenseDetails}
														className="mt-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
														onClick={() => setShowExpenseDetails((v) => !v)}
														type="button"
													>
														{showExpenseDetails
															? "Hide expense details"
															: "Show expense details"}
													</button>
												</div>
											</div>
											{showExpenseDetails ? (
												<div
													className="mb-3 grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
													id="inline-expense-details-content"
												>
													<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
														<label className="grid gap-1">
															<span className="text-[11px] font-medium text-muted-foreground">
																Title
															</span>
															<input
																aria-label="Expense title"
																className="h-9 rounded-md border border-border bg-white dark:bg-background px-3 text-sm"
																disabled={!draftEditable || threadCaptureBusy}
																onChange={(e) => setDraftTitle(e.target.value)}
																placeholder="Expense title"
																type="text"
																value={draftTitle}
															/>
														</label>
														<label className="grid gap-1">
															<span className="text-[11px] font-medium text-muted-foreground">
																Currency
															</span>
															<input
																aria-label="Expense currency"
																className="h-9 w-24 rounded-md border border-border bg-white dark:bg-background px-3 font-mono text-sm uppercase"
																disabled={!draftEditable || threadCaptureBusy}
																maxLength={3}
																onChange={(e) =>
																	setDraftCurrency(
																		e.target.value.toUpperCase().slice(0, 3),
																	)
																}
																placeholder="USD"
																type="text"
																value={draftCurrency}
															/>
														</label>
													</div>
													<div className="grid gap-2 sm:grid-cols-2">
														<label className="grid gap-1">
															<span className="text-[11px] font-medium text-muted-foreground">
																Payee
															</span>
															<input
																aria-label="Expense payee"
																className="h-9 rounded-md border border-border bg-white dark:bg-background px-3 text-sm"
																disabled={!draftEditable || threadCaptureBusy}
																onChange={(e) =>
																	setDraftPayeeText(e.target.value)
																}
																placeholder="Payee (optional)"
																type="text"
																value={draftPayeeText}
															/>
														</label>
														<label className="grid gap-1">
															<span className="text-[11px] font-medium text-muted-foreground">
																Description
															</span>
															<input
																aria-label="Expense description"
																className="h-9 rounded-md border border-border bg-white dark:bg-background px-3 text-sm"
																disabled={!draftEditable || threadCaptureBusy}
																onChange={(e) =>
																	setDraftDescription(e.target.value)
																}
																placeholder="e.g. Dinner + taxi"
																type="text"
																value={draftDescription}
															/>
														</label>
													</div>
													<div className="grid gap-2 sm:grid-cols-2">
														<label className="grid gap-1">
															<span className="text-[11px] font-medium text-muted-foreground">
																Invoice
															</span>
															<input
																aria-label="Expense invoice reference"
																className="h-9 rounded-md border border-border bg-white dark:bg-background px-3 text-sm"
																disabled={!draftEditable || threadCaptureBusy}
																onChange={(e) =>
																	setDraftInvoiceRef(e.target.value)
																}
																placeholder="INV-1234"
																type="text"
																value={draftInvoiceRef}
															/>
														</label>
														<label className="grid gap-1">
															<span className="text-[11px] font-medium text-muted-foreground">
																Transaction date
															</span>
															<input
																aria-label="Expense transaction date"
																className="h-9 rounded-md border border-border bg-white dark:bg-background px-2 text-sm"
																disabled={!draftEditable || threadCaptureBusy}
																onChange={(e) =>
																	setDraftTxnDate(e.target.value)
																}
																type="date"
																value={draftTxnDate}
															/>
														</label>
													</div>
													<label className="grid gap-1">
														<span className="text-[11px] font-medium text-muted-foreground">
															Notes
														</span>
														<textarea
															aria-label="Expense notes"
															className="min-h-[68px] rounded-md border border-border bg-white dark:bg-background px-2 py-2 text-sm"
															disabled={!draftEditable || threadCaptureBusy}
															onChange={(e) => setDraftNotes(e.target.value)}
															placeholder="Business notes (optional)"
															rows={3}
															value={draftNotes}
														/>
													</label>
													{!isExpensesInspector ? (
														<div className="flex justify-end">
															<button
																className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
																disabled={
																	!draftEditable ||
																	threadCaptureBusy ||
																	currentUserId == null
																}
																onClick={() => {
																	if (currentUserId != null) {
																		void saveExpenseHeader(currentUserId);
																	}
																}}
																type="button"
															>
																Save details
															</button>
														</div>
													) : null}
												</div>
											) : null}
										</section>
										<section className="mb-3 rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm">
											<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
												<h3 className="text-xs font-semibold text-foreground">
													Line items
												</h3>
												<div className="flex flex-wrap items-center gap-2">
													<span className="text-[11px] text-muted-foreground">
														{draftItems.length} line
														{draftItems.length === 1 ? "" : "s"}
													</span>
													{isExpensesInspector ? (
														<button
															aria-expanded={editLinesExpanded}
															className="rounded-md border border-border/80 bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
															onClick={() => setEditLinesExpanded((v) => !v)}
															type="button"
														>
															{editLinesExpanded
																? "Hide line items"
																: "Show line items"}
														</button>
													) : null}
												</div>
											</div>
											{!isExpensesInspector || editLinesExpanded ? (
												<ManualTransactionEditor
													addLineToChatDisabled={
														!canAddExpenseLineLinkToChat || threadCaptureBusy
													}
													anchorExpenseId={expense?.id}
													currencyCode={(draftCurrency || "USD").toUpperCase()}
													description={draftDescription}
													disabled={!draftEditable || threadCaptureBusy}
													highlightedLineId={highlightedDraftLineId}
													items={draftItems}
													onAddItem={handleAddItemAndFocus}
													onChangeDescription={setDraftDescription}
													onChangeItem={changeDraftItem}
													onInsertLineInDiscussion={
														handleInsertLineInDiscussion
													}
													onRemoveItem={removeDraftItem}
													onSaveDraft={() => {
														if (currentUserId != null)
															void saveDraftExpense(currentUserId);
													}}
													showBottomActions={false}
													tagSuggestions={tagSuggestions}
													variant="thread"
												/>
											) : (
												<p className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-3 py-3 text-sm text-muted-foreground">
													{draftItems.length} line
													{draftItems.length === 1 ? "" : "s"} ·{" "}
													<span className="font-medium text-foreground/80">
														{formatMoney(total)}
													</span>
													{" — "}
													<button
														className="font-semibold text-primary underline-offset-2 hover:underline"
														onClick={() => setEditLinesExpanded(true)}
														type="button"
													>
														Expand to edit
													</button>
												</p>
											)}
										</section>
									</Fragment>
								</div>
							) : null}

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

				<div
					className={
						expenseWorkspaceEditing
							? "sticky bottom-0 z-20 mt-auto border-t-2 border-amber-500/55 bg-amber-50/95 px-3 py-3 shadow-[0_-16px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md sm:px-4 dark:border-amber-500/45 dark:bg-amber-950/55"
							: "sticky bottom-0 z-20 mt-auto border-t border-[rgba(120,100,80,0.15)] bg-[rgba(255,252,246,0.92)] px-3 py-2.5 shadow-[0_-10px_24px_-16px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:px-4"
					}
				>
					{inspectorReadOnly ? (
						<div className="flex flex-col gap-2.5">
							{isExpenseCancelled ? (
								<p className="text-xs text-muted-foreground">
									This expense was cancelled.
								</p>
							) : (
								<div className="flex flex-wrap items-center gap-2">
									{isExpenseDraft ? (
										<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
											<button
												className="inline-flex h-10 items-center rounded-lg bg-[rgba(55,45,30,0.92)] px-4 text-sm font-semibold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(45,38,28,0.95)]"
												onClick={() => {
													if (isExpensesInspector && reviewDraftOpensFlow) {
														window.location.assign(
															`/console/review?spaceId=${encodeURIComponent(String(spaceId))}`,
														);
														return;
													}
													handleReviewDraftInspect();
												}}
												type="button"
											>
												Review draft
											</button>
											<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
												<button
													className="font-medium text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
													onClick={() => setWorkspaceEditMode(true)}
													type="button"
												>
													Edit
												</button>
												{expenseThreadHref ? (
													<>
														<span
															aria-hidden
															className="select-none text-muted-foreground/35"
														>
															·
														</span>
														<Link
															className="font-medium text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
															to={expenseThreadHref}
														>
															Open chat
														</Link>
													</>
												) : null}
											</div>
										</div>
									) : isExpenseApproved ? (
										<>
											{expenseThreadHref ? (
												<Link
													className="inline-flex h-10 items-center rounded-lg bg-[rgba(55,45,30,0.92)] px-4 text-sm font-semibold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(45,38,28,0.95)]"
													to={expenseThreadHref}
												>
													Open expense
												</Link>
											) : null}
											<button
												className="inline-flex h-9 items-center rounded-lg border border-transparent bg-transparent px-3 text-sm font-medium text-muted-foreground transition hover:bg-[rgba(120,100,80,0.08)] hover:text-foreground dark:hover:bg-muted/40"
												onClick={() => setWorkspaceEditMode(true)}
												type="button"
											>
												Edit
											</button>
										</>
									) : (
										<button
											className="inline-flex h-10 items-center rounded-lg bg-[rgba(55,45,30,0.92)] px-4 text-sm font-semibold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(45,38,28,0.95)]"
											onClick={() => setWorkspaceEditMode(true)}
											type="button"
										>
											Review
										</button>
									)}
								</div>
							)}
							<div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[rgba(120,100,80,0.12)] pt-2.5">
								{isExpenseCancelled ? (
									<button
										className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
										onClick={() => setWorkspaceEditMode(true)}
										type="button"
									>
										Edit
									</button>
								) : null}
								{!isExpenseDraft && expenseThreadHref ? (
									<Link
										className="text-xs font-medium text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
										to={expenseThreadHref}
									>
										Open chat
									</Link>
								) : null}
								{thread &&
								!finalized &&
								currentUserId != null &&
								!isExpenseCancelled ? (
									iApproved ? (
										<button
											className="text-sm font-medium text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline disabled:opacity-50"
											disabled={threadCaptureBusy}
											onClick={() => void toggleApprove(currentUserId)}
											type="button"
										>
											Decline
										</button>
									) : (
										<button
											className="text-xs font-medium text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline disabled:opacity-50"
											disabled={threadCaptureBusy}
											onClick={() => void toggleApprove(currentUserId)}
											type="button"
										>
											Approve
										</button>
									)
								) : null}
								{isThreadOrSpaceMaster && !finalized && allMembersApproved ? (
									<button
										className="text-xs font-medium text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline disabled:opacity-50"
										disabled={threadCaptureBusy}
										onClick={() => setFinalizeOpen(true)}
										type="button"
									>
										Finalize
									</button>
								) : null}
								{isExpenseOwner && expense?.id ? (
									<button
										className="ml-auto text-xs font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-50"
										disabled={threadCaptureBusy || destructiveBusy}
										onClick={() => setDeleteOpen(true)}
										type="button"
									>
										Delete…
									</button>
								) : null}
							</div>
						</div>
					) : isExpensesInspector ? (
						<div className="rounded-lg border border-amber-600/25 bg-background/80 px-3 py-2.5 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40">
							<p className="text-sm font-semibold tracking-tight text-amber-950 dark:text-amber-50">
								Editing expense — changes not saved
							</p>
							<div className="mt-3 flex flex-wrap items-center gap-2">
								<button
									className="inline-flex h-10 min-w-[5.5rem] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-accent"
									onClick={() => setWorkspaceEditMode(false)}
									type="button"
								>
									Cancel
								</button>
								<button
									className="inline-flex h-10 min-w-[7.5rem] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95 disabled:opacity-50"
									disabled={
										!draftEditable || threadCaptureBusy || currentUserId == null
									}
									onClick={() => void handleExpenseWorkspaceSave()}
									type="button"
								>
									Save changes
								</button>
							</div>
						</div>
					) : (
						<>
							<div className="flex flex-wrap items-center gap-2">
								<button
									className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-[11px] font-medium hover:bg-accent disabled:opacity-50"
									disabled={!draftEditable || threadCaptureBusy}
									onClick={handleAddItemAndFocus}
									type="button"
								>
									Add item
								</button>
								<button
									className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
									disabled={
										!draftEditable || threadCaptureBusy || currentUserId == null
									}
									onClick={() => {
										if (currentUserId != null)
											void saveDraftExpense(currentUserId);
									}}
									type="button"
								>
									Save draft
								</button>
								{draftEditable ? (
									<button
										className="inline-flex h-8 items-center rounded-md border border-destructive/40 px-2.5 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
										disabled={threadCaptureBusy || destructiveBusy}
										onClick={() => setCancelOpen(true)}
										type="button"
									>
										Cancel draft
									</button>
								) : null}
								{isExpenseOwner && expense?.id ? (
									<button
										className="inline-flex h-8 items-center rounded-md border border-destructive/40 px-2.5 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
										disabled={threadCaptureBusy || destructiveBusy}
										onClick={() => setDeleteOpen(true)}
										type="button"
									>
										Delete expense
									</button>
								) : null}
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								Discussion is temporarily hidden in this panel.
							</p>
						</>
					)}
				</div>

				<section
					aria-label="Expense thread discussion"
					className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-border/50 bg-gradient-to-b from-background to-muted/15"
				>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<div className="shrink-0 border-b border-border/30 bg-muted/20 px-3 py-2 sm:px-4">
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
							{finalized ? (
								<p className="mt-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
									Finalized — no new messages.
								</p>
							) : (
								<p className="mt-1 text-[10px] text-muted-foreground">
									Thread messages; message and capture composers are below.
								</p>
							)}
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

						<div className="shrink-0 border-t border-border/60 bg-card/95 backdrop-blur-sm dark:bg-background/90">
							{finalized ? null : (
								<>
									<ChatComposerDock
										captureSlot={
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
										}
										composerMode={threadComposerMode}
										disabled={threadCaptureBusy}
										interactionLocked={isThreadRecording}
										messageSlot={
											isThreadRecording && threadComposerMode === "message" ? (
												<ComposerVoiceRecording
													disabled={threadCaptureBusy}
													onStop={() => void toggleThreadRecording()}
												/>
											) : (
												<div className="flex flex-col gap-2">
													<ComposerHorizontalBar
														ariaLabel="Thread discussion message"
														disabled={threadCaptureBusy}
														onChange={setChatInput}
														onKeyDown={handleDiscussionKeyDown}
														onMoreTakePhoto={() =>
															threadMessagePhotoCameraInputRef.current?.click()
														}
														onMoreUploadPhoto={() =>
															threadMessagePhotoInputRef.current?.click()
														}
														onPlusFocusText={() =>
															threadMessageTextareaRef.current?.focus()
														}
														onPlusPhotoLibrary={() =>
															threadMessagePhotoInputRef.current?.click()
														}
														onStartRecording={() =>
															void toggleThreadRecording()
														}
														onSubmit={() => void handleSendDiscussion()}
														placeholder="Write to the thread…"
														textareaRef={threadMessageTextareaRef}
														value={chatInput}
														variant="message"
													/>
													<input
														accept="image/*"
														className="sr-only"
														onChange={(e) => {
															const f = e.target.files?.[0] ?? null;
															e.currentTarget.value = "";
															if (f) void handleThreadMessagePhotoFile(f);
														}}
														ref={threadMessagePhotoInputRef}
														tabIndex={-1}
														type="file"
													/>
													<input
														accept="image/*"
														capture="environment"
														className="sr-only"
														onChange={(e) => {
															const f = e.target.files?.[0] ?? null;
															e.currentTarget.value = "";
															if (f) void handleThreadMessagePhotoFile(f);
														}}
														ref={threadMessagePhotoCameraInputRef}
														tabIndex={-1}
														type="file"
													/>
												</div>
											)
										}
										onComposerModeChange={setThreadComposerMode}
										showModeToggle
									/>
								</>
							)}
						</div>
					</div>
				</section>
			</div>

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
			<dialog
				aria-labelledby={cancelTitleId}
				className="fixed inset-0 z-[60] max-h-none w-full max-w-none border-0 bg-transparent p-4 backdrop:bg-black/50"
				onCancel={(e) => {
					e.preventDefault();
					setCancelOpen(false);
				}}
				ref={cancelDialogRef}
			>
				<div className="flex min-h-[min(100vh,100dvh)] w-full items-center justify-center">
					<div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
						<h2 className="text-base font-semibold" id={cancelTitleId}>
							Cancel draft expense?
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							This marks the expense as cancelled. Line items and thread history
							are kept.
						</p>
						<div className="mt-6 flex justify-end gap-2">
							<button
								className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
								onClick={() => setCancelOpen(false)}
								type="button"
							>
								Keep draft
							</button>
							<button
								className="rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
								disabled={destructiveBusy}
								onClick={() => void handleCancelDraft()}
								type="button"
							>
								{destructiveBusy ? "Cancelling…" : "Cancel draft"}
							</button>
						</div>
					</div>
				</div>
			</dialog>
			<dialog
				aria-labelledby={deleteTitleId}
				className="fixed inset-0 z-[60] max-h-none w-full max-w-none border-0 bg-transparent p-4 backdrop:bg-black/50"
				onCancel={(e) => {
					e.preventDefault();
					setDeleteOpen(false);
				}}
				ref={deleteDialogRef}
			>
				<div className="flex min-h-[min(100vh,100dvh)] w-full items-center justify-center">
					<div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
						<h2 className="text-base font-semibold" id={deleteTitleId}>
							Delete expense?
						</h2>
						<p className="mt-2 text-sm text-muted-foreground">
							This permanently deletes the expense, all line items, and related
							thread data.
						</p>
						<div className="mt-6 flex justify-end gap-2">
							<button
								className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
								onClick={() => setDeleteOpen(false)}
								type="button"
							>
								Keep expense
							</button>
							<button
								className="rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
								disabled={destructiveBusy}
								onClick={() => void handleDeleteExpense()}
								type="button"
							>
								{destructiveBusy ? "Deleting…" : "Delete expense"}
							</button>
						</div>
					</div>
				</div>
			</dialog>
		</div>
	);
};
