import assert from "node:assert/strict";
import test from "node:test";
import { expensesForMonth, homeCategoryRows } from "../src/overview.ts";

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

test("combines category totals with budget state", () => {
	const rows = homeCategoryRows([
		{ id: 1, filteredTotal: 5000 },
		{
			id: 2,
			filteredTotal: 100,
			budget_amount: 1000,
			budget_spent: 1200,
		},
		{
			id: 3,
			filteredTotal: 2000,
			budget_amount: 4000,
			budget_spent: 2000,
		},
		{ id: 4, filteredTotal: 0, pinned: true },
	]);

	assert.deepEqual(
		rows.map(({ id, homeOverLimit, homeProgress }) => ({
			id,
			homeOverLimit,
			homeProgress,
		})),
		[
			{ id: 4, homeOverLimit: false, homeProgress: 0 },
			{ id: 1, homeOverLimit: false, homeProgress: 0 },
			{ id: 3, homeOverLimit: false, homeProgress: 50 },
			{ id: 2, homeOverLimit: true, homeProgress: 100 },
		],
	);
	assert.equal(rows[3].homeAmount, 100);
	assert.equal(rows[3].homeDifference, 200);
});
