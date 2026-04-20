import { ExpenseItemRecurringControls } from "./ExpenseItemRecurringControls";
import { draftLineElementId } from "./draftLineAnchors";
import type { BuilderItem } from "./transactionBuilderTypes";

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
	onInsertLineInDiscussion,
	addLineToChatDisabled,
}: {
	description: string;
	items: BuilderItem[];
	disabled: boolean;
	onChangeDescription: (next: string) => void;
	onChangeItem: (id: string, patch: Partial<BuilderItem>) => void;
	onAddItem: () => void;
	onRemoveItem: (id: string) => void;
	onSaveDraft: () => void;
	/** Expense thread sidebar: single column, remove at top */
	variant?: "default" | "thread";
	/** When set with `anchorExpenseId`, each line gets a stable DOM id for deep links. */
	anchorExpenseId?: string | number;
	/** Thread: insert a markdown line link into discussion and focus chat (parent handles mode switch). */
	onInsertLineInDiscussion?: (lineOneBased: number) => void;
	/**
	 * When set, applies only to “Add to chat” (not other fields). Defaults to `disabled`.
	 * Use when draft editing is owner-only but line links should be allowed for other space roles.
	 */
	addLineToChatDisabled?: boolean;
}) => {
	const isThread = variant === "thread";

	return (
		<div className="space-y-3">
			<label className="grid gap-1">
				<span className="text-xs font-medium text-muted-foreground">
					{isThread
						? "Capture / description (optional)"
						: "Description (optional)"}
				</span>
				{isThread ? (
					<span className="text-[10px] text-muted-foreground">
						Raw text from chat or voice. Title and currency are under{" "}
						<strong>Edit expense</strong> in the thread panel.
					</span>
				) : null}
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

			<div
				className={
					isThread
						? "rounded-md border border-border bg-background p-2 sm:p-3"
						: "rounded-md border border-border bg-background p-3"
				}
			>
				<div className="text-xs font-semibold text-muted-foreground">
					Manual items
				</div>
				<div className="mt-3 space-y-3">
					{items.map((it, idx) => (
						<div
							className={
								isThread
									? "scroll-mt-28 rounded-md border border-border/80 bg-card/50 p-3"
									: "rounded-md border border-border/80 bg-card/50 p-2"
							}
							id={
								anchorExpenseId != null
									? draftLineElementId(anchorExpenseId, idx + 1)
									: undefined
							}
							key={it.id}
						>
							{isThread ? (
								<div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
									<span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
										Line {idx + 1}
									</span>
									<div className="flex flex-wrap items-center justify-end gap-1.5">
										{onInsertLineInDiscussion != null &&
										anchorExpenseId != null ? (
											<button
												aria-label={`Add line ${idx + 1} link to discussion`}
												className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
												disabled={addLineToChatDisabled ?? disabled}
												onClick={() => onInsertLineInDiscussion(idx + 1)}
												type="button"
											>
												Add to chat
											</button>
										) : null}
										<button
											aria-label={`Remove item ${idx + 1}`}
											className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
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
									className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground"
									disabled={disabled}
									onChange={(e) =>
										onChangeItem(it.id, { name: e.target.value })
									}
									placeholder="Item name"
									type="text"
									value={it.name}
								/>
								{isThread ? (
									<>
										<input
											aria-label={`Item ${idx + 1} amount`}
											className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm tabular-nums text-foreground"
											disabled={disabled}
											inputMode="decimal"
											onChange={(e) =>
												onChangeItem(it.id, { amount: e.target.value })
											}
											placeholder="0.00"
											type="text"
											value={it.amount}
										/>
										<input
											aria-label={`Item ${idx + 1} tags`}
											className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground"
											disabled={disabled}
											onChange={(e) =>
												onChangeItem(it.id, { tags: e.target.value })
											}
											placeholder="tags (comma separated)"
											type="text"
											value={it.tags}
										/>
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
									</>
								) : (
									<>
										<div className="grid min-w-0 gap-2 sm:grid-cols-2">
											<input
												aria-label={`Item ${idx + 1} amount`}
												className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm tabular-nums text-foreground"
												disabled={disabled}
												inputMode="decimal"
												onChange={(e) =>
													onChangeItem(it.id, { amount: e.target.value })
												}
												placeholder="0.00"
												type="text"
												value={it.amount}
											/>
											<input
												aria-label={`Item ${idx + 1} tags`}
												className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground"
												disabled={disabled}
												onChange={(e) =>
													onChangeItem(it.id, { tags: e.target.value })
												}
												placeholder="tags (comma separated)"
												type="text"
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
								variant={isThread ? "thread" : "default"}
							/>
						</div>
					))}
				</div>

				<div
					className={
						isThread
							? "mt-3 flex flex-col gap-2"
							: "mt-3 flex flex-wrap items-center gap-2"
					}
				>
					<button
						aria-label="Add expense item"
						className={
							isThread
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
						aria-label="Save manual draft"
						className={
							isThread
								? "inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
								: "inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
						}
						disabled={disabled}
						onClick={onSaveDraft}
						type="button"
					>
						Save draft
					</button>
				</div>
			</div>
		</div>
	);
};
