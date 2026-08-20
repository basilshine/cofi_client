export type PeriodTrendReport = {
	id: number;
	kind: "week" | "month" | "range";
	period_start: string;
	period_end: string;
	currency: string;
	facts: { total_spent: number; previous_total: number };
};

export type PeriodTrendPoint = {
	key: string;
	periodStart?: string;
	periodEnd?: string;
	total: number;
	current: boolean;
};

export const periodReportTrend = <T extends PeriodTrendReport>(
	selected: T,
	reports: T[],
	limit = 6,
): PeriodTrendPoint[] => {
	const matching: PeriodTrendPoint[] = reports
		.filter(
			(report) =>
				report.kind === selected.kind && report.currency === selected.currency,
		)
		.filter(
			(report, index, rows) =>
				rows.findIndex(
					(candidate) =>
						candidate.period_start === report.period_start &&
						candidate.period_end === report.period_end,
				) === index,
		)
		.sort((left, right) => left.period_end.localeCompare(right.period_end))
		.slice(-Math.max(2, limit))
		.map((report) => ({
			key: String(report.id),
			periodStart: report.period_start,
			periodEnd: report.period_end,
			total: report.facts.total_spent,
			current:
				report.period_start === selected.period_start &&
				report.period_end === selected.period_end,
		}));

	if (!matching.some(({ current }) => current)) {
		matching.push({
			key: String(selected.id),
			periodStart: selected.period_start,
			periodEnd: selected.period_end,
			total: selected.facts.total_spent,
			current: true,
		});
	}
	if (matching.length === 1 && selected.facts.previous_total > 0) {
		matching.unshift({
			key: "previous",
			total: selected.facts.previous_total,
			current: false,
		});
	}
	return matching;
};
