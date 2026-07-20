import assert from "node:assert/strict";
import test from "node:test";
import { preferredLandingLocale } from "../src/landing-locale.ts";

test("chooses a supported browser language and defaults to English", () => {
	assert.equal(preferredLandingLocale("ru-RU"), "ru");
	assert.equal(preferredLandingLocale("en-GB"), "en");
	assert.equal(preferredLandingLocale("es-MX"), "es");
	assert.equal(preferredLandingLocale("de-DE"), "en");
});

test("keeps an explicit language choice", () => {
	assert.equal(preferredLandingLocale("en-US", "ru"), "ru");
	assert.equal(preferredLandingLocale("ru-RU", "es"), "es");
});
