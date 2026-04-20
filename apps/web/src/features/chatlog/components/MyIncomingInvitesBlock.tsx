import type { MyPendingInviteRow } from "@cofi/api";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../../shared/lib/apiClient";

export type MyIncomingInvitesBlockProps = {
	disabled: boolean;
	/** Bump when spaces reload so the list stays in sync after accept elsewhere. */
	refreshKey: number;
	selectedSpaceId: string | number | null;
	onAcceptInviteToken: (token: string) => Promise<void>;
};

export const MyIncomingInvitesBlock = (props: MyIncomingInvitesBlockProps) => {
	const { disabled, refreshKey, selectedSpaceId, onAcceptInviteToken } = props;

	const [invites, setInvites] = useState<MyPendingInviteRow[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<number | null>(null);
	const [rowErrorById, setRowErrorById] = useState<Record<number, string>>({});

	const load = useCallback(async () => {
		setLoadError(null);
		try {
			const res = await apiClient.spaces.listPendingInvitesForMe();
			setInvites(res.invites ?? []);
		} catch (err) {
			setInvites(null);
			setLoadError(
				err instanceof Error ? err.message : "Failed to load your invites",
			);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load, refreshKey]);

	const handleAccept = async (inv: MyPendingInviteRow) => {
		setRowErrorById((prev) => {
			const next = { ...prev };
			delete next[inv.id];
			return next;
		});
		setBusyId(inv.id);
		try {
			await onAcceptInviteToken(inv.token);
			await load();
		} catch (err) {
			setRowErrorById((prev) => ({
				...prev,
				[inv.id]:
					err instanceof Error ? err.message : "Could not accept this invite",
			}));
		} finally {
			setBusyId(null);
		}
	};

	const handleDecline = async (inv: MyPendingInviteRow) => {
		setRowErrorById((prev) => {
			const next = { ...prev };
			delete next[inv.id];
			return next;
		});
		setBusyId(inv.id);
		try {
			await apiClient.spaces.declineMyInvite(inv.id);
			await load();
		} catch (err) {
			setRowErrorById((prev) => ({
				...prev,
				[inv.id]:
					err instanceof Error ? err.message : "Could not decline this invite",
			}));
		} finally {
			setBusyId(null);
		}
	};

	if (loadError != null) {
		return (
			<div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
				{loadError}
			</div>
		);
	}

	if (invites == null) {
		return (
			<div className="text-[11px] text-muted-foreground" aria-live="polite">
				Loading your invites…
			</div>
		);
	}

	if (invites.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2">
			<div className="text-xs font-semibold tracking-tight text-foreground">
				Your invites
			</div>
			<p className="text-[10px] leading-snug text-muted-foreground">
				You were invited by email — accept to join, or decline to dismiss.
			</p>
			<ul className="space-y-2">
				{invites.map((inv) => {
					const title =
						inv.invite_kind === "space"
							? inv.space_name?.trim() || `Space #${inv.space_id ?? "?"}`
							: "Organization invite";
					const tenantLabel = inv.tenant_name?.trim()
						? inv.tenant_name
						: `Org ${inv.tenant_id}`;
					const matchesSelected =
						inv.invite_kind === "space" &&
						inv.space_id != null &&
						selectedSpaceId != null &&
						String(inv.space_id) === String(selectedSpaceId);
					const rowErr = rowErrorById[inv.id];
					const busy = busyId === inv.id;

					return (
						<li key={inv.id}>
							<div
								className={[
									"rounded-lg border px-3 py-2.5",
									matchesSelected
										? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
										: "border-border/80 bg-muted/20",
								].join(" ")}
							>
								<div className="min-w-0">
									<div className="truncate text-sm font-medium text-foreground">
										{title}
									</div>
									<div className="mt-0.5 truncate text-[11px] text-muted-foreground">
										{tenantLabel}
										{inv.invite_kind === "space" ? (
											<span> · role {inv.invited_space_role}</span>
										) : null}
									</div>
								</div>
								<div className="mt-2 flex flex-wrap gap-2">
									<button
										aria-label={`Accept invite to ${title}`}
										className="inline-flex h-8 min-w-[5.5rem] items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
										disabled={disabled || busy}
										onClick={() => void handleAccept(inv)}
										type="button"
									>
										{busy ? "…" : "Accept"}
									</button>
									<button
										aria-label={`Decline invite to ${title}`}
										className="inline-flex h-8 min-w-[5.5rem] items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
										disabled={disabled || busy}
										onClick={() => void handleDecline(inv)}
										type="button"
									>
										Decline
									</button>
								</div>
								{rowErr ? (
									<p className="mt-2 text-[11px] text-destructive" role="alert">
										{rowErr}
									</p>
								) : null}
							</div>
						</li>
					);
				})}
			</ul>
		</div>
	);
};
