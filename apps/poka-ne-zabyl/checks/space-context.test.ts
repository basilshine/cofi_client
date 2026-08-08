import assert from "node:assert/strict";
import test from "node:test";
import { appURLWithSpaceID, preferredSpaceID } from "../src/space-context.ts";

test("restores a space from the URL before local storage", () => {
	assert.equal(preferredSpaceID("?space_id=17", "9"), 17);
	assert.equal(preferredSpaceID("", "9"), 9);
	assert.equal(preferredSpaceID("?space_id=bad", "9"), 9);
});

test("keeps current app parameters while persisting the active space", () => {
	assert.equal(
		appURLWithSpaceID(
			"https://poka-ne-zabyl.ru/app?view=expenses&deploy=abc",
			17,
		),
		"https://poka-ne-zabyl.ru/app?view=expenses&deploy=abc&space_id=17",
	);
});
