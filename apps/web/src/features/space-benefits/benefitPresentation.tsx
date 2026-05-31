import type { PromoCode } from "@cofi/api";
import { Gift, Tag } from "lucide-react";
import type { ReactNode } from "react";

export type BenefitStatus =
	| "active"
	| "draft"
	| "expires_soon"
	| "used"
	| "expired"
	| "archived"
	| "ignored";

export type PromoBenefit = {
	id: number;
	title: string;
	code: string;
	merchant: string;
	redeemAt: string;
	status: BenefitStatus;
	discountLabel: string;
	validUntil: string;
	source: string;
	raw: PromoCode;
};

export type LoyaltyBenefit = {
	id: string;
	program: string;
	cardMask: string;
	balanceLabel: string;
	pendingLabel: string;
	lastEvent: string;
	status: BenefitStatus;
};

export const loyaltyBenefits: LoyaltyBenefit[] = [];

const statusLabel = (status: BenefitStatus) => {
	if (status === "expires_soon") return "Expires soon";
	return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const statusClass = (status: BenefitStatus) => {
	if (status === "active") {
		return "border-[rgba(95,130,102,0.32)] bg-[rgba(120,154,124,0.14)] text-[#2d4a32]";
	}
	if (status === "expires_soon") {
		return "border-[rgba(200,130,55,0.42)] bg-[rgba(255,236,200,0.56)] text-[#6b4510]";
	}
	if (status === "draft") {
		return "border-[rgba(120,100,80,0.24)] bg-[rgba(255,252,246,0.72)] text-foreground/72";
	}
	if (status === "expired" || status === "archived" || status === "ignored") {
		return "border-border/60 bg-muted/55 text-muted-foreground";
	}
	return "border-border/60 bg-muted/55 text-muted-foreground";
};

const isExpiringSoon = (iso?: string | null): boolean => {
	if (!iso) return false;
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) return false;
	const now = Date.now();
	const twoWeeks = 14 * 24 * 60 * 60 * 1000;
	return ts >= now && ts <= now + twoWeeks;
};

const toBenefitStatus = (promo: PromoCode): BenefitStatus => {
	const status = String(promo.status ?? "active").toLowerCase();
	if (status === "active" && isExpiringSoon(promo.valid_until)) {
		return "expires_soon";
	}
	if (
		status === "draft" ||
		status === "used" ||
		status === "expired" ||
		status === "archived" ||
		status === "ignored"
	) {
		return status;
	}
	return "active";
};

const formatPromoDate = (iso?: string | null): string => {
	if (!iso) return "No expiry";
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) return iso;
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(ts));
};

const formatMoneyWithCurrency = (amount: number, currency?: string): string => {
	const code = currency?.trim().toUpperCase() || "RUB";
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: code,
			maximumFractionDigits: 0,
		}).format(amount);
	} catch {
		return `${amount.toLocaleString()} ${code}`;
	}
};

const formatDiscountLabel = (promo: PromoCode): string => {
	const value = promo.discount_value;
	switch (promo.discount_type) {
		case "percent":
			return value != null ? `${value}% off` : "Percent discount";
		case "fixed_amount":
			return value != null
				? `${formatMoneyWithCurrency(value, promo.currency)} off`
				: "Fixed discount";
		case "cashback":
			return value != null
				? `${formatMoneyWithCurrency(value, promo.currency)} cashback`
				: "Cashback";
		case "free_shipping":
			return "Free shipping";
		case "gift":
			return "Gift offer";
		default:
			return "Promo offer";
	}
};

export const formatBenefitSourceLabel = (sourceType?: string): string => {
	const value = sourceType?.trim().toLowerCase();
	if (!value) return "Unknown";
	if (value === "manual_text") return "Manual text";
	return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export const toPromoBenefit = (promo: PromoCode): PromoBenefit => {
	const merchant =
		promo.source_merchant_name?.trim() ||
		promo.redeem_merchant_name?.trim() ||
		promo.redeem_platform?.trim() ||
		"Promo";
	return {
		id: Number(promo.id),
		title: promo.title?.trim() || promo.promo_code?.trim() || "Promo",
		code: promo.promo_code?.trim() || "No code",
		merchant,
		redeemAt:
			promo.redeem_platform?.trim() ||
			promo.redeem_merchant_name?.trim() ||
			merchant,
		status: toBenefitStatus(promo),
		discountLabel: formatDiscountLabel(promo),
		validUntil: formatPromoDate(promo.valid_until),
		source: formatBenefitSourceLabel(promo.source_type),
		raw: promo,
	};
};

export const PromoBenefitMini = ({ promo }: { promo: PromoBenefit }) => (
	<div className="flex min-w-0 items-center gap-3 rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/64 px-3 py-2 shadow-sm">
		<span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(237,247,239,0.9)] text-[#405f44] shadow-[inset_0_0_0_1px_rgba(91,116,87,0.12)]">
			<Gift className="h-4 w-4" size={16} />
		</span>
		<div className="min-w-0 flex-1">
			<div className="flex min-w-0 items-center gap-2">
				<p className="truncate font-mono text-sm font-bold tracking-[0.06em] text-foreground">
					{promo.code}
				</p>
				<span
					className={[
						"shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
						statusClass(promo.status),
					].join(" ")}
				>
					{statusLabel(promo.status)}
				</span>
			</div>
			<p className="mt-0.5 truncate text-xs text-muted-foreground">
				{promo.merchant} · {promo.validUntil}
			</p>
		</div>
	</div>
);

export const PromoBenefitListItem = ({
	promo,
	trailing,
}: {
	promo: PromoBenefit;
	trailing?: ReactNode;
}) => (
	<li className="flex min-w-0 items-center gap-3 rounded-xl border border-[rgba(120,100,80,0.14)] bg-[rgba(255,252,246,0.74)] px-3 py-3 shadow-sm transition hover:border-[rgba(140,115,85,0.28)] hover:bg-[rgba(255,252,246,0.94)]">
		<span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(237,247,239,0.9)] text-[#405f44] shadow-[inset_0_0_0_1px_rgba(91,116,87,0.12)]">
			<Tag className="h-5 w-5" size={20} />
		</span>
		<div className="min-w-0 flex-1">
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				<h3 className="truncate text-sm font-semibold text-foreground">
					{promo.title}
				</h3>
				<span
					className={[
						"shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
						statusClass(promo.status),
					].join(" ")}
				>
					{statusLabel(promo.status)}
				</span>
			</div>
			<p className="mt-1 truncate text-xs text-muted-foreground">
				{promo.code} · {promo.discountLabel} · {promo.validUntil}
			</p>
		</div>
		{trailing ? <div className="shrink-0">{trailing}</div> : null}
	</li>
);

export const PromoBenefitDetailHeader = ({
	promo,
}: {
	promo: PromoBenefit;
}) => (
	<div className="flex flex-wrap items-start gap-4 rounded-2xl border border-[rgba(120,100,80,0.14)] bg-[rgba(255,252,246,0.8)] p-4 shadow-sm">
		<span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(237,247,239,0.94)] text-[#405f44] shadow-[inset_0_0_0_1px_rgba(91,116,87,0.14)]">
			<Gift className="h-6 w-6" size={24} />
		</span>
		<div className="min-w-0 flex-1">
			<div className="flex flex-wrap items-center gap-2">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					Promo
				</p>
				<span
					className={[
						"rounded-full border px-2 py-0.5 text-[11px] font-semibold",
						statusClass(promo.status),
					].join(" ")}
				>
					{statusLabel(promo.status)}
				</span>
			</div>
			<h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">
				{promo.title}
			</h2>
			<p className="mt-1 text-sm text-muted-foreground">
				{promo.merchant} · redeem at {promo.redeemAt}
			</p>
		</div>
		<div className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/72 px-3 py-2 text-right">
			<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
				Code
			</p>
			<p className="mt-1 font-mono text-lg font-bold tracking-[0.08em] text-foreground">
				{promo.code}
			</p>
		</div>
	</div>
);

export const PromoBenefitCard = ({
	promo,
	busy,
	onArchive,
	onMarkUsed,
}: {
	promo: PromoBenefit;
	busy: boolean;
	onArchive: (promo: PromoBenefit) => void;
	onMarkUsed: (promo: PromoBenefit) => void;
}) => (
	<li className="rounded-2xl border border-[rgba(120,100,80,0.14)] bg-[rgba(255,252,246,0.78)] p-4 shadow-sm transition hover:border-[rgba(140,115,85,0.28)] hover:bg-[rgba(255,252,246,0.94)]">
		<div className="flex flex-wrap items-start justify-between gap-3">
			<div className="min-w-0">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					{promo.merchant}
				</p>
				<h3 className="mt-1 font-display text-lg font-bold tracking-tight text-foreground">
					{promo.title}
				</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					Redeem at {promo.redeemAt}
				</p>
			</div>
			<span
				className={[
					"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
					statusClass(promo.status),
				].join(" ")}
			>
				{statusLabel(promo.status)}
			</span>
		</div>
		<div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
			<div className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/70 px-3 py-2.5">
				<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					Code
				</p>
				<p className="mt-1 font-mono text-lg font-bold tracking-[0.08em] text-foreground">
					{promo.code}
				</p>
			</div>
			<div className="text-sm sm:text-right">
				<p className="font-semibold text-foreground">{promo.discountLabel}</p>
				<p className="mt-1 text-muted-foreground">Until {promo.validUntil}</p>
			</div>
		</div>
		<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
			<p className="text-xs text-muted-foreground">Source: {promo.source}</p>
			<div className="flex flex-wrap gap-2">
				<button
					className="inline-flex h-8 items-center rounded-lg border border-[rgba(120,100,80,0.18)] bg-white/70 px-3 text-xs font-semibold text-foreground/82 transition hover:bg-white disabled:opacity-50"
					disabled={busy || promo.raw.status === "used"}
					onClick={() => onMarkUsed(promo)}
					type="button"
				>
					Mark used
				</button>
				<button
					className="inline-flex h-8 items-center rounded-lg border border-[rgba(120,100,80,0.18)] bg-white/70 px-3 text-xs font-semibold text-muted-foreground transition hover:bg-white hover:text-foreground disabled:opacity-50"
					disabled={busy || promo.raw.status === "archived"}
					onClick={() => onArchive(promo)}
					type="button"
				>
					Archive
				</button>
			</div>
		</div>
	</li>
);

export const LoyaltyBenefitCard = ({
	loyalty,
}: {
	loyalty: LoyaltyBenefit;
}) => (
	<li className="rounded-2xl border border-[rgba(95,125,102,0.2)] bg-gradient-to-br from-[#f0f8f2] via-[#fefdfb] to-[#eef4ed] p-4 shadow-sm">
		<div className="flex flex-wrap items-start justify-between gap-3">
			<div className="min-w-0">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4d6651]">
					Loyalty
				</p>
				<h3 className="mt-1 font-display text-lg font-bold tracking-tight text-foreground">
					{loyalty.program}
				</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					Card {loyalty.cardMask}
				</p>
			</div>
			<span
				className={[
					"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
					statusClass(loyalty.status),
				].join(" ")}
			>
				{statusLabel(loyalty.status)}
			</span>
		</div>
		<div className="mt-4 grid gap-3 sm:grid-cols-2">
			<div className="rounded-xl border border-[rgba(95,125,102,0.16)] bg-white/62 px-3 py-2.5">
				<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					Available
				</p>
				<p className="mt-1 text-xl font-bold tabular-nums text-[#355a3c]">
					{loyalty.balanceLabel}
				</p>
			</div>
			<div className="rounded-xl border border-[rgba(95,125,102,0.16)] bg-white/62 px-3 py-2.5">
				<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					Pending
				</p>
				<p className="mt-1 text-xl font-bold tabular-nums text-foreground">
					{loyalty.pendingLabel}
				</p>
			</div>
		</div>
		<p className="mt-3 text-xs text-muted-foreground">{loyalty.lastEvent}</p>
	</li>
);
