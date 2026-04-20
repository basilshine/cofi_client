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
}: {
	description: string;
	items: BuilderItem[];
	disabled: boolean;
	onChangeDescription: (next: string) => void;
	onChangeItem: (id: string, patch: Partial<BuilderItem>) => void;
	onAddItem: () => void;
	onRemoveItem: (id: string) => void;
	onSaveDraft: () => void;
}) => {
	return (
		<div className="space-y-3">
			<label className="grid gap-1">
				<span className="text-xs font-medium text-muted-foreground">Description (optional)</span>
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

			<div className="rounded-md border border-border bg-background p-3">
				<div className="text-xs font-semibold text-muted-foreground">Manual items</div>
				<div className="mt-3 space-y-2">
					{items.map((it, idx) => (
						<div className="grid gap-2 md:grid-cols-[1fr_140px_1fr_40px]" key={it.id}>
							<input
								aria-label={`Item ${idx + 1} name`}
								className="h-10 rounded-md border border-border bg-card px-3 text-sm"
								disabled={disabled}
								onChange={(e) => onChangeItem(it.id, { name: e.target.value })}
								placeholder="Item name"
								type="text"
								value={it.name}
							/>
							<input
								aria-label={`Item ${idx + 1} amount`}
								className="h-10 rounded-md border border-border bg-card px-3 text-sm"
								disabled={disabled}
								inputMode="decimal"
								onChange={(e) => onChangeItem(it.id, { amount: e.target.value })}
								placeholder="0.00"
								type="text"
								value={it.amount}
							/>
							<input
								aria-label={`Item ${idx + 1} tags`}
								className="h-10 rounded-md border border-border bg-card px-3 text-sm"
								disabled={disabled}
								onChange={(e) => onChangeItem(it.id, { tags: e.target.value })}
								placeholder="tags (comma separated)"
								type="text"
								value={it.tags}
							/>
							<button
								aria-label={`Remove item ${idx + 1}`}
								className="inline-flex h-10 items-center justify-center rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50"
								disabled={disabled || items.length <= 1}
								onClick={() => onRemoveItem(it.id)}
								type="button"
							>
								×
							</button>
						</div>
					))}
				</div>

				<div className="mt-3 flex flex-wrap items-center gap-2">
					<button
						aria-label="Add expense item"
						className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
						disabled={disabled}
						onClick={onAddItem}
						type="button"
					>
						Add item
					</button>
					<button
						aria-label="Save manual draft"
						className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
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

