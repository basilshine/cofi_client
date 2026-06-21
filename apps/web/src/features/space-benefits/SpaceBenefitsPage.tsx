import type {
	DocumentCandidate,
	PatchPromoCodeRequest,
	PromoCode,
} from "@cofi/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceWorkspaceLayout } from "../../app/layout/workspaceSpaces/SpaceWorkspaceLayout";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { apiClient } from "../../shared/lib/apiClient";
import {
	LoyaltyBenefitCard,
	type PromoBenefit,
	PromoBenefitCard,
	PromoBenefitDetailHeader,
	formatBenefitSourceLabel,
	loyaltyBenefits,
	toPromoBenefit,
	toPromoBenefitEntity,
} from "../../shared/lib/benefitPresentation";
import { EntityMini } from "../../shared/lib/entityPresentation";
import { captureManualPromo } from "../../shared/lib/quickCapture";
import {
	WorkspaceFilterBar,
	WorkspaceListingPage,
	WorkspacePagedList,
	WorkspaceSummaryChip,
	workspaceControlClass,
	workspaceSearchInputClass,
} from "../../shared/ui/WorkspaceListingPage";

type CandidateView = {
	id: number;
	typeLabel: string;
	title: string;
	primary: string;
	secondary: string;
	source: string;
	confidenceLabel: string;
	canSavePromo: boolean;
	raw: DocumentCandidate;
};

type PromoStatusFilter =
	| "all"
	| "active"
	| "expires_soon"
	| "used"
	| "archived"
	| "expired";

type PromoSourceFilter = "all" | "receipts" | "manual" | "messages" | "other";

type PromoEditForm = {
	title: string;
	description: string;
	reminderAt: string;
	status: string;
};

const promoStatusOptions: { value: PromoStatusFilter; label: string }[] = [
	{ value: "all", label: "All statuses" },
	{ value: "active", label: "Active" },
	{ value: "expires_soon", label: "Expiring soon" },
	{ value: "used", label: "Used" },
	{ value: "archived", label: "Archived" },
	{ value: "expired", label: "Expired" },
];

const promoSourceOptions: { value: PromoSourceFilter; label: string }[] = [
	{ value: "all", label: "All sources" },
	{ value: "receipts", label: "Receipts" },
	{ value: "manual", label: "Text captures" },
	{ value: "messages", label: "Messages" },
	{ value: "other", label: "Other" },
];

const PROMO_PAGE_SIZE = 50;

const promoEditFormFrom = (promo: PromoBenefit): PromoEditForm => ({
	title: promo.raw.title ?? "",
	description: promo.raw.description ?? "",
	reminderAt: promo.raw.reminder_at?.slice(0, 16) ?? "",
	status: String(promo.raw.status ?? "active"),
});

const nullableText = (value: string): string | undefined => {
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
};

const toNumericId = (value: string | number | undefined): number | null => {
	if (value == null) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const promoSourceGroup = (sourceType?: string | null): PromoSourceFilter => {
	const source = String(sourceType ?? "").toLowerCase();
	if (source === "receipt" || source === "image" || source === "photo") {
		return "receipts";
	}
	if (source === "manual" || source === "manual_text") return "manual";
	if (["email", "telegram", "sms", "message"].includes(source)) {
		return "messages";
	}
	return "other";
};

const promoSearchText = (promo: PromoBenefit): string =>
	[
		promo.title,
		promo.code,
		promo.merchant,
		promo.redeemAt,
		promo.discountLabel,
		promo.validUntil,
		promo.source,
		promo.raw.description,
		promo.raw.conditions_text,
		promo.raw.source_text,
		promo.raw.redeem_merchant_name,
		promo.raw.redeem_platform,
		promo.raw.source_merchant_name,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

const captureReviewHref = (
	spaceId: string | number,
	sourceDocumentId: string | number,
): string =>
	`/console/review?spaceId=${encodeURIComponent(String(spaceId))}&sourceDocumentId=${encodeURIComponent(String(sourceDocumentId))}`;

const toRecord = (value: unknown): Record<string, unknown> => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
};

const candidateData = (
	candidate: DocumentCandidate,
): Record<string, unknown> => {
	return toRecord(candidate.structured_data);
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
	if (type === "promo_code_candidate") return "Promo finding";
	if (type === "loyalty_event_candidate") return "Loyalty finding";
	return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const isBenefitReviewCandidate = (candidate: {
	candidate_type: string;
}): boolean =>
	candidate.candidate_type === "promo_code_candidate" ||
	candidate.candidate_type === "loyalty_event_candidate";

const toCandidateView = (candidate: DocumentCandidate): CandidateView => {
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
		source: formatBenefitSourceLabel(candidate.source_type),
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
	const { spaces, selectedSpaceId, setSelectedSpaceId } = useWorkspaceSpaces();
	const [promos, setPromos] = useState<PromoCode[]>([]);
	const [candidates, setCandidates] = useState<DocumentCandidate[]>([]);
	const [candidateCount, setCandidateCount] = useState(0);
	const [promosHasMore, setPromosHasMore] = useState(false);
	const [promosNextOffset, setPromosNextOffset] = useState<number | null>(null);
	const [isLoadingMorePromos, setIsLoadingMorePromos] = useState(false);
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
	const [promoQuery, setPromoQuery] = useState("");
	const [promoStatusFilter, setPromoStatusFilter] =
		useState<PromoStatusFilter>("all");
	const [promoSourceFilter, setPromoSourceFilter] =
		useState<PromoSourceFilter>("all");
	const [selectedPromoId, setSelectedPromoId] = useState<number | null>(null);
	const [editingPromoId, setEditingPromoId] = useState<number | null>(null);
	const [PromoEditForm, setPromoEditForm] = useState<PromoEditForm | null>(
		null,
	);
	const [promoEditBusyId, setPromoEditBusyId] = useState<number | null>(null);
	const [promoEditError, setPromoEditError] = useState<string | null>(null);
	const [deletePromoTarget, setDeletePromoTarget] =
		useState<PromoBenefit | null>(null);
	const [deletePromoBusyId, setDeletePromoBusyId] = useState<number | null>(
		null,
	);

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
				apiClient.spaces.listPromos(numericSpaceId, {
					limit: PROMO_PAGE_SIZE,
					offset: 0,
				}),
				apiClient.spaces.review.listDocumentCandidates(numericSpaceId, {
					limit: 20,
				}),
			]);
			setPromos(promoData.promos ?? []);
			setPromosHasMore(Boolean(promoData.has_more));
			setPromosNextOffset(promoData.next_offset ?? null);
			setCandidates(
				(candidateData.candidates ?? []).filter(isBenefitReviewCandidate),
			);
			setCandidateCount(
				(candidateData.candidates ?? []).filter(isBenefitReviewCandidate)
					.length ||
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

	const loadMorePromos = useCallback(async () => {
		if (numericSpaceId == null || promosNextOffset == null) return;
		setIsLoadingMorePromos(true);
		setLoadError(null);
		try {
			const promoData = await apiClient.spaces.listPromos(numericSpaceId, {
				limit: PROMO_PAGE_SIZE,
				offset: promosNextOffset,
			});
			setPromos((current) => {
				const seen = new Set(current.map((promo) => Number(promo.id)));
				const nextPromos = (promoData.promos ?? []).filter(
					(promo) => !seen.has(Number(promo.id)),
				);
				return [...current, ...nextPromos];
			});
			setPromosHasMore(Boolean(promoData.has_more));
			setPromosNextOffset(promoData.next_offset ?? null);
			if (promoData.summary?.candidate_count != null) {
				setCandidateCount(
					(current) =>
						current || Number(promoData.summary?.candidate_count ?? 0),
				);
			}
		} catch (error) {
			setLoadError(
				error instanceof Error ? error.message : "Failed to load more benefits",
			);
		} finally {
			setIsLoadingMorePromos(false);
		}
	}, [numericSpaceId, promosNextOffset]);

	const promoBenefits = useMemo(
		() => promos.map((promo): PromoBenefit => toPromoBenefit(promo)),
		[promos],
	);
	const selectedPromo =
		promoBenefits.find((promo) => promo.id === selectedPromoId) ?? null;
	const candidateViews = useMemo(
		() => candidates.map((candidate) => toCandidateView(candidate)),
		[candidates],
	);
	const activePromos = promoBenefits.filter((item) => item.status === "active");
	const expiringPromos = promoBenefits.filter(
		(item) => item.status === "expires_soon",
	);
	const filteredPromoBenefits = useMemo(() => {
		const query = promoQuery.trim().toLowerCase();
		return promoBenefits.filter((promo) => {
			if (promoStatusFilter !== "all" && promo.status !== promoStatusFilter) {
				return false;
			}
			if (
				promoSourceFilter !== "all" &&
				promoSourceGroup(promo.raw.source_type) !== promoSourceFilter
			) {
				return false;
			}
			if (query && !promoSearchText(promo).includes(query)) {
				return false;
			}
			return true;
		});
	}, [promoBenefits, promoQuery, promoSourceFilter, promoStatusFilter]);
	const promoFiltersActive = Boolean(
		promoQuery.trim() ||
			promoStatusFilter !== "all" ||
			promoSourceFilter !== "all",
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

	const deletePromo = async (promo: PromoBenefit) => {
		if (numericSpaceId == null) return;
		setDeletePromoBusyId(promo.id);
		setLoadError(null);
		try {
			await apiClient.spaces.deletePromo(numericSpaceId, promo.id);
			setPromos((current) =>
				current.filter((item) => Number(item.id) !== promo.id),
			);
			if (selectedPromoId === promo.id) {
				setSelectedPromoId(null);
				setEditingPromoId(null);
				setPromoEditForm(null);
				setPromoEditError(null);
			}
			setDeletePromoTarget(null);
		} catch (error) {
			setLoadError(
				error instanceof Error ? error.message : "Failed to delete promo",
			);
		} finally {
			setDeletePromoBusyId(null);
		}
	};

	const openPromoDetail = (promo: PromoBenefit) => {
		setSelectedPromoId(promo.id);
		setEditingPromoId(null);
		setPromoEditForm(promoEditFormFrom(promo));
		setPromoEditError(null);
	};

	const startPromoEdit = (promo: PromoBenefit) => {
		setSelectedPromoId(promo.id);
		setEditingPromoId(promo.id);
		setPromoEditForm(promoEditFormFrom(promo));
		setPromoEditError(null);
	};

	const cancelPromoEdit = () => {
		if (selectedPromo) {
			setPromoEditForm(promoEditFormFrom(selectedPromo));
		}
		setEditingPromoId(null);
		setPromoEditError(null);
	};

	const savePromoEdit = async () => {
		if (
			numericSpaceId == null ||
			selectedPromo == null ||
			PromoEditForm == null
		) {
			return;
		}
		const body: PatchPromoCodeRequest = {
			title: nullableText(PromoEditForm.title),
			description: nullableText(PromoEditForm.description),
			status: nullableText(PromoEditForm.status),
			reminder_at: nullableText(PromoEditForm.reminderAt),
		};
		setPromoEditBusyId(selectedPromo.id);
		setPromoEditError(null);
		try {
			const updated = await apiClient.spaces.patchPromo(
				numericSpaceId,
				selectedPromo.id,
				body,
			);
			setPromos((current) =>
				current.map((item) =>
					Number(item.id) === selectedPromo.id ? updated : item,
				),
			);
			setPromoEditForm(promoEditFormFrom(toPromoBenefit(updated)));
			setEditingPromoId(null);
		} catch (error) {
			setPromoEditError(
				error instanceof Error ? error.message : "Failed to update promo",
			);
		} finally {
			setPromoEditBusyId(null);
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
			const created = await captureManualPromo(numericSpaceId, {
				title,
				promoCode: code,
				redeemPlatform: manualRedeemAt.trim(),
				validUntil: manualValidUntil.trim() || undefined,
			});
			const hasPromoCandidate = (created.candidates ?? []).some(
				(candidate) => candidate.candidate_type === "promo_code_candidate",
			);
			if (!hasPromoCandidate) {
				throw new Error(
					"Manual promo was captured, but no promo candidate was created.",
				);
			}
			setManualTitle("");
			setManualCode("");
			setManualRedeemAt("");
			setManualValidUntil("");
			setManualOpen(false);
			await loadPromos();
		} catch (error) {
			setManualError(
				error instanceof Error ? error.message : "Failed to capture promo",
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
			const result = await apiClient.spaces.review.savePromoCandidate(
				numericSpaceId,
				candidate.id,
			);
			setPromos((current) => [result.promo, ...current]);
			setSelectedPromoId(Number(result.promo.id));
			setPromoEditForm(promoEditFormFrom(toPromoBenefit(result.promo)));
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
			await apiClient.spaces.review.ignoreDocumentCandidate(
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

	const benefitsRightRail = (
		<div className="space-y-5">
			<section className="rounded-2xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.82)] p-5 shadow-sm">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					This space
				</p>
				<h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">
					Benefit wallet
				</h2>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					Promos and loyalty events belong to {spaceName} when they came from
					this space context.
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
			{expiringPromos.length ? (
				<section className="rounded-2xl border border-[rgba(200,160,95,0.22)] bg-[rgba(255,248,235,0.72)] p-5 shadow-sm">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(120,82,28,0.88)]">
								Expiring soon
							</p>
							<h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">
								Use these first
							</h2>
						</div>
						<span className="rounded-full border border-[rgba(200,130,55,0.28)] bg-[rgba(255,236,200,0.56)] px-2 py-1 text-xs font-semibold text-[#6b4510]">
							{expiringPromos.length}
						</span>
					</div>
					<div className="mt-4 space-y-2">
						{expiringPromos.slice(0, 3).map((promo) => (
							<EntityMini entity={toPromoBenefitEntity(promo)} key={promo.id} />
						))}
					</div>
				</section>
			) : null}
			<section className="rounded-2xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.78)] p-5 shadow-sm">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
							Selected promo
						</p>
						<h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">
							Detail and edit
						</h2>
					</div>
					{selectedPromo ? (
						<div className="flex flex-wrap gap-2">
							<button
								className="inline-flex h-8 items-center rounded-lg border border-[rgba(120,100,80,0.18)] bg-white/70 px-3 text-xs font-semibold text-muted-foreground transition hover:bg-white hover:text-foreground"
								onClick={() => startPromoEdit(selectedPromo)}
								type="button"
							>
								Edit
							</button>
							<button
								className="inline-flex h-8 items-center rounded-lg border border-red-200 bg-red-50/80 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
								disabled={deletePromoBusyId === selectedPromo.id}
								onClick={() => setDeletePromoTarget(selectedPromo)}
								type="button"
							>
								Delete
							</button>
						</div>
					) : null}
				</div>

				{selectedPromo ? (
					<div className="mt-4 space-y-4">
						<PromoBenefitDetailHeader promo={selectedPromo} />
						{editingPromoId === selectedPromo.id && PromoEditForm ? (
							<div className="space-y-3 rounded-xl border border-[rgba(120,100,80,0.14)] bg-white/66 p-3">
								<label className="block space-y-1 text-sm">
									<span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
										Title
									</span>
									<input
										className="h-10 w-full rounded-lg border border-border/70 bg-white px-3 text-sm text-foreground outline-none transition focus:border-[rgba(120,92,52,0.45)]"
										onChange={(event) =>
											setPromoEditForm((current) =>
												current
													? { ...current, title: event.target.value }
													: current,
											)
										}
										value={PromoEditForm.title}
									/>
								</label>
								<label className="block space-y-1 text-sm">
									<span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
										Description
									</span>
									<textarea
										className="min-h-20 w-full resize-none rounded-lg border border-border/70 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-[rgba(120,92,52,0.45)]"
										onChange={(event) =>
											setPromoEditForm((current) =>
												current
													? { ...current, description: event.target.value }
													: current,
											)
										}
										value={PromoEditForm.description}
									/>
								</label>
								<div className="grid gap-3">
									<label className="block space-y-1 text-sm">
										<span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
											Status
										</span>
										<select
											className="h-10 w-full rounded-lg border border-border/70 bg-white px-3 text-sm text-foreground outline-none transition focus:border-[rgba(120,92,52,0.45)]"
											onChange={(event) =>
												setPromoEditForm((current) =>
													current
														? { ...current, status: event.target.value }
														: current,
												)
											}
											value={PromoEditForm.status}
										>
											<option value="active">Active</option>
											<option value="used">Used</option>
											<option value="expired">Expired</option>
											<option value="archived">Archived</option>
											<option value="ignored">Ignored</option>
										</select>
									</label>
									<label className="block space-y-1 text-sm">
										<span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
											Reminder
										</span>
										<input
											className="h-10 w-full rounded-lg border border-border/70 bg-white px-3 text-sm text-foreground outline-none transition focus:border-[rgba(120,92,52,0.45)]"
											onChange={(event) =>
												setPromoEditForm((current) =>
													current
														? {
																...current,
																reminderAt: event.target.value,
															}
														: current,
												)
											}
											type="datetime-local"
											value={PromoEditForm.reminderAt}
										/>
									</label>
								</div>
								{promoEditError ? (
									<p className="text-sm text-red-700">{promoEditError}</p>
								) : null}
								<div className="flex flex-wrap justify-end gap-2">
									<button
										className="inline-flex h-9 items-center rounded-lg border border-border/70 bg-white px-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
										onClick={cancelPromoEdit}
										type="button"
									>
										Cancel
									</button>
									<button
										className="inline-flex h-9 items-center rounded-lg bg-[rgba(55,45,30,0.92)] px-3 text-sm font-semibold text-[#fffaf0] transition hover:bg-[rgba(45,38,28,0.95)] disabled:opacity-50"
										disabled={promoEditBusyId === selectedPromo.id}
										onClick={() => void savePromoEdit()}
										type="button"
									>
										{promoEditBusyId === selectedPromo.id
											? "Saving..."
											: "Save changes"}
									</button>
								</div>
							</div>
						) : (
							<div className="space-y-3 rounded-xl border border-[rgba(120,100,80,0.12)] bg-white/58 p-3 text-sm">
								<div>
									<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
										Offer
									</p>
									<p className="mt-1 font-medium text-foreground">
										{selectedPromo.discountLabel}
									</p>
								</div>
								<div>
									<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
										Conditions
									</p>
									<p className="mt-1 leading-relaxed text-muted-foreground">
										{selectedPromo.raw.conditions_text?.trim() ||
											selectedPromo.raw.description?.trim() ||
											"No conditions saved yet."}
									</p>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div>
										<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
											Valid until
										</p>
										<p className="mt-1 text-foreground">
											{selectedPromo.validUntil}
										</p>
									</div>
									<div>
										<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
											Source
										</p>
										<p className="mt-1 text-foreground">
											{selectedPromo.source}
										</p>
									</div>
								</div>
								{selectedPromo.sourceDocumentId != null ? (
									<Link
										className="inline-flex items-center rounded-lg border border-[rgba(48,83,120,0.2)] bg-[rgba(239,247,255,0.72)] px-2.5 py-1 text-xs font-semibold text-[rgba(34,72,108,0.92)] transition hover:bg-[rgba(232,242,255,0.95)]"
										to={captureReviewHref(
											numericSpaceId,
											selectedPromo.sourceDocumentId,
										)}
									>
										Source capture #{selectedPromo.sourceDocumentId}
									</Link>
								) : null}
								<p className="text-xs leading-relaxed text-muted-foreground">
									Code, platform, and conditions are read-only until the promo
									edit API supports those fields.
								</p>
							</div>
						)}
					</div>
				) : (
					<p className="mt-4 text-sm leading-relaxed text-muted-foreground">
						Select a saved promo to inspect its source, conditions, status, and
						reminder.
					</p>
				)}
			</section>

			<section className="rounded-2xl border border-[rgba(120,100,80,0.16)] bg-[rgba(255,252,246,0.78)] p-5 shadow-sm">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					Capture queue
				</p>
				<h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">
					Captures with benefits
				</h2>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					{candidateCount === 0
						? "No captures with benefit candidates are waiting right now."
						: `${candidateCount} benefit candidate${candidateCount === 1 ? "" : "s"} need review inside their source capture${candidateCount === 1 ? "" : "s"}.`}
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
						to={`/console/review?spaceId=${encodeURIComponent(String(numericSpaceId))}`}
					>
						Open captures
					</Link>
				)}
			</section>

			<section className="rounded-2xl border border-[rgba(200,160,95,0.22)] bg-[rgba(255,248,235,0.7)] p-5 shadow-sm">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(120,82,28,0.88)]">
					Sources
				</p>
				<dl className="mt-3 space-y-3 text-sm">
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">Receipt captures</dt>
						<dd className="font-semibold tabular-nums text-foreground">
							{sourceCounts.receipts}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">Text captures</dt>
						<dd className="font-semibold tabular-nums text-foreground">
							{sourceCounts.manual}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">Message captures</dt>
						<dd className="font-semibold tabular-nums text-foreground">
							{sourceCounts.messages}
						</dd>
					</div>
				</dl>
			</section>
		</div>
	);

	return (
		<SpaceWorkspaceLayout
			contentClassName="flex min-h-0 flex-1 flex-col p-0"
			rightRail={benefitsRightRail}
			rightRailLabel={`${spaceName} benefits rail`}
		>
			{deletePromoTarget ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,34,24,0.28)] px-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl border border-red-200 bg-[#fffdf9] p-5 shadow-[0_24px_80px_-36px_rgba(60,40,20,0.55)]">
						<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700">
							Delete benefit
						</p>
						<h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
							Delete{" "}
							{deletePromoTarget.code !== "No code"
								? deletePromoTarget.code
								: deletePromoTarget.title}
							?
						</h2>
						<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
							This removes the saved promo from {spaceName}. Its original
							capture stays available, but this benefit record and projection
							link will be deleted.
						</p>
						<div className="mt-5 flex flex-wrap justify-end gap-2">
							<button
								className="inline-flex h-10 items-center rounded-lg border border-border/70 bg-white px-4 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
								disabled={deletePromoBusyId === deletePromoTarget.id}
								onClick={() => setDeletePromoTarget(null)}
								type="button"
							>
								Cancel
							</button>
							<button
								className="inline-flex h-10 items-center rounded-lg bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
								disabled={deletePromoBusyId === deletePromoTarget.id}
								onClick={() => void deletePromo(deletePromoTarget)}
								type="button"
							>
								{deletePromoBusyId === deletePromoTarget.id
									? "Deleting..."
									: "Delete benefit"}
							</button>
						</div>
					</div>
				</div>
			) : null}

			<WorkspaceListingPage
				description={
					<>
						Saved promos and loyalty records in {spaceName}. Benefit candidates
						stay inside Captures until they are saved.
					</>
				}
				stats={
					<>
						<WorkspaceSummaryChip
							accent="attention"
							label="Active promos"
							value={
								isLoading ? "..." : activePromos.length + expiringPromos.length
							}
						/>
						<WorkspaceSummaryChip
							accent="attention"
							label="Expiring soon"
							value={isLoading ? "..." : expiringPromos.length}
						/>
						<WorkspaceSummaryChip
							accent="positive"
							label="Loyalty programs"
							value={isLoading ? "..." : totalLoyaltyBalance}
						/>
						<WorkspaceSummaryChip
							accent={candidateCount > 0 ? "attention" : "default"}
							label="Capture review"
							value={isLoading ? "..." : candidateCount}
						/>
					</>
				}
				title="Benefits"
			>
				<WorkspaceFilterBar
					resultLabel={
						isLoading
							? "Loading..."
							: `${filteredPromoBenefits.length} shown · ${promoBenefits.length} saved promos`
					}
					search={
						<input
							aria-label="Search benefits"
							className={workspaceSearchInputClass}
							onChange={(event) => setPromoQuery(event.target.value)}
							placeholder="Search code, merchant, condition..."
							type="search"
							value={promoQuery}
						/>
					}
				>
					<select
						aria-label="Filter benefit status"
						className={`${workspaceControlClass} min-w-36`}
						onChange={(event) =>
							setPromoStatusFilter(event.target.value as PromoStatusFilter)
						}
						value={promoStatusFilter}
					>
						{promoStatusOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<select
						aria-label="Filter benefit source"
						className={`${workspaceControlClass} min-w-32`}
						onChange={(event) =>
							setPromoSourceFilter(event.target.value as PromoSourceFilter)
						}
						value={promoSourceFilter}
					>
						{promoSourceOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<button
						className="inline-flex h-10 items-center justify-center rounded-lg border border-[rgba(120,100,80,0.18)] bg-white/70 px-3 text-xs font-semibold text-muted-foreground transition hover:bg-white hover:text-foreground disabled:opacity-50"
						disabled={!promoFiltersActive}
						onClick={() => {
							setPromoQuery("");
							setPromoStatusFilter("all");
							setPromoSourceFilter("all");
						}}
						type="button"
					>
						Clear
					</button>
				</WorkspaceFilterBar>
				{loadError ? (
					<div className="mx-auto mt-4 max-w-5xl px-4 sm:px-5">
						<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
							{loadError}
						</div>
					</div>
				) : null}

				<section className="mx-auto max-w-5xl space-y-6 overflow-y-auto px-4 py-4 sm:px-5">
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
												onChange={(event) => setManualTitle(event.target.value)}
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
												onChange={(event) => setManualCode(event.target.value)}
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
										<p className="mt-3 text-sm text-red-700">{manualError}</p>
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
											{manualBusy ? "Adding…" : "Add to review"}
										</button>
									</div>
								</div>
							) : null}

							{promoBenefits.length ? (
								<>
									{filteredPromoBenefits.length ? (
										<WorkspacePagedList
											hasMore={promosHasMore}
											isLoadingMore={isLoadingMorePromos}
											items={filteredPromoBenefits}
											loadMoreLabel="Load more benefits"
											loadingMoreLabel="Loading benefits"
											onLoadMore={() => void loadMorePromos()}
											renderItem={(promo) => (
												<PromoBenefitCard
													busy={
														savingPromoId === promo.id ||
														deletePromoBusyId === promo.id
													}
													isSelected={selectedPromoId === promo.id}
													key={promo.id}
													onArchive={(item) =>
														void patchPromoStatus(item, "archived")
													}
													onDelete={(item) => setDeletePromoTarget(item)}
													onMarkUsed={(item) =>
														void patchPromoStatus(item, "used")
													}
													onOpen={openPromoDetail}
													promo={promo}
													reviewHref={
														promo.sourceDocumentId != null
															? captureReviewHref(
																	numericSpaceId,
																	promo.sourceDocumentId,
																)
															: undefined
													}
												/>
											)}
										/>
									) : (
										<EmptyPanel
											body="Try another code, merchant, status, or source."
											title="No promos match filters"
										/>
									)}
								</>
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
										<LoyaltyBenefitCard key={loyalty.id} loyalty={loyalty} />
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
				</section>
			</WorkspaceListingPage>
		</SpaceWorkspaceLayout>
	);
};
