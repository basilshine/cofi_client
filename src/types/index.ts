export interface MonthlySummary {
	month: string;
	total: number;
	tags: {
		[key: string]: number;
	};
}

export interface AnalyticsData {
	monthly: MonthlySummary[];
	tags: {
		name: string;
		total: number;
		percentage: number;
	}[];
	trends: {
		date: string;
		total: number;
	}[];
}
