import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import type { ChatSpacesSidebarProps } from "../../../features/chatlog/components/ChatSpacesSidebar";
import {
	useSpaceMembersInvites,
	useSpaceOwnerFromMembers,
} from "../../../features/space-settings/useSpaceMembersInvites";
import { useWorkspaceSpaces } from "./WorkspaceSpacesContext";

const SPACE_SETTINGS_PATH = /^\/console\/spaces\/[^/]+\/settings\/?(?:$|[?#])/;
const SPACE_CHAT_PATH = /^\/console\/spaces\/[^/]+\/chat\/?(?:$|[?#])/;

export const SpaceScopedMembersSidebarBridge = () => {
	const location = useLocation();
	const isSpaceSettingsRoute = SPACE_SETTINGS_PATH.test(location.pathname);
	const isSpaceChatRoute = SPACE_CHAT_PATH.test(location.pathname);

	const {
		workspaceScope,
		spaces,
		refreshSpaces,
		sidebarExpanded,
		setSidebarExpanded,
		selectedSpaceId,
		setSelectedSpaceId,
		setChatSidebarProps,
		newSpaceName,
		setNewSpaceName,
		createSpace,
		isCreatingSpace,
	} = useWorkspaceSpaces();
	const { user } = useAuth();

	const selectedSpace = useMemo(() => {
		if (!spaces || selectedSpaceId == null) return null;
		return spaces.find((s) => String(s.id) === String(selectedSpaceId)) ?? null;
	}, [spaces, selectedSpaceId]);

	const currentUserId = user?.id != null ? Number(user.id) : null;

	const membersModel = useSpaceMembersInvites({
		spaceId: selectedSpaceId,
		selectedSpace,
		enabled: Boolean(selectedSpaceId != null && !isSpaceSettingsRoute),
		onSpacesUpdated: refreshSpaces,
		onJoinedSpace: (space) => setSelectedSpaceId(space.id),
	});

	const isSpaceOwner = useSpaceOwnerFromMembers(
		membersModel.members,
		currentUserId,
	);
	const safeMembers = useMemo(
		() => membersModel.members ?? [],
		[membersModel.members],
	);

	const sidebarProps: ChatSpacesSidebarProps = useMemo(
		() => ({
			expanded: sidebarExpanded,
			onExpandedChange: setSidebarExpanded,
			workspaceScope:
				workspaceScope ??
				({
					kind: "personal",
					tenantId: Number(selectedSpace?.tenant_id ?? 0),
					label: "Personal",
				} as const),
			isLoading: membersModel.isLoading || isCreatingSpace,
			onRefreshSpaces: () => void membersModel.handleRefreshSpaces(),
			newSpaceName,
			onNewSpaceNameChange: setNewSpaceName,
			onCreateSpace: () => void createSpace(),
			spaces,
			selectedSpaceId,
			onSelectSpace: (id) => setSelectedSpaceId(id),
			onClearSelectedExpense: () => {},
			spaceHasUnread: () => false,
			selectedSpace,
			members: safeMembers,
			canManageMemberRoles: membersModel.canManageMemberRoles,
			currentUserId,
			onPatchMemberRole: membersModel.handlePatchMemberRole,
			memberRoleSaving: membersModel.memberRoleSaving,
			memberRoleError: membersModel.memberRoleError,
			onClearMemberRoleError: membersModel.clearMemberRoleError,
			inviteEmail: membersModel.inviteEmail,
			onInviteEmailChange: membersModel.setInviteEmail,
			onCreateInvite: () => void membersModel.handleCreateInvite(),
			inviteToken: membersModel.inviteToken,
			onRemoveSpaceMember: membersModel.handleRemoveSpaceMember,
			removeMemberSaving: membersModel.removeMemberSaving,
			isSpaceOwner,
			tenantInviteEmail: membersModel.tenantInviteEmail,
			onTenantInviteEmailChange: membersModel.setTenantInviteEmail,
			onCreateTenantInvite: () => void membersModel.handleCreateTenantInvite(),
			tenantInviteToken: membersModel.tenantInviteToken,
			acceptInviteToken: membersModel.acceptInviteToken,
			onAcceptInviteTokenChange: membersModel.setAcceptInviteToken,
			onAcceptInvite: () => void membersModel.handleAcceptInvite(),
			inviteSuggestionsNonce: membersModel.inviteSuggestionsNonce,
			incomingInvitesRefreshKey: membersModel.incomingInvitesRefreshKey,
			onAcceptInviteToken: async (token: string) => {
				await membersModel.handleAcceptInvite(token);
			},
			hideSpaceList: true,
			embedded: true,
		}),
		[
			sidebarExpanded,
			setSidebarExpanded,
			workspaceScope,
			selectedSpace,
			isCreatingSpace,
			safeMembers,
			membersModel.canManageMemberRoles,
			membersModel.memberRoleSaving,
			membersModel.memberRoleError,
			membersModel.clearMemberRoleError,
			membersModel.removeMemberSaving,
			membersModel.isLoading,
			membersModel.inviteEmail,
			membersModel.setInviteEmail,
			membersModel.inviteToken,
			membersModel.inviteSuggestionsNonce,
			membersModel.incomingInvitesRefreshKey,
			membersModel.tenantInviteEmail,
			membersModel.setTenantInviteEmail,
			membersModel.tenantInviteToken,
			membersModel.acceptInviteToken,
			membersModel.setAcceptInviteToken,
			membersModel.handleRefreshSpaces,
			membersModel.handlePatchMemberRole,
			membersModel.handleRemoveSpaceMember,
			membersModel.handleCreateInvite,
			membersModel.handleCreateTenantInvite,
			membersModel.handleAcceptInvite,
			newSpaceName,
			setNewSpaceName,
			createSpace,
			spaces,
			selectedSpaceId,
			setSelectedSpaceId,
			isSpaceOwner,
		],
	);

	const sidebarSignature = useMemo(
		() =>
			JSON.stringify({
				spaceId: selectedSpaceId == null ? null : String(selectedSpaceId),
				tenantId: workspaceScope?.tenantId ?? null,
				sidebarExpanded,
				isLoading: membersModel.isLoading || isCreatingSpace,
				membersCount: safeMembers.length,
				canManageMemberRoles: membersModel.canManageMemberRoles,
				memberRoleSaving: membersModel.memberRoleSaving,
				removeMemberSaving: membersModel.removeMemberSaving,
				inviteSuggestionsNonce: membersModel.inviteSuggestionsNonce,
				incomingInvitesRefreshKey: membersModel.incomingInvitesRefreshKey,
				memberRoleError: membersModel.memberRoleError ?? null,
				inviteEmail: membersModel.inviteEmail,
				tenantInviteEmail: membersModel.tenantInviteEmail,
				acceptInviteToken: membersModel.acceptInviteToken,
				newSpaceName,
				isSpaceOwner,
			}),
		[
			selectedSpaceId,
			workspaceScope?.tenantId,
			sidebarExpanded,
			membersModel.isLoading,
			isCreatingSpace,
			safeMembers.length,
			membersModel.canManageMemberRoles,
			membersModel.memberRoleSaving,
			membersModel.removeMemberSaving,
			membersModel.inviteSuggestionsNonce,
			membersModel.incomingInvitesRefreshKey,
			membersModel.memberRoleError,
			membersModel.inviteEmail,
			membersModel.tenantInviteEmail,
			membersModel.acceptInviteToken,
			newSpaceName,
			isSpaceOwner,
		],
	);
	const lastAppliedSignatureRef = useRef<string | null>(null);

	useEffect(() => {
		if (isSpaceChatRoute || isSpaceSettingsRoute) {
			lastAppliedSignatureRef.current = null;
			setChatSidebarProps(null);
			return;
		}

		if (lastAppliedSignatureRef.current === sidebarSignature) {
			return;
		}
		lastAppliedSignatureRef.current = sidebarSignature;
		setChatSidebarProps(sidebarProps);
	}, [
		isSpaceChatRoute,
		isSpaceSettingsRoute,
		sidebarProps,
		sidebarSignature,
		setChatSidebarProps,
	]);

	useEffect(
		() => () => {
			setChatSidebarProps(null);
		},
		[setChatSidebarProps],
	);

	return null;
};
