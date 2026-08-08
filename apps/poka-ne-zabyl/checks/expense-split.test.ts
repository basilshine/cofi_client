import assert from "node:assert/strict";
import test from "node:test";
import {
	equalSplitAmounts,
	fullSplitAmount,
	splitDistributionIsValid,
} from "../src/expense-split.ts";

test("assigns the whole expense to one participant", () => {
	const amounts = fullSplitAmount(1999.99, 7);

	assert.deepEqual(Array.from(amounts.entries()), [[7, 1999.99]]);
	assert.equal(splitDistributionIsValid(1999.99, amounts, 8), true);
});

test("keeps equal split rounding and rejects an incomplete distribution", () => {
	const equal = equalSplitAmounts(100, [7, 8, 9]);

	assert.deepEqual(Array.from(equal.values()), [33.34, 33.33, 33.33]);
	assert.equal(splitDistributionIsValid(100, equal, 8), true);
	assert.equal(splitDistributionIsValid(100, new Map([[7, 99]]), 8), false);
});
