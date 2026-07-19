import assert from "node:assert/strict";
import test from "node:test";
import {
	hashtagAtCursor,
	hashtagSuggestions,
	hashtagsFromText,
	replaceHashtagAtCursor,
	tagsAfterNotesEdit,
} from "../src/hashtags.ts";

test("extracts, suggests and completes unicode hashtags", () => {
	assert.deepEqual(hashtagsFromText("Оплатил #Кредитка и #радость #кредитка"), [
		"кредитка",
		"радость",
	]);
	assert.deepEqual(hashtagAtCursor("Покупка #кре", 12), {
		start: 8,
		query: "кре",
	});
	assert.deepEqual(hashtagSuggestions(["наличные", "кредитка"], "кре"), [
		"кредитка",
	]);
	assert.deepEqual(replaceHashtagAtCursor("Покупка #кре", 12, "кредитка"), {
		value: "Покупка #кредитка ",
		cursor: 18,
	});
	assert.deepEqual(tagsAfterNotesEdit(["магазин"], "Без тегов", "Очень рад"), [
		"магазин",
	]);
	assert.deepEqual(tagsAfterNotesEdit(["магазин"], "#карта", "#наличные"), [
		"наличные",
	]);
});
