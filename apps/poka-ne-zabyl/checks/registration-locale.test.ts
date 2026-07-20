import assert from "node:assert/strict";
import test from "node:test";

import { browserRegistrationCountry } from "../src/registration-locale.ts";

test("infers a registration country from the browser locale", () => {
	assert.equal(browserRegistrationCountry("ru"), "RU");
	assert.equal(browserRegistrationCountry("en-GB"), "GB");
	assert.equal(browserRegistrationCountry(""), "");
});
