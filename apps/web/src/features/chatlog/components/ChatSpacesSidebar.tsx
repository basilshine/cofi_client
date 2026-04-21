import type {
	Space,
	SpaceInviteSuggestionsResponse,
	SpaceMember,
	SpaceRole,
} from "@cofi/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../shared/lib/apiClient";
import {
	ceitsSpaceExpenseAddUrl,
	ceitsSpaceExpensesListUrl,
} from "../../../shared/lib/ceitsAppUrls";
import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";
import { InviteLinkSharePanel } from "./InviteLinkSharePanel";
import { MyIncomingInvitesBlock } from "./MyIncomingInvitesBlock";
import { SpaceInviteCombobox } from "./SpaceInviteCombobox";
import { SpaceMemberDetailsDialog } from "./SpaceMemberDetailsDialog";
import { SpacePendingInvitesBlock } from "./SpacePendingInvitesBlock";

const IconPanelOpen = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>Expand sidebar</title>
		<path
			d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 12H9M18 8l4 4-4 4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconPanelClose = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>Collapse sidebar</title>
		<path
			d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M9 12h10M6 8l-4 4 4 4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconUserPlus = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>Add member</title>
		<path
			d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM20 8v6M23 11h-6"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconPlusSquare = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>New space</title>
		<rect height="18" rx="2" width="18" x="3" y="3" />
		<path d="M12 8v8M8 12h8" strokeLinecap="round" />
	</svg>
);

export type ChatSpacesSidebarProps = {
	expanded: boolean;
	onExpandedChange: (next: boolean) => void;
	workspaceScope: ChatWorkspaceScope;
	isLoading: boolean;
	onRefreshSpaces: () => void;
	newSpaceName: string;
	onNewSpaceNameChange: (v: string) => void;
	onCreateSpace: () => void;
	spaces: Space[] | null;
	selectedSpaceId: string | number | null;
	onSelectSpace: (id: string | number) => void;
	onClearThread: () => void;
	spaceHasUnread: (spaceId: string | number) => boolean;
	selectedSpace: Space | null;
	members: SpaceMember[] | null;
	/** From GET /spaces/:id/members — tenant admin + space owner. */
	canManageMemberRoles: boolean;
	currentUserId: number | null;
	onPatchMemberRole: (
		userId: number,
		role: Exclude<SpaceRole, "owner">,
	) => Promise<void>;
	memberRoleSaving: boolean;
	memberRoleError: string | null;
	onClearMemberRoleError: () => void;
	inviteEmail: string;
	onInviteEmailChange: (v: string) => void;
	onCreateInvite: () => void;
	inviteToken: string | null;
	/** Tenant admin + space owner; same gate as invite creation. */
	onRemoveSpaceMember: (userId: number) => Promise<boolean>;
	removeMemberSaving: boolean;
	isSpaceOwner: boolean;
	tenantInviteEmail: string;
	onTenantInviteEmailChange: (v: string) => void;
	onCreateTenantInvite: () => void;
	tenantInviteToken: string | null;
	acceptInviteToken: string;
	onAcceptInviteTokenChange: (v: string) => void;
	onAcceptInvite: () => void;
	onHardPurgeAllMessages: () => void;
	hardPurgeFeedback: string | null;
	/** Bumps invite-suggestions refetch after creating an invite. */
	inviteSuggestionsNonce: number;
	/** Bumps incoming-invites refetch (e.g. after loading spaces). */
	incomingInvitesRefreshKey: number;
	/** Accept an invite by token (same as paste flow); used for “Your invites” actions. */
	onAcceptInviteToken: (token: string) => Promise<void>;
	/** Hide space list / create (shown in workspace nav). */
	hideSpaceList?: boolean;
	/** Render as panel inside a parent sidebar (no outer aside chrome). */
	embedded?: boolean;
};

const spaceInitial = (name: string) => {
	const t = name.trim();
	if (!t) return "?";
	return t.charAt(0).toUpperCase();
};

const memberInitial = (m: SpaceMember) => {
	const n = m.name?.trim() || m.email?.trim() || "";
	if (n) return n.charAt(0).toUpperCase();
	return String(m.user_id).slice(-1);
};

export const ChatSpacesSidebar = (props: ChatSpacesSidebarProps) => {
	const {
		expanded,
		onExpandedChange,
		workspaceScope,
		isLoading,
		onRefreshSpaces,
		newSpaceName,
		onNewSpaceNameChange,
		onCreateSpace,
		spaces,
		selectedSpaceId,
		onSelectSpace,
		onClearThread,
		spaceHasUnread,
		selectedSpace,
		members,
		canManageMemberRoles,
		currentUserId,
		onPatchMemberRole,
		memberRoleSaving,
		memberRoleError,
		onClearMemberRoleError,
		inviteEmail,
		onInviteEmailChange,
		onCreateInvite,
		inviteToken,
		onRemoveSpaceMember,
		removeMemberSaving,
		isSpaceOwner,
		tenantInviteEmail,
		onTenantInviteEmailChange,
		onCreateTenantInvite,
		tenantInviteToken,
		acceptInviteToken,
		onAcceptInviteTokenChange,
		onAcceptInvite,
		onHardPurgeAllMessages,
		hardPurgeFeedback,
		inviteSuggestionsNonce,
		incomingInvitesRefreshKey,
		onAcceptInviteToken,
		hideSpaceList = false,
		embedded = false,
	} = props;

	const [memberDetails, setMemberDetails] = useState<SpaceMember | null>(null);
	const [inviteSuggestions, setInviteSuggestions] =
		useState<SpaceInviteSuggestionsResponse | null>(null);

	const handleCloseMemberDetails = useCallback(() => {
		setMemberDetails(null);
		onClearMemberRoleError();
	}, [onClearMemberRoleError]);

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

	const expandTo = useCallback(
		(anchorId: string) => {
			onExpandedChange(true);
			window.requestAnimationFrame(() => {
				window.setTimeout(() => {
					document.getElementById(anchorId)?.scrollIntoView({
						behavior: "smooth",
						block: "start",
					});
				}, 80);
			});
		},
		[onExpandedChange],
	);

	const ceitsListUrl = useMemo(
		() =>
			selectedSpaceId != null
				? ceitsSpaceExpensesListUrl(selectedSpaceId)
				: null,
		[selectedSpaceId],
	);
	const ceitsAddUrl = useMemo(
		() =>
			selectedSpaceId != null ? ceitsSpaceExpenseAddUrl(selectedSpaceId) : null,
		[selectedSpaceId],
	);

	const fullBody = (
		<div className="flex min-h-0 flex-1 flex-col gap-0">
			{hideSpaceList ? null : (
				<div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 pb-3">
					<div className="text-sm font-semibold tracking-tight">Spaces</div>
					<div className="flex items-center gap-1">
						<button
							aria-expanded={expanded}
							aria-label="Collapse sidebar"
							className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
							onClick={() => onExpandedChange(false)}
							type="button"
						>
							<IconPanelClose className="h-4 w-4" />
						</button>
						<button
							className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
							disabled={isLoading}
							onClick={() => onRefreshSpaces()}
							type="button"
						>
							Refresh
						</button>
					</div>
				</div>
			)}

			<div
				className={[
					"min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-0.5",
					hideSpaceList ? "mt-0" : "mt-3",
				].join(" ")}
			>
				{hideSpaceList ? null : (
					<>
						<div
							id="chat-sidebar-create"
							className="scroll-mt-4 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3"
						>
							{workspaceScope.kind === "organization" ? (
								<p className="text-xs leading-relaxed text-muted-foreground">
									New organization spaces are created from{" "}
									<Link
										className="font-medium text-foreground underline underline-offset-2"
										to="/console/spaces"
									>
										Spaces
									</Link>
									.
								</p>
							) : (
								<div className="grid gap-2">
									<label className="grid gap-1">
										<span className="text-xs font-medium text-muted-foreground">
											New space name
										</span>
										<input
											aria-label="New space name"
											className="h-10 rounded-md border border-border bg-background px-3 text-sm"
											onChange={(e) => onNewSpaceNameChange(e.target.value)}
											placeholder="Team budget"
											type="text"
											value={newSpaceName}
										/>
									</label>
									<button
										className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
										disabled={isLoading || !newSpaceName.trim()}
										onClick={() => onCreateSpace()}
										type="button"
									>
										Create space
									</button>
								</div>
							)}
						</div>

						<div className="grid gap-2">
							<div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
								Spaces · {workspaceScope.label}
							</div>
							<p className="text-[10px] leading-snug text-muted-foreground">
								{workspaceScope.kind === "organization"
									? "Organization workspace — spaces may be yours or someone else’s."
									: "Personal workspace — spaces you created show as yours; shared spaces show another owner."}
							</p>
							{spaces?.length ? (
								<ul className="space-y-1">
									{spaces.map((s) => {
										const isActive =
											selectedSpaceId !== null &&
											String(s.id) === String(selectedSpaceId);
										const unread = spaceHasUnread(s.id);
										const ownerId =
											s.owner_user_id != null ? Number(s.owner_user_id) : null;
										const isYours =
											currentUserId != null &&
											ownerId != null &&
											ownerId === currentUserId;
										return (
											<li key={String(s.id)}>
												<button
													aria-label={`Select space ${s.name}${unread ? ", unread messages" : ""}`}
													className={[
														"flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
														isActive
															? "bg-primary/10 font-medium text-foreground ring-1 ring-primary/25"
															: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
													].join(" ")}
													onClick={() => {
														onClearThread();
														onSelectSpace(s.id);
													}}
													type="button"
												>
													<div className="min-w-0 flex-1">
														<div className="truncate">{s.name}</div>
														<div className="mt-0.5 text-[10px] leading-tight text-muted-foreground/95">
															{isYours ? (
																<span className="font-medium text-emerald-700 dark:text-emerald-400">
																	Your space
																</span>
															) : ownerId != null ? (
																<span>Shared · owner user #{ownerId}</span>
															) : (
																<span className="font-mono">
																	id {String(s.id)}
																</span>
															)}
														</div>
													</div>
													{unread ? (
														<span
															aria-hidden
															className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/40"
															title="Unread messages"
														/>
													) : null}
												</button>
											</li>
										);
									})}
								</ul>
							) : (
								<div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
									No spaces found.
								</div>
							)}
						</div>
					</>
				)}

				<div
					id="chat-sidebar-members"
					className={[
						"scroll-mt-4 space-y-3",
						hideSpaceList ? "pt-0" : "border-t border-border/70 pt-4",
					].join(" ")}
				>
					<MyIncomingInvitesBlock
						disabled={isLoading}
						onAcceptInviteToken={onAcceptInviteToken}
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
										onClick={() => {
											onClearMemberRoleError();
											setMemberDetails(m);
										}}
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
						id="chat-sidebar-invite-space"
						className="scroll-mt-4 grid gap-2 pt-1"
					>
						{canManageMemberRoles ? (
							<>
								<div className="grid gap-1">
									<span className="text-xs font-medium text-muted-foreground">
										Invite by email (tenant admin + space owner)
									</span>
									<SpaceInviteCombobox
										disabled={isLoading || selectedSpaceId == null}
										onChange={onInviteEmailChange}
										pendingInvites={
											inviteSuggestions?.pending_invites_for_space ?? null
										}
										suggestions={inviteSuggestions?.suggestions ?? null}
										value={inviteEmail}
									/>
								</div>
								<button
									className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
									disabled={
										isLoading || !selectedSpaceId || !inviteEmail.trim()
									}
									onClick={() => onCreateInvite()}
									type="button"
								>
									Create invite
								</button>
								{inviteToken ? (
									<InviteLinkSharePanel token={inviteToken} />
								) : null}
							</>
						) : (
							<p className="text-[11px] leading-relaxed text-muted-foreground">
								Only a tenant admin who is also the space owner can create space
								invites. You can still accept an invite below if you have a
								token.
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
								<span className="font-mono">{selectedSpace.tenant_id}</span>{" "}
								from this space — do not edit. Requires tenant admin; otherwise
								the server returns 403.
							</p>
							<label className="grid gap-1">
								<span className="text-xs font-medium text-muted-foreground">
									Email (tenant-only invite)
								</span>
								<input
									aria-label="Tenant invite email"
									className="h-10 rounded-md border border-border bg-background px-3 text-sm"
									onChange={(e) => onTenantInviteEmailChange(e.target.value)}
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
								onClick={() => onCreateTenantInvite()}
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
								onChange={(e) => onAcceptInviteTokenChange(e.target.value)}
								placeholder="invite token…"
								type="text"
								value={acceptInviteToken}
							/>
						</label>
						<button
							className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
							disabled={isLoading || !acceptInviteToken.trim()}
							onClick={() => onAcceptInvite()}
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
								Permanently remove every chat line in this space. Does not
								delete expenses or transactions. Requires server permission (see{" "}
								<code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
									ALLOW_HARD_PURGE_ALL_MESSAGES
								</code>{" "}
								in production).
							</p>
							<button
								aria-label="Clear all chat messages in this space"
								className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border border-destructive/50 bg-background px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
								disabled={isLoading}
								onClick={() => onHardPurgeAllMessages()}
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
				</div>
			</div>
		</div>
	);

	const collapsedRail = (
		<div className="flex min-h-0 flex-1 flex-col items-center gap-3">
			{embedded ? null : (
				<>
					<button
						aria-label="Expand sidebar"
						className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/50 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => onExpandedChange(true)}
						type="button"
					>
						<IconPanelOpen className="h-4 w-4" />
					</button>

					<div className="h-px w-8 shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" />
				</>
			)}

			{hideSpaceList ? null : (
				<div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto overflow-x-hidden py-1">
					{spaces?.length
						? spaces.map((s) => {
								const isActive =
									selectedSpaceId !== null &&
									String(s.id) === String(selectedSpaceId);
								const unread = spaceHasUnread(s.id);
								return (
									<button
										aria-label={`${s.name}${unread ? ", unread" : ""}`}
										aria-pressed={isActive}
										className={[
											"relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											isActive
												? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
												: "border border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/80 hover:text-foreground",
										].join(" ")}
										key={String(s.id)}
										onClick={() => {
											onClearThread();
											onSelectSpace(s.id);
										}}
										title={s.name}
										type="button"
									>
										{spaceInitial(s.name)}
										{unread ? (
											<span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
										) : null}
									</button>
								);
							})
						: null}
				</div>
			)}

			<div
				className={[
					"flex w-full flex-col items-center gap-2 pt-3",
					hideSpaceList ? "" : "border-t border-border/60",
				].join(" ")}
			>
				<div
					className="flex flex-col items-center gap-1"
					title={
						members?.length
							? `${members.length} member${members.length === 1 ? "" : "s"}`
							: "Members"
					}
				>
					<div className="flex -space-x-2">
						{(members ?? []).slice(0, 3).map((m) => (
							<div
								className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-gradient-to-br from-muted to-muted/60 text-[11px] font-semibold text-foreground shadow-sm"
								key={m.user_id}
							>
								{memberInitial(m)}
							</div>
						))}
					</div>
					{members != null && members.length > 0 ? (
						<span className="text-[10px] font-medium tabular-nums text-muted-foreground">
							{members.length}
						</span>
					) : (
						<span className="text-[10px] text-muted-foreground">—</span>
					)}
				</div>

				<button
					aria-label="Invite someone — opens sidebar to invite"
					className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={() => expandTo("chat-sidebar-invite-space")}
					type="button"
				>
					<IconUserPlus className="h-4 w-4" />
				</button>

				{hideSpaceList ? null : (
					<button
						aria-label={
							workspaceScope.kind === "organization"
								? "Organization spaces — opens sidebar"
								: "Create a space — opens sidebar"
						}
						className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => expandTo("chat-sidebar-create")}
						type="button"
					>
						<IconPlusSquare className="h-4 w-4" />
					</button>
				)}
			</div>
		</div>
	);

	const Shell = embedded ? "div" : "aside";
	const shellClassName = embedded
		? "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-muted/10"
		: [
				"flex h-full min-h-0 flex-col border-r border-border/80 bg-muted/15 transition-[width,max-width] duration-200 ease-out",
				expanded
					? "lg:max-w-[320px] lg:w-full"
					: "lg:max-w-[4.5rem] lg:w-[4.5rem]",
			].join(" ");

	return (
		<Shell className={shellClassName}>
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div
					className={[
						"min-h-0 flex-1 flex-col overflow-y-auto p-4",
						"max-lg:flex",
						expanded ? "lg:flex" : "lg:hidden",
					].join(" ")}
				>
					{fullBody}
				</div>
				<div
					className={[
						"hidden min-h-0 flex-1 flex-col overflow-hidden p-2",
						"max-lg:hidden",
						expanded ? "lg:hidden" : "lg:flex",
					].join(" ")}
				>
					{collapsedRail}
				</div>
			</div>
			<SpaceMemberDetailsDialog
				canManageMemberRoles={canManageMemberRoles}
				currentUserId={currentUserId}
				errorMessage={memberRoleError}
				isSaving={memberRoleSaving}
				member={memberDetails}
				onClose={handleCloseMemberDetails}
				onRemoveFromSpace={onRemoveSpaceMember}
				onSaveRole={onPatchMemberRole}
				open={memberDetails != null}
				removeMemberSaving={removeMemberSaving}
			/>
		</Shell>
	);
};
