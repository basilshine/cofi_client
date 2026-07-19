import assert from "node:assert/strict";
import test from "node:test";

import {
	PULL_REFRESH_THRESHOLD,
	pullRefreshDistance,
} from "../src/pull-refresh.ts";

test("pull refresh accepts only a downward vertical gesture and caps its distance", () => {
	assert.equal(pullRefreshDistance(0, -20), 0);
	assert.equal(pullRefreshDistance(60, 30), 0);
	assert.equal(pullRefreshDistance(0, 200), 88);
	assert.ok(pullRefreshDistance(0, 150) >= PULL_REFRESH_THRESHOLD);
});
