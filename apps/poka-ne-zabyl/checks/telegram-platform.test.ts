import assert from "node:assert/strict";
import test from "node:test";
import { shouldUseFullscreen } from "../src/telegram-platform.ts";

test("uses fullscreen only in Telegram mobile clients", () => {
	for (const platform of ["android", "android_x", "ios"]) {
		assert.equal(shouldUseFullscreen(platform), true);
	}
	for (const platform of [
		"macos",
		"tdesktop",
		"weba",
		"webk",
		"unigram",
		"unknown",
	]) {
		assert.equal(shouldUseFullscreen(platform), false);
	}
});
