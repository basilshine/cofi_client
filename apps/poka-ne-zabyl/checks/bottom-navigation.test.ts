import assert from "node:assert/strict";
import test from "node:test";

import { compactBottomNavigation } from "../src/bottom-navigation.ts";

test("bottom navigation follows deliberate scroll direction and expands at the top", () => {
	assert.equal(compactBottomNavigation(false, 100, 112), true);
	assert.equal(compactBottomNavigation(true, 112, 100), false);
	assert.equal(compactBottomNavigation(true, 100, 96), true);
	assert.equal(compactBottomNavigation(true, 30, 20), false);
});
