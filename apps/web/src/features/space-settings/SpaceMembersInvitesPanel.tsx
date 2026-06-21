import type {
	Space,
	SpaceInviteSuggestionsResponse,
	SpaceMember,
} from "@cofi/api";
import { InviteParticipantIcon } from "@cofi/ceits-icons";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../shared/lib/apiClient";
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
	onClearSelectedExpense?: () => void;
} & SpaceMembersInvitesModel;

export const SpaceMembersInvitesPanel = ({
	selectedSpaceId,
	selectedSpace,
	currentUserId,
	isSpaceOwner,
	onClearSelectedExpense,
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
	handlePatchMemberRole,
	handleRemoveSpaceMember,
	handleCreateInvite,
	handleCreateTenantInvite,
	handleAcceptInvite,
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

	const openMemberDetails = useCallback(
		(m: SpaceMember) => {
			clearMemberRoleError();
			setMemberDetails(m);
			onClearSelectedExpense?.();
		},
		[clearMemberRoleError, onClearSelectedExpense],
	);

	return (
		<>
			<div className="grid gap-4">
				{inviteFeedback ? (
					<output className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800">
						{inviteFeedback}
					</output>
				) : null}
				{inviteError ? (
					<p
						className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
						role="alert"
					>
						{inviteError}
					</p>
				) : null}

				<section className="rounded-xl border border-border/70 bg-background/75 p-4">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h3 className="text-sm font-semibold tracking-tight">
								Current members
							</h3>
							<p className="mt-1 text-xs text-muted-foreground">
								Registered users who can open{" "}
								{selectedSpace?.name ?? "this space"}.
							</p>
						</div>
						<span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
							{members?.length ?? 0} active
						</span>
					</div>
					{members?.length ? (
						<ul className="mt-3 grid gap-2">
							{members.map((m) => (
								<li key={`${m.user_id}-${m.role}`}>
									<button
										className="group flex w-full items-center justify-between gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 text-left transition hover:border-border hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={() => openMemberDetails(m)}
										type="button"
									>
										<div className="min-w-0">
											<div className="truncate text-sm font-medium">
												{m.name || m.email || `user_${m.user_id}`}
											</div>
											<div className="truncate text-xs text-muted-foreground">
												{m.email ? m.email : `id ${m.user_id}`}
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
						<div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
							{selectedSpace ? "No members loaded." : "Select a space."}
						</div>
					)}
				</section>

				<section
					className="scroll-mt-4 rounded-xl border border-[rgba(82,104,86,0.22)] bg-[rgba(242,248,240,0.55)] p-4"
					id="chat-sidebar-invite-space"
				>
					<div>
						<h3 className="text-sm font-semibold tracking-tight">
							Invite someone
						</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							Search people from your shared-space circle, or type an email for
							a new invite.
						</p>
					</div>
					{canManageMemberRoles ? (
						<div className="mt-3 grid gap-2">
							<SpaceInviteCombobox
								disabled={isLoading || selectedSpaceId == null}
								onChange={setInviteEmail}
								pendingInvites={
									inviteSuggestions?.pending_invites_for_space ?? null
								}
								suggestions={inviteSuggestions?.suggestions ?? null}
								value={inviteEmail}
							/>
							<button
								className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
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
							{inviteToken ? (
								<InviteLinkSharePanel token={inviteToken} />
							) : null}
						</div>
					) : (
						<p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
							Only a tenant admin who is also the space owner can create space
							invites.
						</p>
					)}
				</section>

				<section className="rounded-xl border border-border/70 bg-background/75 p-4">
					<div>
						<h3 className="text-sm font-semibold tracking-tight">
							Pending invites
						</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							Outgoing invites you created for this space.
						</p>
					</div>
					<div className="mt-3">
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
						{canManageMemberRoles &&
						!(inviteSuggestions?.pending_invites_for_space ?? []).length ? (
							<p className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
								No pending invites from you in this space.
							</p>
						) : null}
					</div>
				</section>

				<section className="rounded-xl border border-border/70 bg-background/75 p-4">
					<div>
						<h3 className="text-sm font-semibold tracking-tight">
							Incoming invites
						</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							Invites addressed to your account, plus a manual token fallback.
						</p>
					</div>
					<div className="mt-3">
						<MyIncomingInvitesBlock
							disabled={isLoading}
							onAcceptInviteToken={async (token) => handleAcceptInvite(token)}
							refreshKey={incomingInvitesRefreshKey}
							selectedSpaceId={selectedSpaceId}
						/>
					</div>
					<div className="mt-3 grid gap-2 border-t border-border/60 pt-3">
						<label className="grid gap-1">
							<span className="text-xs font-medium text-muted-foreground">
								Accept invite token
							</span>
							<input
								aria-label="Invite token"
								className="h-10 rounded-md border border-border bg-background px-3 text-sm"
								onChange={(e) => setAcceptInviteToken(e.target.value)}
								placeholder="paste token..."
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
							Accept token
						</button>
					</div>
				</section>

				{isSpaceOwner && selectedSpace ? (
					<details className="rounded-xl border border-border/70 bg-background/75 p-4">
						<summary className="cursor-pointer text-sm font-semibold tracking-tight">
							Advanced organization invite
						</summary>
						<div className="mt-3 grid gap-2 border-t border-border/60 pt-3">
							<p className="text-[10px] leading-snug text-muted-foreground">
								Tenant-only invite for workspace access. It does not add the
								person to this space.
							</p>
							<label className="grid gap-1">
								<span className="text-xs font-medium text-muted-foreground">
									Email
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
									isLoading ||
									!tenantInviteEmail.trim() ||
									!selectedSpace.tenant_id
								}
								onClick={() => void handleCreateTenantInvite()}
								type="button"
							>
								Create organization invite
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
					</details>
				) : null}
			</div>

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
