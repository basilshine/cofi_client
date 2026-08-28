import type { SheetData, SheetOptions } from "write-excel-file/browser";

export type ExpenseExportRow = {
	space: string;
	date: string;
	expense: string;
	item: string;
	vendor: string;
	category: string;
	amount: number;
	currency: string;
	originalAmount?: number;
	originalCurrency?: string;
	payer: string;
	addedBy: string;
	notes: string;
	tags: string;
};

export type ExpenseExportLabels = Record<keyof ExpenseExportRow, string>;

const safeSpreadsheetText = (value: string) => {
	const firstVisible = [...value].find(
		(character) => character.charCodeAt(0) >= 32 && character.trim() !== "",
	);
	return firstVisible && "=+-@".includes(firstVisible) ? `'${value}` : value;
};

const columns: (keyof ExpenseExportRow)[] = [
	"space",
	"date",
	"expense",
	"item",
	"vendor",
	"category",
	"amount",
	"currency",
	"originalAmount",
	"originalCurrency",
	"payer",
	"addedBy",
	"notes",
	"tags",
];

const columnWidths = [22, 13, 30, 28, 22, 20, 14, 11, 17, 16, 20, 20, 32, 24];

const localizedDate = (value: string, locale: string) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return value;
	const [, year, month, day] = match;
	return new Intl.DateTimeFormat(locale).format(
		new Date(Number(year), Number(month) - 1, Number(day), 12),
	);
};

export const expenseSelectionWorkbook = (
	rows: ExpenseExportRow[],
	labels: ExpenseExportLabels,
	locale: string,
): { data: SheetData; options: SheetOptions<Blob> } => {
	const header = columns.map((column) => ({
		value: labels[column],
		fontWeight: "bold" as const,
		textColor: "#172044",
		backgroundColor: "#E8EDFF",
		bottomBorderColor: "#9BAAE8",
		bottomBorderStyle: "thin" as const,
		alignVertical: "center" as const,
		wrap: true,
		height: 34,
	}));
	const body = rows.map((row, rowIndex) =>
		columns.map((column) => {
			const value = row[column];
			const backgroundColor = rowIndex % 2 === 1 ? "#F8F9FC" : undefined;
			if (column === "date") {
				return {
					value: localizedDate(String(value || ""), locale),
					backgroundColor,
					alignVertical: "top" as const,
				};
			}
			if (typeof value === "number") {
				return {
					value,
					type: Number,
					format: "#,##0.00",
					backgroundColor,
					align: "right" as const,
					alignVertical: "top" as const,
				};
			}
			return {
				value: safeSpreadsheetText(value || ""),
				backgroundColor,
				alignVertical: "top" as const,
				wrap: true,
			};
		}),
	);

	return {
		data: [header, ...body],
		options: {
			columns: columnWidths.map((width) => ({ width })),
			stickyRowsCount: 1,
			showGridLines: false,
			zoomScale: 0.9,
		},
	};
};

export const expenseSelectionFilename = (space: string, date: string) => {
	const safeSpace = [...space]
		.map((character) =>
			character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
				? "-"
				: character,
		)
		.join("")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 48);
	return `poka-ne-zabyl-${safeSpace || "expenses"}-${date}.xlsx`;
};
