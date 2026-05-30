import type { BenefitCandidate, PromoCode, Space } from "@cofi/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceHeader } from "../../app/layout/workspaceSpaces/SpaceHeader";
import { SpaceTabs } from "../../app/layout/workspaceSpaces/SpaceTabs";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../shared/lib/apiClient";

type BenefitStatus =
	| "active"
	| "draft"
	| "expires_soon"
	| "used"
	| "expired"
	| "archived"
	| "ignored";

type PromoBenefit = {
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

type LoyaltyBenefit = {
	id: string;
	program: string;
	cardMask: string;
	balanceLabel: string;
	pendingLabel: string;
	lastEvent: string;
	status: BenefitStatus;
};

const loyaltyBenefits: LoyaltyBenefit[] = [];

type CandidateView = {
	id: number;
	typeLabel: string;
	title: string;
	primary: string;
	secondary: string;
	source: string;
	confidenceLabel: string;
	canSavePromo: boolean;
	raw: BenefitCandidate;
};

const toNumericId = (value: string | number | undefined): number | null => {
	if (value == null) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

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

const formatSourceLabel = (sourceType?: string): string => {
	const value = sourceType?.trim().toLowerCase();
	if (!value) return "Unknown";
	if (value === "manual_text") return "Manual text";
	return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const toRecord = (value: unknown): Record<string, unknown> => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
};

const candidateData = (
	candidate: BenefitCandidate,
): Record<string, unknown> => {
	const structured = toRecord(candidate.structured_data);
	const nested = toRecord(structured.data);
	return Object.keys(nested).length ? nested : structured;
};

const firstText = (
	data: Record<string, unknown>,
	keys: string[],
): string | null => {
	for (const key of keys) {
		const value = data[key];
		if (typeof value === "string" && value.trim()) return value.trim();
		if (typeof value === "number" && Number.isFinite(value))
			return String(value);
	}
	return null;
};

const candidateTypeLabel = (type: string): string => {
	if (type === "promo_code_candidate") return "Promo candidate";
	if (type === "loyalty_event_candidate") return "Loyalty candidate";
	return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const toCandidateView = (candidate: BenefitCandidate): CandidateView => {
	const data = candidateData(candidate);
	const promoCode = firstText(data, [
		"promo_code",
		"code",
		"coupon",
		"discount_code",
	]);
	const program = firstText(data, [
		"program_name",
		"loyalty_program",
		"name",
		"card_mask",
	]);
	const discount = firstText(data, [
		"discount_value",
		"discount_amount",
		"value",
		"points_earned",
		"available_balance",
	]);
	const validUntil = firstText(data, [
		"valid_until",
		"expires_at",
		"expiration_date",
	]);
	const primary =
		promoCode ||
		program ||
		candidate.merchant_text?.trim() ||
		candidate.title?.trim() ||
		"Detected benefit";
	const secondaryParts = [
		discount ? `Value: ${discount}` : null,
		validUntil ? `Until: ${validUntil}` : null,
	].filter(Boolean);
	return {
		id: Number(candidate.id),
		typeLabel: candidateTypeLabel(candidate.candidate_type),
		title:
			candidate.title?.trim() || candidateTypeLabel(candidate.candidate_type),
		primary,
		secondary: secondaryParts.length
			? secondaryParts.join(" · ")
			: "Review before saving to this space.",
		source: formatSourceLabel(candidate.source_type),
		confidenceLabel:
			Number.isFinite(candidate.confidence) && candidate.confidence > 0
				? `${Math.round(candidate.confidence * 100)}% confidence`
				: "Needs review",
		canSavePromo: candidate.candidate_type === "promo_code_candidate",
		raw: candidate,
	};
};

const EmptyPanel = ({
	title,
	body,
}: {
	title: string;
	body: string;
}) => (
	<div className="rounded-2xl border border-dashed border-[rgba(120,100,80,0.22)] bg-[rgba(255,252,246,0.58)] px-5 py-7 text-center shadow-sm">
		<p className="font-display text-lg font-bold tracking-tight text-foreground">
			{title}
		</p>
		<p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
			{body}
		</p>
	</div>
);

const PromoCard = ({
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

const LoyaltyCard = ({ loyalty }: { loyalty: LoyaltyBenefit }) => (
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

const CandidateCard = ({
	candidate,
	busy,
	onIgnore,
	onSavePromo,
}: {
	candidate: CandidateView;
	busy: boolean;
	onIgnore: (candidate: CandidateView) => void;
	onSavePromo: (candidate: CandidateView) => void;
}) => (
	<li className="rounded-xl border border-[rgba(200,160,95,0.2)] bg-white/62 p-3 shadow-sm">
		<div className="flex flex-wrap items-start justify-between gap-2">
			<div className="min-w-0">
				<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(120,82,28,0.88)]">
					{candidate.typeLabel}
				</p>
				<h3 className="mt-1 truncate text-sm font-semibold text-foreground">
					{candidate.primary}
				</h3>
			</div>
			<span className="rounded-full border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.84)] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
				{candidate.confidenceLabel}
			</span>
		</div>
		<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
			{candidate.secondary}
		</p>
		<p className="mt-1 text-[11px] text-muted-foreground">
			Source: {candidate.source}
		</p>
		<div className="mt-3 flex flex-wrap gap-2">
			{candidate.canSavePromo ? (
				<button
					className="inline-flex h-8 items-center rounded-lg bg-[rgba(55,45,30,0.92)] px-3 text-xs font-semibold text-[#fffaf0] transition hover:bg-[rgba(45,38,28,0.95)] disabled:opacity-50"
					disabled={busy}
					onClick={() => onSavePromo(candidate)}
					type="button"
				>
					Save promo
				</button>
			) : null}
			<button
				className="inline-flex h-8 items-center rounded-lg border border-[rgba(120,100,80,0.18)] bg-white/70 px-3 text-xs font-semibold text-muted-foreground transition hover:bg-white hover:text-foreground disabled:opacity-50"
				disabled={busy}
				onClick={() => onIgnore(candidate)}
				type="button"
			>
				Ignore
			</button>
		</div>
	</li>
);

export const SpaceBenefitsPage = () => {
	const { spaceId } = useParams<{ spaceId: string }>();
	const { user } = useAuth();
	const { spaces, selectedSpaceId, setSelectedSpaceId } = useWorkspaceSpaces();
	const [promos, setPromos] = useState<PromoCode[]>([]);
	const [candidates, setCandidates] = useState<BenefitCandidate[]>([]);
	const [candidateCount, setCandidateCount] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [savingPromoId, setSavingPromoId] = useState<number | null>(null);
	const [candidateBusyId, setCandidateBusyId] = useState<number | null>(null);
	const [manualOpen, setManualOpen] = useState(false);
	const [manualBusy, setManualBusy] = useState(false);
	const [manualError, setManualError] = useState<string | null>(null);
	const [manualTitle, setManualTitle] = useState("");
	const [manualCode, setManualCode] = useState("");
	const [manualRedeemAt, setManualRedeemAt] = useState("");
	const [manualValidUntil, setManualValidUntil] = useState("");

	const numericSpaceId = useMemo(() => toNumericId(spaceId), [spaceId]);
	const space = useMemo(() => {
		if (!spaces || spaceId == null) return null;
		return spaces.find((s) => String(s.id) === String(spaceId)) ?? null;
	}, [spaces, spaceId]);
	const spaceName = space?.name?.trim() || "this space";

	useConsoleHeaderTitle("Benefits", space?.name ?? null);

	useEffect(() => {
		if (numericSpaceId == null) return;
		if (
			selectedSpaceId == null ||
			String(selectedSpaceId) !== String(numericSpaceId)
		) {
			setSelectedSpaceId(numericSpaceId);
		}
	}, [numericSpaceId, selectedSpaceId, setSelectedSpaceId]);

	const loadPromos = useCallback(async () => {
		if (numericSpaceId == null) return;
		setIsLoading(true);
		setLoadError(null);
		try {
			const [promoData, candidateData] = await Promise.all([
				apiClient.spaces.listPromos(numericSpaceId),
				apiClient.spaces.listBenefitCandidates(numericSpaceId, { limit: 20 }),
			]);
			setPromos(promoData.promos ?? []);
			setCandidates(candidateData.candidates ?? []);
			setCandidateCount(
				(candidateData.candidates ?? []).length ||
					promoData.summary?.candidate_count ||
					0,
			);
		} catch (error) {
			setLoadError(
				error instanceof Error ? error.message : "Failed to load benefits",
			);
		} finally {
			setIsLoading(false);
		}
	}, [numericSpaceId]);

	useEffect(() => {
		void loadPromos();
	}, [loadPromos]);

	const promoBenefits = useMemo(
		() =>
			promos.map((promo): PromoBenefit => {
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
					source: formatSourceLabel(promo.source_type),
					raw: promo,
				};
			}),
		[promos],
	);
	const candidateViews = useMemo(
		() => candidates.map((candidate) => toCandidateView(candidate)),
		[candidates],
	);
	const activePromos = promoBenefits.filter((item) => item.status === "active");
	const expiringPromos = promoBenefits.filter(
		(item) => item.status === "expires_soon",
	);
	const totalLoyaltyBalance = loyaltyBenefits.length;
	const sourceCounts = useMemo(() => {
		const counts = { manual: 0, messages: 0, receipts: 0 };
		for (const promo of promos) {
			const source = String(promo.source_type ?? "").toLowerCase();
			if (source === "receipt" || source === "image") counts.receipts += 1;
			else if (["email", "telegram", "sms", "message"].includes(source)) {
				counts.messages += 1;
			} else {
				counts.manual += 1;
			}
		}
		return counts;
	}, [promos]);

	const patchPromoStatus = async (
		promo: PromoBenefit,
		status: "used" | "archived",
	) => {
		if (numericSpaceId == null) return;
		setSavingPromoId(promo.id);
		setLoadError(null);
		try {
			const updated = await apiClient.spaces.patchPromo(
				numericSpaceId,
				promo.id,
				{
					status,
				},
			);
			setPromos((current) =>
				current.map((item) => (Number(item.id) === promo.id ? updated : item)),
			);
		} catch (error) {
			setLoadError(
				error instanceof Error ? error.message : "Failed to update promo",
			);
		} finally {
			setSavingPromoId(null);
		}
	};

	const submitManualPromo = async () => {
		if (numericSpaceId == null) return;
		const title = manualTitle.trim();
		const code = manualCode.trim();
		if (!title && !code) {
			setManualError("Add a title or promo code.");
			return;
		}
		setManualBusy(true);
		setManualError(null);
		try {
			const created = await apiClient.spaces.createPromo(numericSpaceId, {
				title,
				promo_code: code,
				redeem_platform: manualRedeemAt.trim(),
				valid_until: manualValidUntil.trim() || undefined,
				source_type: "manual",
				status: "active",
			});
			setPromos((current) => [created, ...current]);
			setManualTitle("");
			setManualCode("");
			setManualRedeemAt("");
			setManualValidUntil("");
			setManualOpen(false);
		} catch (error) {
			setManualError(
				error instanceof Error ? error.message : "Failed to save promo",
			);
		} finally {
			setManualBusy(false);
		}
	};

	const removeCandidate = (candidateId: number) => {
		setCandidates((current) =>
			current.filter((item) => Number(item.id) !== candidateId),
		);
		setCandidateCount((current) => Math.max(0, current - 1));
	};

	const saveCandidatePromo = async (candidate: CandidateView) => {
		if (numericSpaceId == null) return;
		setCandidateBusyId(candidate.id);
		setLoadError(null);
		try {
			const result = await apiClient.spaces.saveBenefitCandidatePromo(
				numericSpaceId,
				candidate.id,
			);
			setPromos((current) => [result.promo, ...current]);
			removeCandidate(candidate.id);
		} catch (error) {
			setLoadError(
				error instanceof Error ? error.message : "Failed to save candidate",
			);
		} finally {
			setCandidateBusyId(null);
		}
	};

	const ignoreCandidate = async (candidate: CandidateView) => {
		if (numericSpaceId == null) return;
		setCandidateBusyId(candidate.id);
		setLoadError(null);
		try {
			await apiClient.spaces.ignoreBenefitCandidate(
				numericSpaceId,
				candidate.id,
			);
			removeCandidate(candidate.id);
		} catch (error) {
			setLoadError(
				error instanceof Error ? error.message : "Failed to ignore candidate",
			);
		} finally {
			setCandidateBusyId(null);
		}
	};

	if (numericSpaceId == null) {
		return <Navigate replace to="/console/home" />;
	}

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
			<header className="shrink-0 border-b border-border/80 bg-background px-4 py-3 lg:px-8">
				<SpaceTabs />
			</header>
			<div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
				<div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#faf8f3_0%,#f3efe6_42%,#f6f2ea_100%)]">
					<div className="w-full space-y-6 px-4 py-6 lg:px-8 lg:py-8">
						<SpaceHeader
							currentUserId={user?.id ?? null}
							space={
								space ??
								({ id: numericSpaceId, name: "Space", tenant_id: 0 } as Space)
							}
						/>

						<section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{[
								{
									key: "active-promos",
									label: "Active promos",
									value: String(activePromos.length + expiringPromos.length),
									note: "Saved codes ready to use.",
								},
								{
									key: "expiring",
									label: "Expiring soon",
									value: String(expiringPromos.length),
									note: "Worth using before they disappear.",
								},
								{
									key: "loyalty",
									label: "Loyalty programs",
									value: String(totalLoyaltyBalance),
									note: "Bonus accounts linked to this space.",
								},
								{
									key: "candidates",
									label: "Needs review",
									value: String(candidateCount),
									note: "Detected benefits waiting for a decision.",
								},
							].map((widget) => (
								<div
									className="rounded-xl border border-border/60 bg-card px-4 py-3 soft-shadow"
									key={widget.key}
								>
									<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
										{widget.label}
									</p>
									<p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
										{isLoading ? "…" : widget.value}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{widget.note}
									</p>
								</div>
							))}
						</section>

						{loadError ? (
							<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
								{loadError}
							</div>
						) : null}

						<section className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
							<div className="space-y-6 lg:col-span-2">
								<section
									aria-labelledby="space-promos"
									className="rounded-2xl border border-[rgba(200,160,95,0.26)] bg-gradient-to-b from-[#fffdfb] via-[#fffaf4] to-[#f8f3eb] shadow-[0_10px_32px_-28px_rgba(120,88,48,0.16)]"
								>
									<div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(200,160,95,0.18)] bg-[rgba(255,255,255,0.36)] px-5 py-4">
										<div className="min-w-0">
											<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(120,82,28,0.88)]">
												Promos
											</p>
											<h2
												className="mt-1 font-display text-xl font-bold tracking-tight text-foreground"
												id="space-promos"
											>
												Saved promo codes
											</h2>
										</div>
										<button
											className="inline-flex h-9 items-center rounded-lg border border-[rgba(120,100,80,0.2)] bg-white/80 px-3 text-sm font-medium text-foreground/85 shadow-sm transition-all duration-150 hover:bg-white disabled:opacity-50"
											onClick={() => setManualOpen((open) => !open)}
											type="button"
										>
											{manualOpen ? "Close" : "Add manually"}
										</button>
									</div>
									<div className="p-4 sm:p-5">
										{manualOpen ? (
											<div className="mb-4 rounded-xl border border-[rgba(120,100,80,0.14)] bg-white/68 p-4">
												<div className="grid gap-3 sm:grid-cols-2">
													<label className="space-y-1 text-sm">
														<span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
															Title
														</span>
														<input
															className="h-10 w-full rounded-lg border border-border/70 bg-white px-3 text-sm text-foreground outline-none transition focus:border-[rgba(120,92,52,0.45)]"
															onChange={(event) =>
																setManualTitle(event.target.value)
															}
															placeholder="Yandex Food discount"
															value={manualTitle}
														/>
													</label>
													<label className="space-y-1 text-sm">
														<span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
															Code
														</span>
														<input
															className="h-10 w-full rounded-lg border border-border/70 bg-white px-3 font-mono text-sm text-foreground outline-none transition focus:border-[rgba(120,92,52,0.45)]"
															onChange={(event) =>
																setManualCode(event.target.value)
															}
															placeholder="MINUS400"
															value={manualCode}
														/>
													</label>
													<label className="space-y-1 text-sm">
														<span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
															Redeem at
														</span>
														<input
															className="h-10 w-full rounded-lg border border-border/70 bg-white px-3 text-sm text-foreground outline-none transition focus:border-[rgba(120,92,52,0.45)]"
															onChange={(event) =>
																setManualRedeemAt(event.target.value)
															}
															placeholder="Ozon, Yandex Food..."
															value={manualRedeemAt}
														/>
													</label>
													<label className="space-y-1 text-sm">
														<span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
															Valid until
														</span>
														<input
															className="h-10 w-full rounded-lg border border-border/70 bg-white px-3 text-sm text-foreground outline-none transition focus:border-[rgba(120,92,52,0.45)]"
															onChange={(event) =>
																setManualValidUntil(event.target.value)
															}
															placeholder="2026-06-30"
															value={manualValidUntil}
														/>
													</label>
												</div>
												{manualError ? (
													<p className="mt-3 text-sm text-red-700">
														{manualError}
													</p>
												) : null}
												<div className="mt-4 flex flex-wrap justify-end gap-2">
													<button
														className="inline-flex h-9 items-center rounded-lg border border-border/70 bg-white px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
														onClick={() => setManualOpen(false)}
														type="button"
													>
														Cancel
													</button>
													<button
														className="inline-flex h-9 items-center rounded-lg bg-[rgba(55,45,30,0.92)] px-3 text-sm font-semibold text-[#fffaf0] transition hover:bg-[rgba(45,38,28,0.95)] disabled:opacity-50"
														disabled={manualBusy}
														onClick={submitManualPromo}
														type="button"
													>
														{manualBusy ? "Saving…" : "Save promo"}
													</button>
												</div>
											</div>
										) : null}

										{promoBenefits.length ? (
											<ul className="space-y-3">
												{promoBenefits.map((promo) => (
													<PromoCard
														busy={savingPromoId === promo.id}
														key={promo.id}
														onArchive={(item) =>
															void patchPromoStatus(item, "archived")
														}
														onMarkUsed={(item) =>
															void patchPromoStatus(item, "used")
														}
														promo={promo}
													/>
												))}
											</ul>
										) : isLoading ? (
											<EmptyPanel
												body="Loading saved promo codes from this space."
												title="Loading promos"
											/>
										) : (
											<EmptyPanel
												body={`Saved promo codes for ${spaceName} will appear here after review.`}
												title="No saved promos yet"
											/>
										)}
									</div>
								</section>

								<section
									aria-labelledby="space-loyalty"
									className="rounded-2xl border border-[rgba(95,125,102,0.24)] bg-gradient-to-br from-[#f0f8f2] via-[#fefdfb] to-[#e8f2ea] shadow-[0_20px_48px_-28px_rgba(48,72,52,0.2)]"
								>
									<div className="border-b border-[rgba(105,135,112,0.15)] bg-[rgba(255,255,255,0.35)] px-5 py-4">
										<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4d6651]">
											Loyalty
										</p>
										<h2
											className="mt-1 font-display text-xl font-bold tracking-tight text-foreground"
											id="space-loyalty"
										>
											Bonus programs
										</h2>
									</div>
									<div className="p-4 sm:p-5">
										{loyaltyBenefits.length ? (
											<ul className="space-y-3">
												{loyaltyBenefits.map((loyalty) => (
													<LoyaltyCard key={loyalty.id} loyalty={loyalty} />
												))}
											</ul>
										) : (
											<EmptyPanel
												body={`Loyalty balances and bonus events for ${spaceName} will appear here after review.`}
												title="No loyalty programs yet"
											/>
										)}
									</div>
								</section>
							</div>

							<aside className="space-y-4">
								<section className="rounded-2xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.78)] p-5 shadow-sm">
									<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
										Decision queue
									</p>
									<h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">
										Benefits to review
									</h2>
									<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
										{candidateCount === 0
											? "Nothing waiting right now."
											: `${candidateCount} detected item${candidateCount === 1 ? "" : "s"} need review.`}
									</p>
									{candidateViews.length ? (
										<ul className="mt-4 space-y-2">
											{candidateViews.map((candidate) => (
												<CandidateCard
													busy={candidateBusyId === candidate.id}
													candidate={candidate}
													key={candidate.id}
													onIgnore={(item) => void ignoreCandidate(item)}
													onSavePromo={(item) => void saveCandidatePromo(item)}
												/>
											))}
										</ul>
									) : (
										<Link
											className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[rgba(55,45,30,0.92)] px-4 text-sm font-semibold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(45,38,28,0.95)]"
											to={`/console/chat?spaceId=${encodeURIComponent(String(numericSpaceId))}`}
										>
											Open chat
										</Link>
									)}
								</section>

								<section className="rounded-2xl border border-[rgba(200,160,95,0.22)] bg-[rgba(255,248,235,0.7)] p-5 shadow-sm">
									<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(120,82,28,0.88)]">
										Sources
									</p>
									<dl className="mt-3 space-y-3 text-sm">
										<div className="flex items-baseline justify-between gap-3">
											<dt className="text-muted-foreground">Receipts</dt>
											<dd className="font-semibold tabular-nums text-foreground">
												{sourceCounts.receipts}
											</dd>
										</div>
										<div className="flex items-baseline justify-between gap-3">
											<dt className="text-muted-foreground">Manual</dt>
											<dd className="font-semibold tabular-nums text-foreground">
												{sourceCounts.manual}
											</dd>
										</div>
										<div className="flex items-baseline justify-between gap-3">
											<dt className="text-muted-foreground">Messages</dt>
											<dd className="font-semibold tabular-nums text-foreground">
												{sourceCounts.messages}
											</dd>
										</div>
									</dl>
								</section>
							</aside>
						</section>
					</div>
				</div>

				<aside
					aria-label={`${spaceName} benefits rail`}
					className="hidden shrink-0 self-stretch flex-col border-l border-[rgba(190,175,150,0.35)] bg-[linear-gradient(180deg,#f5f1ea_0%,#f0ebe3_100%)] xl:flex xl:w-[20rem]"
				>
					<div className="min-h-0 flex-1 overflow-y-auto px-5 py-8">
						<div className="space-y-5">
							<section className="rounded-2xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.82)] p-5 shadow-sm">
								<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
									This space
								</p>
								<h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">
									Benefit wallet
								</h2>
								<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
									Promos and loyalty events belong to {spaceName} when they came
									from this space context.
								</p>
							</section>
							<section className="rounded-2xl border border-[rgba(95,125,102,0.22)] bg-[rgba(240,248,242,0.78)] p-5 shadow-sm">
								<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4d6651]">
									Summary
								</p>
								<dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
									<div>
										<dt className="text-muted-foreground">Promos</dt>
										<dd className="mt-1 text-xl font-bold text-foreground">
											{promoBenefits.length}
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Loyalty</dt>
										<dd className="mt-1 text-xl font-bold text-foreground">
											{loyaltyBenefits.length}
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Expiring</dt>
										<dd className="mt-1 text-xl font-bold text-[#6b4510]">
											{expiringPromos.length}
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Review</dt>
										<dd className="mt-1 text-xl font-bold text-foreground">
											{candidateCount}
										</dd>
									</div>
								</dl>
							</section>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
};
