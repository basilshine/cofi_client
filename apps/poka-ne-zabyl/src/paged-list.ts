export const appendUniquePage = <T extends { id: number }>(
	current: T[],
	incoming: T[],
) => {
	const known = new Set(current.map(({ id }) => id));
	return [
		...current,
		...incoming.filter(({ id }) => {
			if (known.has(id)) {
				return false;
			}
			known.add(id);
			return true;
		}),
	];
};

export const nextPageOffset = (
	reportedOffset: number | undefined,
	requestedOffset: number,
	pageSize: number,
) => reportedOffset ?? requestedOffset + pageSize;
