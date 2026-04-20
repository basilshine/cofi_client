import type { Vendor } from "@cofi/api";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { apiClient } from "../../../shared/lib/apiClient";

const mergeVendorRows = (
	loaded: Vendor[],
	resolved: Vendor | null,
): Vendor[] => {
	const byId = new Map<number, Vendor>();
	for (const v of loaded) {
		if (v.id != null) byId.set(v.id, v);
	}
	if (resolved?.id != null && !byId.has(resolved.id)) {
		byId.set(resolved.id, resolved);
	}
	return [...byId.values()].sort((a, b) =>
		String(a.name).localeCompare(String(b.name)),
	);
};

export type VendorComboboxProps = {
	spaceId: string | number;
	/** Vendors returned from `GET /finances/vendors?space_id=` */
	vendors: Vendor[];
	/** Current expense’s vendor — merged into options so the selection is never missing from the list. */
	resolvedVendor: Vendor | null;
	selectedVendorId: number | null;
	onSelectedVendorIdChange: (id: number | null) => void;
	/** Create tenant vendor for this space (same as finances API). */
	onVendorCreated: (v: Vendor) => void;
	disabled?: boolean;
	/** Increment when the edit dialog opens so the field re-syncs from the draft. */
	syncToken: string | number;
};

/**
 * Autocomplete for tenant vendors: search, pick existing, clear, or create by name (no separate “save” row).
 */
export const VendorCombobox = ({
	spaceId,
	vendors,
	resolvedVendor,
	selectedVendorId,
	onSelectedVendorIdChange,
	onVendorCreated,
	disabled,
	syncToken,
}: VendorComboboxProps) => {
	const listId = useId();
	const wrapRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const [createBusy, setCreateBusy] = useState(false);

	const merged = useMemo(
		() => mergeVendorRows(vendors, resolvedVendor),
		[vendors, resolvedVendor],
	);

	useEffect(() => {
		const onDoc = (e: MouseEvent) => {
			if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);

	// When dialog opens or selection / list catches up, show the linked vendor name in the field.
	useEffect(() => {
		void syncToken;
		if (selectedVendorId == null) {
			setInputValue("");
			return;
		}
		const row =
			merged.find((v) => v.id === selectedVendorId) ??
			(resolvedVendor?.id === selectedVendorId ? resolvedVendor : undefined);
		if (row) setInputValue(row.name);
	}, [syncToken, selectedVendorId, merged, resolvedVendor]);

	const q = inputValue.trim().toLowerCase();
	const filtered = useMemo(() => {
		if (!q) return merged;
		return merged.filter((v) => v.name.toLowerCase().includes(q));
	}, [merged, q]);

	const exactNameMatch = merged.some(
		(v) => v.name.trim().toLowerCase() === inputValue.trim().toLowerCase(),
	);
	const trimmed = inputValue.trim();
	const showCreateRow =
		open && trimmed.length > 0 && !exactNameMatch && !createBusy;

	const handlePickVendor = useCallback(
		(v: Vendor) => {
			onSelectedVendorIdChange(v.id);
			setInputValue(v.name);
			setOpen(false);
		},
		[onSelectedVendorIdChange],
	);

	const handleClear = useCallback(() => {
		onSelectedVendorIdChange(null);
		setInputValue("");
		setOpen(false);
	}, [onSelectedVendorIdChange]);

	const handleCreate = useCallback(async () => {
		const name = trimmed;
		if (!name || spaceId == null) return;
		setCreateBusy(true);
		try {
			const v = await apiClient.finances.vendors.create({
				name,
				space_id: Number(spaceId),
			});
			onVendorCreated(v);
			handlePickVendor(v);
		} catch {
			/* caller may surface errors */
		} finally {
			setCreateBusy(false);
		}
	}, [trimmed, spaceId, onVendorCreated, handlePickVendor]);

	const showDropdown = open;

	return (
		<div className="relative" ref={wrapRef}>
			<input
				aria-autocomplete="list"
				aria-controls={listId}
				aria-expanded={showDropdown}
				autoComplete="off"
				className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
				disabled={disabled}
				id={`${listId}-input`}
				onChange={(e) => {
					setInputValue(e.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onKeyDown={(e) => {
					if (e.key === "Escape") setOpen(false);
				}}
				placeholder="Search vendors or type a new name…"
				role="combobox"
				type="text"
				value={inputValue}
			/>
			{showDropdown ? (
				<ul
					className="absolute left-0 right-0 z-50 mt-1 max-h-60 list-none overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
					id={listId}
				>
					<li className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
						Vendors (this space’s tenant)
					</li>
					<li>
						<button
							className="w-full px-3 py-2 text-left text-xs hover:bg-accent"
							onClick={handleClear}
							type="button"
						>
							<span className="text-muted-foreground">No vendor</span>
						</button>
					</li>
					{filtered.map((v) => (
						<li key={v.id}>
							<button
								className="w-full px-3 py-2 text-left text-xs hover:bg-accent"
								onClick={() => handlePickVendor(v)}
								type="button"
							>
								<span className="font-medium text-foreground">{v.name}</span>
							</button>
						</li>
					))}
					{showCreateRow ? (
						<li className="border-t border-border/80">
							<button
								className="w-full px-3 py-2 text-left text-xs hover:bg-accent disabled:opacity-50"
								disabled={createBusy || disabled}
								onClick={() => void handleCreate()}
								type="button"
							>
								<span className="font-medium text-foreground">
									{createBusy ? "Creating…" : "Create vendor"}
								</span>
								<span className="ml-1 text-muted-foreground">{trimmed}</span>
							</button>
						</li>
					) : null}
				</ul>
			) : null}
		</div>
	);
};
