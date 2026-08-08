import assert from "node:assert/strict";
import test from "node:test";
import { itemCountText, purchaseCountText, uiText } from "../src/mini-i18n.ts";

test("expense summary labels and purchase counts follow the UI language", () => {
	assert.equal(uiText("en", "found"), "Found");
	assert.equal(uiText("es", "total"), "Total");
	assert.equal(uiText("en", "selectedExpense"), "Selected expense");
	assert.equal(purchaseCountText(1, "en"), "1 purchase");
	assert.equal(purchaseCountText(2, "es"), "2 compras");
	assert.equal(purchaseCountText(5, "ru"), "5 покупок");
	assert.equal(itemCountText(1, "en"), "1 item");
	assert.equal(itemCountText(2, "es"), "2 artículos");
	assert.equal(itemCountText(5, "ru"), "5 позиций");
});
