import assert from "node:assert/strict";
import test from "node:test";
import {
	landingAppPath,
	legalPagePath,
	preferredLandingLocale,
} from "../src/landing-locale.ts";

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

test("landing app links preserve the selected language", () => {
	assert.equal(landingAppPath("ru"), "/app");
	assert.equal(landingAppPath("en"), "/app?lang=en");
	assert.equal(
		landingAppPath("es", "view=subscription"),
		"/app?view=subscription&lang=es",
	);
});

test("landing app links keep ad attribution without leaking other query data", () => {
	assert.equal(
		landingAppPath(
			"ru",
			"view=subscription",
			"?yclid=123&utm_source=yandex&preview=1",
		),
		"/app?view=subscription&yclid=123&utm_source=yandex",
	);
});

test("legal links preserve the selected language", () => {
	assert.equal(legalPagePath("ru", "consent"), "/consent");
	assert.equal(legalPagePath("en", "privacy"), "/en/privacy");
	assert.equal(legalPagePath("es", "consent"), "/es/consent");
});
