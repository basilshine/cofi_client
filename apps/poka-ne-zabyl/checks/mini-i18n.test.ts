import assert from "node:assert/strict";
import test from "node:test";
import { browserAuthCopy } from "../src/browser-auth-copy.ts";
import {
	type UIMessage,
	normalizeUILanguage,
	uiText,
} from "../src/mini-i18n.ts";

const criticalCaptureMessages: UIMessage[] = [
	"addExpense",
	"addPlan",
	"captureText",
	"captureVoice",
	"capturePhoto",
	"captureManual",
	"captureSend",
	"captureProcessing",
	"reviewExpense",
	"reviewReceipt",
	"reviewEstimate",
	"purchasePlace",
	"items",
	"saveExpense",
	"deleteRecognizedExpense",
	"expenseSaved",
];

test("normalizes the supported profile languages", () => {
	assert.equal(normalizeUILanguage("ru-RU"), "ru");
	assert.equal(normalizeUILanguage("en-US"), "en");
	assert.equal(normalizeUILanguage("es-ES"), "es");
	assert.equal(normalizeUILanguage("de-DE"), "ru");
});

test("capture and review flows do not leak Russian copy into other locales", () => {
	for (const language of ["en", "es"] as const) {
		for (const key of criticalCaptureMessages) {
			assert.doesNotMatch(
				uiText(language, key),
				/[А-Яа-яЁё]/,
				`${language}.${key}`,
			);
		}
	}
});

test("browser authentication does not leak Russian copy into other locales", () => {
	for (const language of ["en", "es"] as const) {
		assert.doesNotMatch(
			JSON.stringify(browserAuthCopy(language)),
			/[А-Яа-яЁё]/,
		);
	}
});
