import { useCallback, useMemo } from "react";

export const buildChatInviteUrl = (token: string): string => {
	const origin =
		typeof window !== "undefined" && window.location?.origin
			? window.location.origin
			: "";
	return `${origin}/console/chat?invite=${encodeURIComponent(token.trim())}`;
};

type InviteLinkSharePanelProps = {
	token: string;
};

/**
 * Shareable invite link + Telegram “share URL” (user sends the link in Telegram themselves;
 * we do not DM Telegram users from the server yet).
 */
export const InviteLinkSharePanel = ({ token }: InviteLinkSharePanelProps) => {
	const url = useMemo(() => buildChatInviteUrl(token), [token]);

	const telegramShareHref = useMemo(() => {
		const text = encodeURIComponent(
			"Join me on Ceits — open the link to sign in and accept the space invite.",
		);
		return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${text}`;
	}, [url]);

	const handleCopyLink = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(url);
		} catch {
			/* ignore */
		}
	}, [url]);

	const handleCopyToken = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(token.trim());
		} catch {
			/* ignore */
		}
	}, [token]);

	return (
		<div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
			<p className="text-[11px] leading-relaxed text-muted-foreground">
				Automated email to the recipient is not wired yet. Share the link (or
				token) so they can open Ceits and accept. For Telegram, use “Share via
				Telegram” — you send the message; we do not message their Telegram
				account from the server.
			</p>
			<div>
				<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
					Invite link
				</div>
				<div className="mt-1 break-all font-mono text-[11px] text-foreground">
					{url}
				</div>
				<button
					className="mt-2 inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-[11px] font-medium hover:bg-accent"
					onClick={() => void handleCopyLink()}
					type="button"
				>
					Copy link
				</button>
			</div>
			<div>
				<a
					className="inline-flex h-8 items-center rounded-md border border-[#229ED9] bg-[#229ED9]/10 px-3 text-[11px] font-medium text-[#229ED9] hover:bg-[#229ED9]/20"
					href={telegramShareHref}
					rel="noreferrer"
					target="_blank"
				>
					Share via Telegram
				</a>
			</div>
			<div>
				<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
					Raw token (Accept invite below)
				</div>
				<div className="mt-1 break-all font-mono text-[11px]">{token}</div>
				<button
					className="mt-2 inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-[11px] font-medium hover:bg-accent"
					onClick={() => void handleCopyToken()}
					type="button"
				>
					Copy token
				</button>
			</div>
		</div>
	);
};
