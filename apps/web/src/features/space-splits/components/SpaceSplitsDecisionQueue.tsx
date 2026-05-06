import { Link } from "react-router-dom";

type DecisionItem = {
	id: string;
	title: string;
	subtitle: string;
	amountLabel: string;
	to: string;
};

type SpaceSplitsDecisionQueueProps = {
	title: string;
	eyebrow: string;
	emptyText: string;
	items: DecisionItem[];
};

export const SpaceSplitsDecisionQueue = ({
	title,
	eyebrow,
	emptyText,
	items,
}: SpaceSplitsDecisionQueueProps) => {
	return (
		<section className="rounded-2xl border border-border/70 bg-card text-card-foreground soft-shadow inner-glow">
			<div className="border-b border-border/50 px-6 py-4">
				<p className="eyebrow">{eyebrow}</p>
				<h3 className="text-lg font-semibold tracking-tight text-foreground">
					{title}
				</h3>
			</div>
			{items.length === 0 ? (
				<p className="px-6 py-5 text-sm text-muted-foreground">{emptyText}</p>
			) : (
				<ul className="divide-y divide-border/45">
					{items.map((item) => (
						<li className="px-6 py-3.5" key={item.id}>
							<Link
								className="group flex items-start justify-between gap-3 rounded-lg p-1 transition hover:bg-background/50"
								to={item.to}
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium text-foreground">
										{item.title}
									</p>
									<p className="mt-0.5 truncate text-xs text-muted-foreground">
										{item.subtitle}
									</p>
								</div>
								<p className="shrink-0 text-sm font-semibold tabular-nums text-foreground/90">
									{item.amountLabel}
								</p>
							</Link>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};
