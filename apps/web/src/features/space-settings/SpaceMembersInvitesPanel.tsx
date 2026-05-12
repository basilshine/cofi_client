import type {
	Space,
	SpaceInviteSuggestionsResponse,
	SpaceMember,
} from "@cofi/api";
import { InviteParticipantIcon } from "@cofi/ceits-icons";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../shared/lib/apiClient";
import {
	ceitsSpaceExpenseAddUrl,
	ceitsSpaceExpensesListUrl,
} from "../../shared/lib/ceitsAppUrls";
import {
	InviteLinkSharePanel,
	MyIncomingInvitesBlock,
	SpaceInviteCombobox,
	SpaceMemberDetailsDialog,
	SpacePendingInvitesBlock,
} from "../../widgets/space-invite-management";
import type { SpaceMembersInvitesModel } from "./useSpaceMembersInvites";

export type SpaceMembersInvitesPanelProps = {
	selectedSpaceId: string | number | null;
	selectedSpace: Space | null;
	currentUserId: number | null;
	isSpaceOwner: boolean;
	onClearThread?: () => void;
} & SpaceMembersInvitesModel;

export const SpaceMembersInvitesPanel = ({
	selectedSpaceId,
	selectedSpace,
	currentUserId,
	isSpaceOwner,
	onClearThread,
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
	inviteSuggestionsNonce,
	incomingInvitesRefreshKey,
	tenantInviteEmail,
	setTenantInviteEmail,
	tenantInviteToken,
	acceptInviteToken,
	setAcceptInviteToken,
	hardPurgeFeedback,
	handlePatchMemberRole,
	handleRemoveSpaceMember,
	handleCreateInvite,
	handleCreateTenantInvite,
	handleAcceptInvite,
	handleHardPurgeAllMessages,
	handleRefreshSpaces,
}: SpaceMembersInvitesPanelProps) => {
	void handleRefreshSpaces;
	const [memberDetails, setMemberDetails] = useState<SpaceMember | null>(null);
	const [inviteSuggestions, setInviteSuggestions] =
		useState<SpaceInviteSuggestionsResponse | null>(null);

	const handleCloseMemberDetails = useCallback(() => {
		setMemberDetails(null);
		clearMemberRoleError();
	}, [clearMemberRoleError]);

	useEffect(() => {
		if (!memberDetails || !members?.length) return;
		const fresh = members.find(
			(x) => Number(x.user_id) === Number(memberDetails.user_id),
		);
		if (fresh) setMemberDetails(fresh);
	}, [members, memberDetails]);

	useEffect(() => {
		if (
			!canManageMemberRoles ||
			selectedSpaceId == null ||
			selectedSpace == null
		) {
			setInviteSuggestions(null);
			return;
		}
		let cancelled = false;
		const tid = Number(selectedSpace.tenant_id);
		const timer = window.setTimeout(() => {
			void (async () => {
				try {
					const res = await apiClient.spaces.inviteSuggestions(
						selectedSpaceId,
						{
							q: inviteEmail.trim() || undefined,
							tenantId: tid,
						},
					);
					if (!cancelled) setInviteSuggestions(res);
				} catch {
					if (!cancelled) setInviteSuggestions(null);
				}
			})();
		}, 280);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [
		canManageMemberRoles,
		inviteEmail,
		selectedSpace,
		selectedSpaceId,
		inviteSuggestionsNonce,
	]);

	const refetchInviteSuggestions = useCallback(async () => {
		if (
			!canManageMemberRoles ||
			selectedSpaceId == null ||
			selectedSpace == null
		) {
			setInviteSuggestions(null);
			return;
		}
		try {
			const res = await apiClient.spaces.inviteSuggestions(selectedSpaceId, {
				q: inviteEmail.trim() || undefined,
				tenantId: Number(selectedSpace.tenant_id),
			});
			setInviteSuggestions(res);
		} catch {
			setInviteSuggestions(null);
		}
	}, [canManageMemberRoles, inviteEmail, selectedSpace, selectedSpaceId]);

	const ceitsListUrl =
		selectedSpaceId != null ? ceitsSpaceExpensesListUrl(selectedSpaceId) : null;
	const ceitsAddUrl =
		selectedSpaceId != null ? ceitsSpaceExpenseAddUrl(selectedSpaceId) : null;

	const openMemberDetails = useCallback(
		(m: SpaceMember) => {
			clearMemberRoleError();
			setMemberDetails(m);
			onClearThread?.();
		},
		[clearMemberRoleError, onClearThread],
	);

	return (
		<>
			<MyIncomingInvitesBlock
				disabled={isLoading}
				onAcceptInviteToken={async (token) => handleAcceptInvite(token)}
				refreshKey={incomingInvitesRefreshKey}
				selectedSpaceId={selectedSpaceId}
			/>
			<div className="text-sm font-semibold tracking-tight">Members</div>
			{selectedSpace ? (
				<div className="text-xs text-muted-foreground">
					Space:{" "}
					<span className="font-medium text-foreground">
						{selectedSpace.name}
					</span>
				</div>
			) : null}

			{ceitsListUrl && ceitsAddUrl ? (
				<div className="rounded-lg border border-border/80 bg-muted/25 p-3">
					<div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						Ceits app
					</div>
					<p className="mt-1 text-[10px] leading-snug text-muted-foreground">
						Full expense editor and space vendors (opens in a new tab).
					</p>
					<div className="mt-2 flex flex-col gap-1.5">
						<a
							className="text-xs font-medium text-primary underline-offset-2 hover:underline"
							href={ceitsListUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							All expenses in this space
						</a>
						<a
							className="text-xs font-medium text-primary underline-offset-2 hover:underline"
							href={ceitsAddUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							Add expense
						</a>
					</div>
				</div>
			) : null}

			{members?.length ? (
				<ul className="space-y-1.5">
					{members.map((m) => (
						<li key={`${m.user_id}-${m.role}`}>
							<button
								className="group flex w-full items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-left transition hover:border-border hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={() => openMemberDetails(m)}
								type="button"
							>
								<div className="min-w-0">
									<div className="truncate text-sm font-medium">
										{m.name || m.email || `user_${m.user_id}`}
									</div>
									<div className="truncate text-xs text-muted-foreground">
										id {m.user_id}
										{m.email ? ` · ${m.email}` : ""}
									</div>
									<div className="mt-0.5 text-[10px] text-muted-foreground/90 opacity-0 transition-opacity group-hover:opacity-100">
										View role & permissions
									</div>
								</div>
								<span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
									{m.role}
								</span>
							</button>
						</li>
					))}
				</ul>
			) : (
				<div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
					{selectedSpace ? "No members loaded." : "Select a space."}
				</div>
			)}

			<SpacePendingInvitesBlock
				canManage={canManageMemberRoles}
				disabled={isLoading}
				onListChanged={refetchInviteSuggestions}
				pending={inviteSuggestions?.pending_invites_for_space ?? null}
				spaceId={selectedSpaceId}
				tenantId={
					selectedSpace != null ? Number(selectedSpace.tenant_id) : null
				}
			/>

			<div
				className="scroll-mt-4 grid gap-2 pt-1"
				id="chat-sidebar-invite-space"
			>
				{canManageMemberRoles ? (
					<>
						<div className="grid gap-1">
							<span className="text-xs font-medium text-muted-foreground">
								Invite by email (tenant admin + space owner)
							</span>
							<SpaceInviteCombobox
								disabled={isLoading || selectedSpaceId == null}
								onChange={setInviteEmail}
								pendingInvites={
									inviteSuggestions?.pending_invites_for_space ?? null
								}
								suggestions={inviteSuggestions?.suggestions ?? null}
								value={inviteEmail}
							/>
						</div>
						<button
							className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
							disabled={isLoading || !selectedSpaceId || !inviteEmail.trim()}
							onClick={() => void handleCreateInvite()}
							type="button"
						>
							<InviteParticipantIcon
								className="h-4 w-4 shrink-0 opacity-90"
								size={16}
							/>
							Create invite
						</button>
						{inviteToken ? <InviteLinkSharePanel token={inviteToken} /> : null}
					</>
				) : (
					<p className="text-[11px] leading-relaxed text-muted-foreground">
						Only a tenant admin who is also the space owner can create space
						invites. You can still accept an invite below if you have a token.
					</p>
				)}
			</div>

			{isSpaceOwner && selectedSpace ? (
				<div className="grid gap-2 border-t border-border pt-3">
					<div className="text-xs font-medium text-muted-foreground">
						Invite to organization (tenant)
					</div>
					<p className="text-[10px] leading-snug text-muted-foreground">
						Targets tenant{" "}
						<span className="font-mono">{selectedSpace.tenant_id}</span> from
						this space — do not edit. Requires tenant admin; otherwise the
						server returns 403.
					</p>
					<label className="grid gap-1">
						<span className="text-xs font-medium text-muted-foreground">
							Email (tenant-only invite)
						</span>
						<input
							aria-label="Tenant invite email"
							className="h-10 rounded-md border border-border bg-background px-3 text-sm"
							onChange={(e) => setTenantInviteEmail(e.target.value)}
							placeholder="colleague@example.com"
							type="email"
							value={tenantInviteEmail}
						/>
					</label>
					<button
						className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
						disabled={
							isLoading || !tenantInviteEmail.trim() || !selectedSpace.tenant_id
						}
						onClick={() => void handleCreateTenantInvite()}
						type="button"
					>
						Create tenant invite
					</button>
					{tenantInviteToken ? (
						<div className="rounded-lg border border-border bg-muted p-3 text-xs">
							<div className="text-[10px] font-semibold text-muted-foreground">
								Tenant invite token
							</div>
							<div className="mt-1 break-all font-mono">
								{tenantInviteToken}
							</div>
						</div>
					) : null}
				</div>
			) : null}

			<div className="grid gap-2">
				<label className="grid gap-1">
					<span className="text-xs font-medium text-muted-foreground">
						Accept invite (paste token)
					</span>
					<input
						aria-label="Invite token"
						className="h-10 rounded-md border border-border bg-background px-3 text-sm"
						onChange={(e) => setAcceptInviteToken(e.target.value)}
						placeholder="invite token…"
						type="text"
						value={acceptInviteToken}
					/>
				</label>
				<button
					className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
					disabled={isLoading || !acceptInviteToken.trim()}
					onClick={() => void handleAcceptInvite()}
					type="button"
				>
					Accept invite
				</button>
			</div>

			{isSpaceOwner && selectedSpaceId ? (
				<div className="mt-4 border-t border-border pt-4">
					<div className="text-xs font-semibold text-destructive">
						Danger zone
					</div>
					<p className="mt-2 text-xs text-muted-foreground">
						Permanently remove every chat line in this space. Does not delete
						expenses or transactions. Requires server permission (see{" "}
						<code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
							ALLOW_HARD_PURGE_ALL_MESSAGES
						</code>{" "}
						in production).
					</p>
					<button
						aria-label="Clear all chat messages in this space"
						className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border border-destructive/50 bg-background px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
						disabled={isLoading}
						onClick={() => void handleHardPurgeAllMessages()}
						type="button"
					>
						Clear all chat messages
					</button>
					{hardPurgeFeedback ? (
						<output
							aria-live="polite"
							className="mt-2 block text-xs font-medium text-emerald-700 dark:text-emerald-400"
						>
							{hardPurgeFeedback}
						</output>
					) : null}
				</div>
			) : null}

			<SpaceMemberDetailsDialog
				canManageMemberRoles={canManageMemberRoles}
				currentUserId={currentUserId}
				errorMessage={memberRoleError}
				isSaving={memberRoleSaving}
				member={memberDetails}
				onClose={handleCloseMemberDetails}
				onRemoveFromSpace={handleRemoveSpaceMember}
				onSaveRole={handlePatchMemberRole}
				open={memberDetails != null}
				removeMemberSaving={removeMemberSaving}
			/>
		</>
	);
};
