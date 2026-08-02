import assert from "node:assert/strict";
import test from "node:test";
import { periodReportTrend } from "../src/period-report.ts";

test("builds trend only from completed reports with matching kind and currency", () => {
	const selected = {
		id: 3,
		kind: "month" as const,
		period_start: "2026-07-01",
		period_end: "2026-07-31",
		currency: "RUB",
		facts: { total_spent: 30_000, previous_total: 20_000 },
	};
	const trend = periodReportTrend(selected, [
		selected,
		{
			...selected,
			id: 2,
			period_start: "2026-06-01",
			period_end: "2026-06-30",
			facts: { total_spent: 20_000, previous_total: 0 },
		},
		{
			...selected,
			id: 4,
			kind: "week",
			facts: { total_spent: 7_000, previous_total: 0 },
		},
		{
			...selected,
			id: 5,
			currency: "USD",
			facts: { total_spent: 300, previous_total: 0 },
		},
	]);

	assert.deepEqual(
		trend.map(({ key }) => key),
		["2", "3"],
	);
	assert.equal(trend[1]?.current, true);
});
