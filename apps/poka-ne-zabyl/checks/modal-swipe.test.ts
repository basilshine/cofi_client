import assert from "node:assert/strict";
import test from "node:test";
import { modalSwipeAction } from "../src/modal-swipe.ts";

test("modal swipes down through peek before closing", () => {
	assert.equal(modalSwipeAction("expanded", 80), "peek");
	assert.equal(modalSwipeAction("peek", 80), "close");
	assert.equal(modalSwipeAction("peek", -80), "expand");
	assert.equal(modalSwipeAction("expanded", 30), "none");
});
