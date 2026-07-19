import assert from "node:assert/strict";
import test from "node:test";

import { spaceScopedItems } from "../src/space-scoped-data.ts";

test("space-scoped data is hidden after switching spaces", () => {
	const repairBudget = [{ name: "Ремонт", budget: 15000 }];

	assert.deepEqual(spaceScopedItems(repairBudget, 7, 2), []);
	assert.deepEqual(spaceScopedItems(repairBudget, 7, 7), repairBudget);
});
