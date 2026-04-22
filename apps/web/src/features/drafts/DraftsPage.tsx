import type { Draft, DraftItem } from "@cofi/api";
import { useEffect, useMemo, useState } from "react";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { apiClient } from "../../shared/lib/apiClient";

type ItemFormRow = {
	name: string;
	amount: string;
	emotion: string;
	tags: string;
	expense_date: string;
};

const emptyRow = (): ItemFormRow => ({
	name: "",
	amount: "",
	emotion: "",
	tags: "",
	expense_date: "",
});

const draftToRows = (d: Draft): ItemFormRow[] =>
	d.items.map((it) => ({
		name: it.name ?? "",
		amount: String(it.amount ?? ""),
		emotion: it.emotion ?? "",
		tags: (it.tags ?? []).join(", "),
		expense_date: it.expense_date ?? "",
	}));

const parseTags = (raw: string): string[] | undefined => {
	const parts = raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return parts.length ? parts : undefined;
};

const rowsToDraftItems = (rows: ItemFormRow[]): DraftItem[] => {
	const out: DraftItem[] = [];
	for (const row of rows) {
		const name = row.name.trim();
		const amount = Number.parseFloat(row.amount.replace(",", "."));
		if (!name || !Number.isFinite(amount)) continue;
		const item: DraftItem = {
			name,
			amount,
		};
		const em = row.emotion.trim();
		if (em) item.emotion = em;
		const tags = parseTags(row.tags);
		if (tags) item.tags = tags;
		const ed = row.expense_date.trim();
		if (ed) item.expense_date = ed;
		out.push(item);
	}
	return out;
};

const sumItems = (items: DraftItem[]): number =>
	items.reduce((s, it) => s + (Number.isFinite(it.amount) ? it.amount : 0), 0);

export const DraftsPage = () => {
	useConsoleHeaderTitle("Drafts", null);
	const [spaceId, setSpaceId] = useState<string>("1");
	const [text, setText] = useState("");
	const [draft, setDraft] = useState<Draft | null>(null);
	const [rows, setRows] = useState<ItemFormRow[]>([]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (!draft) {
			setRows([]);
			return;
		}
		setRows(draftToRows(draft));
	}, [draft]);

	const computedTotal = useMemo(() => sumItems(rowsToDraftItems(rows)), [rows]);

	const handleCreateFromText = async () => {
		if (!text.trim()) return;
		setIsLoading(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			const data = await apiClient.drafts.createFromText({
				space_id: spaceId,
				text: text.trim(),
			});
			setDraft(data);
		} catch (err) {
			setDraft(null);
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to create draft",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSaveDraft = async () => {
		if (!draft) return;
		const items = rowsToDraftItems(rows);
		if (!items.length) {
			setErrorMessage("Add at least one line with a name and valid amount.");
			setSuccessMessage(null);
			return;
		}
		setIsLoading(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			const total = sumItems(items);
			const updated = await apiClient.drafts.update(draft.id, {
				items,
				total,
			});
			setDraft(updated);
			setSuccessMessage("Draft saved.");
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to update draft",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleConfirm = async () => {
		if (!draft) return;
		setIsLoading(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			await apiClient.drafts.confirm(draft.id);
			setDraft(null);
			setSuccessMessage("Draft confirmed.");
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to confirm draft",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = async () => {
		if (!draft) return;
		setIsLoading(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			await apiClient.drafts.cancel(draft.id);
			setDraft(null);
			setSuccessMessage("Draft cancelled.");
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to cancel draft",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleRowChange = (
		index: number,
		field: keyof ItemFormRow,
		value: string,
	) => {
		setRows((prev) => {
			const next = [...prev];
			const row = next[index];
			if (!row) return prev;
			next[index] = { ...row, [field]: value };
			return next;
		});
	};

	const handleAddRow = () => {
		setRows((prev) => [...prev, emptyRow()]);
	};

	const handleRemoveRow = (index: number) => {
		setRows((prev) => prev.filter((_, i) => i !== index));
	};

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">Drafts</h1>
				<p className="text-sm text-muted-foreground">
					Create a draft from text, edit line items, save, then confirm or
					cancel. Verify confirmed rows in History.
				</p>
			</div>

			<div className="rounded-lg border border-border bg-card p-4">
				<div className="grid gap-3">
					<label className="grid gap-1">
						<span className="text-xs font-medium text-muted-foreground">
							Space ID
						</span>
						<input
							className="h-10 w-48 rounded-md border border-border bg-background px-3 text-sm"
							onChange={(e) => setSpaceId(e.target.value)}
							type="text"
							value={spaceId}
						/>
					</label>

					<label className="grid gap-1">
						<span className="text-xs font-medium text-muted-foreground">
							Text input
						</span>
						<textarea
							className="min-h-28 rounded-md border border-border bg-background p-3 text-sm"
							onChange={(e) => setText(e.target.value)}
							placeholder="Bought coffee for 200"
							value={text}
						/>
					</label>

					<div className="flex flex-wrap items-center gap-2">
						<button
							className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
							disabled={isLoading || !text.trim()}
							onClick={() => void handleCreateFromText()}
							type="button"
						>
							Create draft from text
						</button>

						<button
							className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
							disabled={isLoading || !draft}
							onClick={() => void handleSaveDraft()}
							type="button"
						>
							Save changes
						</button>

						<button
							className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
							disabled={isLoading || !draft}
							onClick={() => void handleConfirm()}
							type="button"
						>
							Confirm draft
						</button>

						<button
							className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
							disabled={isLoading || !draft}
							onClick={() => void handleCancel()}
							type="button"
						>
							Cancel draft
						</button>
					</div>
				</div>
			</div>

			{draft ? (
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-sm font-semibold">Edit draft</h2>
						<div className="text-xs text-muted-foreground">
							Draft #{String(draft.id)} · Total (edited):{" "}
							<span className="font-mono text-foreground">
								{computedTotal.toFixed(2)}
							</span>
						</div>
					</div>

					<div className="space-y-3">
						{rows.map((row, index) => (
							<div
								className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-2 lg:grid-cols-3"
								key={`${draft.id}-row-${index}`}
							>
								<label className="grid gap-1 sm:col-span-2 lg:col-span-1">
									<span className="text-xs font-medium text-muted-foreground">
										Name
									</span>
									<input
										aria-label={`Item ${index + 1} name`}
										className="h-9 rounded-md border border-border bg-card px-2 text-sm"
										onChange={(e) =>
											handleRowChange(index, "name", e.target.value)
										}
										type="text"
										value={row.name}
									/>
								</label>
								<label className="grid gap-1">
									<span className="text-xs font-medium text-muted-foreground">
										Amount
									</span>
									<input
										aria-label={`Item ${index + 1} amount`}
										className="h-9 rounded-md border border-border bg-card px-2 text-sm"
										inputMode="decimal"
										onChange={(e) =>
											handleRowChange(index, "amount", e.target.value)
										}
										type="text"
										value={row.amount}
									/>
								</label>
								<label className="grid gap-1">
									<span className="text-xs font-medium text-muted-foreground">
										Emotion (optional)
									</span>
									<input
										aria-label={`Item ${index + 1} emotion`}
										className="h-9 rounded-md border border-border bg-card px-2 text-sm"
										onChange={(e) =>
											handleRowChange(index, "emotion", e.target.value)
										}
										type="text"
										value={row.emotion}
									/>
								</label>
								<label className="grid gap-1 sm:col-span-2">
									<span className="text-xs font-medium text-muted-foreground">
										Tags (comma-separated)
									</span>
									<input
										aria-label={`Item ${index + 1} tags`}
										className="h-9 rounded-md border border-border bg-card px-2 text-sm"
										onChange={(e) =>
											handleRowChange(index, "tags", e.target.value)
										}
										type="text"
										value={row.tags}
									/>
								</label>
								<label className="grid gap-1 sm:col-span-2 lg:col-span-1">
									<span className="text-xs font-medium text-muted-foreground">
										Expense date (optional, ISO)
									</span>
									<input
										aria-label={`Item ${index + 1} expense date`}
										className="h-9 rounded-md border border-border bg-card px-2 text-sm"
										onChange={(e) =>
											handleRowChange(index, "expense_date", e.target.value)
										}
										type="text"
										value={row.expense_date}
									/>
								</label>
								<div className="flex items-end sm:col-span-2 lg:col-span-3">
									<button
										className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-40"
										disabled={rows.length <= 1 || isLoading}
										onClick={() => handleRemoveRow(index)}
										type="button"
									>
										Remove line
									</button>
								</div>
							</div>
						))}
					</div>

					<button
						className="mt-3 inline-flex h-9 items-center rounded-md border border-dashed border-border px-3 text-xs font-medium text-muted-foreground hover:bg-accent"
						disabled={isLoading}
						onClick={handleAddRow}
						type="button"
					>
						Add line
					</button>
				</div>
			) : null}

			{successMessage ? (
				<output
					aria-live="polite"
					className="block rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100"
				>
					{successMessage}
				</output>
			) : null}

			{errorMessage ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}

			<pre className="overflow-auto rounded-lg border border-border bg-muted p-4 text-xs">
				{JSON.stringify(draft, null, 2)}
			</pre>
		</section>
	);
};
