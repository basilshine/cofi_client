import type { Space } from "@cofi/api";
import { useEffect, useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceHeader } from "../../app/layout/workspaceSpaces/SpaceHeader";
import { SpaceTabs } from "../../app/layout/workspaceSpaces/SpaceTabs";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";

type BenefitStatus = "active" | "draft" | "expires_soon" | "used";

type PromoBenefit = {
	id: string;
	title: string;
	code: string;
	merchant: string;
	redeemAt: string;
	status: BenefitStatus;
	discountLabel: string;
	validUntil: string;
	source: string;
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

const promoBenefits: PromoBenefit[] = [];
const loyaltyBenefits: LoyaltyBenefit[] = [];
const candidateCount = 0;

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
	return "border-border/60 bg-muted/55 text-muted-foreground";
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

const PromoCard = ({ promo }: { promo: PromoBenefit }) => (
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
		<p className="mt-3 text-xs text-muted-foreground">Source: {promo.source}</p>
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

export const SpaceBenefitsPage = () => {
	const { spaceId } = useParams<{ spaceId: string }>();
	const { user } = useAuth();
	const { spaces, selectedSpaceId, setSelectedSpaceId } = useWorkspaceSpaces();

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

	if (numericSpaceId == null) {
		return <Navigate replace to="/console/home" />;
	}

	const activePromos = promoBenefits.filter((item) => item.status === "active");
	const expiringPromos = promoBenefits.filter(
		(item) => item.status === "expires_soon",
	);
	const totalLoyaltyBalance = loyaltyBenefits.length;

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
									value: String(activePromos.length),
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
										{widget.value}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{widget.note}
									</p>
								</div>
							))}
						</section>

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
											disabled
											type="button"
										>
											Add manually
										</button>
									</div>
									<div className="p-4 sm:p-5">
										{promoBenefits.length ? (
											<ul className="space-y-3">
												{promoBenefits.map((promo) => (
													<PromoCard key={promo.id} promo={promo} />
												))}
											</ul>
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
									<Link
										className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[rgba(55,45,30,0.92)] px-4 text-sm font-semibold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(45,38,28,0.95)]"
										to={`/console/chat?spaceId=${encodeURIComponent(String(numericSpaceId))}`}
									>
										Open chat
									</Link>
								</section>

								<section className="rounded-2xl border border-[rgba(200,160,95,0.22)] bg-[rgba(255,248,235,0.7)] p-5 shadow-sm">
									<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(120,82,28,0.88)]">
										Sources
									</p>
									<dl className="mt-3 space-y-3 text-sm">
										<div className="flex items-baseline justify-between gap-3">
											<dt className="text-muted-foreground">Receipts</dt>
											<dd className="font-semibold tabular-nums text-foreground">
												0
											</dd>
										</div>
										<div className="flex items-baseline justify-between gap-3">
											<dt className="text-muted-foreground">Manual</dt>
											<dd className="font-semibold tabular-nums text-foreground">
												0
											</dd>
										</div>
										<div className="flex items-baseline justify-between gap-3">
											<dt className="text-muted-foreground">Messages</dt>
											<dd className="font-semibold tabular-nums text-foreground">
												0
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
