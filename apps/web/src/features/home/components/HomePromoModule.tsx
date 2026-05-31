import { Link } from "react-router-dom";
import {
	type PromoBenefit,
	toPromoBenefitEntity,
} from "../../../shared/lib/benefitPresentation";
import { EntityMini } from "../../../shared/lib/entityPresentation";

const promoSkeletonKeys = [
	"promo-skeleton-1",
	"promo-skeleton-2",
	"promo-skeleton-3",
];

export type HomePromoPreviewItem = {
	promo: PromoBenefit;
	spaceId: number;
	spaceName: string;
};

export const HomePromoModule = ({
	isLoading,
	items,
}: {
	isLoading: boolean;
	items: HomePromoPreviewItem[];
}) => {
	if (!isLoading && items.length === 0) return null;

	const primarySpaceId = items[0]?.spaceId ?? null;
	const href =
		primarySpaceId != null
			? `/console/spaces/${encodeURIComponent(String(primarySpaceId))}/benefits`
			: "/console/spaces";

	return (
		<section
			aria-labelledby="home-promos"
			className="rounded-2xl border border-[rgba(95,125,102,0.2)] bg-gradient-to-br from-[#f3f9f4] via-[#fffdf8] to-[#f8f1e4] p-5 shadow-[0_18px_46px_-34px_rgba(60,82,52,0.42)]"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4d6651]">
						Promos
					</p>
					<h2
						className="mt-1 font-display text-xl font-bold tracking-tight text-foreground"
						id="home-promos"
					>
						Worth using soon
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Saved value Ceits found in your active spaces.
					</p>
				</div>
				<Link
					className="inline-flex h-9 items-center rounded-full border border-[rgba(120,100,80,0.18)] bg-white/72 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground transition hover:bg-white hover:text-foreground"
					to={href}
				>
					Open benefits
				</Link>
			</div>

			<div className="mt-4 grid gap-3 md:grid-cols-3">
				{isLoading && items.length === 0
					? promoSkeletonKeys.map((key) => (
							<div
								className="h-[4.25rem] animate-pulse rounded-xl border border-[rgba(120,100,80,0.1)] bg-white/46"
								key={key}
							/>
						))
					: items.slice(0, 3).map((item) => (
							<EntityMini
								entity={toPromoBenefitEntity(item.promo, {
									href: `/console/spaces/${encodeURIComponent(String(item.spaceId))}/benefits`,
									spaceName: item.spaceName,
								})}
								key={`${item.spaceId}-${item.promo.id}`}
							/>
						))}
			</div>
		</section>
	);
};
