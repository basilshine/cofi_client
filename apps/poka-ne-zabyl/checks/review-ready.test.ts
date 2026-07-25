import assert from "node:assert/strict";
import test from "node:test";
import { reviewReadySummary } from "../src/money.ts";

test("summarizes recognized receipt items before confirmation", () => {
	assert.deepEqual(
		reviewReadySummary(
			[
				{ name: "Молоко", amount: 120 },
				{ name: "Хлеб", amount: 80 },
			],
			200,
		),
		{ total: 200, incompleteItems: 0, totalMatches: true },
	);
	assert.deepEqual(reviewReadySummary([{ name: "", amount: 0 }], 100), {
		total: 0,
		incompleteItems: 1,
		totalMatches: false,
	});
});
