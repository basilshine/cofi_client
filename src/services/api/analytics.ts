import LogRocket from "logrocket";
import { apiService } from "../api";

// Analytics filtering types
export interface AnalyticsFilters {
	period?: "week" | "month";
	dateRange?: string;
	tag?: string;
}

// Backend analytics response types (see cofi_server/internal/analytics/models.go)
export interface TagStats {
	tag: string;
	total: number;
	count: number;
	percentage: number;
}

export interface EmotionStats {
	emotion: string;
	count: number;
	total: number;
	percentage: number;
}

export interface GoalProgress {
	goal_id: number;
	target: number;
	current: number;
	percentage: number;
	days_left: number;
	projected: number;
}

export interface StatsResponse {
	period: string;
	total_spent: number;
	average_daily: number;
	most_expensive_day: string;
	max_daily_spent: number;
	previous_total: number;
	change_percent: number;
	top_tags: TagStats[];
	emotion_stats: EmotionStats[];
	goal_progress: GoalProgress[];
	regret_amount: number;
	most_common_emotion: string;
}

export interface EmotionStatsResponse {
	emotions: Record<string, unknown>;
	most_common: string;
	regret_amount: number;
}

export const analyticsService = {
	getStats: async (
		period: "week" | "month" = "week",
		userId?: number,
	): Promise<StatsResponse> => {
		try {
			LogRocket.log("[analyticsService.getStats] Starting request", {
				period,
				userId,
			});

			const uid = userId != null ? String(userId) : undefined;
			if (!uid) {
				throw new Error("user_id is required for analytics stats");
			}

			const response =
				period === "week"
					? await apiService.analytics.week(uid)
					: await apiService.analytics.month(uid);

			LogRocket.log("[analyticsService.getStats] Success:", response.data);
			return response.data as unknown as StatsResponse;
		} catch (error) {
			LogRocket.error("[analyticsService.getStats] Failed:", error);
			throw error;
		}
	},

	getSummary: async (
		period: "week" | "month" = "week",
		userId?: number,
	): Promise<StatsResponse> => {
		try {
			LogRocket.log("[analyticsService.getSummary] Starting request", {
				period,
				userId,
			});

			const uid = userId != null ? String(userId) : undefined;
			const response = await apiService.analytics.summary(period, "json", uid);
			LogRocket.log("[analyticsService.getSummary] Success:", response.data);
			return response.data as unknown as StatsResponse;
		} catch (error) {
			LogRocket.error("[analyticsService.getSummary] Failed:", error);
			throw error;
		}
	},

	getEmotionStats: async (
		period: "week" | "month" = "week",
		userId?: number,
	): Promise<EmotionStatsResponse> => {
		try {
			LogRocket.log("[analyticsService.getEmotionStats] Starting request", {
				period,
				userId,
			});

			const uid = userId != null ? String(userId) : undefined;
			if (!uid) {
				throw new Error("user_id is required for emotion stats");
			}

			const response = await apiService.analytics.emotions(uid, period);
			LogRocket.log(
				"[analyticsService.getEmotionStats] Success:",
				response.data,
			);
			return response.data as EmotionStatsResponse;
		} catch (error) {
			LogRocket.error("[analyticsService.getEmotionStats] Failed:", error);
			throw error;
		}
	},

	// Helper functions for analytics calculations
	calculateSpendingTrend: (stats: StatsResponse): "up" | "down" | "stable" => {
		if (stats.change_percent > 5) return "up";
		if (stats.change_percent < -5) return "down";
		return "stable";
	},

	getTopTag: (tags: TagStats[]): TagStats | null => {
		return tags.length > 0 ? tags[0] : null;
	},

	getMoodAnalysis: (
		emotions: EmotionStats[],
	): { positive: number; negative: number; neutral: number } => {
		const positive = emotions
			.filter((e) =>
				["happy", "excited", "satisfied", "grateful"].includes(
					e.emotion.toLowerCase(),
				),
			)
			.reduce((sum, e) => sum + e.count, 0);

		const negative = emotions
			.filter((e) =>
				["regret", "guilt", "sad", "angry", "frustrated"].includes(
					e.emotion.toLowerCase(),
				),
			)
			.reduce((sum, e) => sum + e.count, 0);

		const neutral = emotions
			.filter(
				(e) =>
					![
						"happy",
						"excited",
						"satisfied",
						"grateful",
						"regret",
						"guilt",
						"sad",
						"angry",
						"frustrated",
					].includes(e.emotion.toLowerCase()),
			)
			.reduce((sum, e) => sum + e.count, 0);

		const total = positive + negative + neutral;
		return {
			positive: total > 0 ? (positive / total) * 100 : 0,
			negative: total > 0 ? (negative / total) * 100 : 0,
			neutral: total > 0 ? (neutral / total) * 100 : 0,
		};
	},

	getSpendingInsights: (stats: StatsResponse): string[] => {
		const insights: string[] = [];

		if (stats.change_percent > 20) {
			insights.push(
				`Your spending increased by ${stats.change_percent.toFixed(1)}% compared to last ${stats.period}`,
			);
		} else if (stats.change_percent < -20) {
			insights.push(
				`Great job! You reduced spending by ${Math.abs(stats.change_percent).toFixed(1)}% compared to last ${stats.period}`,
			);
		}

		if (stats.regret_amount > 0) {
			const regretPercentage = (stats.regret_amount / stats.total_spent) * 100;
			insights.push(
				`You had ${regretPercentage.toFixed(1)}% regretful spending this ${stats.period}`,
			);
		}

		const topTag = stats.top_tags?.[0];
		if (topTag && topTag.percentage > 50) {
			insights.push(
				`${topTag.tag} dominates your spending at ${topTag.percentage.toFixed(1)}%`,
			);
		}

		if (stats.max_daily_spent > stats.average_daily * 3) {
			insights.push(
				`Your most expensive day was ${(stats.max_daily_spent / stats.average_daily - 1).toFixed(0)}x your average daily spending`,
			);
		}

		return insights;
	},
};
