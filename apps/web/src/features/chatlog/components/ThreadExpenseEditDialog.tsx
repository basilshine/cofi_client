import type { Vendor } from "@cofi/api";
import { useEffect, useId, useRef, useState } from "react";
import { apiClient } from "../../../shared/lib/apiClient";
import { VendorCombobox } from "./VendorCombobox";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	spaceId: string | number;
	currentUserId: number | null;
	/** Only the expense owner can edit draft headers. */
	canEdit: boolean;
	busy: boolean;
	draftTitle: string;
	setDraftTitle: (v: string) => void;
	draftCurrency: string;
	setDraftCurrency: (v: string) => void;
	draftPayeeText: string;
	setDraftPayeeText: (v: string) => void;
	draftTxnDate: string;
	setDraftTxnDate: (v: string) => void;
	draftInvoiceRef: string;
	setDraftInvoiceRef: (v: string) => void;
	draftNotes: string;
	setDraftNotes: (v: string) => void;
	draftVendorId: number | null;
	setDraftVendorId: (v: number | null) => void;
	/** Expense-linked vendor (merged into the picker so the name always appears). */
	linkedVendor: { id: number; name: string } | null;
	/** Return true when the server saved successfully (dialog will close). */
	onSave: () => boolean | Promise<boolean>;
};

/**
 * Space draft expense: **required** title + currency; **optional** business/personal fields behind expand.
 */
export const ThreadExpenseEditDialog = ({
	open,
	onOpenChange,
	spaceId,
	currentUserId,
	canEdit,
	busy,
	draftTitle,
	setDraftTitle,
	draftCurrency,
	setDraftCurrency,
	draftPayeeText,
	setDraftPayeeText,
	draftTxnDate,
	setDraftTxnDate,
	draftInvoiceRef,
	setDraftInvoiceRef,
	draftNotes,
	setDraftNotes,
	draftVendorId,
	setDraftVendorId,
	linkedVendor,
	onSave,
}: Props) => {
	const titleId = useId();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [showOptional, setShowOptional] = useState(false);
	const [vendorSyncToken, setVendorSyncToken] = useState(0);

	useEffect(() => {
		const el = dialogRef.current;
		if (!el) return;
		if (open) {
			el.showModal();
		} else {
			el.close();
		}
	}, [open]);

	useEffect(() => {
		if (open) setVendorSyncToken((t) => t + 1);
	}, [open]);

	useEffect(() => {
		if (!open || spaceId == null) return;
		let cancelled = false;
		void apiClient.finances.vendors
			.list({ spaceId })
			.then((rows) => {
				if (!cancelled) setVendors(rows ?? []);
			})
			.catch(() => {
				if (!cancelled) setVendors([]);
			});
		return () => {
			cancelled = true;
		};
	}, [open, spaceId]);

	const resolvedVendorRow: Vendor | null = linkedVendor
		? {
				id: linkedVendor.id,
				name: linkedVendor.name,
				tenant_id: 0,
			}
		: null;

	const handleSave = async () => {
		const ok = await Promise.resolve(onSave());
		if (ok) onOpenChange(false);
	};

	return (
		<dialog
			aria-labelledby={titleId}
			className="fixed inset-0 z-[60] max-h-none w-full max-w-none border-0 bg-transparent p-4 backdrop:bg-black/50"
			onCancel={(e) => {
				e.preventDefault();
				onOpenChange(false);
			}}
			ref={dialogRef}
		>
			<div className="flex max-h-[min(100vh,100dvh)] w-full items-start justify-center overflow-y-auto py-6">
				<div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-lg">
					<h2 className="text-base font-semibold text-foreground" id={titleId}>
						Edit expense (space draft)
					</h2>
					<p className="mt-1 text-xs leading-snug text-muted-foreground">
						<strong>Required</strong> fields identify this expense for everyone
						in the thread. <strong>Optional</strong> fields add bookkeeping
						(vendor, invoice) or extra payee text — separate from line items
						below.
					</p>

					<div className="mt-4 space-y-3">
						<label className="grid gap-1">
							<span className="text-xs font-medium text-foreground">
								Title <span className="text-destructive">*</span>
							</span>
							<input
								aria-required
								className="h-10 rounded-md border border-border bg-background px-3 text-sm"
								disabled={!canEdit || busy}
								onChange={(e) => setDraftTitle(e.target.value)}
								placeholder="e.g. Team lunch, Q1 software"
								type="text"
								value={draftTitle}
							/>
							<span className="text-[10px] text-muted-foreground">
								Short label for this draft in Ceits (lists, thread).
							</span>
						</label>

						<label className="grid gap-1">
							<span className="text-xs font-medium text-foreground">
								Currency <span className="text-destructive">*</span>
							</span>
							<input
								aria-required
								className="h-10 w-28 rounded-md border border-border bg-background px-3 font-mono text-sm uppercase"
								disabled={!canEdit || busy}
								maxLength={3}
								onChange={(e) =>
									setDraftCurrency(e.target.value.toUpperCase().slice(0, 3))
								}
								placeholder="USD"
								type="text"
								value={draftCurrency}
							/>
							<span className="text-[10px] text-muted-foreground">
								Three-letter ISO code (e.g. USD, EUR).
							</span>
						</label>

						<button
							aria-expanded={showOptional}
							className="flex w-full items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/50"
							disabled={!canEdit}
							onClick={() => setShowOptional((x) => !x)}
							type="button"
						>
							<span>Optional: vendor, payee text, invoice, notes, date</span>
							<span aria-hidden className="text-muted-foreground">
								{showOptional ? "−" : "+"}
							</span>
						</button>

						{showOptional ? (
							<div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 p-3">
								<p className="text-[10px] leading-snug text-muted-foreground">
									Use these when the space needs a formal payee or invoice
									reference. “Payee text” is free-form if you do not use a
									vendor record.
								</p>

								<div className="grid gap-1">
									<span className="text-xs font-medium text-muted-foreground">
										Vendor (tenant)
									</span>
									<VendorCombobox
										disabled={!canEdit || busy}
										onSelectedVendorIdChange={setDraftVendorId}
										onVendorCreated={(v) => {
											setVendors((prev) =>
												[...prev.filter((x) => x.id !== v.id), v].sort((a, b) =>
													String(a.name).localeCompare(String(b.name)),
												),
											);
										}}
										resolvedVendor={resolvedVendorRow}
										selectedVendorId={draftVendorId}
										spaceId={spaceId}
										syncToken={vendorSyncToken}
										vendors={vendors}
									/>
									<span className="text-[10px] text-muted-foreground">
										Search existing vendors or type a new name and choose
										&quot;Create vendor&quot;. The list is scoped to this
										space&apos;s organization (tenant).
									</span>
								</div>

								<label className="grid gap-1">
									<span className="text-xs font-medium text-muted-foreground">
										Payee text (optional)
									</span>
									<input
										className="h-10 rounded-md border border-border bg-background px-3 text-sm"
										disabled={!canEdit || busy}
										onChange={(e) => setDraftPayeeText(e.target.value)}
										placeholder="As on receipt or bank line"
										type="text"
										value={draftPayeeText}
									/>
								</label>

								<label className="grid gap-1">
									<span className="text-xs font-medium text-muted-foreground">
										Invoice / reference (optional)
									</span>
									<input
										className="h-10 rounded-md border border-border bg-background px-3 text-sm"
										disabled={!canEdit || busy}
										onChange={(e) => setDraftInvoiceRef(e.target.value)}
										placeholder="INV-1234"
										type="text"
										value={draftInvoiceRef}
									/>
								</label>

								<label className="grid gap-1">
									<span className="text-xs font-medium text-muted-foreground">
										Business notes (optional)
									</span>
									<textarea
										className="min-h-[72px] rounded-md border border-border bg-background px-2 py-2 text-sm"
										disabled={!canEdit || busy}
										onChange={(e) => setDraftNotes(e.target.value)}
										placeholder="Terms, PO, internal memo…"
										rows={3}
										value={draftNotes}
									/>
								</label>

								<label className="grid gap-1">
									<span className="text-xs font-medium text-muted-foreground">
										Transaction date
									</span>
									<input
										className="h-10 rounded-md border border-border bg-background px-2 text-sm"
										disabled={!canEdit || busy}
										onChange={(e) => setDraftTxnDate(e.target.value)}
										type="date"
										value={draftTxnDate}
									/>
									<span className="text-[10px] text-muted-foreground">
										Leave empty to let the server keep its default (often
										today).
									</span>
								</label>
							</div>
						) : null}
					</div>

					<div className="mt-6 flex flex-wrap justify-end gap-2">
						<button
							className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
							onClick={() => onOpenChange(false)}
							type="button"
						>
							Cancel
						</button>
						<button
							className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
							disabled={!canEdit || busy || currentUserId == null}
							onClick={() => void handleSave()}
							type="button"
						>
							{busy ? "Saving…" : "Save"}
						</button>
					</div>
				</div>
			</div>
		</dialog>
	);
};
