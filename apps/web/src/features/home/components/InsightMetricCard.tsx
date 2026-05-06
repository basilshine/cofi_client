import { Link } from "react-router-dom";

type InsightMetricCardProps = {
	label: string;
	value: string;
	contextLine?: string;
	spaceLinks?: Array<{ id: number; name: string }>;
	to?: string;
	loading?: boolean;
	tone?: "review" | "activity";
};

export const InsightMetricCard = ({
	label,
	value,
	contextLine,
	spaceLinks,
	to,
	loading,
	tone = "activity",
}: InsightMetricCardProps) => {
	const tileClassName = `relative overflow-hidden rounded-2xl border px-5 py-4 transition-all ${
		tone === "review"
			? "border-[rgba(120,105,85,0.08)] bg-[#FAF5EC] shadow-[0_10px_24px_rgba(31,37,35,0.05)] hover:shadow-[0_12px_26px_rgba(31,37,35,0.055)]"
			: "border-[rgba(120,105,85,0.08)] bg-[#F4F7F1] shadow-[0_10px_24px_rgba(31,37,35,0.05)] hover:shadow-[0_12px_26px_rgba(31,37,35,0.055)]"
	}`;

	const content = (
		<>
			<span
				aria-hidden
				className={`mb-2 block h-[3px] w-8 rounded-full ${
					tone === "review" ? "bg-[#EAD8B8]" : "bg-[#C9D6C3]"
				}`}
			/>
			<div className="flex h-full flex-col">
				<p className="eyebrow mb-2">{label}</p>
				{loading ? (
					<div className="h-8 w-32 animate-pulse rounded-md bg-muted/60" />
				) : (
					<div className="flex flex-wrap items-baseline gap-2">
						<p className="text-[2rem] font-semibold tracking-tight text-[#1F2523]">
							{value}
						</p>
						{contextLine ? (
							<p className="text-[11px] leading-relaxed text-[#70756E]">
								· {contextLine}
							</p>
						) : null}
					</div>
				)}
				{spaceLinks && spaceLinks.length > 0 ? (
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						{spaceLinks.slice(0, 2).map((space) => (
							<Link
								className="inline-flex cursor-pointer items-center rounded-full bg-[rgba(142,159,136,0.12)] px-2.5 py-1 text-[10px] leading-none text-[#5C645D] transition-all duration-200 hover:bg-[rgba(142,159,136,0.18)]"
								key={space.id}
								onClick={(event) => {
									event.stopPropagation();
								}}
								to={`/console/chat?spaceId=${encodeURIComponent(String(space.id))}`}
							>
								{space.name}
							</Link>
						))}
					</div>
				) : null}
			</div>
		</>
	);

	if (!to) {
		return <div className={tileClassName}>{content}</div>;
	}

	return (
		<Link className={`${tileClassName} block cursor-pointer`} to={to}>
			{content}
		</Link>
	);
};
