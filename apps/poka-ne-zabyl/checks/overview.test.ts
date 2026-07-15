import assert from "node:assert/strict";
import test from "node:test";
import { entriesForMonth, expensesForMonth } from "../src/overview.ts";

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

test("totals only dated plans in the selected calendar month", () => {
	const plans = [
		{ due_date: "2026-07-20", amount: 1200 },
		{ due_date: "2026-08-01", amount: 900 },
		{ due_date: null, amount: 500 },
	];
	assert.equal(
		entriesForMonth(
			plans,
			(plan) => plan.due_date,
			new Date(2026, 6, 15),
		).reduce((sum, plan) => sum + plan.amount, 0),
		1200,
	);
});
