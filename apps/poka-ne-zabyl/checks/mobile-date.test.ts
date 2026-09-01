import assert from "node:assert/strict";
import test from "node:test";
import { mobileDatePresentation } from "../src/mobile-date.ts";

test("presents an empty date as a clear mobile action", () => {
	assert.deepEqual(mobileDatePresentation("", "ru", "2026-09-01"), {
		primary: "Без даты",
		secondary: "Нажмите, чтобы выбрать",
	});
});

test("calls out today and tomorrow without hiding the full date", () => {
	const today = mobileDatePresentation("2026-09-01", "ru", "2026-09-01");
	const tomorrow = mobileDatePresentation("2026-09-02", "en", "2026-09-01");

	assert.match(today.primary, /1 сентября 2026/);
	assert.equal(today.secondary, "Сегодня");
	assert.equal(tomorrow.primary, "September 2, 2026");
	assert.equal(tomorrow.secondary, "Tomorrow");
});

test("uses the localized weekday for later dates", () => {
	const result = mobileDatePresentation("2026-09-03", "es", "2026-09-01");

	assert.equal(result.primary, "3 de septiembre de 2026");
	assert.equal(result.secondary, "jueves");
});
