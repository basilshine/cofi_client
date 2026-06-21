import type { Space, SpaceMember, SpaceRole } from "@cofi/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/lib/apiClient";

export type UseSpaceMembersInvitesArgs = {
	spaceId: string | number | null;
	selectedSpace: Space | null;
	enabled: boolean;
	onSpacesUpdated?: () => Promise<void>;
	onJoinedSpace?: (space: Space) => void;
};

export const useSpaceMembersInvites = ({
	spaceId,
	selectedSpace,
	enabled,
	onSpacesUpdated,
	onJoinedSpace,
}: UseSpaceMembersInvitesArgs) => {
	const [members, setMembers] = useState<SpaceMember[] | null>(null);
	const [canManageMemberRoles, setCanManageMemberRoles] = useState(false);
	const [memberRoleSaving, setMemberRoleSaving] = useState(false);
	const [memberRoleError, setMemberRoleError] = useState<string | null>(null);
	const [removeMemberSaving, setRemoveMemberSaving] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [inviteEmail, setInviteEmailState] = useState("");
	const setInviteEmail = useCallback((v: string) => {
		setInviteEmailState(v);
	}, []);
	const [inviteToken, setInviteToken] = useState<string | null>(null);
	const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
	const [inviteError, setInviteError] = useState<string | null>(null);
	const [inviteSuggestionsNonce, setInviteSuggestionsNonce] = useState(0);
	const [incomingInvitesRefreshKey, setIncomingInvitesRefreshKey] = useState(0);
	const [tenantInviteEmail, setTenantInviteEmailState] = useState("");
	const setTenantInviteEmail = useCallback((v: string) => {
		setTenantInviteEmailState(v);
	}, []);
	const [tenantInviteToken, setTenantInviteToken] = useState<string | null>(
		null,
	);
	const [acceptInviteToken, setAcceptInviteTokenState] = useState("");
	const setAcceptInviteToken = useCallback((v: string) => {
		setAcceptInviteTokenState(v);
	}, []);

	const loadMembers = useCallback(async () => {
		if (!enabled || spaceId == null) {
			setMembers(null);
			setCanManageMemberRoles(false);
			return;
		}
		setIsLoading(true);
		try {
			const res = await apiClient.spaces.listMembers(spaceId);
			setMembers(res.members ?? []);
			setCanManageMemberRoles(Boolean(res.can_manage_member_roles));
		} catch (e) {
			setMembers(null);
			setCanManageMemberRoles(false);
			setMemberRoleError(
				e instanceof Error ? e.message : "Failed to load members",
			);
		} finally {
			setIsLoading(false);
		}
	}, [enabled, spaceId]);

	useEffect(() => {
		void loadMembers();
	}, [loadMembers]);

	const handleRefreshSpaces = useCallback(async () => {
		if (!onSpacesUpdated) return;
		setIsLoading(true);
		try {
			await onSpacesUpdated();
			setIncomingInvitesRefreshKey((k) => k + 1);
		} finally {
			setIsLoading(false);
		}
	}, [onSpacesUpdated]);

	const handlePatchMemberRole = useCallback(
		async (userId: number, role: Exclude<SpaceRole, "owner">) => {
			if (spaceId == null) return;
			setMemberRoleSaving(true);
			setMemberRoleError(null);
			try {
				const updated = await apiClient.spaces.patchMemberRole(
					spaceId,
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
		[spaceId],
	);

	const handleRemoveSpaceMember = useCallback(
		async (userId: number): Promise<boolean> => {
			if (spaceId == null) return false;
			setRemoveMemberSaving(true);
			setMemberRoleError(null);
			try {
				await apiClient.spaces.removeMember(spaceId, userId);
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
				setRemoveMemberSaving(false);
			}
		},
		[spaceId],
	);

	const handleCreateInvite = useCallback(async () => {
		if (spaceId == null) return;
		const email = inviteEmail.trim();
		if (!email) return;
		setIsLoading(true);
		setInviteFeedback(null);
		setInviteError(null);
		try {
			const res = await apiClient.spaces.createInvite(spaceId, { email });
			setInviteToken(res.token ?? null);
			setInviteFeedback(`Invite created for ${email}.`);
			setInviteEmailState("");
			setInviteSuggestionsNonce((n) => n + 1);
		} catch (e) {
			setInviteError(
				e instanceof Error ? e.message : "Could not create invite",
			);
		} finally {
			setIsLoading(false);
		}
	}, [spaceId, inviteEmail]);

	const handleCreateTenantInvite = useCallback(async () => {
		if (selectedSpace == null) return;
		const email = tenantInviteEmail.trim();
		if (!email) return;
		setIsLoading(true);
		try {
			const res = await apiClient.tenants.createInvite(
				selectedSpace.tenant_id,
				{
					email,
					channel: "email",
				},
			);
			setTenantInviteToken(res.token ?? null);
			setTenantInviteEmailState("");
		} finally {
			setIsLoading(false);
		}
	}, [selectedSpace, tenantInviteEmail]);

	const handleAcceptInvite = useCallback(
		async (tokenOverride?: string) => {
			const token = (tokenOverride ?? acceptInviteToken).trim();
			if (!token) return;
			setIsLoading(true);
			try {
				const outcome = await apiClient.spaces.acceptInvite(token);
				setAcceptInviteTokenState("");
				if (onSpacesUpdated) await onSpacesUpdated();
				setIncomingInvitesRefreshKey((k) => k + 1);
				if (outcome.kind === "space" && onJoinedSpace) {
					onJoinedSpace(outcome.space);
					setInviteFeedback(`Joined ${outcome.space.name}.`);
				} else {
					setInviteFeedback("Joined organization. Spaces refreshed.");
				}
			} catch (e) {
				setInviteError(
					e instanceof Error ? e.message : "Could not accept invite",
				);
			} finally {
				setIsLoading(false);
			}
		},
		[acceptInviteToken, onJoinedSpace, onSpacesUpdated],
	);

	const clearMemberRoleError = useCallback(() => setMemberRoleError(null), []);

	return {
		members,
		canManageMemberRoles,
		memberRoleSaving,
		memberRoleError,
		clearMemberRoleError,
		removeMemberSaving,
		isLoading,
		inviteEmail,
		setInviteEmail,
		inviteToken,
		inviteFeedback,
		inviteError,
		inviteSuggestionsNonce,
		incomingInvitesRefreshKey,
		tenantInviteEmail,
		setTenantInviteEmail,
		tenantInviteToken,
		acceptInviteToken,
		setAcceptInviteToken,
		handleRefreshSpaces,
		handlePatchMemberRole,
		handleRemoveSpaceMember,
		handleCreateInvite,
		handleCreateTenantInvite,
		handleAcceptInvite,
	};
};

export type SpaceMembersInvitesModel = ReturnType<
	typeof useSpaceMembersInvites
>;

export const useSpaceOwnerFromMembers = (
	members: SpaceMember[] | null,
	currentUserId: number | null,
) => {
	return useMemo(() => {
		if (!members?.length || currentUserId == null) return false;
		return members.some(
			(m) => Number(m.user_id) === currentUserId && m.role === "owner",
		);
	}, [members, currentUserId]);
};
