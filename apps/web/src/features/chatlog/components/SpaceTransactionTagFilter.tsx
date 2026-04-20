import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

type Props = {
	/** `null` while loading; sorted distinct names from the server. */
	catalog: string[] | null;
	/** Selected tags (lowercase keys). */
	selected: string[];
	onChange: (tags: string[]) => void;
	disabled?: boolean;
};

export const SpaceTransactionTagFilter = ({
	catalog,
	selected,
	onChange,
	disabled = false,
}: Props) => {
	const inputId = useId();
	const listId = useId();
	const wrapRef = useRef<HTMLDivElement>(null);
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);

	const suggestions = useMemo(() => {
		if (!catalog) return [];
		const q = query.trim().toLowerCase();
		const sel = new Set(selected);
		return catalog
			.filter((tag) => {
				const k = tag.toLowerCase();
				if (sel.has(k)) return false;
				if (!q) return true;
				return k.includes(q);
			})
			.slice(0, 12);
	}, [catalog, query, selected]);

	const handleAdd = useCallback(
		(raw: string) => {
			const k = raw.trim().toLowerCase();
			if (!k || selected.includes(k)) return;
			onChange([...selected, k]);
			setQuery("");
			setOpen(true);
		},
		[selected, onChange],
	);

	const handleRemove = useCallback(
		(k: string) => {
			onChange(selected.filter((t) => t !== k));
		},
		[selected, onChange],
	);

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const first = suggestions[0];
			if (first) handleAdd(first);
			return;
		}
		if (e.key === "Escape") {
			setOpen(false);
		}
	};

	useEffect(() => {
		const onDoc = (ev: MouseEvent) => {
			if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);

	const loading = catalog === null;
	const emptyCatalog = catalog !== null && catalog.length === 0;

	return (
		<div className="grid gap-1">
			<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
				Filter by tags
			</span>
			<p className="text-[10px] text-muted-foreground">
				Transactions must include every selected tag (on any line item). Type to
				search tags used in this space.
			</p>
			<div className="relative z-20" ref={wrapRef}>
				<div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
					{selected.map((k) => (
						<span
							className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
							key={k}
						>
							<span className="truncate">
								{catalog?.find((t) => t.toLowerCase() === k) ?? k}
							</span>
							<button
								aria-label={`Remove tag filter ${k}`}
								className="shrink-0 rounded px-0.5 hover:bg-background/80"
								onClick={() => handleRemove(k)}
								type="button"
							>
								×
							</button>
						</span>
					))}
					<input
						aria-autocomplete="list"
						aria-controls={open && suggestions.length > 0 ? listId : undefined}
						aria-expanded={open && suggestions.length > 0}
						className="min-w-[6rem] flex-1 border-0 bg-transparent py-0.5 text-xs outline-none placeholder:text-muted-foreground"
						disabled={disabled || loading}
						id={inputId}
						onChange={(e) => {
							setQuery(e.target.value);
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						onKeyDown={handleInputKeyDown}
						placeholder={
							loading
								? "Loading tags…"
								: emptyCatalog
									? "No tags in this space yet"
									: "Add tag…"
						}
						role="combobox"
						type="text"
						value={query}
					/>
				</div>
				{open && !loading && suggestions.length > 0 ? (
					<div
						className="absolute left-0 right-0 top-full z-50 mt-0.5 max-h-36 overflow-auto rounded-md border border-border bg-popover py-0.5 text-xs shadow-md"
						id={listId}
					>
						{suggestions.map((tag) => (
							<button
								className="w-full px-2 py-1.5 text-left hover:bg-accent"
								key={tag.toLowerCase()}
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => handleAdd(tag)}
								type="button"
							>
								{tag}
							</button>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
};
