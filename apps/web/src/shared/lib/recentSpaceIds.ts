const STORAGE_KEY = "ceits.recentSpaceIds";
const MAX_RECENT = 32;

/**
 * Most-recent-first space ids (cross-session). Used to order Quick capture chips.
 */
export const readRecentSpaceIds = (): number[] => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const arr = JSON.parse(raw) as unknown;
		if (!Array.isArray(arr)) return [];
		return arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
	} catch {
		return [];
	}
};

export const touchRecentSpaceId = (spaceId: number): void => {
	if (!Number.isFinite(spaceId) || spaceId <= 0) return;
	try {
		const next = [
			spaceId,
			...readRecentSpaceIds().filter((id) => id !== spaceId),
		].slice(0, MAX_RECENT);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		/* ignore quota / private mode */
	}
};

export const orderSpacesByRecent = <T extends { id: string | number }>(
	spaces: T[],
): T[] => {
	const recent = readRecentSpaceIds();
	const byId = new Map<number, T>();
	for (const s of spaces) {
		const id = Number(s.id);
		if (Number.isFinite(id)) byId.set(id, s);
	}
	const ordered: T[] = [];
	const used = new Set<number>();
	for (const rid of recent) {
		const s = byId.get(rid);
		if (s) {
			ordered.push(s);
			used.add(rid);
		}
	}
	for (const s of spaces) {
		const id = Number(s.id);
		if (!used.has(id) && Number.isFinite(id)) ordered.push(s);
	}
	return ordered;
};

/** Server-provided `last_activity_at` first (newest at top); then local recent touches; then name. */
export const sortSpacesByLastActivity = <
	T extends {
		id: string | number;
		name?: string;
		last_activity_at?: string;
	},
>(
	spaces: T[],
): T[] => {
	const recent = readRecentSpaceIds();
	const recentRank = new Map<number, number>();
	recent.forEach((id, idx) => recentRank.set(id, idx));

	const activityTs = (s: T): number => {
		const raw = s.last_activity_at;
		if (raw == null || typeof raw !== "string") return 0;
		const n = Date.parse(raw);
		return Number.isFinite(n) ? n : 0;
	};

	return [...spaces].sort((a, b) => {
		const da = activityTs(a);
		const db = activityTs(b);
		if (da !== db) return db - da;
		const ra = recentRank.get(Number(a.id)) ?? 9999;
		const rb = recentRank.get(Number(b.id)) ?? 9999;
		if (ra !== rb) return ra - rb;
		const na = (a.name ?? "").trim();
		const nb = (b.name ?? "").trim();
		return na.localeCompare(nb, undefined, { sensitivity: "base" });
	});
};
