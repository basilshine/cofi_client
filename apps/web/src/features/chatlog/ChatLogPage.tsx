import type {
	ChatMessage,
	SpaceMember,
	SpaceRole,
	Transaction,
	WsEnvelope,
} from "@cofi/api";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSetChatBreadcrumb } from "../../app/layout/ChatBreadcrumbContext";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceTabs } from "../../app/layout/workspaceSpaces/SpaceTabs";
import { WorkspaceRightSidebar } from "../../app/layout/workspaceSpaces/WorkspaceRightSidebar";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient, writeActiveOrgTenantId } from "../../shared/lib/apiClient";
import { readCeitsFirstChat } from "../../shared/lib/ceitsUserPrefs";
import type { ChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import { httpClient } from "../../shared/lib/httpClient";
import {
	parseCapturePhoto,
	parseCaptureText,
	parseCaptureVoice,
} from "../../shared/lib/quickCaptureTransactions";
import {
	sortSpacesByLastActivity,
	touchRecentSpaceId,
} from "../../shared/lib/recentSpaceIds";
import { wsClient } from "../../shared/lib/wsClient";
import type { ChatComposerMode } from "./components/ChatComposerDock";
import { ChatExpenseRightPanelContent } from "./components/ChatExpenseRightPanelContent";
import type { ChatSpacesSidebarProps } from "./components/ChatSpacesSidebar";
import {
	isDraftExpenseSystemMessage,
	isRecurringExpenseChatMessage,
} from "./components/DraftExpenseBoilerplateCaption";
import { DraftExpenseCard } from "./components/DraftExpenseCard";
import { ExpenseMessageCard } from "./components/ExpenseMessageCard";
import { FirstChatQuickActions } from "./components/FirstChatQuickActions";
import {
	type ComposerPayload,
	SmartTextareaComposer,
	type SmartTextareaComposerHandle,
} from "./components/SmartTextareaComposer";
import { SpaceExpensesMain } from "./components/SpaceExpensesMain";
import {
	type ThreadDeepLink,
	ThreadDiscussionRichText,
} from "./components/ThreadDiscussionRichText";
import type { BuilderItem } from "./components/transactionBuilderTypes";
import { parseTags, toNumber } from "./components/transactionBuilderTypes";
import { useExpenseThreadState } from "./hooks/useExpenseThreadState";
import {
	asChronological,
	isMainChatUnread,
	maxMessageIdInList,
	messageIdCompare,
	readLastReadMain,
	writeLastReadMain,
} from "./lib/mainChatRead";
import { userMessageAccent } from "./lib/userMessageAccent";
import type {
	ChatLogLocationState,
	SelectSpaceOptions,
} from "./model/chatLogLocation";
import { PARSE_DUMMY_TEST_SNIPPETS } from "./parseDummySnippets";

const DEFAULT_LIMIT = 50;

/** Floating chat navigation — same pill look on root and drilled layers. */
const navPillBase =
	"inline-flex min-h-9 shrink-0 items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4";

const navPillInactive =
	"text-muted-foreground hover:bg-accent/70 hover:text-foreground";

export const ChatLogPage = () => {
	const { formatMoney, formatDateTime } = useUserFormat();
	const setChatBreadcrumb = useSetChatBreadcrumb();
	const {
		workspaceScope,
		spaces,
		patchSpaces,
		isLoading: workspaceContextLoading,
		loadError: workspaceLoadError,
		refreshSpaces,
		sidebarExpanded: chatSidebarExpanded,
		setSidebarExpanded: setChatSidebarExpanded,
		selectedSpaceId,
		setSelectedSpaceId,
		setChatSidebarProps,
		setSpaceHasUnread,
		newSpaceName,
		setNewSpaceName,
		createSpace,
		isCreatingSpace,
		rightSidebarExpanded,
		setRightSidebarExpanded,
	} = useWorkspaceSpaces();

	const { user: authUser } = useAuth();

	const scopeResolutionDone = Boolean(workspaceScope);

	const [wsStatus, setWsStatus] = useState<"disconnected" | "connected">(
		"disconnected",
	);
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

	const firstChatQuick = useMemo(
		() => readCeitsFirstChat(authUser),
		[authUser],
	);
	const showFirstChatQuickStrip = useMemo(() => {
		if (selectedSpaceId == null) return false;
		if (!firstChatQuick?.quick_actions?.length) return false;
		if (String(firstChatQuick.space_id) !== String(selectedSpaceId)) {
			return false;
		}
		if (!messages?.length) return false;
		return messages.some((m) => m.message_type === "onboarding_welcome");
	}, [selectedSpaceId, firstChatQuick, messages]);

	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteToken, setInviteToken] = useState<string | null>(null);
	const [inviteSuggestionsNonce, setInviteSuggestionsNonce] = useState(0);
	const [incomingInvitesRefreshKey, setIncomingInvitesRefreshKey] = useState(0);
	const [tenantInviteEmail, setTenantInviteEmail] = useState("");
	const [tenantInviteToken, setTenantInviteToken] = useState<string | null>(
		null,
	);
	const [acceptInviteToken, setAcceptInviteToken] = useState("");

	const [composerMode, setComposerMode] = useState<ChatComposerMode>("message");
	const [isRecording, setIsRecording] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	/** Latest main-chat message id per space (from loads + WS). */
	const [latestMainMessageIdBySpace, setLatestMainMessageIdBySpace] = useState<
		Record<string, string>
	>({});
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const allSpaceUnsubsRef = useRef<(() => void)[]>([]);
	const spacesRef = useRef(spaces);
	const selectedSpaceIdRef = useRef(selectedSpaceId);
	const [stickToLatest, setStickToLatest] = useState(true);
	const [showJumpToLatest, setShowJumpToLatest] = useState(false);
	const [currentUserId, setCurrentUserId] = useState<number | null>(null);
	const [hardPurgeFeedback, setHardPurgeFeedback] = useState<string | null>(
		null,
	);
	/** When set, the workspace right panel shows the full expense thread (same features as before). */
	const [sidebarThreadExpenseId, setSidebarThreadExpenseId] = useState<
		string | number | null
	>(null);
	/** Space Expenses route: expense thread is in workspace edit mode (dim main list). */
	const [
		expenseInspectorWorkspaceEditing,
		setExpenseInspectorWorkspaceEditing,
	] = useState(false);
	const [spaceTransactions, setSpaceTransactions] = useState<
		Transaction[] | null
	>(null);
	const [spaceTransactionsError, setSpaceTransactionsError] = useState<
		string | null
	>(null);
	const [spaceTransactionsLoading, setSpaceTransactionsLoading] =
		useState(false);
	/** One-shot scroll to a draft line after deep link (`?line=`). Cleared when consumed or thread closes. */
	const [threadDraftLineScroll, setThreadDraftLineScroll] = useState<
		number | null
	>(null);
	const [editingMessageId, setEditingMessageId] = useState<
		string | number | null
	>(null);
	const [editingMessageText, setEditingMessageText] = useState("");
	const [pendingDeleteMessage, setPendingDeleteMessage] =
		useState<ChatMessage | null>(null);
	const [deleteMessageBusy, setDeleteMessageBusy] = useState(false);
	const currentUserIdRef = useRef(currentUserId);
	const smartComposerRef = useRef<SmartTextareaComposerHandle>(null);
	const quickCaptureIntentRef = useRef<"photo" | "voice" | null>(null);
	const handleToggleRecordingRef = useRef<() => Promise<void>>(async () => {});
	/** When true, stopping the recorder sends transcribed text as chat only (no expense). */
	const recordingForMessageRef = useRef(false);

	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();
	/** Dedupe processing the same `?invite=` token from the URL in one session. */
	const lastUrlInviteTokenProcessedRef = useRef<string | null>(null);
	/** When true, auto-run accept invite once workspace + WS are ready (from invite link). */
	const autoAcceptInviteFromUrlRef = useRef(false);
	const workspaceScopeRef = useRef<ChatWorkspaceScope | null>(null);
	const prevWorkspaceTenantRef = useRef<number | null>(null);

	const expenseThreadCtrl = useExpenseThreadState(
		selectedSpaceId,
		sidebarThreadExpenseId,
	);

	const loadSpaceTransactions = useCallback(async () => {
		if (selectedSpaceId == null) {
			setSpaceTransactions(null);
			return;
		}
		setSpaceTransactionsLoading(true);
		setSpaceTransactionsError(null);
		try {
			const data = await apiClient.spaces.listTransactions(selectedSpaceId, {
				limit: 200,
			});
			setSpaceTransactions(data ?? []);
		} catch (e) {
			setSpaceTransactions(null);
			setSpaceTransactionsError(
				e instanceof Error ? e.message : "Failed to load expenses",
			);
		} finally {
			setSpaceTransactionsLoading(false);
		}
	}, [selectedSpaceId]);

	useEffect(() => {
		void loadSpaceTransactions();
	}, [loadSpaceTransactions]);

	useEffect(() => {
		const onExpensesRoute = location.pathname.startsWith(
			"/console/chat/expenses",
		);
		if (!onExpensesRoute || sidebarThreadExpenseId == null) {
			setExpenseInspectorWorkspaceEditing(false);
		}
	}, [location.pathname, sidebarThreadExpenseId]);

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
		writeActiveOrgTenantId(null);
	}, []);

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
		patchSpaces(() => null);
		setMembers(null);
		setCanManageMemberRoles(false);
		setMessages(null);
		setOldestMessageId(null);
		setHasMore(true);
		setSidebarThreadExpenseId(null);
		setThreadDraftLineScroll(null);
		setLatestMainMessageIdBySpace({});
		setErrorMessage(null);
	}, [workspaceScope]);

	useEffect(() => {
		spacesRef.current = spaces;
	}, [spaces]);
	useEffect(() => {
		selectedSpaceIdRef.current = selectedSpaceId;
	}, [selectedSpaceId]);

	/** Deep links and sub-nav use `?spaceId=` (same idea as dashboard overview). */
	useEffect(() => {
		if (!scopeResolutionDone || !workspaceScope) return;
		if (!spaces?.length) return;
		const p = location.pathname;
		if (!p.startsWith("/console/chat")) return;
		if (p.startsWith("/console/chat/thread")) return;
		const raw = searchParams.get("spaceId")?.trim();
		if (!raw) return;
		const space = spaces.find((s) => String(s.id) === String(raw));
		if (!space) return;
		if (String(selectedSpaceId) === String(space.id)) return;
		setSelectedSpaceId(space.id);
	}, [
		scopeResolutionDone,
		workspaceScope,
		spaces,
		location.pathname,
		searchParams,
		selectedSpaceId,
		setSelectedSpaceId,
	]);

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
		if (!el || !messages?.length) {
			setShowJumpToLatest(false);
			return;
		}
		const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
		setShowJumpToLatest(dist > JUMP_TO_LATEST_THRESHOLD_PX);
	}, [messages]);

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

	const chatHeaderPageLabel = location.pathname.startsWith(
		"/console/chat/expenses",
	)
		? "Expenses"
		: "Chat";
	useConsoleHeaderTitle(chatHeaderPageLabel, selectedSpace?.name ?? null);

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
			setDeleteMessageBusy(true);
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
			} finally {
				setDeleteMessageBusy(false);
				setPendingDeleteMessage(null);
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
		if (m.sender_type !== "user") {
			if (isDraftExpenseSystemMessage(m)) return "Parsed by Ceits";
			if (isRecurringExpenseChatMessage(m)) return "Saved by Ceits";
			return "Ceits";
		}
		const uid = m.user_id;
		if (uid == null) return "User";
		if (currentUserId != null && uid === currentUserId) return "You";
		return memberLabelByUserId.get(uid) ?? `User ${uid}`;
	};

	const handleLoadSpaces = useCallback(async () => {
		const scope = workspaceScopeRef.current;
		if (!scope) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			await refreshSpaces();
			setIncomingInvitesRefreshKey((k) => k + 1);
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to load spaces",
			);
		} finally {
			setIsLoading(false);
		}
	}, [refreshSpaces]);

	const handleSelectSpace = async (
		spaceId: string | number,
		opts?: SelectSpaceOptions,
	) => {
		setSelectedSpaceId(spaceId);
		setInviteToken(null);
		setTenantInviteToken(null);
		setHardPurgeFeedback(null);
		setMessages(null);
		setMembers(null);
		setCanManageMemberRoles(false);
		setMemberRoleError(null);
		setOldestMessageId(null);
		setHasMore(true);

		if (opts?.openThreadExpenseId == null) {
			setSidebarThreadExpenseId(null);
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
				}
			}

			if (opts?.openThreadExpenseId != null) {
				setComposerMode("message");
				setSidebarThreadExpenseId(opts.openThreadExpenseId);
				setRightSidebarExpanded(true);
				if (opts.openThreadDraftLine != null && opts.openThreadDraftLine >= 1) {
					setThreadDraftLineScroll(opts.openThreadDraftLine);
				} else {
					setThreadDraftLineScroll(null);
				}
			}
			const sidNum = Number(spaceId);
			if (Number.isFinite(sidNum) && sidNum > 0) touchRecentSpaceId(sidNum);
		} catch (err) {
			quickCaptureIntentRef.current = null;
			setMembers(null);
			setCanManageMemberRoles(false);
			setMessages(null);
			setSidebarThreadExpenseId(null);
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

	const openExpenseInSidebar = useCallback(
		(expenseId: string | number) => {
			setComposerMode("message");
			setThreadDraftLineScroll(null);
			setSidebarThreadExpenseId(expenseId);
			setRightSidebarExpanded(true);
		},
		[setRightSidebarExpanded],
	);

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
		navigate(
			{
				pathname: location.pathname,
				search: location.search,
				hash: location.hash,
			},
			{
				replace: true,
				state: scope ? { chatWorkspace: scope } : {},
			},
		);
		if (sid != null) {
			void handleSelectSpace(sid, {
				openThreadExpenseId: eid,
				...(draftLine != null ? { openThreadDraftLine: draftLine } : {}),
			});
			return;
		}
		setComposerMode("message");
		setSidebarThreadExpenseId(eid);
		setRightSidebarExpanded(true);
		if (draftLine != null) {
			setThreadDraftLineScroll(draftLine);
		} else {
			setThreadDraftLineScroll(null);
		}
	}, [
		location.hash,
		location.pathname,
		location.search,
		location.state,
		navigate,
		setRightSidebarExpanded,
	]);

	useEffect(() => {
		const st = location.state as ChatLogLocationState | null;
		if (st?.openThreadExpenseId != null) return;
		const sid = st?.selectSpaceId;
		if (sid == null) return;
		const scope = workspaceScopeRef.current;
		navigate(
			{
				pathname: location.pathname,
				search: location.search,
				hash: location.hash,
			},
			{
				replace: true,
				state: scope ? { chatWorkspace: scope } : {},
			},
		);
		void handleSelectSpace(sid);
	}, [
		location.hash,
		location.pathname,
		location.search,
		location.state,
		navigate,
	]);

	const handleCreateSpace = useCallback(async () => {
		setErrorMessage(null);
		try {
			await createSpace();
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to create space",
			);
		}
	}, [createSpace]);

	const handleCreateInvite = useCallback(async () => {
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
	}, [inviteEmail, selectedSpaceId]);

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

	const handleCreateTenantInvite = useCallback(async () => {
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
	}, [selectedSpace, tenantInviteEmail]);

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

	/** Send arbitrary text as a chat message (used by SmartTextareaComposer message + ask flows). */
	const handleSendChatText = async (text: string) => {
		if (selectedSpaceId === null) return;
		const t = text.trim();
		if (!t) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const created = await wsClient.rpc<ChatMessage>("chat.send", {
				spaceId: selectedSpaceId,
				text: t,
			});
			setStickToLatest(true);
			setMessages((prev) => [...(prev ?? []), created]);
			setOldestMessageId((prev) => prev ?? created.id);
			const nowIso = new Date().toISOString();
			patchSpaces((prev) => {
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

	/** Drop an in-progress recording without processing it (e.g. Back/Cancel from voice state). */
	const handleCancelRecording = useCallback(() => {
		const rec = mediaRecorderRef.current;
		if (rec && rec.state === "recording") {
			rec.stop();
		}
		mediaChunksRef.current = [];
		setIsRecording(false);
		recordingForMessageRef.current = false;
	}, []);

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
			}>("/api/v1/capture", {
				input_kind: "manual",
				space_id: Number(selectedSpaceId),
				description: description.trim(),
				items: payloadItems,
			});

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

			setComposerMode("message");
			setStickToLatest(true);
			const bumpIso = new Date().toISOString();
			patchSpaces((prev) => {
				if (!prev) return prev;
				return prev.map((s) =>
					String(s.id) === String(selectedSpaceId)
						? { ...s, last_activity_at: bumpIso }
						: s,
				);
			});
			void loadSpaceTransactions();
		},
		[selectedSpaceId, loadSpaceTransactions],
	);

	/** Unified payload handler for SmartTextareaComposer. Routes to existing logic. */
	const handleComposerSubmit = useCallback(
		async (payload: ComposerPayload) => {
			if (selectedSpaceId === null) return;

			if (payload.composer_mode === "expense") {
				if (payload.expense_input_type === "text") {
					const text = payload.content.trim();
					if (!text) return;
					setIsLoading(true);
					setErrorMessage(null);
					try {
						const res = await parseCaptureText(text, {
							spaceId: selectedSpaceId,
						});
						const parsed = res.items ?? [];
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
								"Nothing parsed — try clearer amounts and item names.",
							);
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
				} else if (payload.expense_input_type === "photo") {
					await handleParsePhotoFile(payload.file);
				}
				// voice: handled via onStartExpenseRecording / onStopRecording directly
			} else if (payload.composer_mode === "ask") {
				let text = "";
				if (payload.ask_type === "period_expenses") {
					text = payload.content
						? `How much did I spend on ${payload.content} ${payload.period.toLowerCase()}?`
						: `How much did I spend ${payload.period.toLowerCase()}?`;
				} else if (payload.ask_type === "find_expense") {
					text = `Find expense: ${payload.content}`;
				} else if (payload.ask_type === "next_payment") {
					text = `What's my next payment? (${payload.period})`;
				} else if (payload.ask_type === "split_balance") {
					text = payload.content
						? `Who owes whom? ${payload.content}`
						: "Who owes whom in this space?";
				} else if (payload.ask_type === "custom") {
					text = payload.content;
				}
				if (text.trim()) await handleSendChatText(text);
			} else if (payload.composer_mode === "message") {
				await handleSendChatText(payload.content);
			}
		},
		[selectedSpaceId, finalizeParsedDraft, handleSendChatText],
	);

	const handleParsePhotoFile = async (file: File) => {
		if (!selectedSpaceId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const res = await parseCapturePhoto(file, { spaceId: selectedSpaceId });
			const parsed = res.items ?? [];
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
			const res = await parseCaptureVoice(blob, blob.type || "audio/webm", {
				spaceId: selectedSpaceId,
			});
			const parsed = res.items ?? [];
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
			const description = res.transcription?.trim() || "Voice expense";
			await finalizeParsedDraft(description, builderItems);
		} catch (e) {
			setErrorMessage(e instanceof Error ? e.message : "Failed to parse voice");
		} finally {
			setIsLoading(false);
		}
	};

	const handleStopRecordingAsChatMessage = async () => {
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
			const res = await parseCaptureVoice(blob, blob.type || "audio/webm", {
				spaceId: selectedSpaceId,
			});
			const text = res.transcription?.trim();
			if (!text) {
				setErrorMessage("Nothing transcribed — try again.");
				return;
			}
			const created = await wsClient.rpc<ChatMessage>("chat.send", {
				spaceId: selectedSpaceId,
				text,
			});
			setStickToLatest(true);
			setMessages((prev) => [...(prev ?? []), created]);
			setOldestMessageId((prev) => prev ?? created.id);
			const nowIso = new Date().toISOString();
			patchSpaces((prev) => {
				if (!prev) return prev;
				return prev.map((s) =>
					String(s.id) === String(selectedSpaceId)
						? { ...s, last_activity_at: nowIso }
						: s,
				);
			});
		} catch (e) {
			setErrorMessage(
				e instanceof Error ? e.message : "Failed to send voice message",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const beginRecording = async (forMessage: boolean) => {
		if (isRecording) return;
		recordingForMessageRef.current = forMessage;
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
			recordingForMessageRef.current = false;
			setErrorMessage(
				e instanceof Error ? e.message : "Microphone permission denied",
			);
		}
	};

	const handleToggleRecording = async () => {
		if (isRecording) {
			setIsRecording(false);
			const forMsg = recordingForMessageRef.current;
			recordingForMessageRef.current = false;
			if (forMsg) {
				await handleStopRecordingAsChatMessage();
			} else {
				await handleStopRecordingAndParse();
			}
			return;
		}
		await beginRecording(composerMode === "message");
	};

	handleToggleRecordingRef.current = async () => {
		await beginRecording(false);
	};

	useEffect(() => {
		if (isLoading) return;
		const intent = quickCaptureIntentRef.current;
		if (!intent) return;
		const timer = window.setTimeout(() => {
			if (quickCaptureIntentRef.current !== intent) return;
			quickCaptureIntentRef.current = null;
			if (intent === "photo") {
				smartComposerRef.current?.navigateTo("expense_photo");
				window.setTimeout(
					() => smartComposerRef.current?.triggerPhotoUpload(),
					150,
				);
				return;
			}
			void handleToggleRecordingRef.current();
		}, 120);
		return () => window.clearTimeout(timer);
	}, [isLoading, selectedSpaceId]);

	const handleFirstChatQuickAction = useCallback(
		(id: string) => {
			if (id === "upload_receipt") {
				quickCaptureIntentRef.current = "photo";
				return;
			}
			if (id === "add_recurring_bill") {
				if (selectedSpaceId == null) return;
				navigate(
					`/console/recurring?spaceId=${encodeURIComponent(String(selectedSpaceId))}`,
				);
				return;
			}
			if (id === "invite_someone") {
				smartComposerRef.current?.navigateTo("message_text");
				return;
			}
			if (id === "voice_note") {
				void beginRecording(false);
				return;
			}
			if (id === "quick_note") {
				smartComposerRef.current?.navigateTo("message_text");
			}
		},
		[navigate, selectedSpaceId, beginRecording],
	);

	// Draft approve/decline happens on the inline chat draft card now.

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
			setComposerMode("capture");
		} else {
			setComposerMode("message");
		}
	}, [multiUserSpace]);

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
							setMessages((prev) => {
								const list = prev ?? [];
								if (list.some((m) => String(m.id) === String(message.id)))
									return list;
								return [...list, message];
							});

							writeLastReadMain(msgSpaceId, message.id);
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
		if (selectedSpaceId === null) return;
		const list = messages;
		if (!list?.length) return;
		const maxId = maxMessageIdInList(list);
		if (!maxId) return;
		writeLastReadMain(selectedSpaceId, maxId);
	}, [selectedSpaceId, messages]);

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

	useEffect(() => {
		setSpaceHasUnread((spaceId) =>
			isMainChatUnread(
				readLastReadMain(spaceId),
				latestMainMessageIdBySpace[String(spaceId)],
			),
		);
		return () => {
			setSpaceHasUnread((_spaceId) => false);
		};
	}, [latestMainMessageIdBySpace, setSpaceHasUnread]);

	const chatSidebarBridgeProps = useMemo((): ChatSpacesSidebarProps | null => {
		if (!workspaceScope) return null;
		return {
			expanded: chatSidebarExpanded,
			onExpandedChange: setChatSidebarExpanded,
			workspaceScope,
			isLoading: isLoading || workspaceContextLoading || isCreatingSpace,
			onRefreshSpaces: () => void handleLoadSpaces(),
			newSpaceName,
			onNewSpaceNameChange: setNewSpaceName,
			onCreateSpace: () => void handleCreateSpace(),
			spaces: spacesSortedForSidebar,
			selectedSpaceId,
			onSelectSpace: (id: string | number) => {
				setSidebarThreadExpenseId(null);
				setThreadDraftLineScroll(null);
				setSelectedSpaceId(id);
			},
			onClearThread: () => {
				setSidebarThreadExpenseId(null);
				setThreadDraftLineScroll(null);
			},
			spaceHasUnread: (spaceId) =>
				isMainChatUnread(
					readLastReadMain(spaceId),
					latestMainMessageIdBySpace[String(spaceId)],
				),
			selectedSpace,
			members,
			canManageMemberRoles,
			currentUserId,
			onPatchMemberRole: handlePatchMemberRole,
			memberRoleSaving,
			memberRoleError,
			onClearMemberRoleError: () => setMemberRoleError(null),
			inviteEmail,
			onInviteEmailChange: setInviteEmail,
			onCreateInvite: () => void handleCreateInvite(),
			inviteToken,
			onRemoveSpaceMember: handleRemoveSpaceMember,
			removeMemberSaving: memberRemoveSaving,
			isSpaceOwner,
			tenantInviteEmail,
			onTenantInviteEmailChange: setTenantInviteEmail,
			onCreateTenantInvite: () => void handleCreateTenantInvite(),
			tenantInviteToken,
			acceptInviteToken,
			onAcceptInviteTokenChange: setAcceptInviteToken,
			onAcceptInvite: () => void handleAcceptInviteRef.current(),
			onHardPurgeAllMessages: () => void handleHardPurgeAllMessages(),
			hardPurgeFeedback,
			inviteSuggestionsNonce,
			incomingInvitesRefreshKey,
			onAcceptInviteToken: async (token) => {
				await handleAcceptInviteRef.current(token);
			},
		};
	}, [
		workspaceScope,
		chatSidebarExpanded,
		setChatSidebarExpanded,
		isLoading,
		workspaceContextLoading,
		isCreatingSpace,
		handleLoadSpaces,
		handleCreateSpace,
		newSpaceName,
		setNewSpaceName,
		spacesSortedForSidebar,
		selectedSpaceId,
		setSelectedSpaceId,
		selectedSpace,
		members,
		canManageMemberRoles,
		currentUserId,
		handlePatchMemberRole,
		memberRoleSaving,
		memberRoleError,
		inviteEmail,
		handleCreateInvite,
		inviteToken,
		handleRemoveSpaceMember,
		memberRemoveSaving,
		isSpaceOwner,
		tenantInviteEmail,
		handleCreateTenantInvite,
		tenantInviteToken,
		acceptInviteToken,
		handleHardPurgeAllMessages,
		hardPurgeFeedback,
		inviteSuggestionsNonce,
		incomingInvitesRefreshKey,
		latestMainMessageIdBySpace,
		setSidebarThreadExpenseId,
		setThreadDraftLineScroll,
	]);

	useEffect(() => {
		setChatSidebarProps(chatSidebarBridgeProps);
	}, [chatSidebarBridgeProps, setChatSidebarProps]);

	useEffect(() => () => setChatSidebarProps(null), [setChatSidebarProps]);

	const handleCloseSidebarThread = useCallback(() => {
		setSidebarThreadExpenseId(null);
		setThreadDraftLineScroll(null);
		void loadSpaceTransactions();
	}, [loadSpaceTransactions]);

	const handleSelectExpenseFromPanel = useCallback(
		(expenseId: string | number) => {
			setSidebarThreadExpenseId(expenseId);
			setRightSidebarExpanded(true);
		},
		[setRightSidebarExpanded],
	);

	const handleInsertLineLinkToMainChat = useCallback((markdown: string) => {
		smartComposerRef.current?.insertMessage(markdown);
	}, []);

	const handleOpenThreadLinkFromMainChat = useCallback(
		(link: ThreadDeepLink) => {
			const draftLine =
				link.line != null && link.line >= 1 ? link.line : undefined;
			if (
				selectedSpaceId != null &&
				String(selectedSpaceId) !== String(link.spaceId)
			) {
				void handleSelectSpace(link.spaceId, {
					openThreadExpenseId: link.expenseId,
					...(draftLine != null ? { openThreadDraftLine: draftLine } : {}),
				});
				return;
			}
			setComposerMode("message");
			setSidebarThreadExpenseId(link.expenseId);
			setRightSidebarExpanded(true);
			setThreadDraftLineScroll(draftLine ?? null);
		},
		[selectedSpaceId, setRightSidebarExpanded],
	);

	useEffect(() => {
		if (!scopeResolutionDone || !workspaceScope) {
			setChatBreadcrumb(null);
			return;
		}
		if (!selectedSpace) {
			setChatBreadcrumb({ spaceName: null, thread: null });
			return () => setChatBreadcrumb(null);
		}
		if (sidebarThreadExpenseId != null) {
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
					exp.description?.trim() || `Expense #${sidebarThreadExpenseId}`;
				label = raw.length > 56 ? `${raw.slice(0, 53)}…` : raw;
			} else {
				label = `Expense #${sidebarThreadExpenseId}`;
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
		sidebarThreadExpenseId,
		expenseThreadCtrl.loading,
		expenseThreadCtrl.expense,
		expenseThreadCtrl.total,
		expenseThreadCtrl.summary,
		expenseThreadCtrl.finalized,
		formatMoney,
		setChatBreadcrumb,
	]);

	const expenseRenderMeta = useMemo(() => {
		const latestIndexByKey = new Map<string, number>();
		const updatesByKey = new Map<
			string,
			Array<{
				state: "draft" | "approved" | "needs_review";
				timestamp?: string | null;
				note?: string | null;
			}>
		>();
		for (let i = 0; i < (messages ?? []).length; i += 1) {
			const m = messages?.[i];
			if (!m) continue;
			const relatedId = m.related_expense_id ?? m.related_transaction_id;
			if (relatedId == null) continue;
			const key = String(relatedId);
			latestIndexByKey.set(key, i);
			const raw = (m.related_expense_status ?? "").toLowerCase();
			const state: "draft" | "approved" | "needs_review" =
				m.related_transaction_id != null || raw === "approved"
					? "approved"
					: raw === "draft"
						? "draft"
						: raw.includes("pending") || raw.includes("review")
							? "needs_review"
							: "draft";
			const note =
				state === "approved" && (updatesByKey.get(key)?.length ?? 0) > 0
					? "Updated after confirmation"
					: state === "needs_review"
						? "Needs agreement"
						: null;
			const list = updatesByKey.get(key) ?? [];
			list.push({
				state,
				timestamp: m.created_at ?? null,
				note,
			});
			updatesByKey.set(key, list);
		}
		return { latestIndexByKey, updatesByKey };
	}, [messages]);

	if (workspaceContextLoading && !workspaceScope) {
		return (
			<section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
				<div className="flex min-h-0 flex-1 items-center justify-center">
					<p className="text-sm text-muted-foreground">Loading workspace…</p>
				</div>
			</section>
		);
	}

	if (!workspaceScope) {
		return (
			<section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
				<div className="flex min-h-0 flex-1 items-center justify-center px-4">
					<p className="text-center text-sm text-destructive">
						{workspaceLoadError ?? "Workspace unavailable."}
					</p>
				</div>
			</section>
		);
	}

	const isExpensesRoute = location.pathname.startsWith(
		"/console/chat/expenses",
	);

	const expenseRightPanel =
		selectedSpaceId == null ? (
			<div className="px-4 py-6 text-sm text-muted-foreground">
				Select a space to browse expenses and threads.
			</div>
		) : (
			<ChatExpenseRightPanelContent
				currentUserId={currentUserId}
				draftLineScrollRequest={threadDraftLineScroll}
				expenseThreadCtrl={expenseThreadCtrl}
				expensesWorkspaceRoute={isExpensesRoute}
				listError={spaceTransactionsError}
				listLoading={spaceTransactionsLoading}
				onCloseThread={handleCloseSidebarThread}
				onDraftLineScrollConsumed={handleDraftLineScrollConsumed}
				onInsertLineLinkToMainChat={handleInsertLineLinkToMainChat}
				onReloadList={() => void loadSpaceTransactions()}
				onSelectExpense={handleSelectExpenseFromPanel}
				onWorkspaceEditModeChange={
					isExpensesRoute ? setExpenseInspectorWorkspaceEditing : undefined
				}
				parseTestSnippets={PARSE_DUMMY_TEST_SNIPPETS}
				sidebarThreadExpenseId={sidebarThreadExpenseId}
				spaceId={selectedSpaceId}
				spaceName={selectedSpace?.name ?? null}
				spaceTransactions={spaceTransactions}
				workspaceEditSurfaceActive={
					isExpensesRoute &&
					sidebarThreadExpenseId != null &&
					expenseInspectorWorkspaceEditing
				}
			/>
		);

	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden">
			<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<header className="shrink-0 border-b border-border/80 bg-background px-4 py-2.5 lg:px-6">
					<SpaceTabs />
				</header>

				{errorMessage ? (
					<div className="shrink-0 border-b border-destructive/25 bg-destructive/10 px-4 py-2 text-sm text-destructive lg:px-6">
						{errorMessage}
					</div>
				) : null}

				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">
						<div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-muted/30 to-background">
							{selectedSpaceId ? (
								<>
									{isExpensesRoute ? (
										<div
											className={
												expenseInspectorWorkspaceEditing
													? "flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-border/60 bg-card opacity-[0.52] saturate-[0.68] contrast-[0.94] transition-[opacity,filter] duration-300 ease-out"
													: "flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-border/60 bg-card transition-[opacity,filter] duration-300 ease-out"
											}
										>
											<SpaceExpensesMain
												currentUserId={currentUserId}
												listError={spaceTransactionsError}
												listLoading={spaceTransactionsLoading}
												onReload={() => void loadSpaceTransactions()}
												onSelectExpense={handleSelectExpenseFromPanel}
												selectedExpenseId={sidebarThreadExpenseId}
												spaceId={selectedSpaceId}
												spaceName={selectedSpace?.name ?? null}
												transactions={spaceTransactions}
											/>
										</div>
									) : (
										<div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-border/60 bg-card">
											<div className="relative flex min-h-0 flex-1 flex-col bg-background/30">
												{hasMore ? (
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
														className="scrollbar-chat absolute inset-0 space-y-2 overflow-y-auto px-4 pb-3 pt-12 sm:px-6 sm:pt-14"
														onScroll={handleMessagesScroll}
														ref={messagesScrollRef}
													>
														{messages?.length ? (
															messages.map((m, idx) => {
																const isUser = m.sender_type === "user";
																const accent = isUser
																	? userMessageAccent(m.user_id)
																	: null;
																const showCaptionAboveExpense =
																	Boolean(
																		m.related_transaction_id ||
																			m.related_expense_id,
																	) &&
																	Boolean(m.text?.trim()) &&
																	!isRecurringExpenseChatMessage(m) &&
																	!isDraftExpenseSystemMessage(m) &&
																	!(
																		editingMessageId != null &&
																		String(editingMessageId) === String(m.id)
																	);
																const isRelatedSelected =
																	sidebarThreadExpenseId != null &&
																	((m.related_expense_id != null &&
																		String(m.related_expense_id) ===
																			String(sidebarThreadExpenseId)) ||
																		(m.related_transaction_id != null &&
																			String(m.related_transaction_id) ===
																				String(sidebarThreadExpenseId)));
																const hasExpenseAttachment = Boolean(
																	m.related_expense_id ||
																		m.related_transaction_id,
																);
																const messageDateKey = m.created_at
																	? new Date(m.created_at).toDateString()
																	: "";
																const prev = idx > 0 ? messages[idx - 1] : null;
																const prevDateKey =
																	prev?.created_at != null
																		? new Date(prev.created_at).toDateString()
																		: "";
																const showDaySeparator =
																	idx === 0 || messageDateKey !== prevDateKey;
																const dateLabel = (() => {
																	if (!m.created_at) return "";
																	const d = new Date(m.created_at);
																	const today = new Date();
																	const y = new Date();
																	y.setDate(today.getDate() - 1);
																	if (d.toDateString() === today.toDateString())
																		return "Today";
																	if (d.toDateString() === y.toDateString())
																		return "Yesterday";
																	return d.toLocaleDateString(undefined, {
																		month: "short",
																		day: "numeric",
																	});
																})();
																const currentRelatedId =
																	m.related_expense_id != null
																		? String(m.related_expense_id)
																		: m.related_transaction_id != null
																			? String(m.related_transaction_id)
																			: null;
																const prevRelatedId =
																	prev?.related_expense_id != null
																		? String(prev.related_expense_id)
																		: prev?.related_transaction_id != null
																			? String(prev.related_transaction_id)
																			: null;
																const sameRelatedAsPrev =
																	currentRelatedId != null &&
																	prevRelatedId != null &&
																	currentRelatedId === prevRelatedId;
																const isLatestForExpense =
																	currentRelatedId == null
																		? true
																		: expenseRenderMeta.latestIndexByKey.get(
																				currentRelatedId,
																			) === idx;
																const groupedUpdates =
																	currentRelatedId == null
																		? []
																		: (expenseRenderMeta.updatesByKey.get(
																				currentRelatedId,
																			) ?? []);
																const inspectorOpen =
																	sidebarThreadExpenseId != null;
																// Chat cards are compact event summaries. Detailed expense work belongs to the shared inspector or review flow.
																if (
																	hasExpenseAttachment &&
																	!isLatestForExpense &&
																	!showCaptionAboveExpense &&
																	!m.text?.trim()
																) {
																	return null;
																}

																return (
																	<div
																		className={
																			sameRelatedAsPrev
																				? "space-y-0.5"
																				: "space-y-1"
																		}
																		key={String(m.id)}
																	>
																		{showDaySeparator ? (
																			<div className="flex items-center py-0.5">
																				<div className="h-px flex-1 bg-border/45" />
																				<span className="px-2 text-[10px] font-medium text-muted-foreground">
																					{dateLabel}
																				</span>
																				<div className="h-px flex-1 bg-border/45" />
																			</div>
																		) : null}
																		{sameRelatedAsPrev &&
																		hasExpenseAttachment ? (
																			<div className="ml-2.5 h-2 w-px bg-[rgba(120,100,80,0.26)]" />
																		) : null}
																		<div
																			className={[
																				"flex",
																				isUser
																					? "justify-end"
																					: "justify-start",
																			].join(" ")}
																		>
																			<div
																				className={[
																					"group relative transition-colors",
																					hasExpenseAttachment
																						? "max-w-[min(780px,95%)]"
																						: isUser
																							? "max-w-[min(620px,88%)]"
																							: "max-w-[min(700px,92%)]",
																					hasExpenseAttachment
																						? "space-y-1 px-0 py-0"
																						: "space-y-2 rounded-xl border px-4 py-3 shadow-sm",
																					hasExpenseAttachment
																						? ""
																						: isUser
																							? "border-primary/35 bg-primary/[0.16]"
																							: "border-[rgba(120,100,80,0.18)] bg-[rgba(255,252,246,0.94)]",
																					isRelatedSelected
																						? hasExpenseAttachment
																							? "border-l-2 border-l-[rgba(120,98,62,0.45)] pl-2"
																							: "border-[rgba(120,98,62,0.38)] bg-[rgba(255,248,235,0.96)]"
																						: "",
																				].join(" ")}
																				style={
																					isUser &&
																					accent &&
																					!hasExpenseAttachment
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
																					{hasExpenseAttachment ? (
																						<span />
																					) : (
																						<div className="min-w-0 text-[10px] font-semibold text-foreground">
																							{getMessageSenderLabel(m)}
																						</div>
																					)}
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
																									setPendingDeleteMessage(m)
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

																				{showCaptionAboveExpense ? (
																					<div className="whitespace-pre-wrap text-sm text-foreground">
																						<ThreadDiscussionRichText
																							body={m.text ?? ""}
																							expenseId={null}
																							onOpenThreadLink={
																								handleOpenThreadLinkFromMainChat
																							}
																							onJumpToLine={() => {}}
																							spaceId={selectedSpaceId ?? "0"}
																						/>
																					</div>
																				) : null}

																				{m.related_transaction_id &&
																				isLatestForExpense ? (
																					<ExpenseMessageCard
																						chatWorkspace={workspaceScope}
																						compact
																						inspectorOpen={inspectorOpen}
																						isSelected={isRelatedSelected}
																						onOpenExpenseThread={
																							openExpenseInSidebar
																						}
																						onTransactionOrphaned={() =>
																							handleRelatedResourceGone(m.id)
																						}
																						spaceId={
																							selectedSpaceId ?? undefined
																						}
																						transactionId={
																							m.related_transaction_id
																						}
																						updates={groupedUpdates}
																					/>
																				) : null}

																				{m.related_expense_id &&
																				isLatestForExpense ? (
																					<DraftExpenseCard
																						chatWorkspace={workspaceScope}
																						compact
																						expenseId={m.related_expense_id}
																						inspectorOpen={inspectorOpen}
																						isSelected={isRelatedSelected}
																						onExpenseOrphaned={() =>
																							handleRelatedResourceGone(m.id)
																						}
																						onOpenExpenseThread={
																							openExpenseInSidebar
																						}
																						originMessageId={m.id}
																						relatedExpenseStatusHint={
																							m.related_expense_status
																						}
																						spaceId={
																							selectedSpaceId ?? undefined
																						}
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
																								onClick={
																									handleCancelEditMessage
																								}
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
																							<ThreadDiscussionRichText
																								body={m.text ?? ""}
																								expenseId={null}
																								onOpenThreadLink={
																									handleOpenThreadLinkFromMainChat
																								}
																								onJumpToLine={() => {}}
																								spaceId={selectedSpaceId ?? "0"}
																							/>
																						</div>
																					</div>
																				) : isDraftExpenseSystemMessage(
																						m,
																					) ? null : showCaptionAboveExpense ? null : (
																					<div className="whitespace-pre-wrap text-sm text-foreground">
																						<ThreadDiscussionRichText
																							body={m.text ?? ""}
																							expenseId={null}
																							onOpenThreadLink={
																								handleOpenThreadLinkFromMainChat
																							}
																							onJumpToLine={() => {}}
																							spaceId={selectedSpaceId ?? "0"}
																						/>
																					</div>
																				)}
																			</div>
																		</div>
																	</div>
																);
															})
														) : isLoading ? (
															<div className="rounded-xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.9)] px-4 py-3 text-sm text-muted-foreground">
																Loading conversation…
															</div>
														) : (
															<div className="rounded-xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.9)] px-4 py-3 text-sm text-muted-foreground">
																<p className="font-medium text-foreground/85">
																	Start with a quick expense note:
																</p>
																<p className="mt-1 text-xs">
																	Coffee 4.50 · Taxi home 500 · Split dinner
																	with Natalia
																</p>
															</div>
														)}
														<div
															aria-hidden
															className="h-px w-full shrink-0"
															ref={messagesEndRef}
														/>
													</div>
													{showJumpToLatest ? (
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
												{selectedSpaceId && showFirstChatQuickStrip ? (
													<FirstChatQuickActions
														actions={firstChatQuick?.quick_actions ?? []}
														onAction={handleFirstChatQuickAction}
													/>
												) : null}
												{selectedSpaceId ? (
													<SmartTextareaComposer
														ref={smartComposerRef}
														disabled={isLoading || !selectedSpaceId}
														isRecording={isRecording}
														onCancelRecording={handleCancelRecording}
														onComposerSubmit={(p) =>
															void handleComposerSubmit(p)
														}
														onStartExpenseRecording={() =>
															void beginRecording(false)
														}
														onStopRecording={() => void handleToggleRecording()}
														spaceId={selectedSpaceId}
													/>
												) : null}
											</div>
										</div>
									)}
								</>
							) : (
								<div className="border-b border-border px-4 py-6 text-sm text-muted-foreground">
									Select a space to load messages and tools.
								</div>
							)}
						</div>
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
				{pendingDeleteMessage ? (
					<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4">
						<div
							aria-modal="true"
							className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-xl"
							role="dialog"
						>
							<h3 className="text-sm font-semibold text-foreground">
								Delete message?
							</h3>
							<p className="mt-2 text-sm text-muted-foreground">
								Only this chat message will be removed. Linked expense data is
								kept.
							</p>
							<div className="mt-4 flex items-center justify-end gap-2">
								<button
									className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
									disabled={deleteMessageBusy}
									onClick={() => setPendingDeleteMessage(null)}
									type="button"
								>
									Keep message
								</button>
								<button
									className="inline-flex h-9 items-center rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
									disabled={deleteMessageBusy}
									onClick={() =>
										void handleDeleteOneMessage(pendingDeleteMessage)
									}
									type="button"
								>
									{deleteMessageBusy ? "Deleting…" : "Delete message"}
								</button>
							</div>
						</div>
					</div>
				) : null}
			</section>
			<WorkspaceRightSidebar
				expanded={rightSidebarExpanded}
				onExpandedChange={setRightSidebarExpanded}
				title="Expenses"
				workSurfaceActive={
					isExpensesRoute &&
					sidebarThreadExpenseId != null &&
					expenseInspectorWorkspaceEditing
				}
			>
				{expenseRightPanel}
			</WorkspaceRightSidebar>
		</div>
	);
};
