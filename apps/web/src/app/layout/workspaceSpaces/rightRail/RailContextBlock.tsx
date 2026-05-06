import { Link } from "react-router-dom";

type UpcomingBill = {
	id: string;
	name: string;
	amountLabel: string;
	dueLabel: string;
	dueSoonLabel?: string;
	spaceName?: string | null;
	isUrgent: boolean;
};

type RailContextBlockProps = {
	bills: UpcomingBill[];
	recurringHref: string;
	monthlyLabel: string;
	monthlyAmount: string;
	monthlyContext: string;
	monthlyDelta?: string | null;
	/** When false, only bills are shown (use on Space Overview to avoid duplicating the main position card). */
	showMonthlySnapshot?: boolean;
	/** Override section label (e.g. "Bills in this space"). */
	sectionLabel?: string;
	/** Softer navy/taupe bills card (Space Overview rail). */
	billsSurface?: "default" | "spaceMuted";
};

export const RailContextBlock = ({
	bills,
	recurringHref,
	monthlyLabel,
	monthlyAmount,
	monthlyContext,
	monthlyDelta,
	showMonthlySnapshot = true,
	sectionLabel = "Context",
	billsSurface = "default",
}: RailContextBlockProps) => {
	const billsCardClass =
		billsSurface === "spaceMuted"
			? "rounded-2xl border border-[rgba(88,98,118,0.22)] bg-gradient-to-b from-[#faf9fc] to-[#f2f1f6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_8px_28px_-22px_rgba(45,48,58,0.12)]"
			: "rounded-2xl border border-border/60 bg-card p-4 soft-shadow inner-glow";

	return (
		<section aria-labelledby="rail-context" className="mt-auto space-y-3">
			<h4
				className={
					billsSurface === "spaceMuted"
						? "text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(72,78,95,0.78)]"
						: "eyebrow"
				}
				id="rail-context"
			>
				{sectionLabel}
			</h4>

			<div className={billsCardClass}>
				<div className="mb-2 flex items-center justify-between">
					<p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
						Upcoming bills
					</p>
					<Link
						className="text-[11px] font-medium text-foreground/70 transition hover:text-foreground"
						to={recurringHref}
					>
						View all
					</Link>
				</div>
				{bills.length === 0 ? (
					<p className="px-1 py-2 text-sm text-muted-foreground">
						No upcoming bills right now.
					</p>
				) : (
					<ul className="space-y-2">
						{bills.map((bill) => (
							<li
								className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-2 transition hover:bg-background/50"
								key={bill.id}
							>
								<div className="min-w-0">
									<p className="truncate text-[12px] font-medium text-foreground/90">
										{bill.name}
										{bill.spaceName ? ` · ${bill.spaceName}` : ""}
									</p>
								</div>
								<div className="text-right">
									<p className="text-sm font-semibold tabular-nums text-foreground">
										{bill.amountLabel}
									</p>
									<p
										className={`text-[11px] ${
											bill.isUrgent
												? "font-semibold text-[rgba(120,82,27,0.95)]"
												: "font-medium text-foreground/68"
										}`}
									>
										{bill.dueSoonLabel ?? bill.dueLabel}
									</p>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>

			{showMonthlySnapshot ? (
				<div className="rounded-2xl border border-[rgba(142,159,136,0.22)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,249,244,0.9)_100%)] p-6 shadow-[0_12px_20px_-20px_rgba(31,37,35,0.38)]">
					<p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
						Monthly snapshot
					</p>
					<p className="mt-3 text-xs text-foreground/65">{monthlyLabel}</p>
					<p className="mt-2 text-[1.95rem] font-semibold tabular-nums tracking-tight text-foreground">
						{monthlyAmount}
					</p>
					<p className="mt-2 text-xs text-foreground/70">{monthlyContext}</p>
					{monthlyDelta ? (
						<p className="mt-4 border-l border-[rgba(142,159,136,0.32)] pl-3 text-xs leading-relaxed text-foreground/75">
							{monthlyDelta}
						</p>
					) : null}
				</div>
			) : null}
		</section>
	);
};
