import type { Space, SpaceMember } from "@cofi/api";
import { useMemo } from "react";

const initial = (s: string | undefined) => {
	const t = (s ?? "").trim();
	if (!t) return "?";
	const parts = t.split(/\s+/);
	if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
	return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
};

const memberLabel = (m: SpaceMember) =>
	(m.name?.trim() || m.email?.trim() || `User ${m.user_id}`).trim();

const formatRelative = (iso?: string | null): string | null => {
	if (!iso) return null;
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) return null;
	const diff = Date.now() - ts;
	const min = Math.round(diff / 60000);
	if (min < 1) return "active just now";
	if (min < 60) return `active ${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `active ${hr}h ago`;
	const day = Math.round(hr / 24);
	if (day < 7) return `active ${day}d ago`;
	const week = Math.round(day / 7);
	if (week < 5) return `active ${week}w ago`;
	const month = Math.round(day / 30);
	return `active ${month}mo ago`;
};

export type SpaceHeaderProps = {
	space: Space | null;
	members?: SpaceMember[] | null;
	currentUserId?: number | null;
	/** Optional right-aligned slot for inline actions (e.g. Quick add). */
	rightSlot?: React.ReactNode;
};

/**
 * Minimal, premium space header used at the top of every in-space page.
 * Presents title + a quiet subtitle (sharing summary or last activity) and an
 * avatar stack so the user knows whose space they are in.
 */
export const SpaceHeader = ({
	space,
	members,
	currentUserId,
	rightSlot,
}: SpaceHeaderProps) => {
	const title = space?.name?.trim() || "Untitled space";

	const subtitle = useMemo((): string => {
		if (!space) return "";
		const list = members ?? [];
		const others =
			currentUserId != null
				? list.filter((m) => Number(m.user_id) !== Number(currentUserId))
				: list;

		if (others.length === 0) {
			return space.description?.trim() ?? "Just you for now";
		}

		if (others.length === 1) {
			return `Shared with ${memberLabel(others[0])}`;
		}

		if (others.length === 2) {
			return `Shared with ${memberLabel(others[0])} and ${memberLabel(others[1])}`;
		}

		return `Shared with ${memberLabel(others[0])}, ${memberLabel(others[1])} and ${others.length - 2} more`;
	}, [space, members, currentUserId]);

	const lastActivity = formatRelative(space?.last_activity_at ?? null);

	const avatars = useMemo(() => {
		const list = (members ?? []).slice(0, 4);
		return list.map((m) => ({
			id: m.user_id,
			label: memberLabel(m),
			isMe:
				currentUserId != null && Number(m.user_id) === Number(currentUserId),
		}));
	}, [members, currentUserId]);

	const overflow = Math.max(0, (members?.length ?? 0) - avatars.length);

	return (
		<header className="flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0 max-w-full space-y-2">
				<p className="eyebrow">Space</p>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-[34px]">
						{title}
					</h1>
					{avatars.length ? (
						<div
							aria-label={`${members?.length ?? 0} members`}
							className="flex shrink-0 items-center -space-x-1.5"
						>
							{avatars.map((a) => (
								<span
									aria-label={a.label}
									className={[
										"inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold tracking-tight",
										a.isMe
											? "bg-secondary text-secondary-foreground"
											: "bg-muted text-foreground",
									].join(" ")}
									key={a.id}
									title={a.label}
								>
									{initial(a.label)}
								</span>
							))}
							{overflow > 0 ? (
								<span
									className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border-2 border-background bg-muted px-1.5 text-[10px] font-bold text-muted-foreground"
									title={`${overflow} more member${overflow === 1 ? "" : "s"}`}
								>
									+{overflow}
								</span>
							) : null}
						</div>
					) : null}
				</div>
				<p className="text-sm text-muted-foreground">
					{subtitle}
					{lastActivity ? (
						<span className="text-muted-foreground/70"> · {lastActivity}</span>
					) : null}
				</p>
			</div>
			{rightSlot ? (
				<div className="flex shrink-0 items-center gap-2">{rightSlot}</div>
			) : null}
		</header>
	);
};
