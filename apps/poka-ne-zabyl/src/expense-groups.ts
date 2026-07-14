export const groupRowsByExpense = <T extends { expense: { id: number } }>(
	rows: T[],
) => {
	const groups = new Map<number, T[]>();
	for (const row of rows) {
		const group = groups.get(row.expense.id) || [];
		group.push(row);
		groups.set(row.expense.id, group);
	}
	return [...groups.values()];
};
