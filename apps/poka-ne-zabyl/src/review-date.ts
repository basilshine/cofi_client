const localISODate = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export type ReviewDateConcern = "old" | "future" | null;

export const reviewDateConcern = (
	value: string,
	today = new Date(),
): ReviewDateConcern => {
	const date = value.slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

	const oldestExpected = new Date(today);
	oldestExpected.setFullYear(oldestExpected.getFullYear() - 1);
	const latestExpected = new Date(today);
	latestExpected.setDate(latestExpected.getDate() + 1);

	if (date < localISODate(oldestExpected)) return "old";
	if (date > localISODate(latestExpected)) return "future";
	return null;
};
