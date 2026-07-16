import assert from "node:assert/strict";
import test from "node:test";
import { expensesForMonth } from "../src/overview.ts";

test("keeps only expenses from the selected calendar month", () => {
	const expenses = [
		{ id: 1, expense_date: "2026-07-01" },
		{ id: 2, expense_date: "2026-07-31T12:00:00Z" },
		{ id: 3, expense_date: "2026-06-30" },
	];
	assert.deepEqual(
		expensesForMonth(expenses, new Date(2026, 6, 15)).map(({ id }) => id),
		[1, 2],
	);
});
