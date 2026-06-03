import type { PromoCode } from "@cofi/api";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
	EntityCard,
	EntityDetailHeader,
	EntityListItem,
	type EntityViewModel,
} from "./entityPresentation";

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
	sourceDocumentId: number | null;
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

export const benefitStatusLabel = (status: BenefitStatus) => {
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

const isTechnicalPromoTitle = (value: string | null | undefined): boolean => {
	const normalized = value?.trim().toLowerCase();
	return (
		!normalized ||
		normalized === "promo code candidate" ||
		normalized === "promo candidate" ||
		normalized === "benefit candidate" ||
		normalized.endsWith("_candidate") ||
		normalized.endsWith(" candidate")
	);
};

export const formatBenefitSourceLabel = (sourceType?: string): string => {
	const value = sourceType?.trim().toLowerCase();
	if (!value || value === "unknown") return "Capture";
	if (value === "manual_text" || value === "text" || value === "manual") {
		return "Text capture";
	}
	return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export const toPromoBenefit = (promo: PromoCode): PromoBenefit => {
	const merchant =
		promo.source_merchant_name?.trim() ||
		promo.redeem_merchant_name?.trim() ||
		promo.redeem_platform?.trim() ||
		"Promo";
	const code = promo.promo_code?.trim();
	const rawTitle = promo.title?.trim();
	return {
		id: Number(promo.id),
		title: !isTechnicalPromoTitle(rawTitle)
			? rawTitle
			: code || `${merchant} promo`,
		code: code || "No code",
		merchant,
		redeemAt:
			promo.redeem_platform?.trim() ||
			promo.redeem_merchant_name?.trim() ||
			merchant,
		status: toBenefitStatus(promo),
		discountLabel: formatDiscountLabel(promo),
		validUntil: formatPromoDate(promo.valid_until),
		source: formatBenefitSourceLabel(promo.source_type),
		sourceDocumentId:
			promo.source_document_id != null
				? Number(promo.source_document_id)
				: null,
		raw: promo,
	};
};

export const toPromoBenefitEntity = (
	promo: PromoBenefit,
	options: {
		href?: string;
		selected?: boolean;
		spaceName?: string;
	} = {},
): EntityViewModel => {
	const title = promo.code !== "No code" ? promo.code : promo.title;
	const context = [promo.merchant, promo.validUntil, options.spaceName]
		.filter(Boolean)
		.join(" · ");
	return {
		id: String(promo.id),
		visualKey: "benefit",
		label: "Promo",
		title,
		subtitle: context,
		detail: `${promo.discountLabel} · redeem at ${promo.redeemAt}`,
		href: options.href,
		meta: [promo.discountLabel, promo.source],
		status: benefitStatusLabel(promo.status),
		statusClassName: statusClass(promo.status),
		selected: options.selected,
	};
};

export const toLoyaltyBenefitEntity = (
	loyalty: LoyaltyBenefit,
	options: { selected?: boolean } = {},
): EntityViewModel => ({
	id: loyalty.id,
	visualKey: "loyalty",
	label: "Loyalty",
	title: loyalty.program,
	subtitle: `Card ${loyalty.cardMask}`,
	detail: loyalty.lastEvent,
	meta: [loyalty.balanceLabel, loyalty.pendingLabel],
	status: benefitStatusLabel(loyalty.status),
	statusClassName: statusClass(loyalty.status),
	selected: options.selected,
});

export const PromoBenefitListItem = ({
	promo,
	trailing,
}: {
	promo: PromoBenefit;
	trailing?: ReactNode;
}) => (
	<li>
		<EntityListItem entity={toPromoBenefitEntity(promo)} trailing={trailing} />
	</li>
);

export const PromoBenefitDetailHeader = ({
	promo,
}: {
	promo: PromoBenefit;
}) => (
	<div className="flex flex-wrap items-start gap-4 rounded-2xl border border-[rgba(120,100,80,0.14)] bg-[rgba(255,252,246,0.8)] p-4 shadow-sm">
		<EntityDetailHeader
			entity={toPromoBenefitEntity(promo)}
			trailing={
				<div className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/72 px-3 py-2 text-right">
					<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						Code
					</p>
					<p className="mt-1 font-mono text-lg font-bold tracking-[0.08em] text-foreground">
						{promo.code}
					</p>
				</div>
			}
		/>
	</div>
);

export const PromoBenefitCard = ({
	promo,
	busy,
	isSelected = false,
	onArchive,
	onDelete,
	onMarkUsed,
	onOpen,
	reviewHref,
}: {
	promo: PromoBenefit;
	busy: boolean;
	isSelected?: boolean;
	onArchive: (promo: PromoBenefit) => void;
	onDelete?: (promo: PromoBenefit) => void;
	onMarkUsed: (promo: PromoBenefit) => void;
	onOpen?: (promo: PromoBenefit) => void;
	reviewHref?: string;
}) => (
	<li>
		<EntityCard
			actions={
				<>
					{onOpen ? (
						<button
							className="inline-flex h-8 items-center rounded-lg border border-[rgba(95,125,102,0.22)] bg-[rgba(237,247,239,0.78)] px-3 text-xs font-semibold text-[#37543b] transition hover:bg-[rgba(237,247,239,0.94)] disabled:opacity-50"
							disabled={busy}
							onClick={() => onOpen(promo)}
							type="button"
						>
							Details
						</button>
					) : null}
					{reviewHref ? (
						<Link
							className="inline-flex h-8 items-center rounded-lg border border-[rgba(48,83,120,0.22)] bg-[rgba(239,247,255,0.72)] px-3 text-xs font-semibold text-[rgba(34,72,108,0.92)] transition hover:bg-[rgba(232,242,255,0.95)]"
							to={reviewHref}
						>
							Review capture
						</Link>
					) : null}
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
					{onDelete ? (
						<button
							className="inline-flex h-8 items-center rounded-lg border border-red-200 bg-red-50/80 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
							disabled={busy}
							onClick={() => onDelete(promo)}
							type="button"
						>
							Delete
						</button>
					) : null}
				</>
			}
			entity={toPromoBenefitEntity(promo, { selected: isSelected })}
		>
			<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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
			<p className="mt-3 text-xs text-muted-foreground">
				Source: {promo.source}
				{promo.sourceDocumentId != null
					? ` · Source capture #${promo.sourceDocumentId}`
					: ""}
			</p>
		</EntityCard>
	</li>
);

export const LoyaltyBenefitCard = ({
	loyalty,
}: {
	loyalty: LoyaltyBenefit;
}) => (
	<li>
		<EntityCard entity={toLoyaltyBenefitEntity(loyalty)}>
			<div className="grid gap-3 sm:grid-cols-2">
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
		</EntityCard>
	</li>
);
