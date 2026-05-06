import { Link } from "react-router-dom";

type CoverageRow = {
	id: string;
	title: string;
	meta: string;
	participantLabel: string;
	myShareLabel: string;
	totalLabel: string;
	statusLabel: string;
	to: string;
};

type SpaceSplitsCoverageTableProps = {
	rows: CoverageRow[];
	isLoading?: boolean;
	spaceName?: string | null;
	eyebrow?: string;
	title?: string;
	description?: string;
	emptyText?: string;
};

export const SpaceSplitsCoverageTable = ({
	rows,
	isLoading = false,
	spaceName,
	eyebrow = "Splits",
	title,
	description,
	emptyText = "No split rows available in this space yet.",
}: SpaceSplitsCoverageTableProps) => {
	const resolvedTitle =
		title ?? `Loaded splits in ${spaceName ?? "this space"}`;
	const resolvedDescription =
		description ??
		"A full-page list of split rows and approvals scoped to the current space.";

	return (
		<section className="rounded-xl border border-border/60 bg-background/70">
			<div className="border-b border-border/50 px-4 py-4 lg:px-6">
				<p className="eyebrow">{eyebrow}</p>
				<h2 className="text-xl font-semibold tracking-tight text-foreground">
					{resolvedTitle}
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					{resolvedDescription}
				</p>
			</div>
			{isLoading ? (
				<p className="px-4 py-6 text-sm text-muted-foreground lg:px-6">
					Loading splits...
				</p>
			) : rows.length === 0 ? (
				<p className="px-4 py-6 text-sm text-muted-foreground lg:px-6">
					{emptyText}
				</p>
			) : (
				<div className="overflow-x-auto px-2 py-2 lg:px-3">
					<table className="w-full min-w-[44rem] border-separate border-spacing-y-1.5">
						<thead>
							<tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
								<th className="px-3 py-2 font-semibold">Expense</th>
								<th className="px-3 py-2 font-semibold">Participants</th>
								<th className="px-3 py-2 font-semibold">My share</th>
								<th className="px-3 py-2 font-semibold">Total</th>
								<th className="px-3 py-2 font-semibold">Status</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr className="rounded-xl bg-card/60" key={row.id}>
									<td className="rounded-l-xl px-3 py-2.5">
										<Link className="group block min-w-0" to={row.to}>
											<p className="truncate text-sm font-medium text-foreground group-hover:underline">
												{row.title}
											</p>
											<p className="truncate text-xs text-muted-foreground">
												{row.meta}
											</p>
										</Link>
									</td>
									<td className="px-3 py-2.5 text-sm text-foreground/80">
										{row.participantLabel}
									</td>
									<td className="px-3 py-2.5 text-sm font-medium tabular-nums text-foreground">
										{row.myShareLabel}
									</td>
									<td className="px-3 py-2.5 text-sm font-medium tabular-nums text-foreground/90">
										{row.totalLabel}
									</td>
									<td className="rounded-r-xl px-3 py-2.5">
										<span className="inline-flex rounded-full bg-[rgba(142,159,136,0.14)] px-2 py-0.5 text-[11px] font-medium text-[#49574C]">
											{row.statusLabel}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
};
