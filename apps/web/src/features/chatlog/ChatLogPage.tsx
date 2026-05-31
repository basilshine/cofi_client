import type {
	ChatMessage,
	SpaceMember,
	SpaceRole,
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
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSetChatBreadcrumb } from "../../app/layout/ChatBreadcrumbContext";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient, writeActiveOrgTenantId } from "../../shared/lib/apiClient";
import { readCeitsFirstChat } from "../../shared/lib/ceitsUserPrefs";
import type { ChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import {
	sortSpacesByLastActivity,
	touchRecentSpaceId,
} from "../../shared/lib/recentSpaceIds";
import { wsClient } from "../../shared/lib/wsClient";
import { ChatCaptureReviewEvents } from "./components/ChatCaptureReviewEvents";
import type { ChatComposerMode } from "./components/ChatComposerDock";
import {
	ChatComposerOrientation,
	type ChatComposerPurpose,
} from "./components/ChatComposerOrientation";
import { ChatExpenseRightPanelContent } from "./components/ChatExpenseRightPanelContent";
import type { ChatSpacesSidebarProps } from "./components/ChatSpacesSidebar";
import { ChatToastPortal } from "./components/ChatToastPortal";
import { DeleteChatMessageDialog } from "./components/DeleteChatMessageDialog";
import {
	isDraftExpenseSystemMessage,
	isRecurringExpenseChatMessage,
} from "./components/DraftExpenseBoilerplateCaption";
import { FirstChatQuickActions } from "./components/FirstChatQuickActions";
import { NativeChatMessageList } from "./components/NativeChatMessageList";
import { NativeChatSpaceSurface } from "./components/NativeChatSpaceSurface";
import { NativeChatWorkspace } from "./components/NativeChatWorkspace";
import {
	type ComposerPurpose,
	SmartTextareaComposer,
	type SmartTextareaComposerHandle,
} from "./components/SmartTextareaComposer";
import { SpaceExpensesWorkspace } from "./components/SpaceExpensesWorkspace";
import type { ThreadDeepLink } from "./components/ThreadDiscussionRichText";
import { useNativeChatComposerActions } from "./hooks/useNativeChatComposerActions";
import { useNativeChatVoiceRecorder } from "./hooks/useNativeChatVoiceRecorder";
import { useSpaceExpensesWorkspaceState } from "./hooks/useSpaceExpensesWorkspaceState";
import {
	asChronological,
	isMainChatUnread,
	maxMessageIdInList,
	messageIdCompare,
	readLastReadMain,
	writeLastReadMain,
} from "./lib/mainChatRead";
import type {
	ChatLogLocationState,
	SelectSpaceOptions,
} from "./model/chatLogLocation";
import { PARSE_DUMMY_TEST_SNIPPETS } from "./parseDummySnippets";

const DEFAULT_LIMIT = 50;

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
	const [composerPurpose, setComposerPurpose] =
		useState<ChatComposerPurpose>("message");
	const setNativeComposerPurpose = useCallback(
		(purpose: ChatComposerPurpose) => {
			setComposerPurpose(purpose);
			setComposerMode(purpose === "message" ? "message" : "capture");
		},
		[],
	);
	const handleComposerPurposeChange = useCallback(
		(purpose: ComposerPurpose) => {
			setNativeComposerPurpose(purpose);
		},
		[setNativeComposerPurpose],
	);
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
	const { beginRecording, cancelRecording, isRecording, stopRecording } =
		useNativeChatVoiceRecorder({ onError: setErrorMessage });

	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();
	const isExpensesRoute = location.pathname.startsWith(
		"/console/chat/expenses",
	);
	/** Dedupe processing the same `?invite=` token from the URL in one session. */
	const lastUrlInviteTokenProcessedRef = useRef<string | null>(null);
	/** Dedupe opening the same expense detail deep link from the Expenses URL. */
	const lastExpenseDetailLinkProcessedRef = useRef<string | null>(null);
	/** When true, auto-run accept invite once workspace + WS are ready (from invite link). */
	const autoAcceptInviteFromUrlRef = useRef(false);
	const workspaceScopeRef = useRef<ChatWorkspaceScope | null>(null);
	const prevWorkspaceTenantRef = useRef<number | null>(null);
	const openExpenseInspectorPanel = useCallback(() => {
		setRightSidebarExpanded(true);
	}, [setRightSidebarExpanded]);

	const {
		clearDraftLineScroll,
		clearExpenseThread,
		closeExpenseThread,
		expenseInspectorWorkspaceEditing,
		expenseThreadCtrl,
		loadSpaceTransactions,
		openExpenseThread,
		selectExpense,
		setExpenseInspectorWorkspaceEditing,
		sidebarThreadExpenseId,
		spaceTransactions,
		spaceTransactionsError,
		spaceTransactionsLoading,
		threadDraftLineScroll,
	} = useSpaceExpensesWorkspaceState({
		isExpensesRoute,
		onOpenInspector: openExpenseInspectorPanel,
		selectedSpaceId,
	});

	const { handleComposerSubmit, parseVoiceBlob, sendVoiceBlobAsChatMessage } =
		useNativeChatComposerActions({
			loadSpaceTransactions,
			patchSpaces,
			selectedSpaceId,
			setComposerPurpose: setNativeComposerPurpose,
			setErrorMessage,
			setIsLoading,
			setMessages,
			setOldestMessageId,
			setStickToLatest,
		});

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
		clearExpenseThread();
		setLatestMainMessageIdBySpace({});
		setErrorMessage(null);
	}, [workspaceScope, clearExpenseThread]);

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
	const hasMultipleMembers = useMemo(
		() => (members?.length ?? 0) > 1,
		[members],
	);

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
			clearExpenseThread();
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
			setNativeComposerPurpose("message");
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
				setNativeComposerPurpose("message");
				openExpenseThread(opts.openThreadExpenseId, {
					draftLine:
						opts.openThreadDraftLine != null && opts.openThreadDraftLine >= 1
							? opts.openThreadDraftLine
							: null,
				});
			}
			const sidNum = Number(spaceId);
			if (Number.isFinite(sidNum) && sidNum > 0) touchRecentSpaceId(sidNum);
		} catch (err) {
			quickCaptureIntentRef.current = null;
			setMembers(null);
			setCanManageMemberRoles(false);
			setMessages(null);
			clearExpenseThread();
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
			setNativeComposerPurpose("message");
			openExpenseThread(expenseId);
		},
		[openExpenseThread, setNativeComposerPurpose],
	);

	const handleDraftLineScrollConsumed = useCallback(() => {
		clearDraftLineScroll();
	}, [clearDraftLineScroll]);

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
		setNativeComposerPurpose("message");
		openExpenseThread(eid, { draftLine: draftLine ?? null });
	}, [
		location.hash,
		location.pathname,
		location.search,
		location.state,
		navigate,
		openExpenseThread,
		setNativeComposerPurpose,
	]);

	useEffect(() => {
		if (!isExpensesRoute) {
			lastExpenseDetailLinkProcessedRef.current = null;
			return;
		}
		if (!scopeResolutionDone || !workspaceScope) return;

		const expenseId = searchParams.get("expenseId")?.trim();
		if (!expenseId) {
			lastExpenseDetailLinkProcessedRef.current = null;
			return;
		}

		const rawSpaceId = searchParams.get("spaceId")?.trim();
		const targetSpaceId = rawSpaceId || selectedSpaceId;
		if (targetSpaceId == null) return;

		const rawLine = searchParams.get("line")?.trim();
		const parsedLine = rawLine ? Number.parseInt(rawLine, 10) : Number.NaN;
		const draftLine =
			Number.isFinite(parsedLine) && parsedLine >= 1 ? parsedLine : undefined;
		const linkKey = `${String(targetSpaceId)}:${expenseId}:${draftLine ?? ""}`;
		if (
			lastExpenseDetailLinkProcessedRef.current === linkKey &&
			sidebarThreadExpenseId != null &&
			String(sidebarThreadExpenseId) === String(expenseId)
		) {
			return;
		}
		lastExpenseDetailLinkProcessedRef.current = linkKey;

		if (rawSpaceId && String(selectedSpaceId) !== String(rawSpaceId)) {
			void handleSelectSpace(rawSpaceId, {
				openThreadExpenseId: expenseId,
				...(draftLine != null ? { openThreadDraftLine: draftLine } : {}),
			});
			return;
		}

		setNativeComposerPurpose("message");
		openExpenseThread(expenseId, { draftLine: draftLine ?? null });
	}, [
		isExpensesRoute,
		scopeResolutionDone,
		workspaceScope,
		searchParams,
		selectedSpaceId,
		sidebarThreadExpenseId,
		openExpenseThread,
		setNativeComposerPurpose,
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

	useEffect(() => {
		const st = location.state as ChatLogLocationState | null;
		const draftText = st?.composerDraftText?.trim();
		if (!draftText || selectedSpaceId == null) return;
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
		setNativeComposerPurpose("message");
		smartComposerRef.current?.composeText("message_text", draftText);
	}, [
		location.hash,
		location.pathname,
		location.search,
		location.state,
		navigate,
		selectedSpaceId,
		setNativeComposerPurpose,
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

	const handleToggleRecording = async () => {
		if (isRecording) {
			const result = await stopRecording();
			if (!result) return;
			if (result.forMessage) {
				await sendVoiceBlobAsChatMessage(result.blob);
			} else {
				await parseVoiceBlob(result.blob);
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
			setNativeComposerPurpose("capture");
		} else {
			setNativeComposerPurpose("message");
		}
	}, [multiUserSpace, setNativeComposerPurpose]);

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
		cancelRecording();
	}, [composerMode, cancelRecording]);

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
				clearExpenseThread();
				setSelectedSpaceId(id);
			},
			onClearThread: clearExpenseThread,
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
		clearExpenseThread,
	]);

	useEffect(() => {
		setChatSidebarProps(chatSidebarBridgeProps);
	}, [chatSidebarBridgeProps, setChatSidebarProps]);

	useEffect(() => () => setChatSidebarProps(null), [setChatSidebarProps]);

	const handleCloseSidebarThread = useCallback(() => {
		closeExpenseThread();
	}, [closeExpenseThread]);

	const handleSelectExpenseFromPanel = useCallback(
		(expenseId: string | number) => {
			selectExpense(expenseId);
		},
		[selectExpense],
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
			setNativeComposerPurpose("message");
			openExpenseThread(link.expenseId, { draftLine: draftLine ?? null });
		},
		[selectedSpaceId, openExpenseThread, setNativeComposerPurpose],
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

	if (isExpensesRoute) {
		return (
			<SpaceExpensesWorkspace
				currentUserId={currentUserId}
				errorMessage={errorMessage}
				expenseInspectorWorkspaceEditing={expenseInspectorWorkspaceEditing}
				expenseRightPanel={expenseRightPanel}
				listError={spaceTransactionsError}
				listLoading={spaceTransactionsLoading}
				onReload={() => void loadSpaceTransactions()}
				onSelectExpense={handleSelectExpenseFromPanel}
				selectedExpenseId={sidebarThreadExpenseId}
				selectedSpaceId={selectedSpaceId}
				spaceName={selectedSpace?.name ?? null}
				spaceTransactions={spaceTransactions}
				toastMessage={toastMessage}
			/>
		);
	}

	const nativeChatHomeState = multiUserSpace
		? "message_text"
		: "expense_method_select";

	return (
		<NativeChatWorkspace
			errorMessage={errorMessage}
			feedbackSlot={
				<>
					<ChatToastPortal message={toastMessage} />
					<DeleteChatMessageDialog
						busy={deleteMessageBusy}
						message={pendingDeleteMessage}
						onCancel={() => setPendingDeleteMessage(null)}
						onConfirm={(message) => void handleDeleteOneMessage(message)}
					/>
				</>
			}
			onRightSidebarExpandedChange={setRightSidebarExpanded}
			rightRail={expenseRightPanel}
			rightSidebarExpanded={rightSidebarExpanded}
			rightSidebarTitle="Expenses"
			rightSidebarWorkSurfaceActive={false}
		>
			{selectedSpaceId ? (
				<NativeChatSpaceSurface
					composerSlot={
						<>
							<ChatCaptureReviewEvents
								refreshKey={messages?.length ?? 0}
								spaceId={selectedSpaceId}
								spaceName={selectedSpace?.name ?? null}
							/>
							<ChatComposerOrientation
								composerPurpose={composerPurpose}
								disabled={isLoading || !selectedSpaceId}
								isSharedSpace={hasMultipleMembers}
								onAskClick={() => {
									handleComposerPurposeChange("ask");
									smartComposerRef.current?.navigateTo("ask_topic_select");
								}}
								onCaptureClick={() => {
									handleComposerPurposeChange("capture");
									smartComposerRef.current?.navigateTo("expense_method_select");
								}}
								onMessageClick={() => {
									handleComposerPurposeChange("message");
									smartComposerRef.current?.navigateTo("message_text");
								}}
								spaceName={selectedSpace?.name ?? null}
							/>
							<SmartTextareaComposer
								ref={smartComposerRef}
								disabled={isLoading || !selectedSpaceId}
								homeState={nativeChatHomeState}
								isRecording={isRecording}
								onCancelRecording={cancelRecording}
								onComposerSubmit={(p) => void handleComposerSubmit(p)}
								onPurposeChange={handleComposerPurposeChange}
								onStartExpenseRecording={() => void beginRecording(false)}
								onStopRecording={handleToggleRecording}
								spaceId={selectedSpaceId}
							/>
						</>
					}
					hasMore={hasMore}
					loadOlderDisabled={isLoading || !selectedSpaceId || !oldestMessageId}
					messagesEndRef={messagesEndRef}
					messagesScrollRef={messagesScrollRef}
					onJumpToLatest={handleJumpToLatest}
					onLoadOlder={() => void handleLoadOlder()}
					onMessagesScroll={handleMessagesScroll}
					quickActionsSlot={
						showFirstChatQuickStrip ? (
							<FirstChatQuickActions
								actions={firstChatQuick?.quick_actions ?? []}
								onAction={handleFirstChatQuickAction}
							/>
						) : null
					}
					showJumpToLatest={showJumpToLatest}
				>
					<NativeChatMessageList
						canDeleteMessage={canDeleteMessage}
						canEditMessage={canEditMessage}
						chatWorkspace={workspaceScope}
						editingMessageId={editingMessageId}
						editingMessageText={editingMessageText}
						formatDateTime={formatDateTime}
						getMessageSenderLabel={getMessageSenderLabel}
						isLoading={isLoading}
						messages={messages}
						onCancelEditMessage={handleCancelEditMessage}
						onDeleteMessageRequest={setPendingDeleteMessage}
						onEditMessageTextChange={setEditingMessageText}
						onOpenExpenseThread={openExpenseInSidebar}
						onOpenThreadLink={handleOpenThreadLinkFromMainChat}
						onRelatedResourceGone={handleRelatedResourceGone}
						onSaveEditMessage={() => void handleSaveEditMessage()}
						onStartEditMessage={(message) => {
							setEditingMessageId(message.id);
							setEditingMessageText(message.text ?? "");
						}}
						selectedSpaceId={selectedSpaceId}
						sidebarThreadExpenseId={sidebarThreadExpenseId}
					/>
				</NativeChatSpaceSurface>
			) : (
				<div className="border-b border-border px-4 py-6 text-sm text-muted-foreground">
					Select a space to load messages and tools.
				</div>
			)}
		</NativeChatWorkspace>
	);
};
