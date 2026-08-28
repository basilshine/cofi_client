export type ItemSplitSource = { id: number; amount: number };

const equalItemAmounts = (total: number, participantIDs: number[]) => {
	const amounts = new Map<number, number>();
	if (participantIDs.length === 0) return amounts;
	const totalCents = Math.round(total * 100);
	const base = Math.floor(totalCents / participantIDs.length);
	let remainder = totalCents - base * participantIDs.length;
	for (const participantID of participantIDs) {
		const bonus = remainder > 0 ? 1 : 0;
		if (remainder > 0) remainder -= 1;
		amounts.set(participantID, (base + bonus) / 100);
	}
	return amounts;
};

export const itemAssignmentsAreComplete = (
	items: ItemSplitSource[],
	assignments: Map<number, number[]>,
) =>
	items.length > 0 &&
	items.every((item) => (assignments.get(item.id) || []).length > 0);

export const aggregateItemAssignments = (
	items: ItemSplitSource[],
	assignments: Map<number, number[]>,
) => {
	const totals = new Map<number, number>();
	for (const item of items) {
		const participantIDs = [...(assignments.get(item.id) || [])].sort(
			(a, b) => a - b,
		);
		for (const [participantID, amount] of equalItemAmounts(
			item.amount,
			participantIDs,
		)) {
			totals.set(
				participantID,
				Math.round(((totals.get(participantID) || 0) + amount) * 100) / 100,
			);
		}
	}
	return totals;
};
