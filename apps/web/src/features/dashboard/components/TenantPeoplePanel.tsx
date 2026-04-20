import type { TenantMember } from "@cofi/api";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../shared/lib/apiClient";

type TenantPeoplePanelProps = {
	tenantId: number | null;
	currentUserId?: number;
};

/**
 * Lists tenant directory members (verified email flag) for the active dashboard tenant.
 */
export const TenantPeoplePanel = ({
	tenantId,
	currentUserId,
}: TenantPeoplePanelProps) => {
	const [members, setMembers] = useState<TenantMember[] | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (tenantId == null || !Number.isFinite(Number(tenantId))) {
			setMembers(null);
			setErr(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setErr(null);
		void apiClient.tenants
			.listMembers(tenantId, { limit: 80, tenantIdHeader: tenantId })
			.then((page) => {
				if (!cancelled) setMembers(page.members);
			})
			.catch((e: unknown) => {
				if (!cancelled) {
					setMembers(null);
					setErr(e instanceof Error ? e.message : "Could not load people");
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [tenantId]);

	if (tenantId == null) {
		return (
			<p className="text-xs text-[hsl(var(--text-secondary))]">
				Select a workspace context to load people.
			</p>
		);
	}

	return (
		<div className="space-y-3 text-sm">
			{loading ? (
				<p
					aria-busy="true"
					className="text-xs text-[hsl(var(--text-secondary))]"
				>
					Loading people…
				</p>
			) : null}
			{err ? (
				<p className="text-xs text-red-600 dark:text-red-400" role="alert">
					{err}
				</p>
			) : null}
			{members && members.length === 0 && !loading && !err ? (
				<p className="text-xs text-[hsl(var(--text-secondary))]">
					No members yet.
				</p>
			) : null}
			{members && members.length > 0 ? (
				<ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
					{members.map((m) => (
						<li
							className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[hsl(var(--border-subtle))]/90 bg-[hsl(var(--surface-muted))]/35 px-3 py-2.5 text-xs"
							key={m.user_id}
						>
							<div className="min-w-0 flex-1">
								<span className="font-medium text-[hsl(var(--text-primary))]">
									{m.name?.trim() || `User #${m.user_id}`}
									{currentUserId != null && m.user_id === currentUserId ? (
										<span className="ml-1 font-normal text-[hsl(var(--text-secondary))]">
											(you)
										</span>
									) : null}
								</span>
								<span className="ml-2 text-[hsl(var(--text-secondary))]">
									{m.role}
								</span>
							</div>
							<div className="shrink-0">
								{m.identity_verified ? (
									<span className="inline-flex rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
										Email verified
									</span>
								) : (
									<span className="inline-flex rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-200">
										Not verified
									</span>
								)}
							</div>
						</li>
					))}
				</ul>
			) : null}
			<p className="text-[11px] leading-relaxed text-[hsl(var(--text-secondary))]">
				<Link
					className="font-medium text-[hsl(var(--text-primary))] underline underline-offset-2 hover:no-underline"
					to="/console/account"
				>
					Account settings
				</Link>{" "}
				— invite people, cancel pending invites, or remove access (when you are
				an admin).
			</p>
		</div>
	);
};
