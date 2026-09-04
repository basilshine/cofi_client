import assert from "node:assert/strict";
import test from "node:test";
import {
	categoryChartRows,
	expensesForMonth,
	homeCategoryDistribution,
	homeCategoryRemainder,
	homeCategoryRows,
	homePlanOverview,
} from "../src/overview.ts";

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

test("shows every pinned category beyond the default five rows", () => {
	const rows = homeCategoryRows([
		...Array.from({ length: 7 }, (_, index) => ({
			id: index + 1,
			filteredTotal: index,
			pinned: true,
		})),
		{ id: 8, filteredTotal: 1000 },
	]);

	assert.deepEqual(
		rows.map(({ id }) => id),
		[7, 6, 5, 4, 3, 2, 1],
	);
});

test("builds a top-three category distribution from actual monthly spending", () => {
	const rows = homeCategoryDistribution(
		[
			{ id: 1, homeAmount: 1200, pinned: false },
			{ id: 2, homeAmount: 0, pinned: true },
			{ id: 3, homeAmount: 3000, pinned: false },
			{ id: 4, homeAmount: 800, pinned: false },
			{ id: 5, homeAmount: 500, pinned: false },
		],
		6000,
	);

	assert.deepEqual(
		rows.map(({ id, homeShare }) => ({ id, homeShare })),
		[
			{ id: 3, homeShare: 50 },
			{ id: 1, homeShare: 20 },
			{ id: 4, homeShare: 800 / 60 },
		],
	);
});

test("keeps category shares coherent when category totals exceed the headline total", () => {
	const rows = homeCategoryDistribution(
		[
			{ id: 1, homeAmount: 6000 },
			{ id: 2, homeAmount: 3000 },
			{ id: 3, homeAmount: 1000 },
		],
		5000,
	);

	assert.deepEqual(
		rows.map(({ id, homeShare }) => ({ id, homeShare })),
		[
			{ id: 1, homeShare: 60 },
			{ id: 2, homeShare: 30 },
			{ id: 3, homeShare: 10 },
		],
	);
});

test("summarizes only positive categories hidden after the visible rows", () => {
	const all = [
		{ id: 1, homeAmount: 3200 },
		{ id: 2, homeAmount: 1400 },
		{ id: 3, homeAmount: 900 },
		{ id: 4, homeAmount: 350 },
		{ id: 5, homeAmount: 100 },
		{ id: 6, homeAmount: 50 },
		{ id: 7, homeAmount: 0 },
	];
	const remainder = homeCategoryRemainder(all, all.slice(0, 5), 6000);

	assert.deepEqual(
		remainder?.categories.map(({ id }) => id),
		[6],
	);
	assert.equal(remainder?.homeAmount, 50);
	assert.ok(Math.abs((remainder?.homeShare || 0) - 50 / 60) < 1e-9);
	assert.equal(homeCategoryRemainder(all, all, 6000), null);
});

test("keeps five upcoming plans and summarizes the remaining amount", () => {
	const plans = Array.from({ length: 7 }, (_, index) => ({
		id: index + 1,
		amount: index === 5 ? Number.NaN : (index + 1) * 100,
	}));
	const overview = homePlanOverview(plans, (plan) => plan.amount);

	assert.deepEqual(
		overview.plans.map(({ id }) => id),
		[1, 2, 3, 4, 5],
	);
	assert.deepEqual(
		overview.remainder?.plans.map(({ id }) => id),
		[6, 7],
	);
	assert.equal(overview.remainder?.homeAmount, 700);
	assert.equal(
		homePlanOverview(plans.slice(0, 5), (plan) => plan.amount).remainder,
		null,
	);
});

test("builds a compact category chart with an aggregated remainder", () => {
	const chart = categoryChartRows(
		[
			{ id: 1, amount: 5000 },
			{ id: 2, amount: 3000 },
			{ id: 3, amount: 1200 },
			{ id: 4, amount: 600 },
			{ id: 5, amount: 200 },
			{ id: 6, amount: Number.NaN },
		],
		(category) => category.amount,
		4,
	);

	assert.equal(chart.total, 10000);
	assert.deepEqual(
		chart.rows.map((row) => ({
			id: row.category?.id || null,
			amount: row.amount,
		})),
		[
			{ id: 1, amount: 5000 },
			{ id: 2, amount: 3000 },
			{ id: 3, amount: 1200 },
			{ id: null, amount: 800 },
		],
	);
	assert.equal(
		Math.round(chart.rows.reduce((sum, row) => sum + row.share, 0)),
		100,
	);
});
