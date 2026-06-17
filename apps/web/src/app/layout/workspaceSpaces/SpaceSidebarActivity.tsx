import type { SpaceActivityItem, WsEnvelope } from "@cofi/api";
import { WS_OP_SPACE_ACTIVITY_UPDATED } from "@cofi/api";
import * as Popover from "@radix-ui/react-popover";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../../shared/lib/apiClient";
import { EntityIcon } from "../../../shared/lib/entityPresentation";
import type { EntityVisualKey } from "../../../shared/lib/entityVisual";
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

type ActivityPresentation = {
	detail: string;
	label: string;
	sentence: string;
	visualKey: EntityVisualKey;
};

const presentationForActivity = (
	item: SpaceActivityItem,
): ActivityPresentation => {
	const who = item.actor.display_name || "Someone";
	switch (item.action) {
		case "capture_candidate_created":
			return {
				detail:
					"Capture produced an expense candidate. Review it before it changes balances.",
				label: "Capture",
				sentence: `${who} created a capture with an expense candidate`,
				visualKey: "reviewPacket",
			};
		case "capture_candidate_ignored":
			return {
				detail:
					"Expense candidate review was removed. The space history stays visible.",
				label: "Capture",
				sentence: `${who} removed expense candidate review data`,
				visualKey: "reviewPacket",
			};
		case "expense_confirmed":
			return {
				detail: "A reviewed capture outcome became a saved expense record.",
				label: "Expense",
				sentence: `${who} confirmed an expense record`,
				visualKey: "expense",
			};
		case "expense_splits_updated":
			return {
				detail: "Split records were updated for an expense in this space.",
				label: "Split",
				sentence: `${who} updated split records`,
				visualKey: "split",
			};
		case "promo_saved":
			return {
				detail: "A reviewed capture outcome became a saved benefit record.",
				label: "Benefit",
				sentence: `${who} saved a benefit record`,
				visualKey: "benefit",
			};
		case "participant_created":
			return {
				detail: "A reviewed capture outcome became a space participant.",
				label: "People",
				sentence: `${who} created a participant record`,
				visualKey: "people",
			};
		case "participant_alias_linked":
			return {
				detail:
					"A duplicate participant name now resolves to one canonical person for splits and stats.",
				label: "People",
				sentence: `${who} linked a participant alias`,
				visualKey: "people",
			};
		case "participant_alias_unlinked":
			return {
				detail:
					"A participant alias was restored as a separate person for future splits.",
				label: "People",
				sentence: `${who} restored a participant alias`,
				visualKey: "people",
			};
		case "recurring_created":
			return {
				detail: "A reviewed capture outcome became a future payment rule.",
				label: "Future",
				sentence: `${who} created a recurring rule`,
				visualKey: "future",
			};
		case "recurring_changed":
			return {
				detail: "Future payment behavior changed for a saved record.",
				label: "Future",
				sentence: `${who} updated a recurring rule`,
				visualKey: "future",
			};
		case "space_created":
			return {
				detail: "Space context was created.",
				label: "Space",
				sentence: `${who} created this space`,
				visualKey: "people",
			};
		case "invite_accepted":
			return {
				detail:
					"A member joined the access layer. Participants still represent split people.",
				label: "People",
				sentence: `${who} accepted an invite`,
				visualKey: "people",
			};
		default:
			return {
				detail: "Space activity changed.",
				label: "Activity",
				sentence: `${who} ${item.action.replace(/_/g, " ")}`,
				visualKey: "unknown",
			};
	}
};

const numberFromMetadata = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return Math.floor(value);
	}
	if (typeof value === "string") {
		const n = Number(value);
		if (Number.isFinite(n) && n > 0) return Math.floor(n);
	}
	return null;
};

const reviewHrefForActivity = (
	spaceKey: string | null,
	item: SpaceActivityItem,
): string | null => {
	if (spaceKey == null) return null;
	const sourceDocumentId = numberFromMetadata(
		item.metadata?.source_document_id,
	);
	if (sourceDocumentId == null) return null;
	return `/console/review?spaceId=${encodeURIComponent(spaceKey)}&sourceDocumentId=${sourceDocumentId}`;
};

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
							const presentation = presentationForActivity(item);
							const pending = item.read_state === "pending";
							const reviewHref = reviewHrefForActivity(spaceKey, item);
							return (
								<li key={String(item.id)}>
									<div
										className={[
											"flex gap-2 rounded-xl border px-2.5 py-2 text-[12px] leading-snug shadow-sm",
											pending
												? "border-[rgba(172,124,35,0.26)] bg-[rgba(255,247,229,0.82)]"
												: "border-border/50 bg-card/35",
										].join(" ")}
									>
										<EntityIcon
											className="mt-0.5"
											size="xs"
											visualKey={presentation.visualKey}
										/>
										<div className="min-w-0 flex-1">
											<div className="flex min-w-0 flex-wrap items-center gap-1.5">
												<span className="rounded-full border border-border/55 bg-background/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
													{presentation.label}
												</span>
												{pending ? (
													<span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
														New
													</span>
												) : null}
											</div>
											<p className="mt-1 font-medium text-foreground">
												{presentation.sentence}
											</p>
											<p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
												{presentation.detail}
											</p>
											<p className="mt-1 text-[10px] text-muted-foreground">
												{formatRelativeShort(item.created_at)}
											</p>
											{reviewHref != null ? (
												<Link
													className="mt-2 inline-flex h-7 items-center rounded-full border border-[rgba(82,72,57,0.16)] bg-background/70 px-2 text-[10px] font-bold uppercase tracking-wide text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													to={reviewHref}
												>
													Review capture
												</Link>
											) : null}
										</div>
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
