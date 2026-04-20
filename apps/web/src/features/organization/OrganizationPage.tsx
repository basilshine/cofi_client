import type { Space, Tenant, TenantMembersPage } from "@cofi/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../shared/lib/apiClient";
import { isNonPersonalTenantType } from "../../shared/lib/tenantTypes";

const uniqueTenantIds = (spaces: Space[]): number[] => {
	const seen = new Set<number>();
	for (const s of spaces) {
		const tid = Number(s.tenant_id);
		if (Number.isFinite(tid)) seen.add(tid);
	}
	return [...seen].sort((a, b) => a - b);
};

const tenantLabel = (
	id: number,
	meta: Record<number, Tenant | null>,
): string => {
	const t = meta[id];
	if (t?.name?.trim()) return t.name.trim();
	return `Organization ${id}`;
};

export const OrganizationPage = () => {
	const [spaces, setSpaces] = useState<Space[] | null>(null);
	const [tenantMetaById, setTenantMetaById] = useState<
		Record<number, Tenant | null>
	>({});
	const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
	const [membersPage, setMembersPage] = useState<TenantMembersPage | null>(
		null,
	);
	const [nameDraft, setNameDraft] = useState("");
	const [loadError, setLoadError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isLoadingMembers, setIsLoadingMembers] = useState(false);
	const [isSavingName, setIsSavingName] = useState(false);

	const [createName, setCreateName] = useState("");
	const [createBusy, setCreateBusy] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState("member");
	const [inviteBusy, setInviteBusy] = useState(false);
	const [inviteMessage, setInviteMessage] = useState<string | null>(null);
	const [inviteError, setInviteError] = useState<string | null>(null);

	const tenantIds = useMemo(
		() => (spaces ? uniqueTenantIds(spaces) : []),
		[spaces],
	);

	const orgTenantIds = useMemo(() => {
		return tenantIds.filter((id) => {
			const t = tenantMetaById[id];
			return t != null && isNonPersonalTenantType(t.type);
		});
	}, [tenantIds, tenantMetaById]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const list = await apiClient.spaces.list({ tenantId: null });
				if (!cancelled) setSpaces(list);
			} catch {
				if (!cancelled) setSpaces([]);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (spaces === null || tenantIds.length === 0) {
			setTenantMetaById({});
			return;
		}
		let cancelled = false;
		void (async () => {
			const pairs = await Promise.all(
				tenantIds.map(async (id) => {
					try {
						const t = await apiClient.tenants.get(id, {
							tenantIdHeader: id,
						});
						return [id, t] as const;
					} catch {
						return [id, null] as const;
					}
				}),
			);
			if (cancelled) return;
			const next: Record<number, Tenant | null> = {};
			for (const [id, t] of pairs) next[id] = t;
			setTenantMetaById(next);
		})();
		return () => {
			cancelled = true;
		};
	}, [spaces, tenantIds]);

	useEffect(() => {
		if (selectedTenantId === null && orgTenantIds.length > 0) {
			setSelectedTenantId(orgTenantIds[0]);
		}
		if (selectedTenantId !== null && !orgTenantIds.includes(selectedTenantId)) {
			setSelectedTenantId(orgTenantIds[0] ?? null);
		}
	}, [selectedTenantId, orgTenantIds]);

	useEffect(() => {
		if (selectedTenantId === null) return;
		const t = tenantMetaById[selectedTenantId];
		setNameDraft(t?.name?.trim() ?? "");
	}, [selectedTenantId, tenantMetaById]);

	const loadMembers = useCallback(async () => {
		if (selectedTenantId === null) return;
		setIsLoadingMembers(true);
		setLoadError(null);
		try {
			const page = await apiClient.tenants.listMembers(selectedTenantId, {
				tenantIdHeader: selectedTenantId,
			});
			setMembersPage(page);
		} catch (err) {
			setMembersPage(null);
			setLoadError(
				err instanceof Error ? err.message : "Failed to load members",
			);
		} finally {
			setIsLoadingMembers(false);
		}
	}, [selectedTenantId]);

	useEffect(() => {
		if (selectedTenantId === null) return;
		void loadMembers();
	}, [selectedTenantId, loadMembers]);

	const handleSaveName = async () => {
		if (selectedTenantId === null) return;
		const trimmed = nameDraft.trim();
		if (trimmed === "") {
			setSaveError("Enter a non-empty name.");
			return;
		}
		setIsSavingName(true);
		setSaveError(null);
		try {
			const t = await apiClient.tenants.patch(
				selectedTenantId,
				{ name: trimmed },
				{ tenantIdHeader: selectedTenantId },
			);
			setTenantMetaById((prev) => ({ ...prev, [selectedTenantId]: t }));
			setNameDraft(t.name);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Rename failed";
			setSaveError(
				msg.includes("403") || msg.toLowerCase().includes("forbidden")
					? "Only tenant admins and owners can rename the organization."
					: msg,
			);
		} finally {
			setIsSavingName(false);
		}
	};

	const handleCreateOrganization = async () => {
		const trimmed = createName.trim();
		if (trimmed === "") {
			setCreateError("Enter an organization name.");
			return;
		}
		setCreateBusy(true);
		setCreateError(null);
		try {
			const res = await apiClient.tenants.create({ name: trimmed });
			const list = await apiClient.spaces.list({ tenantId: null });
			setSpaces(list);
			setTenantMetaById((prev) => ({
				...prev,
				[res.tenant.id]: res.tenant,
			}));
			setSelectedTenantId(Number(res.tenant.id));
			setCreateName("");
			setInviteMessage(
				`Created “${res.tenant.name}”. You can switch to it above and open the business dashboard.`,
			);
		} catch (err) {
			setCreateError(
				err instanceof Error ? err.message : "Could not create organization",
			);
		} finally {
			setCreateBusy(false);
		}
	};

	const handleSendInvite = async () => {
		if (selectedTenantId === null) return;
		const email = inviteEmail.trim().toLowerCase();
		if (email === "") {
			setInviteError("Enter an email address.");
			return;
		}
		setInviteBusy(true);
		setInviteError(null);
		setInviteMessage(null);
		try {
			await apiClient.tenants.createInvite(selectedTenantId, {
				email,
				invited_tenant_role: inviteRole,
				channel: "email",
			});
			setInviteMessage(
				"Invite created. The recipient can accept it from their Ceits account using the emailed link.",
			);
			setInviteEmail("");
			await loadMembers();
		} catch (err) {
			setInviteError(
				err instanceof Error ? err.message : "Could not create invite",
			);
		} finally {
			setInviteBusy(false);
		}
	};

	return (
		<section className="space-y-8">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
				<p className="text-sm text-muted-foreground">
					Create a Ceits organization, rename it, invite teammates by email, and
					browse members. Access is enforced by the API (tenant roles).
				</p>
				<p className="text-sm">
					<Link
						className="font-medium text-primary underline underline-offset-2"
						to="/console/dashboard/business"
					>
						Back to business dashboard
					</Link>
				</p>
			</div>

			<div className="space-y-3 rounded-lg border border-border bg-card p-4">
				<h2 className="text-sm font-medium">Create an organization</h2>
				<p className="text-xs text-muted-foreground">
					Adds a new organization you own, with a default starter space (named
					with the org id so it stays unique), so you can use the business
					dashboard and invite others.
				</p>
				<div className="flex flex-wrap items-end gap-3">
					<label className="grid min-w-[12rem] flex-1 gap-1 text-sm">
						<span className="text-muted-foreground">Organization name</span>
						<input
							className="h-10 rounded-md border border-border bg-background px-3"
							onChange={(e) => setCreateName(e.target.value)}
							type="text"
							value={createName}
						/>
					</label>
					<button
						className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
						disabled={createBusy}
						onClick={() => void handleCreateOrganization()}
						type="button"
					>
						{createBusy ? "Creating…" : "Create organization"}
					</button>
				</div>
				{createError ? (
					<p className="text-sm text-destructive" role="alert">
						{createError}
					</p>
				) : null}
			</div>

			{spaces !== null && orgTenantIds.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					You have no organization yet. Create one above, or join one via an
					invite.
				</p>
			) : null}

			{orgTenantIds.length > 0 ? (
				<div className="space-y-6">
					<label className="grid max-w-md gap-1 text-sm">
						<span className="text-muted-foreground">Organization</span>
						<select
							aria-label="Organization tenant"
							className="h-10 rounded-md border border-border bg-background px-3"
							onChange={(e) => {
								const v = Number(e.target.value);
								setSelectedTenantId(Number.isFinite(v) ? v : null);
							}}
							value={selectedTenantId ?? ""}
						>
							{orgTenantIds.map((tid) => (
								<option key={tid} value={tid}>
									{tenantLabel(tid, tenantMetaById)}
								</option>
							))}
						</select>
					</label>

					<div className="space-y-3 rounded-lg border border-border bg-card p-4">
						<h2 className="text-sm font-medium">Organization name</h2>
						<p className="text-xs text-muted-foreground">
							Updates the display name for this organization.
						</p>
						<div className="flex flex-wrap items-end gap-3">
							<label className="grid min-w-[12rem] flex-1 gap-1 text-sm">
								<span className="text-muted-foreground">Display name</span>
								<input
									className="h-10 rounded-md border border-border bg-background px-3"
									onChange={(e) => setNameDraft(e.target.value)}
									type="text"
									value={nameDraft}
								/>
							</label>
							<button
								className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
								disabled={isSavingName || selectedTenantId === null}
								onClick={() => void handleSaveName()}
								type="button"
							>
								{isSavingName ? "Saving…" : "Save name"}
							</button>
						</div>
						{saveError ? (
							<p className="text-sm text-destructive" role="alert">
								{saveError}
							</p>
						) : null}
					</div>

					<div className="space-y-3 rounded-lg border border-border bg-card p-4">
						<h2 className="text-sm font-medium">Invite by email</h2>
						<p className="text-xs text-muted-foreground">
							Sends a tenant invite (email channel). Recipient must accept with
							their Ceits account.
						</p>
						<div className="flex flex-wrap items-end gap-3">
							<label className="grid min-w-[12rem] flex-1 gap-1 text-sm">
								<span className="text-muted-foreground">Email</span>
								<input
									autoComplete="email"
									className="h-10 rounded-md border border-border bg-background px-3"
									onChange={(e) => setInviteEmail(e.target.value)}
									type="email"
									value={inviteEmail}
								/>
							</label>
							<label className="grid w-36 gap-1 text-sm">
								<span className="text-muted-foreground">Role</span>
								<select
									className="h-10 rounded-md border border-border bg-background px-2"
									onChange={(e) => setInviteRole(e.target.value)}
									value={inviteRole}
								>
									<option value="member">member</option>
									<option value="editor">editor</option>
									<option value="admin">admin</option>
									<option value="viewer">viewer</option>
								</select>
							</label>
							<button
								className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-sm font-medium disabled:opacity-50"
								disabled={inviteBusy || selectedTenantId === null}
								onClick={() => void handleSendInvite()}
								type="button"
							>
								{inviteBusy ? "Sending…" : "Send invite"}
							</button>
						</div>
						{inviteError ? (
							<p className="text-sm text-destructive" role="alert">
								{inviteError}
							</p>
						) : null}
						{inviteMessage ? (
							<p className="text-sm text-muted-foreground" role="status">
								{inviteMessage}
							</p>
						) : null}
					</div>

					<div className="space-y-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h2 className="text-sm font-medium">Members</h2>
							<button
								className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
								disabled={isLoadingMembers}
								onClick={() => void loadMembers()}
								type="button"
							>
								Refresh
							</button>
						</div>
						{loadError ? (
							<p className="text-sm text-destructive" role="alert">
								{loadError}
							</p>
						) : null}
						{isLoadingMembers && !membersPage ? (
							<p className="text-sm text-muted-foreground">Loading…</p>
						) : null}
						{membersPage ? (
							<div className="overflow-x-auto rounded-lg border border-border">
								<table className="w-full min-w-[28rem] text-left text-sm">
									<thead>
										<tr className="border-b border-border bg-muted/40">
											<th className="px-3 py-2 font-medium">Name</th>
											<th className="px-3 py-2 font-medium">Role</th>
											<th className="px-3 py-2 font-medium">User ID</th>
											<th className="px-3 py-2 font-medium">Email</th>
										</tr>
									</thead>
									<tbody>
										{membersPage.members.map((m) => (
											<tr className="border-b border-border/60" key={m.user_id}>
												<td className="px-3 py-2">{m.name || "—"}</td>
												<td className="px-3 py-2 font-mono text-xs">
													{m.role}
												</td>
												<td className="px-3 py-2 font-mono text-xs">
													{m.user_id}
												</td>
												<td className="px-3 py-2 text-xs text-muted-foreground">
													{m.email && m.email.length > 0 ? m.email : "—"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
								<p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
									Showing {membersPage.members.length} of {membersPage.total}{" "}
									(offset {membersPage.offset}, limit {membersPage.limit})
								</p>
							</div>
						) : null}
					</div>
				</div>
			) : null}
		</section>
	);
};
