import { useEffect, useMemo, useRef, useState } from "react";
import { ExpenseItemRecurringControls } from "./ExpenseItemRecurringControls";
import { draftLineElementId } from "./draftLineAnchors";
import type { BuilderItem } from "./transactionBuilderTypes";

const sanitizeAmountInput = (raw: string): string => {
	const normalized = raw.replace(",", ".").replace(/[^\d.]/g, "");
	const firstDot = normalized.indexOf(".");
	if (firstDot === -1) return normalized;
	const intPart = normalized.slice(0, firstDot);
	const fracPart = normalized
		.slice(firstDot + 1)
		.replace(/\./g, "")
		.slice(0, 2);
	return `${intPart}.${fracPart}`;
};

const formatAmountOnBlur = (raw: string): string => {
	const cleaned = sanitizeAmountInput(raw).trim();
	if (!cleaned) return "";
	const n = Number(cleaned);
	if (!Number.isFinite(n)) return "";
	return n.toFixed(2);
};

const parseTagCsv = (raw: string): string[] =>
	raw
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);

const normalizeTag = (raw: string): string => raw.trim().replace(/\s+/g, " ");

const TagAutocompleteInput = ({
	value,
	suggestions,
	disabled,
	onChange,
	placeholder,
	ariaLabel,
}: {
	value: string;
	suggestions: string[];
	disabled: boolean;
	onChange: (next: string) => void;
	placeholder: string;
	ariaLabel: string;
}) => {
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	useEffect(() => {
		const onDoc = (e: MouseEvent) => {
			if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);

	const selected = useMemo(() => parseTagCsv(value), [value]);
	const selectedNorm = useMemo(
		() => new Set(selected.map((t) => t.toLowerCase())),
		[selected],
	);
	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return suggestions.filter((tag) => {
			if (selectedNorm.has(tag.toLowerCase())) return false;
			if (!q) return true;
			return tag.toLowerCase().includes(q);
		});
	}, [query, selectedNorm, suggestions]);

	const commitTag = (raw: string) => {
		const next = normalizeTag(raw);
		if (!next) return;
		if (selectedNorm.has(next.toLowerCase())) {
			setQuery("");
			return;
		}
		onChange([...selected, next].join(", "));
		setQuery("");
		setOpen(false);
	};

	const removeTag = (tag: string) => {
		const next = selected.filter((t) => t.toLowerCase() !== tag.toLowerCase());
		onChange(next.join(", "));
	};

	return (
		<div className="relative" ref={wrapRef}>
			<div className="min-h-10 rounded-md border border-border bg-card px-2 py-1.5">
				<div className="flex flex-wrap items-center gap-1.5">
					{selected.map((tag) => (
						<span
							className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-foreground"
							key={tag}
						>
							{tag}
							<button
								aria-label={`Remove tag ${tag}`}
								className="text-muted-foreground hover:text-foreground"
								disabled={disabled}
								onClick={() => removeTag(tag)}
								type="button"
							>
								×
							</button>
						</span>
					))}
					<input
						aria-label={ariaLabel}
						className="h-7 min-w-[7rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
						disabled={disabled}
						onChange={(e) => {
							setQuery(e.target.value);
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								setOpen(false);
								return;
							}
							if (e.key === "Enter" || e.key === ",") {
								e.preventDefault();
								commitTag(query);
								return;
							}
							if (e.key === "Backspace" && !query && selected.length > 0) {
								removeTag(selected[selected.length - 1]);
							}
						}}
						placeholder={selected.length ? "Add tag…" : placeholder}
						type="text"
						value={query}
					/>
				</div>
			</div>
			{open && !disabled ? (
				<ul className="absolute left-0 right-0 z-40 mt-1 max-h-52 overflow-auto rounded-md border border-border bg-popover py-1 text-xs shadow-md">
					{filtered.slice(0, 8).map((tag) => (
						<li key={tag}>
							<button
								className="w-full px-3 py-1.5 text-left hover:bg-accent"
								onClick={() => commitTag(tag)}
								type="button"
							>
								{tag}
							</button>
						</li>
					))}
					{query.trim() ? (
						<li className="border-t border-border/70">
							<button
								className="w-full px-3 py-1.5 text-left hover:bg-accent"
								onClick={() => commitTag(query)}
								type="button"
							>
								Create tag:{" "}
								<span className="font-medium">{normalizeTag(query)}</span>
							</button>
						</li>
					) : null}
					{filtered.length === 0 && !query.trim() ? (
						<li className="px-3 py-1.5 text-muted-foreground">
							No matching tags
						</li>
					) : null}
				</ul>
			) : null}
		</div>
	);
};

export const ManualTransactionEditor = ({
	description,
	items,
	disabled,
	onChangeDescription,
	onChangeItem,
	onAddItem,
	onRemoveItem,
	onSaveDraft,
	variant = "default",
	anchorExpenseId,
	onInsertLineInChat,
	addLineToChatDisabled,
	showBottomActions = true,
	currencyCode = "USD",
	tagSuggestions = [],
	highlightedLineId = null,
}: {
	description: string;
	items: BuilderItem[];
	disabled: boolean;
	onChangeDescription: (next: string) => void;
	onChangeItem: (id: string, patch: Partial<BuilderItem>) => void;
	onAddItem: () => void;
	onRemoveItem: (id: string) => void;
	onSaveDraft: () => void;
	/** Compact side panel: single column, remove at top */
	variant?: "default" | "panel";
	/** When set with `anchorExpenseId`, each line gets a stable DOM id for deep links. */
	anchorExpenseId?: string | number;
	/** Insert a line reference into chat and focus the composer (parent handles mode switch). */
	onInsertLineInChat?: (lineOneBased: number) => void;
	/**
	 * When set, applies only to “Add to chat” (not other fields). Defaults to `disabled`.
	 * Use when draft editing is owner-only but line links should be allowed for other space roles.
	 */
	addLineToChatDisabled?: boolean;
	showBottomActions?: boolean;
	currencyCode?: string;
	tagSuggestions?: string[];
	highlightedLineId?: string | null;
}) => {
	const isPanel = variant === "panel";
	const panelInputClass =
		"h-10 w-full min-w-0 rounded-md border border-border bg-white dark:bg-background px-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/70 hover:border-border/80 focus:border-primary/45 focus:ring-2 focus:ring-primary/20 focus:outline-none";
	const panelAmountInputClass =
		"h-10 w-full min-w-0 rounded-md border border-border bg-white dark:bg-background px-3 pr-14 text-sm tabular-nums text-foreground shadow-sm transition placeholder:text-muted-foreground/70 hover:border-border/80 focus:border-primary/45 focus:ring-2 focus:ring-primary/20 focus:outline-none";

	return (
		<div className="space-y-3">
			{!isPanel ? (
				<label className="grid gap-1">
					<span className="text-xs font-medium text-muted-foreground">
						Description (optional)
					</span>
					<input
						aria-label="Draft description"
						className="h-10 rounded-md border border-border bg-background px-3 text-sm"
						disabled={disabled}
						onChange={(e) => onChangeDescription(e.target.value)}
						placeholder="e.g. Dinner + taxi"
						type="text"
						value={description}
					/>
				</label>
			) : null}

			<div>
				<div className="text-xs font-semibold text-muted-foreground">
					Manual items
				</div>
				<div className="mt-3 space-y-3">
					{items.map((it, idx) =>
						(() => {
							const lineId =
								anchorExpenseId != null
									? draftLineElementId(anchorExpenseId, idx + 1)
									: undefined;
							const isHighlighted =
								lineId != null && highlightedLineId === lineId;
							return (
								<div
									className={
										isPanel
											? [
													"scroll-mt-28 rounded-xl border bg-background p-3.5 shadow-sm transition",
													isHighlighted
														? "border-primary/60 ring-2 ring-primary/35"
														: "border-border/70",
												].join(" ")
											: "rounded-md border border-border/80 bg-card/50 p-2"
									}
									id={lineId}
									key={it.id}
								>
									{isPanel ? (
										<div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
											<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
												Line {idx + 1}
											</span>
											<div className="flex flex-wrap items-center justify-end gap-1.5">
												{onInsertLineInChat != null &&
												anchorExpenseId != null ? (
													<button
														aria-label={`Add line ${idx + 1} link to chat`}
														className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
														disabled={addLineToChatDisabled ?? disabled}
														onClick={() => onInsertLineInChat(idx + 1)}
														type="button"
													>
														Add to chat
													</button>
												) : null}
												<button
													aria-label={`Remove item ${idx + 1}`}
													className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
													disabled={disabled || items.length <= 1}
													onClick={() => onRemoveItem(it.id)}
													type="button"
												>
													Remove line
												</button>
											</div>
										</div>
									) : null}
									<div className="flex min-w-0 flex-col gap-2">
										<input
											aria-label={`Item ${idx + 1} name`}
											className={
												isPanel
													? panelInputClass
													: "h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm text-foreground"
											}
											disabled={disabled}
											onChange={(e) =>
												onChangeItem(it.id, { name: e.target.value })
											}
											placeholder="Item name"
											type="text"
											value={it.name}
										/>
										{isPanel ? (
											<>
												<div className="relative">
													<input
														aria-label={`Item ${idx + 1} amount`}
														className={
															isPanel
																? panelAmountInputClass
																: "h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 pr-14 text-sm tabular-nums text-foreground"
														}
														disabled={disabled}
														inputMode="decimal"
														onBlur={(e) =>
															onChangeItem(it.id, {
																amount: formatAmountOnBlur(e.target.value),
															})
														}
														onChange={(e) =>
															onChangeItem(it.id, {
																amount: sanitizeAmountInput(e.target.value),
															})
														}
														placeholder="0.00"
														type="text"
														value={it.amount}
													/>
													<span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
														{currencyCode}
													</span>
												</div>
												<TagAutocompleteInput
													ariaLabel={`Item ${idx + 1} tags`}
													disabled={disabled}
													onChange={(next) =>
														onChangeItem(it.id, { tags: next })
													}
													placeholder="Add tags…"
													suggestions={tagSuggestions}
													value={it.tags}
												/>
												<input
													aria-label={`Item ${idx + 1} line note`}
													className={
														isPanel
															? panelInputClass
															: "h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm text-foreground"
													}
													disabled={disabled}
													onChange={(e) =>
														onChangeItem(it.id, { notes: e.target.value })
													}
													placeholder="Line note (optional)"
													type="text"
													value={it.notes ?? ""}
												/>
											</>
										) : (
											<>
												<div className="grid min-w-0 gap-2 sm:grid-cols-2">
													<div className="relative">
														<input
															aria-label={`Item ${idx + 1} amount`}
															className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 pr-14 text-sm tabular-nums text-foreground"
															disabled={disabled}
															inputMode="decimal"
															onBlur={(e) =>
																onChangeItem(it.id, {
																	amount: formatAmountOnBlur(e.target.value),
																})
															}
															onChange={(e) =>
																onChangeItem(it.id, {
																	amount: sanitizeAmountInput(e.target.value),
																})
															}
															placeholder="0.00"
															type="text"
															value={it.amount}
														/>
														<span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
															{currencyCode}
														</span>
													</div>
													<TagAutocompleteInput
														ariaLabel={`Item ${idx + 1} tags`}
														disabled={disabled}
														onChange={(next) =>
															onChangeItem(it.id, { tags: next })
														}
														placeholder="Add tags…"
														suggestions={tagSuggestions}
														value={it.tags}
													/>
												</div>
												<input
													aria-label={`Item ${idx + 1} line note`}
													className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground"
													disabled={disabled}
													onChange={(e) =>
														onChangeItem(it.id, { notes: e.target.value })
													}
													placeholder="Line note (optional)"
													type="text"
													value={it.notes ?? ""}
												/>
												<div className="flex justify-end">
													<button
														aria-label={`Remove item ${idx + 1}`}
														className="inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50"
														disabled={disabled || items.length <= 1}
														onClick={() => onRemoveItem(it.id)}
														type="button"
													>
														×
													</button>
												</div>
											</>
										)}
									</div>
									<ExpenseItemRecurringControls
										disabled={disabled}
										enabled={Boolean(it.recurring_enabled)}
										idPrefix={`manual-${it.id}`}
										interval={it.recurring_interval ?? "monthly"}
										onEnabledChange={(v) =>
											onChangeItem(it.id, { recurring_enabled: v })
										}
										onIntervalChange={(v) =>
											onChangeItem(it.id, { recurring_interval: v })
										}
										variant={isPanel ? "panel" : "default"}
									/>
								</div>
							);
						})(),
					)}
				</div>

				{showBottomActions ? (
					<div
						className={
							isPanel
								? "mt-3 flex flex-col gap-2"
								: "mt-3 flex flex-wrap items-center gap-2"
						}
					>
						<button
							aria-label="Add expense item"
							className={
								isPanel
									? "inline-flex h-10 w-full items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
									: "inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
							}
							disabled={disabled}
							onClick={onAddItem}
							type="button"
						>
							Add item
						</button>
						<button
							aria-label="Save manual entry"
							className={
								isPanel
									? "inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
									: "inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
							}
							disabled={disabled}
							onClick={onSaveDraft}
							type="button"
						>
							Save candidate
						</button>
					</div>
				) : null}
			</div>
		</div>
	);
};
