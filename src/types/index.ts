export interface MonthlySummary {
	month: string;
	total: number;
	categories: {
		[key: string]: number;
	};
}

export interface AnalyticsData {
	monthly: MonthlySummary[];
	categories: {
		name: string;
		total: number;
		percentage: number;
	}[];
	trends: {
		date: string;
		total: number;
	}[];
}
