export const coachmarkIDs = [
	"space",
	"overview",
	"expenses",
	"add",
	"categories",
	"settings",
	"account",
	"expenseDetails",
	"plans",
	"splits",
] as const;

export type CoachmarkID = (typeof coachmarkIDs)[number];

export const nextCoachmark = (
	seen: readonly CoachmarkID[],
	eligible: Partial<Record<CoachmarkID, boolean>>,
) => coachmarkIDs.find((id) => eligible[id] && !seen.includes(id)) ?? null;

export const parseCoachmarks = (value: string | null): CoachmarkID[] => {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed)
			? parsed.filter((id): id is CoachmarkID =>
					coachmarkIDs.includes(id as CoachmarkID),
				)
			: [];
	} catch {
		return [];
	}
};
