import assert from "node:assert/strict";
import test from "node:test";
import {
	categoryBudgetSummary,
	shiftCategoryMonth,
} from "../src/category-budget-summary.ts";

test("summarizes monthly limits without mixing weekly budgets", () => {
	assert.deepEqual(
		categoryBudgetSummary([
			{ monthSpent: 320, budgetAmount: 1_000, budgetPeriod: "month" },
			{ monthSpent: 180, budgetAmount: 250, budgetPeriod: "week" },
			{ monthSpent: 75, budgetAmount: 0 },
		]),
		{ spent: 575, limit: 1_000, remaining: 425 },
	);
});

test("moves across year boundaries", () => {
	assert.equal(shiftCategoryMonth("2026-01", -1), "2025-12");
	assert.equal(shiftCategoryMonth("2025-12", 1), "2026-01");
});
