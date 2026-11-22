import assert from "node:assert/strict";
import test from "node:test";
import {
	browserAuthConfirmError,
	browserAuthCopy,
} from "../src/browser-auth-copy.ts";
import {
	type UIMessage,
	linkedIdentityErrorText,
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

test("browser authentication distinguishes an unlinked phone, an expired call and an email code", () => {
	for (const language of ["ru", "en", "es"] as const) {
		const copy = browserAuthCopy(language);
		assert.equal(
			browserAuthConfirmError(
				language,
				"phone",
				"verified phone is not linked to an account",
			),
			copy.phoneNotLinked,
		);
		assert.equal(
			browserAuthConfirmError(language, "phone", "verification call expired"),
			copy.phoneExpired,
		);
		assert.equal(
			browserAuthConfirmError(language, "phone", "invalid or expired code"),
			copy.invalidCall,
		);
		assert.equal(
			browserAuthConfirmError(language, "email", "invalid or expired code"),
			copy.invalidCode,
		);
	}
});

test("localizes already-linked identity errors", () => {
	assert.equal(
		linkedIdentityErrorText("ru", "email", "Email is already linked", ""),
		"Эта почта уже привязана к другому аккаунту.",
	);
	assert.equal(
		linkedIdentityErrorText("ru", "telegram", "telegram already linked", ""),
		"Этот Telegram уже привязан к другому аккаунту.",
	);
});
