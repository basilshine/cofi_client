import type { SpaceActivityItem, WsEnvelope } from "@cofi/api";
import { WS_OP_SPACE_ACTIVITY_UPDATED } from "@cofi/api";
import * as Popover from "@radix-ui/react-popover";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../../shared/lib/apiClient";
import { wsClient } from "../../../shared/lib/wsClient";

const IconBell = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="16"
		stroke="currentColor"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="16"
	>
		<title>Activity</title>
		<path
			d="M15 17H5l1.2-1.2c.5-.5.8-1.2.8-1.9V11a5 5 0 1 1 10 0v2.9c0 .7.3 1.4.8 1.9L19 17h-4z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M10 19a2 2 0 0 0 4 0"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const formatRelativeShort = (iso: string): string => {
	const t = new Date(iso).getTime();
	if (!Number.isFinite(t)) return "";
	const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
	if (sec < 60) return "Just now";
	if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
	if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
	return `${Math.floor(sec / 86400)}d ago`;
};

type VerbCategory = "create" | "update" | "delete";

const categoryForAction = (action: string): VerbCategory => {
	if (action === "expense_draft_created") return "create";
	if (action === "expense_draft_cancelled") return "delete";
	return "update";
};

const sentenceForActivity = (item: SpaceActivityItem): string => {
	const who = item.actor.display_name || "Someone";
	switch (item.action) {
		case "expense_draft_created":
			return `${who} added a draft expense`;
		case "expense_draft_cancelled":
			return `${who} cancelled a draft expense`;
		case "expense_confirmed":
			return `${who} confirmed an expense`;
		case "expense_splits_updated":
			return `${who} updated expense splits`;
		case "recurring_changed":
			return `${who} updated a recurring expense`;
		default:
			return `${who} ${item.action.replace(/_/g, " ")}`;
	}
};

const categoryBarClass: Record<VerbCategory, string> = {
	create: "border-l-emerald-500",
	update: "border-l-sky-500",
	delete: "border-l-destructive",
};

const leftBarWidth = "border-l-[3px]";

export const SpaceSidebarActivity = ({
	selectedSpaceId,
}: {
	selectedSpaceId: string | number | null;
}) => {
	const spaceKey = selectedSpaceId == null ? null : String(selectedSpaceId);
	const [summary, setSummary] = useState<{
		has_unread: boolean;
		unread_count: number;
	} | null>(null);
	const [open, setOpen] = useState(false);
	const openRef = useRef(false);
	openRef.current = open;
	const [items, setItems] = useState<SpaceActivityItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refreshSummary = useCallback(async () => {
		if (spaceKey == null) {
			setSummary(null);
			return;
		}
		try {
			const s = await apiClient.spaces.activity.summary(spaceKey);
			setSummary(s);
		} catch {
			setSummary(null);
		}
	}, [spaceKey]);

	const refreshListIfOpen = useCallback(async () => {
		if (spaceKey == null || !openRef.current) return;
		try {
			const res = await apiClient.spaces.activity.list(spaceKey, {
				limit: 10,
			});
			setItems(res.items);
		} catch {
			/* keep existing list */
		}
	}, [spaceKey]);

	useEffect(() => {
		setItems([]);
		setError(null);
	}, [spaceKey]);

	useEffect(() => {
		void refreshSummary();
	}, [refreshSummary]);

	useEffect(() => {
		const onFocus = () => {
			void refreshSummary();
		};
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [refreshSummary]);

	useEffect(() => {
		if (spaceKey == null) return;
		let cancelled = false;
		let unsub: (() => void) | undefined;
		const topic = `space:${spaceKey}`;
		const handleWs = (env: WsEnvelope) => {
			if (env.type !== "event" || env.op !== WS_OP_SPACE_ACTIVITY_UPDATED) {
				return;
			}
			void refreshSummary();
			void refreshListIfOpen();
		};
		void (async () => {
			try {
				unsub = await wsClient.subscribe(topic, handleWs);
			} catch {
				/* WS optional when logged out / no token */
			}
			if (cancelled) unsub?.();
		})();
		return () => {
			cancelled = true;
			unsub?.();
		};
	}, [spaceKey, refreshSummary, refreshListIfOpen]);

	const handleOpenChange = useCallback(
		async (next: boolean) => {
			setOpen(next);
			if (!next || spaceKey == null) return;
			setLoading(true);
			setError(null);
			try {
				const res = await apiClient.spaces.activity.list(spaceKey, {
					limit: 10,
				});
				setItems(res.items);
				await apiClient.spaces.activity.markRead(spaceKey, {
					up_to_audit_event_id: 0,
				});
				await refreshSummary();
				setItems((prev) =>
					prev.map((it) => ({ ...it, read_state: "read" as const })),
				);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Could not load activity");
			} finally {
				setLoading(false);
			}
		},
		[spaceKey, refreshSummary],
	);

	const disabled = spaceKey == null;
	const unreadN = (() => {
		if (summary == null) return 0;
		const n = Number(summary.unread_count);
		return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
	})();
	const showBadge = unreadN > 0;
	/** Compact pill label; full count is in aria-label. */
	const badgeLabel =
		unreadN > 99 ? "99+" : unreadN > 0 ? String(unreadN) : null;
	const activityAriaLabel = disabled
		? "Space activity — select a space first"
		: unreadN > 0
			? `Space activity, ${unreadN} unread ${unreadN === 1 ? "entry" : "entries"}`
			: "Space activity, no unread entries";

	return (
		<Popover.Root open={open} onOpenChange={handleOpenChange}>
			<Popover.Trigger asChild>
				<button
					aria-label={activityAriaLabel}
					className={[
						"relative flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/50 px-2 py-1.5 text-left text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						disabled
							? "cursor-not-allowed opacity-50"
							: "text-muted-foreground hover:text-foreground",
					].join(" ")}
					disabled={disabled}
					type="button"
				>
					<span className="flex min-w-0 items-center gap-3">
						<IconBell className="h-4 w-4 shrink-0" />
						<span className="truncate">Activity</span>
					</span>
					{showBadge && badgeLabel != null ? (
						<span
							aria-hidden
							className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground"
							title={`${unreadN} unread`}
						>
							{badgeLabel}
						</span>
					) : null}
				</button>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					align="start"
					className="z-[80] w-[min(calc(100vw-2rem),288px)] max-h-[min(50vh,22rem)] overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
					collisionPadding={12}
					side="top"
					sideOffset={8}
				>
					<p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						Recent in this space
					</p>
					{loading ? (
						<p className="px-1 py-3 text-[12px] text-muted-foreground">
							Loading…
						</p>
					) : null}
					{error ? (
						<p className="px-1 py-2 text-[12px] text-destructive">{error}</p>
					) : null}
					{!loading && !error && items.length === 0 ? (
						<p className="px-1 py-3 text-[12px] text-muted-foreground">
							No recent activity yet.
						</p>
					) : null}
					<ul className="flex flex-col gap-1">
						{items.map((item) => {
							const cat = categoryForAction(item.action);
							const pending = item.read_state === "pending";
							return (
								<li key={String(item.id)}>
									<div
										className={[
											"rounded-md border border-border/50 py-2 pl-2.5 pr-2 text-[12px] leading-snug",
											leftBarWidth,
											categoryBarClass[cat],
											pending ? "bg-muted/45" : "bg-card/30",
										].join(" ")}
									>
										<p className="font-medium text-foreground">
											{sentenceForActivity(item)}
										</p>
										<p className="mt-0.5 text-[10px] text-muted-foreground">
											{formatRelativeShort(item.created_at)}
											{pending ? (
												<span className="ml-1.5 font-semibold text-primary">
													New
												</span>
											) : null}
										</p>
									</div>
								</li>
							);
						})}
					</ul>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
};
