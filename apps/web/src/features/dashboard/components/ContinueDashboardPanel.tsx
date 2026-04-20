import type { ChatMessage, DashboardContinue } from "@cofi/api";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { apiClient } from "../../../shared/lib/apiClient";
import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";

/** Fetch enough history to reliably resolve the last three lines. */
const FETCH_LIMIT = 36;
const DISPLAY_COUNT = 3;
const MAIN_TEXT_MAX = 420;
const THREAD_TEXT_MAX = 240;

const asChronological = (desc: ChatMessage[]): ChatMessage[] =>
	[...desc].reverse();

const clampPreviewText = (raw: string, maxChars: number): string => {
	const t = raw.replace(/\s+/g, " ").trim();
	if (t.length <= maxChars) return t;
	return `${t.slice(0, maxChars - 1)}…`;
};

const toShortDateTime = (iso?: string): string => {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	try {
		return new Intl.DateTimeFormat(undefined, {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		}).format(d);
	} catch {
		return "";
	}
};

const actionHintForStatus = (status?: string): string => {
	const s = (status ?? "").toLowerCase();
	if (s === "draft") return "Needs review";
	if (s === "approved" || s === "confirmed") return "Already approved";
	if (s === "cancelled" || s === "canceled") return "Marked cancelled";
	return "Needs discussion";
};

const threadCtaForStatus = (status?: string): string => {
	const s = (status ?? "").toLowerCase();
	if (s === "draft") return "Review";
	return "Discuss";
};

const formatAmountCompact = (value: number): string => {
	if (!Number.isFinite(value) || value <= 0) return "";
	return `$${value.toFixed(2)}`;
};

const resolveCreatorDisplay = (
	creatorId: number,
	currentUserId: number | null,
	memberNameById: Map<number, string>,
): string => {
	if (creatorId <= 0) return "";
	if (currentUserId != null && creatorId === currentUserId) return "You";
	const fromMembers = memberNameById.get(creatorId);
	if (fromMembers?.trim()) return fromMembers.trim();
	return `User ${creatorId}`;
};

type ExpenseMetaPreview = {
	title: string;
	totalText: string;
	itemCount: number;
	creatorName: string;
};

const statusPresentation = (status: string | undefined) => {
	const s = (status ?? "").toLowerCase();
	if (s === "draft") {
		return {
			label: "Draft",
			className:
				"border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
		};
	}
	if (s === "approved" || s === "confirmed") {
		return {
			label: s === "approved" ? "Approved" : "Confirmed",
			className:
				"border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
		};
	}
	if (s === "cancelled" || s === "canceled") {
		return {
			label: "Cancelled",
			className:
				"border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))] text-[hsl(var(--text-secondary))]",
		};
	}
	if (s === "gone" || s === "inaccessible") {
		return {
			label: s === "gone" ? "Removed" : "Restricted",
			className:
				"border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))]/80 text-[hsl(var(--text-secondary))]",
		};
	}
	return {
		label: status?.trim() ? status : "Expense",
		className:
			"border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))]/60 text-[hsl(var(--text-primary))]",
	};
};

const pickLatestExpenseContext = (
	chrono: ChatMessage[],
): {
	expenseId: number;
	status: string;
} | null => {
	for (let i = chrono.length - 1; i >= 0; i--) {
		const m = chrono[i];
		const eid = m.related_expense_id;
		if (eid == null || eid === "") continue;
		const num = Number(eid);
		if (!Number.isFinite(num) || num <= 0) continue;
		const st = (m.related_expense_status ?? "").toLowerCase();
		if (st === "gone" || st === "inaccessible") continue;
		return { expenseId: num, status: m.related_expense_status ?? "" };
	}
	return null;
};

const IconChat = ({ className = "h-4 w-4" }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeWidth={1.75}
		viewBox="0 0 24 24"
	>
		<title>Chat</title>
		<path
			d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconThread = ({ className = "h-4 w-4" }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeWidth={1.75}
		viewBox="0 0 24 24"
	>
		<title>Thread</title>
		<path
			d="M8 8h12M8 12h8M8 16h5M4 6a2 2 0 012-2h12l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconDrafts = ({ className = "h-4 w-4" }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeWidth={1.75}
		viewBox="0 0 24 24"
	>
		<title>Drafts</title>
		<path
			d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path d="M14 2v6h6M8 13h8M8 17h6" strokeLinecap="round" />
	</svg>
);

export type ContinueDashboardPanelProps = {
	cont: DashboardContinue;
	/** Spaces in the current workspace (Continue defaults first); used to flip previews. */
	navigableSpaces: { id: number; name: string }[];
	/** Optional external selected space (shared context with quick capture). */
	selectedSpaceId?: number | null;
	/** Show inline arrows/dots; disable when a shared picker is rendered above. */
	showInlineSpaceNav?: boolean;
	/** Show footer drafts button in this widget. */
	showDraftsButton?: boolean;
	/** Light paper style for chat preview inside a dark dashboard hero. */
	visualVariant?: "default" | "heroLightChat";
	/** Show Open chat / Drafts row (hide when hero provides capture buttons). */
	showFooterActions?: boolean;
	chatNavState: (extra: Record<string, unknown>) => Record<string, unknown>;
	chatWorkspace: ChatWorkspaceScope | null;
};

export const ContinueDashboardPanel = ({
	cont,
	navigableSpaces,
	selectedSpaceId = null,
	showInlineSpaceNav = true,
	showDraftsButton = true,
	visualVariant = "default",
	showFooterActions = true,
	chatNavState,
	chatWorkspace,
}: ContinueDashboardPanelProps) => {
	const lightChat = visualVariant === "heroLightChat";
	const { user: authUser } = useAuth();
	const currentUserId = authUser?.id ?? null;

	const spaces = useMemo(() => {
		if (navigableSpaces.length > 0) return navigableSpaces;
		return [{ id: cont.space_id, name: cont.space_name }];
	}, [cont.space_id, cont.space_name, navigableSpaces]);

	const spaceIdsFingerprint = useMemo(
		() => spaces.map((s) => s.id).join(","),
		[spaces],
	);

	const [spaceIndex, setSpaceIndex] = useState(0);
	const previewRegionRef = useRef<HTMLDivElement>(null);
	const spacesRef = useRef(spaces);
	spacesRef.current = spaces;
	const previewRequestRef = useRef(0);

	useLayoutEffect(() => {
		const list = spacesRef.current;
		const idx = list.findIndex((s) => s.id === cont.space_id);
		const nextIdx = idx >= 0 ? idx : 0;
		const max = Math.max(0, list.length - 1);
		setSpaceIndex(Math.min(nextIdx, max));
	}, [cont.space_id, spaceIdsFingerprint]);

	useLayoutEffect(() => {
		setSpaceIndex((i) =>
			Math.min(i, Math.max(0, spacesRef.current.length - 1)),
		);
	}, [spaceIdsFingerprint, navigableSpaces.length]);

	const safeIndex = Math.min(spaceIndex, Math.max(0, spaces.length - 1));
	const externallySelected =
		selectedSpaceId != null
			? (spaces.find((s) => s.id === selectedSpaceId) ?? null)
			: null;
	const activeSpace = externallySelected ??
		spaces[safeIndex] ?? {
			id: cont.space_id,
			name: cont.space_name,
		};
	const activeSpaceId = activeSpace.id;
	const canNavigateSpaces =
		showInlineSpaceNav && selectedSpaceId == null && spaces.length > 1;
	const [chronoPreview, setChronoPreview] = useState<ChatMessage[] | null>(
		null,
	);
	const previewScrollRef = useRef<HTMLElement | null>(null);
	const [cardsEntered, setCardsEntered] = useState(false);
	const [expenseMetaByMainMessageId, setExpenseMetaByMainMessageId] = useState<
		Record<string, ExpenseMetaPreview>
	>({});
	const [threadHintByMainMessageId, setThreadHintByMainMessageId] = useState<
		Record<string, string>
	>({});
	const [previewLoad, setPreviewLoad] = useState<
		"idle" | "loading" | "error" | "ready"
	>("idle");

	const loadPreview = useCallback(
		async (spaceId: number) => {
			const ticket = ++previewRequestRef.current;
			setPreviewLoad("loading");
			setCardsEntered(false);
			setExpenseMetaByMainMessageId({});
			setThreadHintByMainMessageId({});
			try {
				const desc = await apiClient.chatlog.listMessages(spaceId, {
					limit: FETCH_LIMIT,
				});
				if (previewRequestRef.current !== ticket) return;
				const chrono = asChronological(desc);
				const tail = chrono.slice(-DISPLAY_COUNT);
				setChronoPreview(tail);
				setPreviewLoad("ready");

				const expenseRows = tail.filter((m) => {
					const eid = m.related_expense_id;
					if (eid == null || eid === "") return false;
					const n = Number(eid);
					if (!Number.isFinite(n) || n <= 0) return false;
					const st = (m.related_expense_status ?? "").toLowerCase();
					return st !== "gone" && st !== "inaccessible";
				});

				if (expenseRows.length > 0) {
					let memberNameById = new Map<number, string>();
					try {
						const membersRes = await apiClient.spaces.listMembers(spaceId);
						memberNameById = new Map(
							membersRes.members
								.filter((m) => Number.isFinite(Number(m.user_id)))
								.map((m) => {
									const id = Number(m.user_id);
									const name =
										(m.name ?? "").trim() ||
										(m.email ?? "").trim() ||
										`User ${id}`;
									return [id, name] as const;
								}),
						);
					} catch {
						// Keep preview resilient if members cannot be resolved.
					}

					const expenseEntries = await Promise.all(
						expenseRows.map(async (m) => {
							const expenseId = Number(m.related_expense_id);
							try {
								const detail = await apiClient.finances.expenses.get(expenseId);
								const items = detail.items ?? [];
								const total = items.reduce(
									(acc, it) => acc + Number(it.amount || 0),
									0,
								);
								const title =
									(detail.description ?? "").trim() ||
									(items[0]?.name ?? "").trim() ||
									`Expense #${expenseId}`;
								const msgUserId = Number(m.user_id ?? 0);
								const creatorId = Number(detail.user_id ?? 0) || msgUserId;
								const creatorName = resolveCreatorDisplay(
									creatorId,
									currentUserId,
									memberNameById,
								);
								const meta: ExpenseMetaPreview = {
									title,
									totalText: formatAmountCompact(total),
									itemCount: items.length,
									creatorName,
								};
								return [String(m.id), meta] as const;
							} catch {
								return [String(m.id), null] as const;
							}
						}),
					);
					if (previewRequestRef.current !== ticket) return;
					const expenseNext: Record<string, ExpenseMetaPreview> = {};
					for (const [id, meta] of expenseEntries) {
						if (meta) expenseNext[id] = meta;
					}
					setExpenseMetaByMainMessageId(expenseNext);
				}

				const draftRows = tail.filter((m) => {
					if ((m.related_expense_status ?? "").toLowerCase() !== "draft") {
						return false;
					}
					const eid = m.related_expense_id;
					if (eid == null || eid === "") return false;
					const n = Number(eid);
					return Number.isFinite(n) && n > 0;
				});

				if (draftRows.length === 0) {
					return;
				}

				const entries = await Promise.all(
					draftRows.map(async (m) => {
						const expenseId = Number(m.related_expense_id);
						try {
							const { thread } = await apiClient.threads.getOrCreate(
								spaceId,
								expenseId,
							);
							const { messages: tm } = await apiClient.threads.listMessages(
								thread.id,
								{ limit: 12 },
							);
							if (!tm.length) {
								return [String(m.id), ""] as const;
							}
							const latest = tm[tm.length - 1];
							const text = clampPreviewText(
								(latest.body ?? "").trim() || "—",
								THREAD_TEXT_MAX,
							);
							return [String(m.id), text] as const;
						} catch {
							return [String(m.id), ""] as const;
						}
					}),
				);

				if (previewRequestRef.current !== ticket) return;
				const next: Record<string, string> = {};
				for (const [id, text] of entries) {
					if (text) next[id] = text;
				}
				setThreadHintByMainMessageId(next);
			} catch {
				if (previewRequestRef.current !== ticket) return;
				setChronoPreview(null);
				setPreviewLoad("error");
			}
		},
		[currentUserId],
	);

	useEffect(() => {
		void loadPreview(activeSpaceId);
	}, [activeSpaceId, loadPreview]);

	useEffect(() => {
		if (previewLoad !== "ready" || !chronoPreview?.length) return;
		const el = previewScrollRef.current;
		if (!el) return;
		const raf = requestAnimationFrame(() => {
			el.scrollTo({
				top: el.scrollHeight,
				behavior: "smooth",
			});
			// Trigger a soft card entrance once content is mounted.
			setCardsEntered(true);
		});
		return () => cancelAnimationFrame(raf);
	}, [previewLoad, chronoPreview, activeSpaceId]);

	const expenseCtx = useMemo(
		() =>
			chronoPreview?.length ? pickLatestExpenseContext(chronoPreview) : null,
		[chronoPreview],
	);

	const threadLinkState = useMemo(
		() =>
			chatWorkspace != null
				? { chatWorkspace }
				: chatNavState({ selectSpaceId: activeSpaceId }),
		[activeSpaceId, chatWorkspace, chatNavState],
	);

	const buildExpenseThreadHref = useCallback(
		(expenseId: number) =>
			`/console/chat/thread?spaceId=${encodeURIComponent(String(activeSpaceId))}&expenseId=${encodeURIComponent(String(expenseId))}`,
		[activeSpaceId],
	);

	const handlePreviousSpace = useCallback(() => {
		if (!canNavigateSpaces) return;
		setSpaceIndex((i) => {
			const len = spacesRef.current.length;
			if (len <= 1) return i;
			return (i - 1 + len) % len;
		});
	}, [canNavigateSpaces]);

	const handleNextSpace = useCallback(() => {
		if (!canNavigateSpaces) return;
		setSpaceIndex((i) => {
			const len = spacesRef.current.length;
			if (len <= 1) return i;
			return (i + 1) % len;
		});
	}, [canNavigateSpaces]);

	const handlePreviewRegionKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			if (!canNavigateSpaces) return;
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				handlePreviousSpace();
			}
			if (e.key === "ArrowRight") {
				e.preventDefault();
				handleNextSpace();
			}
		},
		[canNavigateSpaces, handleNextSpace, handlePreviousSpace],
	);

	return (
		<div
			aria-label={
				canNavigateSpaces
					? `Pick up in chat: ${activeSpace.name}. Use arrow keys to change space.`
					: `Pick up in chat: ${activeSpace.name}`
			}
			className={[
				"flex min-h-0 flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 [&:focus-visible]:rounded-lg",
				lightChat
					? "focus-visible:ring-amber-400/40 focus-visible:ring-offset-zinc-950"
					: "focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-[hsl(var(--bg))]",
			].join(" ")}
			onKeyDown={handlePreviewRegionKeyDown}
			ref={previewRegionRef}
			role="region"
			tabIndex={canNavigateSpaces ? 0 : undefined}
		>
			{previewLoad === "loading" ? (
				<p
					className={
						lightChat
							? "text-xs text-zinc-500"
							: "text-xs text-[hsl(var(--text-secondary))]"
					}
				>
					Loading recent messages…
				</p>
			) : null}

			{previewLoad === "error" ? (
				<p className="text-xs text-[hsl(var(--danger))]">
					Could not load message preview. You can still open chat from the links
					below.
				</p>
			) : null}

			{previewLoad === "ready" && chronoPreview && chronoPreview.length > 0 ? (
				<div className="min-w-0 space-y-2">
					{lightChat ? (
						<p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
							Recent chat
						</p>
					) : null}
					<section
						aria-label="Recent chat preview"
						className={[
							"scrollbar-chat-compact max-h-[18rem] space-y-2.5 overflow-y-auto pr-1",
							lightChat
								? "rounded-xl border border-zinc-200/90 bg-zinc-50 p-3 shadow-inner ring-1 ring-black/5"
								: "",
						].join(" ")}
						ref={(el) => {
							previewScrollRef.current = el;
						}}
					>
						{chronoPreview.map((m, idx) => {
							const isUser = m.sender_type === "user";
							const badge =
								m.related_expense_id != null && m.related_expense_id !== ""
									? statusPresentation(m.related_expense_status)
									: null;
							const threadHint = threadHintByMainMessageId[String(m.id)];
							const expenseIdRaw = m.related_expense_id;
							const expenseNum =
								expenseIdRaw != null && expenseIdRaw !== ""
									? Number(expenseIdRaw)
									: Number.NaN;
							const expenseSt = (m.related_expense_status ?? "").toLowerCase();
							const expenseThreadBlocked =
								expenseSt === "gone" || expenseSt === "inaccessible";
							const messageThreadHref =
								Number.isFinite(expenseNum) &&
								expenseNum > 0 &&
								!expenseThreadBlocked
									? buildExpenseThreadHref(expenseNum)
									: null;
							const expenseMeta = expenseMetaByMainMessageId[String(m.id)];
							const topLabel =
								badge && expenseMeta?.title
									? expenseMeta.title
									: isUser
										? "You"
										: "Ceits";
							const messageWhen = toShortDateTime(m.created_at);
							const resolvedBody = badge
								? [
										expenseMeta?.totalText || "",
										expenseMeta?.itemCount
											? `${expenseMeta.itemCount} item${expenseMeta.itemCount === 1 ? "" : "s"}`
											: "",
										expenseMeta?.creatorName
											? `by ${expenseMeta.creatorName}`
											: "",
									]
										.filter(Boolean)
										.join(" · ") ||
									clampPreviewText(m.text || "—", MAIN_TEXT_MAX)
								: clampPreviewText(m.text || "—", MAIN_TEXT_MAX);
							return (
								<div
									className={[
										"flex transition-all duration-300 ease-out",
										cardsEntered
											? "translate-y-0 opacity-100"
											: "translate-y-1 opacity-0",
										isUser ? "justify-end" : "justify-start",
									].join(" ")}
									key={String(m.id)}
									style={{ transitionDelay: `${idx * 45}ms` }}
								>
									<div
										className={[
											"max-w-[94%] rounded-2xl border px-3 py-2.5 text-xs shadow-sm",
											lightChat
												? isUser
													? "border-emerald-300/80 bg-emerald-50 text-zinc-900"
													: "border-zinc-200 bg-white text-zinc-900 shadow-sm"
												: isUser
													? "border-[hsl(var(--accent))]/35 bg-[hsl(var(--accent))]/12 text-[hsl(var(--text-primary))]"
													: "border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))]/90 text-[hsl(var(--text-primary))]",
										].join(" ")}
									>
										<div className="mb-1.5 flex flex-wrap items-center gap-1.5">
											<span
												className={[
													"text-[10px] font-semibold",
													lightChat
														? "text-zinc-600"
														: "text-[hsl(var(--text-secondary))]",
													badge ? "tracking-normal" : "uppercase tracking-wide",
												].join(" ")}
											>
												{topLabel}
											</span>
											{badge ? (
												<span
													className={[
														"rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
														badge.className,
													].join(" ")}
												>
													{badge.label}
												</span>
											) : null}
										</div>
										<p
											className={[
												"line-clamp-6 whitespace-pre-wrap break-words leading-relaxed",
												lightChat
													? "text-zinc-900"
													: "text-[hsl(var(--text-primary))]",
											].join(" ")}
										>
											{resolvedBody}
										</p>
										{badge ? (
											<div className="mt-2 flex flex-wrap items-center gap-1.5">
												<span className="rounded-md bg-[hsl(var(--surface-muted))]/70 px-1.5 py-0.5 text-[9px] font-medium text-[hsl(var(--text-secondary))]">
													{actionHintForStatus(m.related_expense_status)}
												</span>
												{Number.isFinite(expenseNum) && expenseNum > 0 ? (
													<span className="rounded-md bg-[hsl(var(--surface-muted))]/70 px-1.5 py-0.5 text-[9px] font-medium text-[hsl(var(--text-secondary))]">
														#{expenseNum}
													</span>
												) : null}
												{expenseMeta?.creatorName ? (
													<span className="rounded-md bg-[hsl(var(--surface-muted))]/70 px-1.5 py-0.5 text-[9px] font-medium text-[hsl(var(--text-secondary))]">
														{expenseMeta.creatorName === "You"
															? "You"
															: `By ${expenseMeta.creatorName}`}
													</span>
												) : null}
												{messageWhen ? (
													<span className="rounded-md bg-[hsl(var(--surface-muted))]/70 px-1.5 py-0.5 text-[9px] font-medium text-[hsl(var(--text-secondary))]">
														{messageWhen}
													</span>
												) : null}
											</div>
										) : null}
										{threadHint ? (
											<div className="mt-2.5 border-t border-dashed border-[hsl(var(--border-subtle))]/70 pt-2">
												<p className="text-[9px] font-semibold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
													Latest in expense thread
												</p>
												<p className="mt-1 line-clamp-4 text-[11px] leading-snug text-[hsl(var(--text-secondary))]">
													{threadHint}
												</p>
											</div>
										) : null}
										{messageThreadHref ? (
											<div
												className={[
													"mt-2.5 flex",
													isUser ? "justify-end" : "justify-start",
												].join(" ")}
											>
												<Link
													aria-label={`Open expense thread for expense ${expenseNum}`}
													className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))]/40 px-2 py-1 text-[10px] font-medium text-[hsl(var(--text-primary))] transition hover:bg-[hsl(var(--surface-muted))]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
													state={threadLinkState}
													to={messageThreadHref}
												>
													<IconThread className="h-3.5 w-3.5 text-[hsl(var(--text-secondary))]" />
													{threadCtaForStatus(m.related_expense_status)}
												</Link>
											</div>
										) : null}
									</div>
								</div>
							);
						})}
					</section>
				</div>
			) : null}

			{previewLoad === "ready" &&
			(!chronoPreview || chronoPreview.length === 0) ? (
				<p
					className={[
						"rounded-lg border border-dashed px-3 py-4 text-center text-xs",
						lightChat
							? "border-zinc-300 bg-zinc-100/80 text-zinc-600"
							: "border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))]/30 text-[hsl(var(--text-secondary))]",
					].join(" ")}
				>
					No messages in this space yet. Open chat to start the thread.
				</p>
			) : null}

			{expenseCtx && expenseCtx.status.toLowerCase() !== "draft" ? (
				<Link
					aria-label={`Open expense thread for #${expenseCtx.expenseId}`}
					className={[
						"group flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
						lightChat
							? "border-white/12 bg-white/[0.07] text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-amber-400/35 hover:bg-white/[0.11] focus-visible:ring-amber-400/45 focus-visible:ring-offset-zinc-950"
							: "border-[hsl(var(--border-subtle))]/80 bg-[hsl(var(--surface-muted))]/30 hover:bg-[hsl(var(--surface-muted))]/50 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-[hsl(var(--bg))]",
					].join(" ")}
					state={threadLinkState}
					to={buildExpenseThreadHref(expenseCtx.expenseId)}
				>
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<span
							className={[
								"text-[10px] font-semibold uppercase tracking-wide",
								lightChat
									? "text-zinc-400"
									: "text-[hsl(var(--text-secondary))]",
							].join(" ")}
						>
							Latest linked expense
						</span>
						<span
							className={[
								"rounded-full border px-2 py-0.5 text-[10px] font-semibold",
								statusPresentation(expenseCtx.status).className,
							].join(" ")}
						>
							{statusPresentation(expenseCtx.status).label}
						</span>
						<span
							className={[
								"text-[11px] tabular-nums",
								lightChat
									? "text-zinc-300"
									: "text-[hsl(var(--text-secondary))]",
							].join(" ")}
						>
							#{expenseCtx.expenseId}
						</span>
					</div>
					<span
						className={[
							"inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold",
							lightChat
								? "text-amber-300/90 group-hover:text-amber-200"
								: "text-[hsl(var(--accent))] group-hover:underline",
						].join(" ")}
					>
						<IconThread className="h-3.5 w-3.5 opacity-90" />
						Thread
					</span>
				</Link>
			) : null}

			{showFooterActions ? (
				<div className="flex flex-wrap gap-2 border-t border-[hsl(var(--border-subtle))]/70 pt-3">
					<Link
						aria-label={`Open chat for ${activeSpace.name}`}
						className="inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-[hsl(var(--accent))] px-3 py-2 text-xs font-medium text-[hsl(var(--accent-contrast))] shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
						state={chatNavState({ selectSpaceId: activeSpaceId })}
						to="/console/chat"
					>
						<IconChat className="h-4 w-4 opacity-90" />
						Open chat
					</Link>

					{showDraftsButton ? (
						<Link
							aria-label="Open drafts"
							className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] px-3 py-2 text-xs font-medium text-[hsl(var(--text-primary))] shadow-sm transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							to="/console/drafts"
						>
							<IconDrafts className="h-4 w-4 text-[hsl(var(--text-secondary))]" />
							Drafts
						</Link>
					) : null}
				</div>
			) : null}
		</div>
	);
};
