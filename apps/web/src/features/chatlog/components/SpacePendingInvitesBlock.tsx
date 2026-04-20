import type { PendingInviteBrief } from "@cofi/api";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { apiClient } from "../../../shared/lib/apiClient";
import { buildChatInviteUrl } from "./InviteLinkSharePanel";

type SpacePendingInvitesBlockProps = {
	spaceId: string | number | null;
	tenantId: number | null;
	pending: PendingInviteBrief[] | null;
	canManage: boolean;
	disabled?: boolean;
	onListChanged: () => void | Promise<void>;
};

const formatExp = (iso: string): string => {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return iso;
	}
};

export const SpacePendingInvitesBlock = ({
	spaceId,
	tenantId,
	pending,
	canManage,
	disabled,
	onListChanged,
}: SpacePendingInvitesBlockProps) => {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const [shareToken, setShareToken] = useState<string | null>(null);
	const [resendBusyId, setResendBusyId] = useState<number | null>(null);

	const closeShare = useCallback(() => {
		setShareToken(null);
		dialogRef.current?.close();
	}, []);

	useEffect(() => {
		const d = dialogRef.current;
		if (!d) return;
		if (shareToken) {
			if (!d.open) d.showModal();
		} else if (d.open) {
			d.close();
		}
	}, [shareToken]);

	const handleBackdrop = (
		e:
			| React.MouseEvent<HTMLDialogElement>
			| React.KeyboardEvent<HTMLDialogElement>,
	) => {
		if (e.target === dialogRef.current) closeShare();
	};

	const handleBackdropKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		handleBackdrop(e);
	};

	const handleResend = async (inviteId: number) => {
		if (spaceId == null || tenantId == null) return;
		setResendBusyId(inviteId);
		try {
			await apiClient.spaces.resendSpaceInvite(spaceId, inviteId, {
				tenantId,
			});
			await onListChanged();
		} finally {
			setResendBusyId(null);
		}
	};

	const shareUrl = shareToken ? buildChatInviteUrl(shareToken) : "";
	const telegramHref =
		shareUrl.length > 0
			? `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(
					"Join me on Ceits — open the link to sign in and accept the space invite.",
				)}`
			: "";

	const handleCopyLink = async () => {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
		} catch {
			/* ignore */
		}
	};

	const handleCopyToken = async () => {
		if (!shareToken) return;
		try {
			await navigator.clipboard.writeText(shareToken.trim());
		} catch {
			/* ignore */
		}
	};

	if (!canManage || !pending?.length) return null;

	return (
		<div className="rounded-lg border border-dashed border-border/90 bg-muted/15 px-2 py-2">
			<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
				Pending invites
			</div>
			<p className="mt-1 text-[10px] leading-snug text-muted-foreground">
				Invited address is a hint only — the recipient can sign in or register
				with another email; the invite still applies when they open the link
				while signed in.
			</p>
			<ul className="mt-2 space-y-2">
				{pending.map((p) => (
					<li
						className="rounded-md border border-border/70 bg-background/80 px-2 py-2"
						key={p.id}
					>
						<div className="flex flex-wrap items-start justify-between gap-2">
							<div className="min-w-0 flex-1">
								<div className="truncate font-mono text-[11px] text-foreground">
									{p.invitee_email}
								</div>
								<div className="text-[10px] text-muted-foreground">
									Until {formatExp(p.expires_at)}
								</div>
							</div>
							<div className="flex shrink-0 flex-wrap gap-1">
								<button
									className="inline-flex h-7 items-center rounded-md border border-border px-2 text-[10px] font-medium hover:bg-accent disabled:opacity-50"
									disabled={disabled || resendBusyId === p.id}
									onClick={() => setShareToken(p.token)}
									type="button"
								>
									Share
								</button>
								<button
									className="inline-flex h-7 items-center rounded-md border border-border px-2 text-[10px] font-medium hover:bg-accent disabled:opacity-50"
									disabled={disabled || resendBusyId === p.id}
									onClick={() => void handleResend(p.id)}
									type="button"
								>
									{resendBusyId === p.id ? "…" : "Resend"}
								</button>
							</div>
						</div>
					</li>
				))}
			</ul>

			<dialog
				aria-labelledby={titleId}
				className="z-[90] w-[min(100%,360px)] rounded-xl border border-border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/50"
				onClick={handleBackdrop}
				onKeyDown={handleBackdropKeyDown}
				ref={dialogRef}
			>
				<div className="border-b border-border px-3 py-2">
					<h2 className="text-sm font-semibold" id={titleId}>
						Share invite
					</h2>
					<p className="mt-0.5 text-[10px] text-muted-foreground">
						Copy the link or open Telegram to send it yourself.
					</p>
				</div>
				<div className="space-y-2 px-3 py-3">
					<div className="break-all font-mono text-[10px] text-muted-foreground">
						{shareUrl}
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-[11px] font-medium hover:bg-accent"
							onClick={() => void handleCopyLink()}
							type="button"
						>
							Copy link
						</button>
						<a
							className="inline-flex h-8 items-center rounded-md border border-[#229ED9] bg-[#229ED9]/10 px-3 text-[11px] font-medium text-[#229ED9] hover:bg-[#229ED9]/20"
							href={telegramHref || "#"}
							onClick={(e) => {
								if (!telegramHref) e.preventDefault();
							}}
							rel="noreferrer"
							target="_blank"
						>
							Telegram
						</a>
						<button
							className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-[11px] font-medium hover:bg-accent"
							onClick={() => void handleCopyToken()}
							type="button"
						>
							Copy token
						</button>
					</div>
					<button
						className="mt-1 w-full rounded-md border border-border py-2 text-[11px] font-medium hover:bg-accent"
						onClick={closeShare}
						type="button"
					>
						Close
					</button>
				</div>
			</dialog>
		</div>
	);
};
