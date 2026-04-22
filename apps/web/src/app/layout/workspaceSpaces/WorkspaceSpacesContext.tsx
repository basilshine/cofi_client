import type { Space } from "@cofi/api";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { ChatSpacesSidebarProps } from "../../../features/chatlog/components/ChatSpacesSidebar";
import { apiClient } from "../../../shared/lib/apiClient";
import {
	type ChatWorkspaceScope,
	writeChatWorkspaceScope,
} from "../../../shared/lib/chatWorkspaceScope";
import { notifyWorkspaceNavUpdated } from "../../../shared/lib/workspaceNavEvents";
import { wsClient } from "../../../shared/lib/wsClient";
const STORAGE_EXPANDED = "ceits.workspace.sidebarExpanded";
const STORAGE_RIGHT_EXPANDED = "ceits.workspace.rightSidebarExpanded";

type WorkspaceSpacesContextValue = {
	workspaceScope: ChatWorkspaceScope | null;
	spaces: Space[] | null;
	patchSpaces: (updater: (prev: Space[] | null) => Space[] | null) => void;
	isLoading: boolean;
	loadError: string | null;
	refreshSpaces: () => Promise<void>;
	sidebarExpanded: boolean;
	setSidebarExpanded: (next: boolean) => void;
	selectedSpaceId: string | number | null;
	setSelectedSpaceId: (id: string | number | null) => void;
	/** Chat route: unread indicator for space list */
	spaceHasUnread: (spaceId: string | number) => boolean;
	setSpaceHasUnread: (fn: (spaceId: string | number) => boolean) => void;
	/** When set, renders ChatSpacesSidebar (members, invites) below the space list */
	chatSidebarProps: ChatSpacesSidebarProps | null;
	setChatSidebarProps: (props: ChatSpacesSidebarProps | null) => void;
	/** Chat route: right panel (space expenses + thread) — same expand/collapse behavior as the left rail */
	rightSidebarExpanded: boolean;
	setRightSidebarExpanded: (next: boolean) => void;
	newSpaceName: string;
	setNewSpaceName: (v: string) => void;
	createSpace: () => Promise<void>;
	isCreatingSpace: boolean;
	createSpaceDialogOpen: boolean;
	setCreateSpaceDialogOpen: (open: boolean) => void;
};

const WorkspaceSpacesContext =
	createContext<WorkspaceSpacesContextValue | null>(null);

export const WorkspaceSpacesProvider = ({
	children,
}: { children: ReactNode }) => {
	const [workspaceScope, setWorkspaceScope] =
		useState<ChatWorkspaceScope | null>(null);
	const [spaces, setSpaces] = useState<Space[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selectedSpaceId, setSelectedSpaceIdState] = useState<
		string | number | null
	>(null);
	const [sidebarExpanded, setSidebarExpandedState] = useState(() => {
		try {
			return localStorage.getItem(STORAGE_EXPANDED) !== "0";
		} catch {
			return true;
		}
	});
	const [unreadFn, setUnreadFn] = useState<
		((spaceId: string | number) => boolean) | null
	>(null);
	const [chatSidebarProps, setChatSidebarProps] =
		useState<ChatSpacesSidebarProps | null>(null);
	const [rightSidebarExpanded, setRightSidebarExpandedState] = useState(() => {
		try {
			return localStorage.getItem(STORAGE_RIGHT_EXPANDED) !== "0";
		} catch {
			return true;
		}
	});
	const [newSpaceName, setNewSpaceName] = useState("");
	const [isCreatingSpace, setIsCreatingSpace] = useState(false);
	const [createSpaceDialogOpen, setCreateSpaceDialogOpen] = useState(false);

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_EXPANDED, sidebarExpanded ? "1" : "0");
		} catch {
			/* ignore */
		}
	}, [sidebarExpanded]);

	useEffect(() => {
		try {
			localStorage.setItem(
				STORAGE_RIGHT_EXPANDED,
				rightSidebarExpanded ? "1" : "0",
			);
		} catch {
			/* ignore */
		}
	}, [rightSidebarExpanded]);

	const setSidebarExpanded = useCallback((next: boolean) => {
		setSidebarExpandedState(next);
	}, []);

	const setRightSidebarExpanded = useCallback((next: boolean) => {
		setRightSidebarExpandedState(next);
	}, []);

	const setSelectedSpaceId = useCallback((id: string | number | null) => {
		setSelectedSpaceIdState(id);
	}, []);

	const setSpaceHasUnread = useCallback(
		(fn: (spaceId: string | number) => boolean) => {
			setUnreadFn(() => fn);
		},
		[],
	);

	const patchSpaces = useCallback(
		(updater: (prev: Space[] | null) => Space[] | null) => {
			setSpaces((prev) => updater(prev));
		},
		[],
	);

	const spaceHasUnread = useCallback(
		(spaceId: string | number) => unreadFn?.(spaceId) ?? false,
		[unreadFn],
	);

	const refreshSpaces = useCallback(async () => {
		setLoadError(null);
		if (workspaceScope?.kind !== "personal") {
			setSpaces(null);
			return;
		}
		setIsLoading(true);
		try {
			const list =
				(await apiClient.spaces.list({
					tenantId: workspaceScope.tenantId,
				})) ?? [];
			setSpaces(list);
			setSelectedSpaceIdState((prev) => {
				if (prev != null && list.some((s) => String(s.id) === String(prev))) {
					return prev;
				}
				return list[0]?.id ?? null;
			});
		} catch (e) {
			setSpaces([]);
			setLoadError(e instanceof Error ? e.message : "Failed to load spaces");
		} finally {
			setIsLoading(false);
		}
	}, [workspaceScope?.kind, workspaceScope?.tenantId]);

	const createSpace = useCallback(async () => {
		const name = newSpaceName.trim();
		if (!name || workspaceScope?.kind !== "personal") return;
		setIsCreatingSpace(true);
		setLoadError(null);
		try {
			await wsClient.connect();
			const created = await wsClient.rpc<Space>("spaces.create", { name });
			setNewSpaceName("");
			setLoadError(null);
			if (workspaceScope?.kind === "personal") {
				const list =
					(await apiClient.spaces.list({
						tenantId: workspaceScope.tenantId,
					})) ?? [];
				setSpaces(list);
				setSelectedSpaceIdState(created.id);
				setCreateSpaceDialogOpen(false);
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Failed to create space";
			setLoadError(msg);
			throw e;
		} finally {
			setIsCreatingSpace(false);
		}
	}, [newSpaceName, workspaceScope]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			setIsLoading(true);
			setLoadError(null);
			try {
				const res = await apiClient.dashboard.get({ variant: "personal" });
				if (cancelled) return;
				const tid = res.context.tenant_id;
				if (tid == null || !Number.isFinite(Number(tid))) {
					setWorkspaceScope(null);
					setSpaces(null);
					return;
				}
				const scope: ChatWorkspaceScope = {
					kind: "personal",
					tenantId: Number(tid),
					label: "Personal",
				};
				setWorkspaceScope(scope);
				writeChatWorkspaceScope(scope);
				notifyWorkspaceNavUpdated();
				const list =
					(await apiClient.spaces.list({ tenantId: Number(tid) })) ?? [];
				if (cancelled) return;
				setSpaces(list);
				setSelectedSpaceIdState((prev) => {
					if (prev != null && list.some((s) => String(s.id) === String(prev))) {
						return prev;
					}
					return list[0]?.id ?? null;
				});
			} catch (e) {
				if (!cancelled) {
					setLoadError(
						e instanceof Error ? e.message : "Failed to load workspace",
					);
					setWorkspaceScope(null);
					setSpaces(null);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const value = useMemo(
		(): WorkspaceSpacesContextValue => ({
			workspaceScope,
			spaces,
			patchSpaces,
			isLoading,
			loadError,
			refreshSpaces,
			sidebarExpanded,
			setSidebarExpanded,
			selectedSpaceId,
			setSelectedSpaceId,
			spaceHasUnread,
			setSpaceHasUnread,
			chatSidebarProps,
			setChatSidebarProps,
			rightSidebarExpanded,
			setRightSidebarExpanded,
			newSpaceName,
			setNewSpaceName,
			createSpace,
			isCreatingSpace,
			createSpaceDialogOpen,
			setCreateSpaceDialogOpen,
		}),
		[
			workspaceScope,
			spaces,
			patchSpaces,
			isLoading,
			loadError,
			refreshSpaces,
			sidebarExpanded,
			setSidebarExpanded,
			selectedSpaceId,
			setSelectedSpaceId,
			spaceHasUnread,
			setSpaceHasUnread,
			chatSidebarProps,
			rightSidebarExpanded,
			setRightSidebarExpanded,
			newSpaceName,
			createSpace,
			isCreatingSpace,
			createSpaceDialogOpen,
		],
	);

	return (
		<WorkspaceSpacesContext.Provider value={value}>
			{children}
		</WorkspaceSpacesContext.Provider>
	);
};

export const useWorkspaceSpaces = (): WorkspaceSpacesContextValue => {
	const ctx = useContext(WorkspaceSpacesContext);
	if (!ctx) {
		throw new Error(
			"useWorkspaceSpaces must be used within WorkspaceSpacesProvider",
		);
	}
	return ctx;
};
