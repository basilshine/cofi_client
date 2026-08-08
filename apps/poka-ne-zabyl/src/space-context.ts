export const LAST_SPACE_STORAGE_KEY = "pnz:last-space-id";

export const preferredSpaceID = (
	search: string,
	storedSpaceID: string | null,
) => {
	const requested = Number(new URLSearchParams(search).get("space_id"));
	if (Number.isInteger(requested) && requested > 0) return requested;
	const stored = Number(storedSpaceID);
	return Number.isInteger(stored) && stored > 0 ? stored : 0;
};

export const appURLWithSpaceID = (href: string, spaceID: number) => {
	const url = new URL(href);
	if (spaceID > 0) url.searchParams.set("space_id", String(spaceID));
	else url.searchParams.delete("space_id");
	return url.toString();
};
