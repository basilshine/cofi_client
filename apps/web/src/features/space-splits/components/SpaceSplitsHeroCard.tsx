import { SplitExpenseIcon } from "@cofi/ceits-icons";

type SpaceSplitsHeroCardProps = {
	spaceName: string;
	reviewCount: number;
	draftCount: number;
	loadedExpenseCount: number;
	withSplitsCount: number;
	totalTrackedShare: string;
};

export const SpaceSplitsHeroCard = ({
	spaceName,
	reviewCount,
	draftCount,
	loadedExpenseCount,
	withSplitsCount,
	totalTrackedShare,
}: SpaceSplitsHeroCardProps) => {
	const coveragePct =
		loadedExpenseCount > 0
			? Math.round((withSplitsCount / loadedExpenseCount) * 100)
			: 0;
	return (
		<section className="rounded-2xl border border-[rgba(189,143,64,0.22)] bg-[linear-gradient(180deg,rgba(255,250,241,0.96)_0%,rgba(255,246,232,0.9)_100%)] px-6 py-5 shadow-[0_18px_26px_-24px_rgba(143,104,43,0.82)]">
			<p className="eyebrow inline-flex items-center gap-2">
				<SplitExpenseIcon className="h-4 w-4 shrink-0 opacity-90" size={16} />
				Splits control panel
			</p>
			<h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
				{spaceName} split decisions
			</h2>
			<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div className="rounded-xl bg-white/75 p-3">
					<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
						Needs review
					</p>
					<p className="mt-1 text-xl font-semibold text-foreground">
						{reviewCount}
					</p>
				</div>
				<div className="rounded-xl bg-white/75 p-3">
					<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
						Drafts
					</p>
					<p className="mt-1 text-xl font-semibold text-foreground">
						{draftCount}
					</p>
				</div>
				<div className="rounded-xl bg-white/75 p-3">
					<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
						Split coverage
					</p>
					<p className="mt-1 text-xl font-semibold text-foreground">
						{coveragePct}%
					</p>
				</div>
				<div className="rounded-xl bg-white/75 p-3">
					<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
						Tracked share
					</p>
					<p className="mt-1 text-xl font-semibold text-foreground">
						{totalTrackedShare}
					</p>
				</div>
			</div>
		</section>
	);
};
