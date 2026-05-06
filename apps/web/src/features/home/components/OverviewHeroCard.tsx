type HeroChipTone = "food" | "recurring" | "uncategorized";

type HeroChip = {
	label: string;
	detail: string;
	tone: HeroChipTone;
};

type HeroStripSegment = {
	key: string;
	width: string;
	tone: HeroChipTone;
};

const heroChipToneClass: Record<HeroChipTone, string> = {
	food: "bg-[#DEE7D9] text-[#566758]",
	recurring: "bg-[#EBDDC8] text-[#6E5F49]",
	uncategorized: "bg-[#E8E1D6] text-[#666B65]",
};

const heroStripToneClass: Record<HeroChipTone, string> = {
	food: "bg-[#C9D8C3]",
	recurring: "bg-[#DCC8AA]",
	uncategorized: "bg-[#D5CCBE]",
};

type OverviewHeroCardProps = {
	eyebrow: string;
	amount: string;
	insight: string;
	subtitle?: string;
	vsLabel?: string;
	loading?: boolean;
	chips: HeroChip[];
	stripSegments: HeroStripSegment[];
};

export const OverviewHeroCard = ({
	eyebrow,
	amount,
	insight,
	subtitle,
	vsLabel = "vs last month",
	loading,
	chips,
	stripSegments,
}: OverviewHeroCardProps) => {
	return (
		<div className="cursor-pointer rounded-[1.5rem] border border-[#E5DECF] bg-[radial-gradient(140%_95%_at_8%_6%,rgba(255,255,250,0.75)_0%,rgba(255,255,250,0)_48%),linear-gradient(180deg,#F7F4EC_0%,#EEF3EC_100%)] px-7 py-8 shadow-[0_16px_30px_-24px_rgba(31,37,35,0.34)] hover:shadow-[0_18px_32px_-24px_rgba(31,37,35,0.36)]">
			<p className="eyebrow mb-4 tracking-[0.14em] text-[#676C66]">{eyebrow}</p>
			{loading ? (
				<div className="h-12 w-40 animate-pulse rounded-md bg-[#EEF2E8]" />
			) : (
				<p className="font-display text-[3.35rem] font-semibold leading-[0.96] tracking-tight text-[#1A241F] sm:text-[4.05rem]">
					{amount}
				</p>
			)}
			{subtitle ? (
				<p className="mt-4 text-sm text-[#666D66]">{subtitle}</p>
			) : null}
			<p className="mt-1 text-xs text-[#7A7F79]">{insight}</p>
			<p className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[#8A9587]">
				<span>{vsLabel}</span>
			</p>

			<div
				aria-hidden
				className="mt-7 flex h-1 w-full gap-px overflow-hidden rounded-full bg-[#E4DDD1]"
			>
				{stripSegments.map((segment) => (
					<span
						className={`${heroStripToneClass[segment.tone]} first:rounded-l-full last:rounded-r-full`}
						key={segment.key}
						style={{ width: segment.width }}
					/>
				))}
			</div>

			<div className="mt-6 flex flex-wrap gap-3.5">
				{chips.map((item, index) => (
					<span
						className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] ${heroChipToneClass[item.tone]} ${index === 0 ? "ring-1 ring-[#C7D4C1]/75" : ""}`}
						key={`${item.label}-${item.detail}`}
					>
						<span>{item.label}</span>
						<span className="rounded-full bg-[#FFFCF6]/60 px-1.5 py-0.5 text-[9px] font-medium">
							{item.detail}
						</span>
					</span>
				))}
			</div>
		</div>
	);
};
