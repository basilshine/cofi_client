import assert from "node:assert/strict";
import test from "node:test";
import {
	type ExpenseExportLabels,
	expenseSelectionFilename,
	expenseSelectionWorkbook,
} from "../src/expense-export.ts";

const labels: ExpenseExportLabels = {
	space: "Пространство",
	date: "Дата",
	expense: "Расход",
	item: "Позиция",
	vendor: "Продавец",
	category: "Категория",
	amount: "Сумма",
	currency: "Валюта",
	originalAmount: "Исходная сумма",
	originalCurrency: "Исходная валюта",
	payer: "Кто оплатил",
	addedBy: "Кто добавил",
	notes: "Заметка",
	tags: "Теги",
};

const row = {
	space: "Семейный бюджет",
	date: "2026-08-28",
	expense: "Покупки на неделю",
	item: "Кофе, молоко",
	vendor: 'Магазин "Рядом"',
	category: "Продукты",
	amount: 1435.5,
	currency: "RUB",
	originalAmount: 18.25,
	originalCurrency: "USD",
	payer: "Наталья",
	addedBy: "Василий",
	notes: "По акции",
	tags: "#дом #еда",
};

test("builds a styled Excel sheet with Unicode text and numeric amounts", () => {
	const workbook = expenseSelectionWorkbook([row], labels, "ru-RU");
	assert.equal(workbook.data[0][0]?.value, "Пространство");
	assert.equal(workbook.data[1][0]?.value, "Семейный бюджет");
	assert.equal(workbook.data[1][1]?.value, "28.08.2026");
	assert.equal(workbook.data[1][6]?.value, 1435.5);
	assert.equal(workbook.data[1][6]?.type, Number);
	assert.equal(workbook.options.stickyRowsCount, 1);
	assert.equal(workbook.options.columns?.length, 14);
});

test("neutralizes spreadsheet formulas in user-entered text", () => {
	const workbook = expenseSelectionWorkbook(
		[{ ...row, item: '=HYPERLINK("https://example.com")', notes: "+1" }],
		labels,
		"ru-RU",
	);
	assert.equal(
		workbook.data[1][3]?.value,
		'\'=HYPERLINK("https://example.com")',
	);
	assert.equal(workbook.data[1][12]?.value, "'+1");
});

test("creates a filesystem-safe Excel filename that describes the space", () => {
	assert.equal(
		expenseSelectionFilename("Ремонт: Белозёрский / 2", "2026-08-28"),
		"poka-ne-zabyl-Ремонт-Белозёрский-2-2026-08-28.xlsx",
	);
});
