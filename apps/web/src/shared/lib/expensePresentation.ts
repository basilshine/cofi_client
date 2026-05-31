import type { Transaction } from "@cofi/api";
import type { EntityViewModel } from "./entityPresentation";

export const expenseListHeading = (tx: Transaction): string => {
	const t = (tx.title ?? "").trim();
	const generic = !t || t.toLowerCase() === "expense";
	const firstLineName = (tx.items ?? [])
		.map((it) => (it.name ?? "").trim())
		.find((n) => n.length > 0);
	if (!generic) return t;
	if (firstLineName) {
		return firstLineName.length > 72
			? `${firstLineName.slice(0, 69)}...`
			: firstLineName;
	}
	const d = (tx.description ?? "").trim();
	if (d) {
		const line = d.split(/\r?\n/).find((l) => l.trim().length > 0) ?? d;
		const one = line.trim();
		return one.length > 72 ? `${one.slice(0, 69)}...` : one;
	}
	return `Expense #${String(tx.id)}`;
};

export const expenseDisplayMerchant = (tx: Transaction): string => {
	const vendor = tx.vendor_name?.trim();
	if (vendor) return vendor;
	const payee = tx.payee_text?.trim();
	if (payee) return payee;
	return expenseListHeading(tx);
};

export type ExpenseStatusTone =
	| "draft"
	| "approved"
	| "cancelled"
	| "needs_review"
	| "other";

export const expenseStatusTone = (raw?: string): ExpenseStatusTone => {
	const s = (raw ?? "").toLowerCase();
	if (s === "approved") return "approved";
	if (s === "cancelled" || s === "canceled") return "cancelled";
	if (s === "draft") return "draft";
	if (
		s.includes("review") ||
		s.includes("question") ||
		(s.includes("pending") && !s.includes("draft"))
	) {
		return "needs_review";
	}
	return "other";
};

export const expenseStatusLabel = (raw?: string): string => {
	const value = (raw ?? "").trim();
	if (!value) return "Unknown";
	return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export const expenseStatusClass = (statusRaw?: string): string => {
	const tone = expenseStatusTone(statusRaw);
	if (tone === "approved") {
		return "border-[rgba(95,130,102,0.35)] bg-[rgba(120,154,124,0.14)] text-[#2d4a32]";
	}
	if (tone === "draft") {
		return "border-[rgba(200,155,80,0.4)] bg-[rgba(255,236,200,0.55)] text-[#6b4510]";
	}
	if (tone === "cancelled") {
		return "border-[rgba(160,90,90,0.28)] bg-[rgba(180,100,100,0.1)] text-[rgba(110,55,55,0.95)]";
	}
	if (tone === "needs_review") {
		return "border-[rgba(210,120,45,0.55)] bg-[rgba(255,210,150,0.45)] text-[#5a3000]";
	}
	return "border-border/60 bg-muted/50 text-muted-foreground";
};

export const expenseStatusPillClass = (statusRaw?: string): string =>
	[
		"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
		expenseStatusTone(statusRaw) === "needs_review" ? "font-bold" : "",
		expenseStatusClass(statusRaw),
	]
		.filter(Boolean)
		.join(" ");

export type ExpenseSourceKind = "receipt" | "manual" | "recurring" | "voice";

export const expenseSourceKind = (tx: Transaction): ExpenseSourceKind => {
	if (tx.recurring_id != null && tx.recurring_id > 0) return "recurring";
	const blob = `${tx.title ?? ""} ${tx.description ?? ""}`.toLowerCase();
	if (
		blob.includes("voice") ||
		blob.includes("transcript") ||
		blob.includes("audio")
	) {
		return "voice";
	}
	if (
		blob.includes("receipt") ||
		blob.includes("parsed") ||
		blob.includes("scan")
	) {
		return "receipt";
	}
	return "manual";
};

export const expenseSourceLabel = (tx: Transaction): string => {
	const kind = expenseSourceKind(tx);
	if (kind === "recurring") return "Recurring";
	if (kind === "voice") return "Voice capture";
	if (kind === "receipt") return "Receipt";
	return "Manual";
};

export const toTransactionExpenseEntity = (
	tx: Transaction,
	options: { amountLabel?: string; selected?: boolean; href?: string } = {},
): EntityViewModel => {
	const heading = expenseListHeading(tx);
	const merchant = expenseDisplayMerchant(tx);
	return {
		id: String(tx.id),
		visualKey: "expense",
		label: "Expense",
		title: merchant,
		subtitle: merchant !== heading ? heading : undefined,
		detail: [tx.txn_date, expenseSourceLabel(tx), expenseStatusLabel(tx.status)]
			.filter(Boolean)
			.join(" - "),
		href: options.href,
		meta: [options.amountLabel, expenseSourceLabel(tx)].filter(Boolean),
		status: expenseStatusLabel(tx.status),
		statusClassName: expenseStatusClass(tx.status),
		selected: options.selected,
	};
};
