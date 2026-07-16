import assert from "node:assert/strict";
import test from "node:test";
import {
	homeScreenPlatform,
	shouldUseFullscreen,
} from "../src/telegram-platform.ts";

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

test("detects the home screen installation platform", () => {
	assert.equal(
		homeScreenPlatform(
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
		),
		"ios",
	);
	assert.equal(
		homeScreenPlatform("Mozilla/5.0 (Linux; Android 15; Pixel 9)"),
		"android",
	);
	assert.equal(
		homeScreenPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X)"),
		"desktop",
	);
});
