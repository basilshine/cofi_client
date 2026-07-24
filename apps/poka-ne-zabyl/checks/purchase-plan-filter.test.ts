import assert from "node:assert/strict";
import test from "node:test";
import {
	collapsePurchasePlanSeries,
	filterPurchasePlans,
	partitionOverduePurchasePlans,
	planPeriodBounds,
	purchasePlanOccurrenceCount,
} from "../src/purchase-plan-filter.ts";

test("filters multi-item plans and builds future date ranges", () => {
	const plans = [
		{
			title: "Покупки на неделю",
			vendor_id: 4,
			due_date: "2026-07-17",
			items: [
				{ name: "Молоко", category_id: 2 },
				{ name: "Хлеб", category_id: 2 },
			],
		},
		{
			title: "Когда-нибудь",
			items: [{ name: "Лампа", category_id: 8 }],
		},
	];
	assert.deepEqual(planPeriodBounds("week", "", "", new Date(2026, 6, 15)), {
		from: "2026-07-15",
		to: "2026-07-21",
	});
	assert.equal(
		filterPurchasePlans(plans, {
			query: "хлеб",
			categoryID: 2,
			vendorID: 4,
			from: "2026-07-15",
			to: "2026-07-21",
		}).length,
		1,
	);
	assert.deepEqual(
		partitionOverduePurchasePlans(plans, "2026-07-18").overdue.map(
			(plan) => plan.title,
		),
		["Покупки на неделю"],
	);
});

test("forecasts recurring plans without duplicating a stored series", () => {
	const recurring = {
		id: 7,
		title: "Подписка",
		due_date: "2026-07-06",
		recurrence_interval: "weekly" as const,
		recurrence_series_id: 7,
	};
	const duplicate = { ...recurring, id: 8, due_date: "2026-07-13" };
	assert.equal(
		purchasePlanOccurrenceCount(recurring, "2026-07-01", "2026-07-31"),
		4,
	);
	assert.equal(collapsePurchasePlanSeries([duplicate, recurring]).length, 1);

	assert.equal(
		purchasePlanOccurrenceCount(
			{
				title: "Аренда",
				due_date: "2026-01-31",
				recurrence_interval: "monthly",
				recurrence_day: 31,
			},
			"2026-02-01",
			"2026-04-30",
		),
		3,
	);
});
