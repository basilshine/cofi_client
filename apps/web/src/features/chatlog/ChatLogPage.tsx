import type {
	ChatMessage,
	Space,
	SpaceMember,
	SpaceRole,
	Transaction,
	WsEnvelope,
} from "@cofi/api";
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSetChatBreadcrumb } from "../../app/layout/ChatBreadcrumbContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient, readActiveOrgTenantId } from "../../shared/lib/apiClient";
import {
	type ChatWorkspaceScope,
	isChatWorkspaceScope,
	readChatWorkspaceScope,
	writeChatWorkspaceScope,
} from "../../shared/lib/chatWorkspaceScope";
import { httpClient } from "../../shared/lib/httpClient";
import {
	sortSpacesByLastActivity,
	touchRecentSpaceId,
} from "../../shared/lib/recentSpaceIds";
import { wsClient } from "../../shared/lib/wsClient";
import { ChatSpacesSidebar } from "./components/ChatSpacesSidebar";
import { SendMessageIcon } from "./components/ComposerIcons";
import {
	isDraftExpenseSystemMessage,
	isRecurringExpenseChatMessage,
} from "./components/DraftExpenseBoilerplateCaption";
import { DraftExpenseCard } from "./components/DraftExpenseCard";
import { ExpenseMessageCard } from "./components/ExpenseMessageCard";
import { ExpenseThreadInlinePanel } from "./components/ExpenseThreadInlinePanel";
import { ExpenseWorkspaceManualPanel } from "./components/ExpenseWorkspaceManualPanel";
import { ParseExpenseComposer } from "./components/ParseExpenseComposer";
import { SpaceTransactionDetailDialog } from "./components/SpaceTransactionDetailDialog";
import { SpaceTransactionTagFilter } from "./components/SpaceTransactionTagFilter";
import type { BuilderItem } from "./components/transactionBuilderTypes";
import {
	newBuilderItem,
	parseTags,
	toNumber,
} from "./components/transactionBuilderTypes";
import { useExpenseThreadState } from "./hooks/useExpenseThreadState";
import { PARSE_DUMMY_TEST_SNIPPETS } from "./parseDummySnippets";

const DEFAULT_LIMIT = 50;

/** Floating chat navigation — same pill look on root and drilled layers. */
const navPillBase =
	"inline-flex min-h-9 shrink-0 items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4";

const navPillActive = "bg-card text-foreground shadow-sm ring-1 ring-border";

const navPillInactive =
	"text-muted-foreground hover:bg-accent/70 hover:text-foreground";

const asChronological = (descMessages: ChatMessage[]) =>
	[...descMessages].reverse();

/** Persisted last-seen main chat message id per space (client-only). */
const LAST_READ_MAIN_PREFIX = "cofi.chat.lastReadMainMsgId.";

const messageIdCompare = (a: string, b: string): number => {
	const na = Number(a);
	const nb = Number(b);
	if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
	return String(a).localeCompare(String(b));
};

const maxMessageIdInList = (list: ChatMessage[]): string | null => {
	if (!list.length) return null;
	let best = String(list[0].id);
	for (let i = 1; i < list.length; i++) {
		const s = String(list[i].id);
		if (messageIdCompare(best, s) < 0) best = s;
	}
	return best;
};

const readLastReadMain = (spaceId: string | number): string | null => {
	try {
		return localStorage.getItem(LAST_READ_MAIN_PREFIX + String(spaceId));
	} catch {
		return null;
	}
};

const writeLastReadMain = (
	spaceId: string | number,
	messageId: string | number,
) => {
	try {
		localStorage.setItem(
			LAST_READ_MAIN_PREFIX + String(spaceId),
			String(messageId),
		);
	} catch {
		/* ignore */
	}
};

const isMainChatUnread = (
	lastRead: string | null,
	latestId: string | undefined,
): boolean => {
	if (!latestId) return false;
	if (!lastRead) return true;
	return messageIdCompare(lastRead, latestId) < 0;
};

const userMessageAccent = (userId?: number) => {
	if (userId == null) {
		return {
			borderLeftColor: "hsl(220 45% 52%)",
			surface: "hsl(220 20% 96% / 0.5)",
		};
	}
	const hue = (Number(userId) * 47) % 360;
	return {
		borderLeftColor: `hsl(${hue} 48% 45%)`,
		surface: `hsl(${hue} 35% 96% / 0.65)`,
	};
};

type MainTab = "chat" | "transactions";
/** Chat footer: plain messages vs parse / photo / voice (same thread). */
type ComposerMode = "message" | "capture";
/** Inside Transactions: manual entry vs linked transaction list. */
type LedgerTab = "manual" | "browse";
type TransactionFilter = "all" | "mine" | "others";

type SelectSpaceOptions = {
	openThreadExpenseId?: string | number;
	/** Focus manual draft line N (1-based) after opening the inline thread. */
	openThreadDraftLine?: number;
	quickCapture?: "photo" | "voice";
	focusCaptureComposer?: boolean;
	focusMessageComposer?: boolean;
};

type ChatLogLocationState = {
	chatWorkspace?: ChatWorkspaceScope;
	openThreadExpenseId?: string | number;
	openThreadSpaceId?: string | number;
	openThreadDraftLine?: number;
	selectSpaceId?: string | number;
	quickCapture?: "photo" | "voice";
	focusCaptureComposer?: boolean;
	focusMessageComposer?: boolean;
};

export const ChatLogPage = () => {
	const { formatMoney, formatDateTime } = useUserFormat();
	const setChatBreadcrumb = useSetChatBreadcrumb();
	const [chatSidebarExpanded, setChatSidebarExpanded] = useState(() => {
		try {
			return localStorage.getItem("ceits.chat.sidebarExpanded") !== "0";
		} catch {
			return true;
		}
	});

	useEffect(() => {
		try {
			localStorage.setItem(
				"ceits.chat.sidebarExpanded",
				chatSidebarExpanded ? "1" : "0",
			);
		} catch {
			/* ignore */
		}
	}, [chatSidebarExpanded]);
	const transactionDetailTitleId = useId();
	const [wsStatus, setWsStatus] = useState<"disconnected" | "connected">(
		"disconnected",
	);
	const [spaces, setSpaces] = useState<Space[] | null>(null);
	const [selectedSpaceId, setSelectedSpaceId] = useState<
		string | number | null
	>(null);
	const [members, setMembers] = useState<SpaceMember[] | null>(null);
	const [canManageMemberRoles, setCanManageMemberRoles] = useState(false);
	const [memberRoleError, setMemberRoleError] = useState<string | null>(null);
	const [memberRoleSaving, setMemberRoleSaving] = useState(false);
	const [memberRemoveSaving, setMemberRemoveSaving] = useState(false);

	const [messages, setMessages] = useState<ChatMessage[] | null>(null); // chronological (asc)
	const [oldestMessageId, setOldestMessageId] = useState<
		string | number | null
	>(null);
	const [hasMore, setHasMore] = useState(true);

	const [newSpaceName, setNewSpaceName] = useState("");
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteToken, setInviteToken] = useState<string | null>(null);
	const [inviteSuggestionsNonce, setInviteSuggestionsNonce] = useState(0);
	const [incomingInvitesRefreshKey, setIncomingInvitesRefreshKey] = useState(0);
	const [tenantInviteEmail, setTenantInviteEmail] = useState("");
	const [tenantInviteToken, setTenantInviteToken] = useState<string | null>(
		null,
	);
	const [acceptInviteToken, setAcceptInviteToken] = useState("");

	const [chatInput, setChatInput] = useState("");
	const [parseInput, setParseInput] = useState("");
	const [mainTab, setMainTab] = useState<MainTab>("chat");
	const [composerMode, setComposerMode] = useState<ComposerMode>("message");
	const [ledgerTab, setLedgerTab] = useState<LedgerTab>("manual");
	const [transactionFilter, setTransactionFilter] =
		useState<TransactionFilter>("all");
	/** Lowercase tag keys; empty = no tag filter. */
	const [selectedTransactionTags, setSelectedTransactionTags] = useState<
		string[]
	>([]);
	/** Distinct tag names for this space (`null` until loaded). */
	const [spaceTagCatalog, setSpaceTagCatalog] = useState<string[] | null>(null);
	const [activeDraftExpenseId, setActiveDraftExpenseId] = useState<
		string | number | null
	>(null);
	/** System draft message id after saving from manual workspace (for recurring origin). */
	const [draftOriginMessageId, setDraftOriginMessageId] = useState<
		string | number | null
	>(null);
	const [manualDescription, setManualDescription] = useState("");
	const [manualItems, setManualItems] = useState<BuilderItem[]>([
		newBuilderItem(),
	]);
	const [isRecording, setIsRecording] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	/** Latest main-chat message id per space (from loads + WS). */
	const [latestMainMessageIdBySpace, setLatestMainMessageIdBySpace] = useState<
		Record<string, string>
	>({});
	/** Bumps after writes to `readLastReadMain` so we re-render from storage. */
	const [lastReadBump, setLastReadBump] = useState(0);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const allSpaceUnsubsRef = useRef<(() => void)[]>([]);
	const spacesRef = useRef(spaces);
	const selectedSpaceIdRef = useRef(selectedSpaceId);
	const mainTabRef = useRef(mainTab);
	const [spaceTransactions, setSpaceTransactions] = useState<
		Transaction[] | null
	>(null);
	const [isTransactionDetailOpen, setIsTransactionDetailOpen] = useState(false);
	const [selectedDetailTransaction, setSelectedDetailTransaction] =
		useState<Transaction | null>(null);
	const [spaceTransactionOpenInEdit, setSpaceTransactionOpenInEdit] =
		useState(false);
	const [stickToLatest, setStickToLatest] = useState(true);
	const [showJumpToLatest, setShowJumpToLatest] = useState(false);
	const [currentUserId, setCurrentUserId] = useState<number | null>(null);
	const [hardPurgeFeedback, setHardPurgeFeedback] = useState<string | null>(
		null,
	);
	/** When set, the main chat card shows the expense review thread inline (same composer below for discussion only). */
	const [inlineThreadExpenseId, setInlineThreadExpenseId] = useState<
		string | number | null
	>(null);
	/** One-shot scroll to a draft line after deep link (`?line=`). Cleared when consumed or thread closes. */
	const [threadDraftLineScroll, setThreadDraftLineScroll] = useState<
		number | null
	>(null);
	const [editingMessageId, setEditingMessageId] = useState<
		string | number | null
	>(null);
	const [editingMessageText, setEditingMessageText] = useState("");
	const inlineThreadExpenseIdRef = useRef(inlineThreadExpenseId);
	const currentUserIdRef = useRef(currentUserId);
	const quickCapturePhotoInputRef = useRef<HTMLInputElement>(null);
	const quickCaptureIntentRef = useRef<"photo" | "voice" | null>(null);
	const handleToggleRecordingRef = useRef<() => Promise<void>>(async () => {});
	const parseTextareaRef = useRef<HTMLTextAreaElement>(null);
	const chatMessageTextareaRef = useRef<HTMLTextAreaElement>(null);

	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();
	/** Dedupe processing the same `?invite=` token from the URL in one session. */
	const lastUrlInviteTokenProcessedRef = useRef<string | null>(null);
	/** When true, auto-run accept invite once workspace + WS are ready (from invite link). */
	const autoAcceptInviteFromUrlRef = useRef(false);
	const [workspaceScope, setWorkspaceScope] =
		useState<ChatWorkspaceScope | null>(null);
	const [scopeResolutionDone, setScopeResolutionDone] = useState(false);
	const [asyncBootstrap, setAsyncBootstrap] = useState<
		null | { type: "org"; tenantId: number } | { type: "personal" }
	>(null);
	const workspaceScopeRef = useRef<ChatWorkspaceScope | null>(null);
	const prevWorkspaceTenantRef = useRef<number | null>(null);

	const expenseThreadCtrl = useExpenseThreadState(
		selectedSpaceId,
		inlineThreadExpenseId,
	);

	useEffect(() => {
		workspaceScopeRef.current = workspaceScope;
	}, [workspaceScope]);

	useLayoutEffect(() => {
		const raw = searchParams.get("invite");
		const t = raw?.trim();
		if (!t) return;
		if (lastUrlInviteTokenProcessedRef.current === t) return;
		lastUrlInviteTokenProcessedRef.current = t;
		setAcceptInviteToken(t);
		autoAcceptInviteFromUrlRef.current = true;
		const next = new URLSearchParams(searchParams);
		next.delete("invite");
		setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams]);

	useLayoutEffect(() => {
		const st = location.state as ChatLogLocationState | null;
		const fromNav = st?.chatWorkspace;
		if (fromNav != null && isChatWorkspaceScope(fromNav)) {
			writeChatWorkspaceScope(fromNav);
			workspaceScopeRef.current = fromNav;
			setWorkspaceScope(fromNav);
			setScopeResolutionDone(true);
			setAsyncBootstrap(null);
			return;
		}

		const activeOrg = readActiveOrgTenantId();
		const fromSession = readChatWorkspaceScope();

		if (activeOrg != null) {
			if (
				fromSession?.kind === "organization" &&
				fromSession.tenantId === activeOrg
			) {
				workspaceScopeRef.current = fromSession;
				setWorkspaceScope(fromSession);
				setScopeResolutionDone(true);
				setAsyncBootstrap(null);
				return;
			}
			setAsyncBootstrap({ type: "org", tenantId: activeOrg });
			workspaceScopeRef.current = null;
			setWorkspaceScope(null);
			setScopeResolutionDone(false);
			return;
		}

		if (fromSession?.kind === "personal") {
			workspaceScopeRef.current = fromSession;
			setWorkspaceScope(fromSession);
			setScopeResolutionDone(true);
			setAsyncBootstrap(null);
			return;
		}

		if (fromSession?.kind === "organization") {
			setAsyncBootstrap({ type: "personal" });
			workspaceScopeRef.current = null;
			setWorkspaceScope(null);
			setScopeResolutionDone(false);
			return;
		}

		setAsyncBootstrap(null);
		workspaceScopeRef.current = null;
		setScopeResolutionDone(false);
		setWorkspaceScope(null);
		void navigate("/console/dashboard/personal", { replace: true });
		// Re-resolve when navigation state changes (e.g. clearing one-shot keys).
	}, [navigate, location.state]);

	useEffect(() => {
		if (asyncBootstrap == null) return;
		let cancelled = false;
		if (asyncBootstrap.type === "org") {
			const tid = asyncBootstrap.tenantId;
			void (async () => {
				try {
					const t = await apiClient.tenants.get(tid, { tenantIdHeader: tid });
					if (cancelled) return;
					const scope: ChatWorkspaceScope = {
						kind: "organization",
						tenantId: tid,
						label:
							t?.name?.trim() && t.name.trim().length > 0
								? t.name.trim()
								: "Organization",
					};
					writeChatWorkspaceScope(scope);
					workspaceScopeRef.current = scope;
					setWorkspaceScope(scope);
					setScopeResolutionDone(true);
					setAsyncBootstrap(null);
				} catch {
					if (!cancelled) {
						setAsyncBootstrap(null);
						void navigate("/console/dashboard/business", { replace: true });
					}
				}
			})();
		} else {
			void (async () => {
				try {
					const res = await apiClient.dashboard.get({ variant: "personal" });
					if (cancelled) return;
					const scope: ChatWorkspaceScope = {
						kind: "personal",
						tenantId: res.context.tenant_id,
						label: "Personal",
					};
					writeChatWorkspaceScope(scope);
					workspaceScopeRef.current = scope;
					setWorkspaceScope(scope);
					setScopeResolutionDone(true);
					setAsyncBootstrap(null);
				} catch {
					if (!cancelled) {
						setAsyncBootstrap(null);
						void navigate("/console/dashboard/personal", { replace: true });
					}
				}
			})();
		}
		return () => {
			cancelled = true;
		};
	}, [asyncBootstrap, navigate]);

	useEffect(() => {
		if (!workspaceScope) return;
		const tid = workspaceScope.tenantId;
		if (prevWorkspaceTenantRef.current === null) {
			prevWorkspaceTenantRef.current = tid;
			return;
		}
		if (prevWorkspaceTenantRef.current === tid) return;
		prevWorkspaceTenantRef.current = tid;
		setSelectedSpaceId(null);
		setSpaces(null);
		setMembers(null);
		setCanManageMemberRoles(false);
		setMessages(null);
		setOldestMessageId(null);
		setHasMore(true);
		setSpaceTransactions(null);
		setSpaceTagCatalog(null);
		setSelectedTransactionTags([]);
		setInlineThreadExpenseId(null);
		setThreadDraftLineScroll(null);
		setActiveDraftExpenseId(null);
		setLatestMainMessageIdBySpace({});
		setErrorMessage(null);
	}, [workspaceScope]);

	useEffect(() => {
		spacesRef.current = spaces;
	}, [spaces]);
	useEffect(() => {
		selectedSpaceIdRef.current = selectedSpaceId;
	}, [selectedSpaceId]);
	useEffect(() => {
		mainTabRef.current = mainTab;
	}, [mainTab]);
	useEffect(() => {
		inlineThreadExpenseIdRef.current = inlineThreadExpenseId;
	}, [inlineThreadExpenseId]);
	useEffect(() => {
		currentUserIdRef.current = currentUserId;
	}, [currentUserId]);

	const messagesScrollRef = useRef<HTMLDivElement | null>(null);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);
	const pendingScrollAdjustRef = useRef<{
		prevScrollHeight: number;
		prevScrollTop: number;
	} | null>(null);

	const JUMP_TO_LATEST_THRESHOLD_PX = 96;

	const updateJumpButtonVisibility = useCallback(() => {
		const el = messagesScrollRef.current;
		if (!el || !messages?.length || inlineThreadExpenseId != null) {
			setShowJumpToLatest(false);
			return;
		}
		const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
		setShowJumpToLatest(dist > JUMP_TO_LATEST_THRESHOLD_PX);
	}, [messages, inlineThreadExpenseId]);

	const handleMessagesScroll = useCallback(() => {
		const el = messagesScrollRef.current;
		if (!el) return;
		if (!messages?.length) {
			setShowJumpToLatest(false);
			setStickToLatest(true);
			return;
		}
		const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
		const nearBottom = dist <= JUMP_TO_LATEST_THRESHOLD_PX;
		setStickToLatest(nearBottom);
		setShowJumpToLatest(!nearBottom);
	}, [messages?.length]);

	const handleJumpToLatest = useCallback(() => {
		const el = messagesScrollRef.current;
		setStickToLatest(true);
		setShowJumpToLatest(false);
		if (el) {
			el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
		}
	}, []);

	const selectedSpace = useMemo(() => {
		if (!spaces || selectedSpaceId === null) return null;
		return spaces.find((s) => String(s.id) === String(selectedSpaceId)) ?? null;
	}, [selectedSpaceId, spaces]);

	/** Newest real activity first (API); ties use local recent touches then name. */
	const spacesSortedForSidebar = useMemo(
		() => (spaces?.length ? sortSpacesByLastActivity(spaces) : spaces),
		[spaces],
	);

	const memberLabelByUserId = useMemo(() => {
		const map = new Map<number, string>();
		for (const m of members ?? []) {
			map.set(
				m.user_id,
				m.name?.trim() || m.email?.trim() || `Member ${m.user_id}`,
			);
		}
		return map;
	}, [members]);

	/** Full composer (Chat + Capture): show whenever the space has members, including solo (notes, story, invite later). */
	const multiUserSpace = useMemo(() => Boolean(members?.length), [members]);

	const isSpaceOwner = useMemo(() => {
		if (currentUserId == null || !members?.length) return false;
		return members.some(
			(m) => m.user_id === currentUserId && m.role === "owner",
		);
	}, [currentUserId, members]);

	const canDeleteMessage = useCallback(
		(m: ChatMessage) => {
			if (currentUserId == null) return false;
			if (isSpaceOwner) return true;
			if (m.sender_type === "user" && m.user_id === currentUserId) return true;
			return false;
		},
		[currentUserId, isSpaceOwner],
	);

	const canEditMessage = useCallback(
		(m: ChatMessage) => {
			if (currentUserId == null) return false;
			return m.sender_type === "user" && Number(m.user_id) === currentUserId;
		},
		[currentUserId],
	);

	const handleCancelEditMessage = useCallback(() => {
		setEditingMessageId(null);
		setEditingMessageText("");
	}, []);

	const handleSaveEditMessage = useCallback(async () => {
		if (editingMessageId == null || selectedSpaceId == null) return;
		const t = editingMessageText.trim();
		if (!t) return;
		setErrorMessage(null);
		try {
			const updated = await apiClient.spaces.updateMessage(
				selectedSpaceId,
				editingMessageId,
				{ text: t },
			);
			setMessages((prev) =>
				(prev ?? []).map((x) =>
					String(x.id) === String(editingMessageId)
						? { ...x, text: updated.text ?? t }
						: x,
				),
			);
			setEditingMessageId(null);
			setEditingMessageText("");
		} catch (e) {
			setErrorMessage(
				e instanceof Error ? e.message : "Failed to update message",
			);
		}
	}, [editingMessageId, editingMessageText, selectedSpaceId]);

	const handleDeleteOneMessage = useCallback(
		async (m: ChatMessage) => {
			if (selectedSpaceId == null) return;
			if (!window.confirm("Delete this message?")) return;
			setErrorMessage(null);
			try {
				await apiClient.spaces.deleteMessage(selectedSpaceId, m.id);
				setMessages((prev) =>
					(prev ?? []).filter((x) => String(x.id) !== String(m.id)),
				);
			} catch (e) {
				setErrorMessage(
					e instanceof Error ? e.message : "Failed to delete message",
				);
			}
		},
		[selectedSpaceId],
	);

	const handleRelatedResourceGone = useCallback(
		(messageId: string | number) => {
			setMessages((prev) =>
				(prev ?? []).filter((x) => String(x.id) !== String(messageId)),
			);
		},
		[],
	);

	const getMessageSenderLabel = (m: ChatMessage) => {
		if (m.sender_type !== "user") return "System";
		const uid = m.user_id;
		if (uid == null) return "User";
		if (currentUserId != null && uid === currentUserId) return "You";
		return memberLabelByUserId.get(uid) ?? `User ${uid}`;
	};

	const copyTransactionToWorkspace = (t: Transaction) => {
		setMainTab("transactions");
		setLedgerTab("manual");
		setManualDescription(`From transaction #${String(t.id)}`);
		setManualItems(
			t.items.map((it) => ({
				id: crypto.randomUUID(),
				name: it.name,
				amount: String(it.amount),
				tags: (it.tags ?? []).join(", "),
			})),
		);
	};

	const handleLoadSpaces = async () => {
		const scope = workspaceScopeRef.current;
		if (!scope) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			// All spaces across every tenant the user belongs to (not only the active workspace).
			const list = (await apiClient.spaces.list({ tenantId: null })) ?? [];
			setSpaces(list);
			setIncomingInvitesRefreshKey((k) => k + 1);
			const firstId = list[0]?.id ?? null;
			setSelectedSpaceId((prev) => prev ?? firstId);
		} catch (err) {
			setSpaces(null);
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to load spaces",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSelectSpace = async (
		spaceId: string | number,
		opts?: SelectSpaceOptions,
	) => {
		setSelectedSpaceId(spaceId);
		setInviteToken(null);
		setTenantInviteToken(null);
		setChatInput("");
		setParseInput("");
		setTransactionFilter("all");
		setActiveDraftExpenseId(null);
		setManualDescription("");
		setManualItems([newBuilderItem()]);
		setHardPurgeFeedback(null);
		setMessages(null);
		setMembers(null);
		setCanManageMemberRoles(false);
		setMemberRoleError(null);
		setOldestMessageId(null);
		setHasMore(true);

		if (opts?.openThreadExpenseId == null) {
			setInlineThreadExpenseId(null);
			setThreadDraftLineScroll(null);
		}

		setIsLoading(true);
		setErrorMessage(null);
		try {
			const [m, msgDesc] = await Promise.all([
				apiClient.spaces.listMembers(spaceId),
				apiClient.chatlog.listMessages(spaceId, {
					limit: DEFAULT_LIMIT,
				}),
			]);
			setMembers(m.members);
			setCanManageMemberRoles(m.can_manage_member_roles);
			setMainTab("chat");
			setComposerMode("message");
			const msgAsc = asChronological(msgDesc);
			setMessages(msgAsc);
			setOldestMessageId(msgAsc[0]?.id ?? null);
			setHasMore(msgDesc.length === DEFAULT_LIMIT);

			const maxFromList = maxMessageIdInList(msgAsc);
			const sidKey = String(spaceId);
			if (maxFromList) {
				setLatestMainMessageIdBySpace((prev) => {
					const existing = prev[sidKey];
					const best =
						!existing || messageIdCompare(existing, maxFromList) < 0
							? maxFromList
							: existing;
					return { ...prev, [sidKey]: best };
				});
				if (opts?.openThreadExpenseId == null) {
					writeLastReadMain(spaceId, maxFromList);
					setLastReadBump((v) => v + 1);
				}
			}

			if (opts?.openThreadExpenseId != null) {
				setComposerMode("message");
				setInlineThreadExpenseId(opts.openThreadExpenseId);
				if (opts.openThreadDraftLine != null && opts.openThreadDraftLine >= 1) {
					setThreadDraftLineScroll(opts.openThreadDraftLine);
				} else {
					setThreadDraftLineScroll(null);
				}
			} else if (opts?.quickCapture != null) {
				setComposerMode("capture");
				quickCaptureIntentRef.current = opts.quickCapture;
			} else if (opts?.focusCaptureComposer) {
				setComposerMode("capture");
				window.setTimeout(() => {
					parseTextareaRef.current?.focus();
				}, 200);
			} else if (opts?.focusMessageComposer) {
				setComposerMode("message");
				window.setTimeout(() => {
					chatMessageTextareaRef.current?.focus();
				}, 200);
			}
			const sidNum = Number(spaceId);
			if (Number.isFinite(sidNum) && sidNum > 0) touchRecentSpaceId(sidNum);
		} catch (err) {
			quickCaptureIntentRef.current = null;
			setMembers(null);
			setCanManageMemberRoles(false);
			setMessages(null);
			setInlineThreadExpenseId(null);
			setThreadDraftLineScroll(null);
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to load space",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handlePatchMemberRole = useCallback(
		async (userId: number, role: Exclude<SpaceRole, "owner">) => {
			if (selectedSpaceId == null) return;
			setMemberRoleSaving(true);
			setMemberRoleError(null);
			try {
				const updated = await apiClient.spaces.patchMemberRole(
					selectedSpaceId,
					userId,
					{ role },
				);
				setMembers((prev) =>
					prev
						? prev.map((x) => (Number(x.user_id) === userId ? updated : x))
						: [updated],
				);
			} catch (e) {
				setMemberRoleError(
					e instanceof Error ? e.message : "Could not update member role",
				);
			} finally {
				setMemberRoleSaving(false);
			}
		},
		[selectedSpaceId],
	);

	const handleRemoveSpaceMember = useCallback(
		async (userId: number): Promise<boolean> => {
			if (selectedSpaceId == null) return false;
			setMemberRemoveSaving(true);
			setMemberRoleError(null);
			try {
				await apiClient.spaces.removeMember(selectedSpaceId, userId);
				setMembers((prev) =>
					prev ? prev.filter((x) => Number(x.user_id) !== userId) : null,
				);
				return true;
			} catch (e) {
				setMemberRoleError(
					e instanceof Error ? e.message : "Could not remove member",
				);
				return false;
			} finally {
				setMemberRemoveSaving(false);
			}
		},
		[selectedSpaceId],
	);

	const openExpenseThreadInline = useCallback((expenseId: string | number) => {
		setMainTab("chat");
		setComposerMode("message");
		setThreadDraftLineScroll(null);
		setInlineThreadExpenseId(expenseId);
	}, []);

	const handleDraftLineScrollConsumed = useCallback(() => {
		setThreadDraftLineScroll(null);
	}, []);

	useEffect(() => {
		const st = location.state as ChatLogLocationState | null;
		if (st?.openThreadExpenseId == null) return;
		const eid = st.openThreadExpenseId;
		const sid = st.openThreadSpaceId;
		const draftLine =
			st.openThreadDraftLine != null && st.openThreadDraftLine >= 1
				? st.openThreadDraftLine
				: undefined;
		const scope = workspaceScopeRef.current;
		navigate(".", {
			replace: true,
			state: scope ? { chatWorkspace: scope } : {},
		});
		if (sid != null) {
			void handleSelectSpace(sid, {
				openThreadExpenseId: eid,
				...(draftLine != null ? { openThreadDraftLine: draftLine } : {}),
			});
			return;
		}
		setMainTab("chat");
		setComposerMode("message");
		setInlineThreadExpenseId(eid);
		if (draftLine != null) {
			setThreadDraftLineScroll(draftLine);
		} else {
			setThreadDraftLineScroll(null);
		}
	}, [location.state]);

	useEffect(() => {
		const st = location.state as ChatLogLocationState | null;
		if (st?.openThreadExpenseId != null) return;
		const sid = st?.selectSpaceId;
		if (sid == null) return;
		const qcap = st?.quickCapture;
		const focusCap = st?.focusCaptureComposer === true;
		const focusMsg = st?.focusMessageComposer === true;
		const scope = workspaceScopeRef.current;
		navigate(".", {
			replace: true,
			state: scope ? { chatWorkspace: scope } : {},
		});
		void handleSelectSpace(sid, {
			quickCapture: qcap,
			focusCaptureComposer: focusCap,
			focusMessageComposer: focusMsg,
		});
	}, [location.state]);

	const handleCreateSpace = async () => {
		const name = newSpaceName.trim();
		if (!name) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const created = await wsClient.rpc<Space>("spaces.create", { name });
			setNewSpaceName("");
			await handleLoadSpaces();
			await handleSelectSpace(created.id);
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to create space",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleCreateInvite = async () => {
		if (selectedSpaceId === null) return;
		const email = inviteEmail.trim();
		if (!email) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const res = await wsClient.rpc<{ token: string; expires_at: string }>(
				"spaces.invite",
				{
					spaceId: selectedSpaceId,
					email,
				},
			);
			setInviteToken(res.token ?? null);
			setInviteEmail("");
			setInviteSuggestionsNonce((n) => n + 1);
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to create invite",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleAcceptInvite = async (tokenOverride?: string) => {
		const token = (tokenOverride ?? acceptInviteToken).trim();
		if (!token) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			// Use REST so accept works without waiting for WebSocket (link auto-accept matches manual paste).
			const outcome = await apiClient.spaces.acceptInvite(token);
			setAcceptInviteToken("");
			await handleLoadSpaces();
			if (outcome.kind === "space") {
				await handleSelectSpace(outcome.space.id);
				setToastMessage(`Joined space “${outcome.space.name}”.`);
			} else {
				setToastMessage(
					`Joined organization (tenant ${outcome.tenant_id}). Your spaces list was refreshed.`,
				);
			}
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to accept invite",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleAcceptInviteRef = useRef(handleAcceptInvite);
	handleAcceptInviteRef.current = handleAcceptInvite;

	// After `?invite=` is captured, accept once workspace scope is ready (HTTP — no WebSocket wait).
	useEffect(() => {
		if (!autoAcceptInviteFromUrlRef.current) return;
		if (!scopeResolutionDone || !workspaceScope) return;
		const token = acceptInviteToken.trim();
		if (!token) return;
		autoAcceptInviteFromUrlRef.current = false;
		void handleAcceptInviteRef.current(token);
	}, [scopeResolutionDone, workspaceScope, acceptInviteToken]);

	const handleCreateTenantInvite = async () => {
		if (!selectedSpace) {
			setErrorMessage("Select a space first.");
			return;
		}
		const email = tenantInviteEmail.trim();
		if (!email) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const res = await apiClient.tenants.createInvite(
				selectedSpace.tenant_id,
				{
					email,
					channel: "email",
				},
			);
			setTenantInviteToken(res.token ?? null);
			setTenantInviteEmail("");
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to create tenant invite",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleLoadOlder = async () => {
		if (selectedSpaceId === null || !oldestMessageId) return;
		setStickToLatest(false);
		const el = messagesScrollRef.current;
		if (el) {
			pendingScrollAdjustRef.current = {
				prevScrollHeight: el.scrollHeight,
				prevScrollTop: el.scrollTop,
			};
		}
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const olderDesc = await apiClient.chatlog.listMessages(selectedSpaceId, {
				limit: DEFAULT_LIMIT,
				before: oldestMessageId,
			});
			const olderAsc = asChronological(olderDesc);
			setMessages((prev) => {
				const next = [...(olderAsc ?? []), ...(prev ?? [])];
				return next;
			});
			setOldestMessageId((prev) => olderAsc[0]?.id ?? prev);
			setHasMore(olderDesc.length === DEFAULT_LIMIT);
		} catch (err) {
			pendingScrollAdjustRef.current = null;
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to load older",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSendChat = async () => {
		if (selectedSpaceId === null) return;
		const text = chatInput.trim();
		if (!text) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const created = await wsClient.rpc<ChatMessage>("chat.send", {
				spaceId: selectedSpaceId,
				text,
			});
			setChatInput("");
			setStickToLatest(true);
			setMessages((prev) => [...(prev ?? []), created]);
			setOldestMessageId((prev) => prev ?? created.id);
			const nowIso = new Date().toISOString();
			setSpaces((prev) => {
				if (!prev) return prev;
				return prev.map((s) =>
					String(s.id) === String(selectedSpaceId)
						? { ...s, last_activity_at: nowIso }
						: s,
				);
			});
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to send message",
			);
		} finally {
			setIsLoading(false);
		}
	};

	/** After parse (text/photo/voice), persist draft + chat message immediately so the user sees the draft card in the thread. */
	const finalizeParsedDraft = useCallback(
		async (description: string, builderItems: BuilderItem[]) => {
			if (!selectedSpaceId) return;
			const payloadItems = builderItems
				.map((it) => {
					const lineNotes = (it.notes ?? "").trim();
					return {
						name: it.name.trim(),
						amount: toNumber(it.amount),
						tags: parseTags(it.tags),
						...(lineNotes ? { notes: lineNotes } : {}),
					};
				})
				.filter((it) => it.name && it.amount !== 0);
			if (!payloadItems.length) {
				setErrorMessage(
					"Nothing to save — parsed lines need a name and amount.",
				);
				return;
			}

			const res = await httpClient.post<{
				expense?: { id: string | number };
				message?: ChatMessage;
			}>(`/api/v1/spaces/${String(selectedSpaceId)}/transactions/manual`, {
				description: description.trim(),
				items: payloadItems,
			});

			setActiveDraftExpenseId(res.data?.expense?.id ?? null);
			setDraftOriginMessageId(res.data?.message?.id ?? null);
			setManualDescription(description.trim());
			setManualItems(builderItems);

			const msg = res.data?.message;
			if (msg) {
				setMessages((prev) => {
					const list = prev ?? [];
					if (list.some((m) => String(m.id) === String(msg.id))) {
						return list;
					}
					return [...list, msg];
				});
			}

			setParseInput("");
			setMainTab("chat");
			setComposerMode("message");
			setStickToLatest(true);
			const bumpIso = new Date().toISOString();
			setSpaces((prev) => {
				if (!prev) return prev;
				return prev.map((s) =>
					String(s.id) === String(selectedSpaceId)
						? { ...s, last_activity_at: bumpIso }
						: s,
				);
			});
		},
		[selectedSpaceId],
	);

	const handleParseTextSubmit = async () => {
		if (selectedSpaceId === null) return;
		const text = parseInput.trim();
		if (!text) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const res = await httpClient.post<{
				items?: {
					name: string;
					amount: number;
					tags?: string[];
					notes?: string;
				}[];
			}>(`/api/v1/spaces/${String(selectedSpaceId)}/transactions/parse/text`, {
				text,
			});
			const parsed = res.data?.items ?? [];
			const builderItems = parsed
				.filter((p) => p?.name?.trim() && Number(p.amount) !== 0)
				.map((p) => ({
					id: crypto.randomUUID(),
					name: p.name.trim(),
					amount: String(p.amount),
					tags: (p.tags ?? []).join(", "),
					notes: p.notes?.trim() ?? "",
				}));
			if (!builderItems.length) {
				setErrorMessage("Nothing parsed — try clearer amounts and item names.");
				return;
			}
			await finalizeParsedDraft(text, builderItems);
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to parse text",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleChangeManualItem = (id: string, patch: Partial<BuilderItem>) =>
		setManualItems((prev) =>
			prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
		);

	const handleAddManualItem = () =>
		setManualItems((prev) => [...prev, newBuilderItem()]);

	const handleRemoveManualItem = (id: string) =>
		setManualItems((prev) => prev.filter((i) => i.id !== id));

	const handleSaveDraft = async () => {
		if (!selectedSpaceId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const payloadItems = manualItems
				.map((it) => {
					const lineNotes = (it.notes ?? "").trim();
					return {
						name: it.name.trim(),
						amount: toNumber(it.amount),
						tags: parseTags(it.tags),
						...(lineNotes ? { notes: lineNotes } : {}),
					};
				})
				.filter((it) => it.name && it.amount !== 0);

			if (!payloadItems.length) return;

			const res = await httpClient.post<{
				expense?: { id: string | number };
				message?: { id: string | number };
			}>(`/api/v1/spaces/${String(selectedSpaceId)}/transactions/manual`, {
				description: manualDescription.trim(),
				items: payloadItems,
			});
			setActiveDraftExpenseId(res.data?.expense?.id ?? null);
			setDraftOriginMessageId(res.data?.message?.id ?? null);
		} catch (e) {
			setErrorMessage(e instanceof Error ? e.message : "Failed to save draft");
		} finally {
			setIsLoading(false);
		}
	};

	const handleApproveDraft = async () => {
		if (!activeDraftExpenseId) return;
		if (!selectedSpaceId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			await httpClient.post(
				`/api/v1/finances/expenses/${String(activeDraftExpenseId)}/confirm`,
			);
			const origin =
				draftOriginMessageId != null &&
				String(draftOriginMessageId).length > 0 &&
				!Number.isNaN(Number(draftOriginMessageId))
					? Number(draftOriginMessageId)
					: undefined;
			for (const it of manualItems) {
				if (!it.recurring_enabled) continue;
				if (!it.name.trim() || toNumber(it.amount) === 0) continue;
				const tags = parseTags(it.tags);
				const tagLabel = tags.length > 0 ? tags[0] : "recurring";
				await apiClient.finances.recurring.create({
					name: it.name.trim(),
					amount: toNumber(it.amount),
					interval: it.recurring_interval ?? "monthly",
					tag_label: tagLabel,
					space_id: Number(selectedSpaceId),
					...(origin != null ? { origin_message_id: origin } : {}),
				});
			}
			setActiveDraftExpenseId(null);
			setDraftOriginMessageId(null);
			setManualDescription("");
			setManualItems([newBuilderItem()]);
		} catch (e) {
			setErrorMessage(
				e instanceof Error ? e.message : "Failed to approve draft",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeclineDraft = async () => {
		if (!activeDraftExpenseId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			await httpClient.post(
				`/api/v1/finances/expenses/${String(activeDraftExpenseId)}/cancel`,
			);
			setActiveDraftExpenseId(null);
			setDraftOriginMessageId(null);
			setManualDescription("");
			setManualItems([newBuilderItem()]);
		} catch (e) {
			setErrorMessage(
				e instanceof Error ? e.message : "Failed to decline draft",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeleteDraftWorkspace = async () => {
		// Cancel draft if exists, otherwise just clear manual state
		if (activeDraftExpenseId) {
			await handleDeclineDraft();
			return;
		}
		setDraftOriginMessageId(null);
		setManualDescription("");
		setManualItems([newBuilderItem()]);
	};

	const handleParsePhotoFile = async (file: File) => {
		if (!selectedSpaceId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const fd = new FormData();
			fd.append("image", file);
			const res = await httpClient.post<{
				items?: {
					name: string;
					amount: number;
					tags?: string[];
					notes?: string;
				}[];
			}>(
				`/api/v1/spaces/${String(selectedSpaceId)}/transactions/parse/photo`,
				fd,
				{
					headers: { "Content-Type": "multipart/form-data" },
				},
			);
			const parsed = res.data?.items ?? [];
			const builderItems = parsed
				.filter((p) => p?.name?.trim() && Number(p.amount) !== 0)
				.map((p) => ({
					id: crypto.randomUUID(),
					name: p.name.trim(),
					amount: String(p.amount),
					tags: (p.tags ?? []).join(", "),
					notes: p.notes?.trim() ?? "",
				}));
			if (!builderItems.length) {
				setErrorMessage("Nothing parsed from this image — try another photo.");
				return;
			}
			const description = `Photo: ${file.name}`;
			await finalizeParsedDraft(description, builderItems);
		} catch (e) {
			setErrorMessage(e instanceof Error ? e.message : "Failed to parse photo");
		} finally {
			setIsLoading(false);
		}
	};

	const handleStopRecordingAndParse = async () => {
		const rec = mediaRecorderRef.current;
		if (!rec) return;
		if (rec.state !== "recording") return;

		const stopPromise = new Promise<void>((resolve) => {
			rec.addEventListener("stop", () => resolve(), { once: true });
		});
		rec.stop();
		await stopPromise;

		const blob = new Blob(mediaChunksRef.current, {
			type: rec.mimeType || "audio/webm",
		});
		mediaChunksRef.current = [];

		if (!selectedSpaceId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const fd = new FormData();
			fd.append(
				"voice",
				new File([blob], "voice.webm", { type: blob.type || "audio/webm" }),
			);
			const res = await httpClient.post<{
				items?: {
					name: string;
					amount: number;
					tags?: string[];
					notes?: string;
				}[];
				transcription?: string;
			}>(
				`/api/v1/spaces/${String(selectedSpaceId)}/transactions/parse/voice`,
				fd,
				{
					headers: { "Content-Type": "multipart/form-data" },
				},
			);
			const parsed = res.data?.items ?? [];
			const builderItems = parsed
				.filter((p) => p?.name?.trim() && Number(p.amount) !== 0)
				.map((p) => ({
					id: crypto.randomUUID(),
					name: p.name.trim(),
					amount: String(p.amount),
					tags: (p.tags ?? []).join(", "),
					notes: p.notes?.trim() ?? "",
				}));
			if (!builderItems.length) {
				setErrorMessage(
					"Nothing parsed from voice — try speaking amounts clearly.",
				);
				return;
			}
			const description = res.data?.transcription?.trim() || "Voice expense";
			await finalizeParsedDraft(description, builderItems);
		} catch (e) {
			setErrorMessage(e instanceof Error ? e.message : "Failed to parse voice");
		} finally {
			setIsLoading(false);
		}
	};

	const handleToggleRecording = async () => {
		if (composerMode !== "capture") return;
		if (isRecording) {
			setIsRecording(false);
			await handleStopRecordingAndParse();
			return;
		}

		setErrorMessage(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const rec = new MediaRecorder(stream);
			mediaRecorderRef.current = rec;
			mediaChunksRef.current = [];
			rec.addEventListener("dataavailable", (e) => {
				if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
			});
			rec.addEventListener("stop", () => {
				for (const t of stream.getTracks()) {
					t.stop();
				}
			});
			rec.start();
			setIsRecording(true);
		} catch (e) {
			setIsRecording(false);
			setErrorMessage(
				e instanceof Error ? e.message : "Microphone permission denied",
			);
		}
	};

	handleToggleRecordingRef.current = handleToggleRecording;

	useEffect(() => {
		if (isLoading) return;
		const intent = quickCaptureIntentRef.current;
		if (!intent) return;
		const timer = window.setTimeout(() => {
			if (quickCaptureIntentRef.current !== intent) return;
			quickCaptureIntentRef.current = null;
			if (intent === "photo") {
				quickCapturePhotoInputRef.current?.click();
				return;
			}
			void handleToggleRecordingRef.current();
		}, 120);
		return () => window.clearTimeout(timer);
	}, [isLoading, selectedSpaceId]);

	const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			void handleSendChat();
		}
	};

	const handleParseKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			void handleParseTextSubmit();
		}
	};

	// Draft approve/decline happens on the inline chat draft card now.

	const loadSpaceTransactions = useCallback(
		async (opts?: { quiet?: boolean }) => {
			if (!selectedSpaceId) return;
			if (!opts?.quiet) {
				setIsLoading(true);
				setErrorMessage(null);
			}
			try {
				const res = await httpClient.get<Transaction[]>(
					`/api/v1/spaces/${String(selectedSpaceId)}/transactions?limit=200`,
				);
				setSpaceTransactions(res.data ?? []);
			} catch (e) {
				setSpaceTransactions(null);
				if (!opts?.quiet) {
					setErrorMessage(
						e instanceof Error ? e.message : "Failed to load transactions",
					);
				}
			} finally {
				if (!opts?.quiet) setIsLoading(false);
			}
		},
		[selectedSpaceId],
	);

	const loadSpaceTransactionTags = useCallback(async () => {
		if (!selectedSpaceId) {
			setSpaceTagCatalog(null);
			return;
		}
		try {
			const res = await apiClient.spaces.listTransactionTags(selectedSpaceId);
			setSpaceTagCatalog(res.tags ?? []);
		} catch {
			setSpaceTagCatalog([]);
		}
	}, [selectedSpaceId]);

	const handleDeleteSpaceTransactionRow = useCallback(
		async (t: Transaction) => {
			if (!window.confirm("Delete this transaction? This cannot be undone.")) {
				return;
			}
			setErrorMessage(null);
			try {
				await apiClient.finances.expenses.delete(t.id);
				if (selectedDetailTransaction?.id === t.id) {
					setIsTransactionDetailOpen(false);
					setSelectedDetailTransaction(null);
				}
				await loadSpaceTransactions({ quiet: true });
				await loadSpaceTransactionTags();
			} catch (e) {
				setErrorMessage(
					e instanceof Error ? e.message : "Failed to delete transaction",
				);
			}
		},
		[
			loadSpaceTransactions,
			loadSpaceTransactionTags,
			selectedDetailTransaction?.id,
		],
	);

	const handleHardPurgeAllMessages = useCallback(async () => {
		if (selectedSpaceId == null) return;
		const ok = window.confirm(
			"Clear ALL chat messages in this space?\n\nThis cannot be undone. Expenses, transactions, and recurring schedules are not deleted — only chat lines.\n\nContinue?",
		);
		if (!ok) return;
		setHardPurgeFeedback(null);
		setErrorMessage(null);
		setIsLoading(true);
		try {
			const res = await apiClient.spaces.hardPurgeAllMessages(selectedSpaceId);
			setMessages([]);
			setOldestMessageId(null);
			setHasMore(false);
			setStickToLatest(true);
			setHardPurgeFeedback(`Removed ${String(res.deleted)} message(s).`);
		} catch (e) {
			setErrorMessage(
				e instanceof Error ? e.message : "Failed to clear chat messages",
			);
		} finally {
			setIsLoading(false);
		}
	}, [selectedSpaceId]);

	useEffect(() => {
		if (!multiUserSpace) {
			setMainTab("chat");
			setComposerMode("capture");
		} else {
			setComposerMode("message");
		}
	}, [multiUserSpace]);

	useEffect(() => {
		if (!selectedSpaceId) {
			setSpaceTransactions(null);
			setSelectedTransactionTags([]);
			setSpaceTagCatalog(null);
			return;
		}
		setSpaceTransactions(null);
		setSelectedTransactionTags([]);
		setSpaceTagCatalog(null);
		void loadSpaceTransactions({ quiet: true });
		void loadSpaceTransactionTags();
	}, [selectedSpaceId, loadSpaceTransactions, loadSpaceTransactionTags]);

	useEffect(() => {
		if (!scopeResolutionDone || !workspaceScope) return;
		const run = async () => {
			try {
				await wsClient.connect();
				setWsStatus("connected");
			} catch {
				setWsStatus("disconnected");
			}
			await handleLoadSpaces();
		};
		void run();
	}, [scopeResolutionDone, workspaceScope?.tenantId]);

	useEffect(() => {
		let cancelled = false;
		void apiClient.auth
			.me()
			.then((u) => {
				if (!cancelled) setCurrentUserId(u.id);
			})
			.catch(() => {
				if (!cancelled) setCurrentUserId(null);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!spaces?.length) return;
		if (selectedSpaceId === null) return;
		void handleSelectSpace(selectedSpaceId);
	}, [selectedSpaceId]);

	// Subscribe to main chat for every space so unread counts work while another space is selected.
	useEffect(() => {
		if (wsStatus !== "connected" || !spaces?.length) {
			return;
		}
		let cancelled = false;
		const subscribedRef = allSpaceUnsubsRef;
		subscribedRef.current = [];

		void (async () => {
			for (const s of spaces) {
				if (cancelled) break;
				const channelSid = String(s.id);
				const unsub = await wsClient.subscribe(
					`space:${channelSid}`,
					(e: WsEnvelope) => {
						if (e.op !== "chat.message.created") return;
						const message = (e.data?.message ?? null) as ChatMessage | null;
						if (!message) return;

						const msgSpaceId = String(message.space_id ?? channelSid);

						setLatestMainMessageIdBySpace((prev) => {
							const nextId = String(message.id);
							const cur = prev[msgSpaceId];
							if (cur && messageIdCompare(cur, nextId) >= 0) return prev;
							return { ...prev, [msgSpaceId]: nextId };
						});

						const selected = selectedSpaceIdRef.current;
						const isSelected =
							selected != null && String(selected) === msgSpaceId;

						if (isSelected) {
							if (message.related_expense_id) {
								setActiveDraftExpenseId(message.related_expense_id);
							}
							setMessages((prev) => {
								const list = prev ?? [];
								if (list.some((m) => String(m.id) === String(message.id)))
									return list;
								return [...list, message];
							});

							const viewingMainChat =
								mainTabRef.current === "chat" &&
								inlineThreadExpenseIdRef.current == null;

							if (viewingMainChat) {
								writeLastReadMain(msgSpaceId, message.id);
								setLastReadBump((v) => v + 1);
							} else {
								const uid = message.user_id;
								const isOwn =
									uid != null &&
									currentUserIdRef.current != null &&
									uid === currentUserIdRef.current;
								if (!isOwn) {
									if (mainTabRef.current === "transactions") {
										setToastMessage("New message in chat");
									} else if (inlineThreadExpenseIdRef.current != null) {
										setToastMessage("New message in chat");
									}
								}
							}
						} else {
							const uid = message.user_id;
							const isOwn =
								uid != null &&
								currentUserIdRef.current != null &&
								uid === currentUserIdRef.current;
							if (!isOwn) {
								const spaceName =
									spacesRef.current?.find((x) => String(x.id) === msgSpaceId)
										?.name ?? "Space";
								setToastMessage(`New message in ${spaceName}`);
							}
						}
					},
				);
				if (cancelled) {
					unsub();
					break;
				}
				subscribedRef.current.push(unsub);
			}
		})();

		return () => {
			cancelled = true;
			for (const u of subscribedRef.current) u();
			subscribedRef.current = [];
		};
	}, [wsStatus, spaces]);

	useEffect(() => {
		if (mainTab !== "chat" || selectedSpaceId === null) return;
		if (inlineThreadExpenseId != null) return;
		const list = messages;
		if (!list?.length) return;
		const maxId = maxMessageIdInList(list);
		if (!maxId) return;
		writeLastReadMain(selectedSpaceId, maxId);
		setLastReadBump((v) => v + 1);
	}, [mainTab, inlineThreadExpenseId, selectedSpaceId, messages]);

	useEffect(() => {
		if (toastMessage == null) return;
		const t = window.setTimeout(() => setToastMessage(null), 4500);
		return () => window.clearTimeout(t);
	}, [toastMessage]);

	useEffect(() => {
		setStickToLatest(true);
	}, [selectedSpaceId]);

	useLayoutEffect(() => {
		const el = messagesScrollRef.current;
		const pending = pendingScrollAdjustRef.current;
		if (pending && el) {
			const newH = el.scrollHeight;
			el.scrollTop = pending.prevScrollTop + (newH - pending.prevScrollHeight);
			pendingScrollAdjustRef.current = null;
			requestAnimationFrame(() => {
				const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
				setStickToLatest(dist <= JUMP_TO_LATEST_THRESHOLD_PX);
				updateJumpButtonVisibility();
			});
			return;
		}
		if (!stickToLatest) {
			requestAnimationFrame(() => updateJumpButtonVisibility());
			return;
		}
		if (!messages?.length) {
			setShowJumpToLatest(false);
			return;
		}
		if (!el) return;
		el.scrollTop = el.scrollHeight - el.clientHeight;
		requestAnimationFrame(() => updateJumpButtonVisibility());
	}, [messages, stickToLatest, updateJumpButtonVisibility]);

	// Leaving Capture composer mode drops an in-progress recording (no upload).
	useEffect(() => {
		if (composerMode === "capture") return;
		const rec = mediaRecorderRef.current;
		if (rec && rec.state === "recording") {
			rec.stop();
		}
		mediaChunksRef.current = [];
		setIsRecording(false);
	}, [composerMode]);

	/** Selected tags that still exist in the space catalog (when catalog is loaded). */
	const effectiveTransactionTags = useMemo(() => {
		if (!selectedTransactionTags.length) return [];
		if (!spaceTagCatalog) return selectedTransactionTags;
		const cat = new Set(spaceTagCatalog.map((t) => t.toLowerCase()));
		return selectedTransactionTags.filter((k) => cat.has(k));
	}, [selectedTransactionTags, spaceTagCatalog]);

	const displayedTransactions = useMemo(() => {
		const list = spaceTransactions ?? [];
		let base = list;
		if (currentUserId != null) {
			if (transactionFilter === "mine") {
				base = list.filter((t) => Number(t.user_id) === currentUserId);
			} else if (transactionFilter === "others") {
				base = list.filter(
					(t) => t.user_id != null && Number(t.user_id) !== currentUserId,
				);
			}
		} else if (transactionFilter === "mine" || transactionFilter === "others") {
			base = [];
		}
		if (!effectiveTransactionTags.length) return base;
		return base.filter((t) => {
			const tagSet = new Set<string>();
			for (const it of t.items ?? []) {
				for (const tag of it.tags ?? []) {
					tagSet.add(String(tag).trim().toLowerCase());
				}
			}
			return effectiveTransactionTags.every((needle) => tagSet.has(needle));
		});
	}, [
		spaceTransactions,
		transactionFilter,
		effectiveTransactionTags,
		currentUserId,
	]);

	const spaceTotalSpent = useMemo(() => {
		const list = spaceTransactions ?? [];
		return list.reduce((acc, t) => {
			const direct = Number(t.total);
			if (Number.isFinite(direct)) return acc + direct;
			const fromItems = (t.items ?? []).reduce(
				(s, it) => s + (Number(it.amount) || 0),
				0,
			);
			return acc + fromItems;
		}, 0);
	}, [spaceTransactions]);

	/** Main thread has unread: show on Transactions tab or when an expense thread covers the chat. */
	const selectedSpaceMainUnread = useMemo(() => {
		if (selectedSpaceId == null) return false;
		const sid = String(selectedSpaceId);
		const latest = latestMainMessageIdBySpace[sid];
		const lastRead = readLastReadMain(selectedSpaceId);
		if (!isMainChatUnread(lastRead, latest)) return false;
		return mainTab !== "chat" || inlineThreadExpenseId != null;
	}, [
		selectedSpaceId,
		latestMainMessageIdBySpace,
		lastReadBump,
		mainTab,
		inlineThreadExpenseId,
	]);

	useEffect(() => {
		if (!scopeResolutionDone || !workspaceScope) {
			setChatBreadcrumb(null);
			return;
		}
		if (!selectedSpace) {
			setChatBreadcrumb({ spaceName: null, thread: null });
			return () => setChatBreadcrumb(null);
		}
		if (inlineThreadExpenseId != null) {
			const loading = expenseThreadCtrl.loading;
			const exp = expenseThreadCtrl.expense;
			const total = expenseThreadCtrl.total;
			const status = expenseThreadCtrl.summary?.thread?.status;
			const finalized = expenseThreadCtrl.finalized;
			let label: string;
			if (loading && !exp) {
				label = "Expense thread";
			} else if (exp) {
				const raw =
					exp.description?.trim() || `Expense #${inlineThreadExpenseId}`;
				label = raw.length > 56 ? `${raw.slice(0, 53)}…` : raw;
			} else {
				label = `Expense #${inlineThreadExpenseId}`;
			}
			const detailParts: string[] = [];
			if (Number.isFinite(total) && total > 0) {
				detailParts.push(formatMoney(total));
			}
			if (finalized) {
				detailParts.push("Finalized");
			} else if (status) {
				detailParts.push(status);
			}
			const detail = detailParts.length > 0 ? detailParts.join(" · ") : null;
			setChatBreadcrumb({
				spaceName: selectedSpace.name,
				thread: { label, detail },
			});
			return () => setChatBreadcrumb(null);
		}
		setChatBreadcrumb({
			spaceName: selectedSpace.name,
			thread: null,
		});
		return () => setChatBreadcrumb(null);
	}, [
		scopeResolutionDone,
		workspaceScope,
		selectedSpace,
		inlineThreadExpenseId,
		expenseThreadCtrl.loading,
		expenseThreadCtrl.expense,
		expenseThreadCtrl.total,
		expenseThreadCtrl.summary,
		expenseThreadCtrl.finalized,
		formatMoney,
		setChatBreadcrumb,
	]);

	const handleRootTabChat = () => {
		setInlineThreadExpenseId(null);
		setThreadDraftLineScroll(null);
		setMainTab("chat");
	};

	const handleRootTabTransactions = () => {
		setInlineThreadExpenseId(null);
		setThreadDraftLineScroll(null);
		setMainTab("transactions");
		setLedgerTab("manual");
	};

	if (!scopeResolutionDone || !workspaceScope) {
		return (
			<section className="space-y-6 p-6">
				<p className="text-sm text-muted-foreground">Loading workspace…</p>
			</section>
		);
	}

	const workspaceTitle =
		workspaceScope.kind === "personal"
			? "Chat · Personal"
			: `Chat · ${workspaceScope.label?.trim() || "Organization"}`;

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">{workspaceTitle}</h1>
				<p className="text-sm text-muted-foreground">
					{workspaceScope.kind === "personal"
						? "Personal workspace — shared-space chat with system expense cards."
						: "Organization workspace — chat and ledger are scoped to this tenant only."}
				</p>
				<div className="text-xs text-muted-foreground">WS: {wsStatus}</div>
			</div>

			{errorMessage ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}

			<div
				className={[
					"grid min-h-0 gap-4 lg:items-stretch",
					chatSidebarExpanded
						? "lg:grid-cols-[minmax(0,320px)_1fr]"
						: "lg:grid-cols-[minmax(4.5rem,4.5rem)_1fr]",
				].join(" ")}
			>
				<ChatSpacesSidebar
					acceptInviteToken={acceptInviteToken}
					canManageMemberRoles={canManageMemberRoles}
					currentUserId={currentUserId}
					expanded={chatSidebarExpanded}
					hardPurgeFeedback={hardPurgeFeedback}
					incomingInvitesRefreshKey={incomingInvitesRefreshKey}
					inviteSuggestionsNonce={inviteSuggestionsNonce}
					inviteEmail={inviteEmail}
					inviteToken={inviteToken}
					isLoading={isLoading}
					isSpaceOwner={isSpaceOwner}
					memberRoleError={memberRoleError}
					memberRoleSaving={memberRoleSaving}
					members={members}
					onClearMemberRoleError={() => setMemberRoleError(null)}
					onPatchMemberRole={handlePatchMemberRole}
					onRemoveSpaceMember={handleRemoveSpaceMember}
					newSpaceName={newSpaceName}
					onAcceptInvite={() => void handleAcceptInvite()}
					onAcceptInviteToken={async (token) => {
						await handleAcceptInvite(token);
					}}
					onAcceptInviteTokenChange={setAcceptInviteToken}
					onCreateInvite={() => void handleCreateInvite()}
					onCreateSpace={() => void handleCreateSpace()}
					onCreateTenantInvite={() => void handleCreateTenantInvite()}
					onExpandedChange={setChatSidebarExpanded}
					onHardPurgeAllMessages={() => void handleHardPurgeAllMessages()}
					onInviteEmailChange={setInviteEmail}
					removeMemberSaving={memberRemoveSaving}
					onNewSpaceNameChange={setNewSpaceName}
					onRefreshSpaces={() => void handleLoadSpaces()}
					onSelectSpace={(id) => setSelectedSpaceId(id)}
					onClearThread={() => {
						setInlineThreadExpenseId(null);
						setThreadDraftLineScroll(null);
					}}
					onTenantInviteEmailChange={setTenantInviteEmail}
					selectedSpace={selectedSpace}
					selectedSpaceId={selectedSpaceId}
					spaceHasUnread={(spaceId) =>
						isMainChatUnread(
							readLastReadMain(spaceId),
							latestMainMessageIdBySpace[String(spaceId)],
						)
					}
					spaces={spacesSortedForSidebar}
					tenantInviteEmail={tenantInviteEmail}
					tenantInviteToken={tenantInviteToken}
					workspaceScope={workspaceScope}
				/>

				<main className="flex min-h-[min(640px,88vh)] flex-col overflow-hidden rounded-lg border border-border bg-card">
					<div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
						<div className="min-w-0">
							<div className="truncate text-sm font-medium">
								{selectedSpace ? selectedSpace.name : "Select a space"}
							</div>
							{selectedSpaceId && spaceTransactions !== null ? (
								<div className="mt-0.5 text-xs text-muted-foreground">
									<span className="font-medium text-foreground">
										Spent in this space:{" "}
									</span>
									{formatMoney(spaceTotalSpent)}
									<span className="ml-1 text-[10px] opacity-80">
										(your chat-linked expenses, up to 200 shown)
									</span>
								</div>
							) : null}
							<div className="mt-1 text-xs text-muted-foreground">
								{inlineThreadExpenseId
									? selectedSpaceMainUnread
										? "Expense thread — You also have unread messages in main chat. Close the thread or switch to the message list to read them."
										: "Expense thread — Review (draft, splits, proposals) scrolls separately from Discussion. Use Back in the panel to return."
									: selectedSpaceMainUnread
										? "You have unread messages — open the Chat tab to read them."
										: mainTab === "chat"
											? "Same thread — toggle Capture or Chat below to parse (text, photo, voice) or send a normal message."
											: "Manual entry and linked transactions for this space."}
							</div>
						</div>
						<button
							className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
							disabled={isLoading || !selectedSpaceId}
							onClick={() =>
								selectedSpaceId && void handleSelectSpace(selectedSpaceId)
							}
							type="button"
						>
							Reload
						</button>
					</div>

					{selectedSpaceId ? (
						<div className="flex flex-col gap-2 border-b border-border bg-muted/20 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
							<span className="sr-only">Space tools</span>
							<nav
								aria-label="Space main sections"
								className="flex flex-wrap gap-1"
								role="tablist"
							>
								<button
									aria-label={
										selectedSpaceMainUnread ? "Chat, unread messages" : "Chat"
									}
									aria-selected={mainTab === "chat"}
									className={`${navPillBase} ${
										mainTab === "chat" ? navPillActive : navPillInactive
									}`}
									disabled={isLoading}
									onClick={handleRootTabChat}
									role="tab"
									type="button"
								>
									<span className="inline-flex items-center gap-2">
										Chat
										{selectedSpaceMainUnread ? (
											<span
												aria-hidden
												className="h-2 w-2 rounded-full bg-primary"
											/>
										) : null}
									</span>
								</button>
								<button
									aria-label="Transactions and manual entry"
									aria-selected={mainTab === "transactions"}
									className={`${navPillBase} ${
										mainTab === "transactions" ? navPillActive : navPillInactive
									}`}
									disabled={isLoading}
									onClick={handleRootTabTransactions}
									role="tab"
									type="button"
								>
									Transactions
								</button>
							</nav>
						</div>
					) : null}

					<div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-muted/30 to-background">
						{selectedSpaceId ? (
							<>
								{mainTab === "chat" ? (
									<>
										<div className="mx-1.5 mt-1.5 flex h-[min(800px,90vh)] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-border/20 dark:shadow-none dark:ring-border/35 sm:mx-2.5">
											<div className="relative flex min-h-0 flex-1 flex-col bg-background/30">
												{hasMore && !inlineThreadExpenseId ? (
													<button
														aria-label="Load older messages"
														className={`absolute left-3 top-3 z-20 max-w-[42%] sm:max-w-none ${navPillBase} ${navPillInactive} disabled:opacity-50`}
														disabled={
															isLoading || !selectedSpaceId || !oldestMessageId
														}
														onClick={() => void handleLoadOlder()}
														type="button"
													>
														Older
													</button>
												) : null}
												<div className="relative min-h-0 flex-1">
													<div
														className="scrollbar-chat absolute inset-0 space-y-2 overflow-y-auto px-3 pb-3 pt-12 sm:px-4 sm:pt-14"
														onScroll={handleMessagesScroll}
														ref={messagesScrollRef}
													>
														{inlineThreadExpenseId && selectedSpaceId ? (
															<div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden">
																<ExpenseThreadInlinePanel
																	controller={expenseThreadCtrl}
																	currentUserId={currentUserId}
																	draftLineScrollRequest={threadDraftLineScroll}
																	formatDateTime={formatDateTime}
																	formatMoney={formatMoney}
																	onClose={() => {
																		setInlineThreadExpenseId(null);
																		setThreadDraftLineScroll(null);
																	}}
																	onDraftLineScrollConsumed={
																		handleDraftLineScrollConsumed
																	}
																	parseTestSnippets={PARSE_DUMMY_TEST_SNIPPETS}
																	spaceId={selectedSpaceId}
																/>
															</div>
														) : messages?.length ? (
															messages.map((m) => {
																const isUser = m.sender_type === "user";
																const accent = isUser
																	? userMessageAccent(m.user_id)
																	: null;
																return (
																	<div
																		className={[
																			"flex",
																			isUser ? "justify-start" : "justify-end",
																		].join(" ")}
																		key={String(m.id)}
																	>
																		<div
																			className={[
																				"group relative max-w-[min(520px,90%)] space-y-2 rounded-lg border px-3 py-2 shadow-sm",
																				isUser
																					? "border-border"
																					: "border-primary/30 bg-primary/10",
																			].join(" ")}
																			style={
																				isUser && accent
																					? {
																							borderLeftWidth: 4,
																							borderLeftStyle: "solid",
																							borderLeftColor:
																								accent.borderLeftColor,
																							backgroundColor: accent.surface,
																						}
																					: undefined
																			}
																		>
																			<div className="flex items-center justify-between gap-2">
																				<div className="min-w-0 text-[10px] font-semibold text-foreground">
																					{getMessageSenderLabel(m)}
																				</div>
																				<div className="flex shrink-0 items-center gap-2">
																					{canEditMessage(m) ? (
																						<button
																							aria-label="Edit message"
																							className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary opacity-0 transition-opacity hover:bg-primary/10 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
																							onClick={() => {
																								setEditingMessageId(m.id);
																								setEditingMessageText(
																									m.text ?? "",
																								);
																							}}
																							title="Edit message"
																							type="button"
																						>
																							Edit
																						</button>
																					) : null}
																					{canDeleteMessage(m) ? (
																						<button
																							aria-label="Delete message"
																							className="rounded px-1.5 py-0.5 text-[10px] font-medium text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
																							onClick={() =>
																								void handleDeleteOneMessage(m)
																							}
																							title="Delete message"
																							type="button"
																						>
																							Delete
																						</button>
																					) : null}
																					<div className="text-[10px] text-muted-foreground">
																						{m.created_at
																							? formatDateTime(m.created_at)
																							: ""}
																					</div>
																				</div>
																			</div>

																			{m.related_transaction_id ? (
																				<ExpenseMessageCard
																					chatWorkspace={workspaceScope}
																					onOpenExpenseThread={
																						openExpenseThreadInline
																					}
																					onTransactionOrphaned={() =>
																						handleRelatedResourceGone(m.id)
																					}
																					spaceId={selectedSpaceId ?? undefined}
																					transactionId={
																						m.related_transaction_id
																					}
																				/>
																			) : null}

																			{m.related_expense_id ? (
																				<DraftExpenseCard
																					chatWorkspace={workspaceScope}
																					expenseId={m.related_expense_id}
																					onExpenseOrphaned={() =>
																						handleRelatedResourceGone(m.id)
																					}
																					onOpenExpenseThread={
																						openExpenseThreadInline
																					}
																					originMessageId={m.id}
																					relatedExpenseStatusHint={
																						m.related_expense_status
																					}
																					spaceId={selectedSpaceId ?? undefined}
																				/>
																			) : null}

																			{canEditMessage(m) &&
																			editingMessageId != null &&
																			String(editingMessageId) ===
																				String(m.id) ? (
																				<div className="mt-2 space-y-2">
																					<label className="grid gap-1">
																						<span className="sr-only">
																							Edit message
																						</span>
																						<textarea
																							className="min-h-[5rem] w-full resize-y rounded-md border border-border bg-background p-2 text-sm text-foreground"
																							onChange={(e) =>
																								setEditingMessageText(
																									e.target.value,
																								)
																							}
																							rows={5}
																							value={editingMessageText}
																						/>
																					</label>
																					<div className="flex flex-wrap gap-2">
																						<button
																							className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
																							onClick={() =>
																								void handleSaveEditMessage()
																							}
																							type="button"
																						>
																							Save
																						</button>
																						<button
																							className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
																							onClick={handleCancelEditMessage}
																							type="button"
																						>
																							Cancel
																						</button>
																					</div>
																				</div>
																			) : isRecurringExpenseChatMessage(m) ? (
																				<div className="space-y-1">
																					<p className="text-[11px] font-semibold uppercase tracking-wide text-primary/90">
																						Recurring schedule
																					</p>
																					<div className="whitespace-pre-wrap text-sm text-foreground">
																						{m.text}
																					</div>
																				</div>
																			) : isDraftExpenseSystemMessage(
																					m,
																				) ? null : (
																				<div className="whitespace-pre-wrap text-sm text-foreground">
																					{m.text}
																				</div>
																			)}
																		</div>
																	</div>
																);
															})
														) : (
															<div className="text-sm text-muted-foreground">
																No messages yet.
															</div>
														)}
														<div
															aria-hidden
															className="h-px w-full shrink-0"
															ref={messagesEndRef}
														/>
													</div>
													{showJumpToLatest && !inlineThreadExpenseId ? (
														<button
															aria-label="Jump to latest messages"
															className="pointer-events-auto absolute bottom-3 right-3 z-30 inline-flex h-10 items-center gap-1.5 rounded-full border border-primary/25 bg-primary px-3 text-primary-foreground shadow-lg ring-2 ring-background transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-11 sm:px-4"
															onClick={handleJumpToLatest}
															type="button"
														>
															<span
																aria-hidden
																className="text-base leading-none sm:text-lg"
															>
																↓
															</span>
															<span className="max-w-[5.5rem] truncate text-xs font-semibold sm:max-w-none">
																Latest
															</span>
														</button>
													) : null}
												</div>
												<div className="shrink-0 border-t border-border/60 bg-card/95 p-3 backdrop-blur-sm dark:bg-background/90">
													{inlineThreadExpenseId &&
													selectedSpaceId ? null : selectedSpaceId ? (
														<div className="space-y-2">
															{multiUserSpace ? (
																<div className="flex flex-wrap items-center justify-end gap-2">
																	<button
																		aria-label={
																			composerMode === "message"
																				? "Switch composer to capture (parse text, photo, or voice)"
																				: "Switch composer to chat message"
																		}
																		aria-pressed={composerMode === "capture"}
																		className="inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-xs font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-50"
																		disabled={isLoading || !selectedSpaceId}
																		onClick={() =>
																			setComposerMode((m) =>
																				m === "message" ? "capture" : "message",
																			)
																		}
																		type="button"
																	>
																		{composerMode === "message"
																			? "Capture"
																			: "Chat"}
																	</button>
																</div>
															) : null}
															{!multiUserSpace || composerMode === "capture" ? (
																<>
																	<p className="text-xs text-muted-foreground">
																		Parse text, photo, or voice — drafts appear
																		in this thread.
																	</p>
																	<ParseExpenseComposer
																		disabled={isLoading || !selectedSpaceId}
																		isRecording={isRecording}
																		onParseInputChange={setParseInput}
																		onParseKeyDown={handleParseKeyDown}
																		onParseSubmit={() =>
																			void handleParseTextSubmit()
																		}
																		onPhotoFile={(f) =>
																			void handleParsePhotoFile(f)
																		}
																		onToggleRecording={() =>
																			void handleToggleRecording()
																		}
																		parseInput={parseInput}
																		photoFileInputRef={
																			quickCapturePhotoInputRef
																		}
																		parseTextareaRef={parseTextareaRef}
																		testSnippets={PARSE_DUMMY_TEST_SNIPPETS}
																	/>
																</>
															) : (
																<>
																	<p className="mb-2 text-xs text-muted-foreground">
																		Messages stay in sync with the space. Switch
																		to Capture to parse text, photo, or voice.
																	</p>
																	<div className="flex items-end gap-2">
																		<label className="grid min-w-0 flex-1 gap-1">
																			<span className="text-xs font-medium text-muted-foreground">
																				Message (Ctrl/⌘ + Enter to send)
																			</span>
																			<textarea
																				aria-label="Chat message"
																				className="h-24 w-full min-w-0 resize-none overflow-y-auto rounded-md border border-border bg-background p-3 text-sm"
																				onChange={(e) =>
																					setChatInput(e.target.value)
																				}
																				onKeyDown={handleChatKeyDown}
																				placeholder="Write a message…"
																				ref={chatMessageTextareaRef}
																				rows={4}
																				value={chatInput}
																			/>
																		</label>
																		<button
																			aria-label="Send message"
																			className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
																			disabled={
																				isLoading ||
																				!selectedSpaceId ||
																				!chatInput.trim()
																			}
																			onClick={() => void handleSendChat()}
																			type="button"
																		>
																			<SendMessageIcon />
																		</button>
																	</div>
																</>
															)}
														</div>
													) : null}
												</div>
											</div>
										</div>
									</>
								) : null}

								{mainTab === "transactions" && selectedSpaceId ? (
									<div className="mx-1.5 mt-1.5 flex min-h-[min(520px,78vh)] flex-1 flex-col overflow-hidden sm:mx-2.5">
										<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-border/20">
											<div
												className="flex flex-wrap gap-1 border-b border-border/60 px-3 py-2"
												role="tablist"
											>
												<button
													aria-selected={ledgerTab === "manual"}
													className={`${navPillBase} ${
														ledgerTab === "manual"
															? navPillActive
															: navPillInactive
													}`}
													onClick={() => setLedgerTab("manual")}
													role="tab"
													type="button"
												>
													Manual entry
												</button>
												<button
													aria-selected={ledgerTab === "browse"}
													className={`${navPillBase} ${
														ledgerTab === "browse"
															? navPillActive
															: navPillInactive
													}`}
													onClick={() => setLedgerTab("browse")}
													role="tab"
													type="button"
												>
													Browse
												</button>
											</div>
											<div className="scrollbar-chat min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
												{ledgerTab === "manual" ? (
													<ExpenseWorkspaceManualPanel
														activeDraftExpenseId={activeDraftExpenseId}
														disabled={isLoading}
														manualDescription={manualDescription}
														manualItems={manualItems}
														onAddItem={handleAddManualItem}
														onApproveDraft={() => void handleApproveDraft()}
														onChangeDescription={setManualDescription}
														onChangeItem={handleChangeManualItem}
														onDeclineDraft={() => void handleDeclineDraft()}
														onDeleteWorkspace={() =>
															void handleDeleteDraftWorkspace()
														}
														onRemoveItem={handleRemoveManualItem}
														onSaveDraft={() => void handleSaveDraft()}
													/>
												) : (
													<div className="space-y-3">
														<fieldset
															aria-label="Transaction filter"
															className="m-0 flex flex-wrap gap-1 border-0 p-0"
														>
															{(
																[
																	["all", "All"],
																	["mine", "Mine"],
																	["others", "Others"],
																] as const
															).map(([id, label]) => (
																<button
																	aria-label={`Filter ${label}`}
																	aria-pressed={transactionFilter === id}
																	className={`${navPillBase} ${
																		transactionFilter === id
																			? navPillActive
																			: navPillInactive
																	}`}
																	key={id}
																	onClick={() => setTransactionFilter(id)}
																	type="button"
																>
																	{label}
																</button>
															))}
														</fieldset>
														<SpaceTransactionTagFilter
															catalog={spaceTagCatalog}
															disabled={isLoading}
															onChange={setSelectedTransactionTags}
															selected={selectedTransactionTags}
														/>
														{displayedTransactions.length ? (
															<ul className="divide-y divide-border rounded-lg border border-border/60 bg-card/90 shadow-sm">
																{displayedTransactions.map((t) => (
																	<li
																		className="flex items-stretch divide-x divide-border"
																		key={String(t.id)}
																	>
																		<button
																			className="min-w-0 flex-1 p-3 text-left text-sm transition-colors hover:bg-accent/60"
																			onClick={() => {
																				setSelectedDetailTransaction(t);
																				setSpaceTransactionOpenInEdit(false);
																				setIsTransactionDetailOpen(true);
																			}}
																			type="button"
																		>
																			<div className="flex items-center justify-between gap-3">
																				<div className="font-medium">
																					#{String(t.id)}
																				</div>
																				<div className="text-xs text-muted-foreground">
																					{t.status}
																				</div>
																			</div>
																			<div className="mt-1 text-xs text-muted-foreground">
																				{t.items
																					?.map((i) => i.name)
																					.filter(Boolean)
																					.join(", ") || "—"}
																			</div>
																		</button>
																		<div className="flex w-[5.5rem] shrink-0 flex-col justify-center gap-1 p-2">
																			<button
																				aria-label={`Edit transaction ${String(t.id)}`}
																				className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-accent"
																				onClick={() => {
																					setSelectedDetailTransaction(t);
																					setSpaceTransactionOpenInEdit(true);
																					setIsTransactionDetailOpen(true);
																				}}
																				type="button"
																			>
																				Edit
																			</button>
																			<button
																				aria-label={`Delete transaction ${String(t.id)}`}
																				className="rounded-md border border-destructive/30 bg-background px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
																				onClick={() =>
																					void handleDeleteSpaceTransactionRow(
																						t,
																					)
																				}
																				type="button"
																			>
																				Delete
																			</button>
																		</div>
																	</li>
																))}
															</ul>
														) : (
															<div className="rounded-lg border border-border bg-card/90 p-4 text-sm text-muted-foreground">
																{transactionFilter === "others"
																	? "No other members’ transactions linked in this space yet."
																	: transactionFilter === "mine"
																		? "You have no expenses linked to this space yet."
																		: "No transactions linked in this space yet."}
															</div>
														)}
														{transactionFilter === "mine" &&
														displayedTransactions.length ? (
															<p className="mt-3 text-[11px] text-muted-foreground">
																Showing only your expenses linked to this space.
															</p>
														) : null}
													</div>
												)}
											</div>
										</div>
									</div>
								) : null}
							</>
						) : (
							<div className="border-b border-border px-4 py-6 text-sm text-muted-foreground">
								Select a space to load messages and tools.
							</div>
						)}
					</div>

					<SpaceTransactionDetailDialog
						initialEditMode={spaceTransactionOpenInEdit}
						onMutated={async () => {
							await loadSpaceTransactions({ quiet: true });
							await loadSpaceTransactionTags();
						}}
						onOpenChange={(next) => {
							setIsTransactionDetailOpen(next);
							if (!next) setSpaceTransactionOpenInEdit(false);
						}}
						onRequestCopyToWorkspace={() => {
							if (selectedDetailTransaction)
								copyTransactionToWorkspace(selectedDetailTransaction);
						}}
						open={isTransactionDetailOpen}
						titleId={transactionDetailTitleId}
						transaction={selectedDetailTransaction}
					/>
				</main>
			</div>

			{toastMessage
				? createPortal(
						<output
							aria-live="polite"
							className="pointer-events-none fixed bottom-6 left-1/2 z-[9999] block max-w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-2.5 text-center text-sm text-foreground shadow-lg"
						>
							{toastMessage}
						</output>,
						document.body,
					)
				: null}
		</section>
	);
};
