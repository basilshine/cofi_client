import assert from "node:assert/strict";
import test from "node:test";
import { spaceMemberCountText } from "../src/mini-i18n.ts";

test("describes personal and shared space membership", () => {
	assert.equal(spaceMemberCountText(1, "ru"), "Только вы");
	assert.equal(spaceMemberCountText(2, "ru"), "2 участника");
	assert.equal(spaceMemberCountText(5, "ru"), "5 участников");
	assert.equal(spaceMemberCountText(3, "en"), "3 members");
});
