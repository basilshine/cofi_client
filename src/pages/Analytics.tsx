import { type StatsResponse, analyticsService } from "@/services/api/analytics";
import { currencyService } from "@/services/currency";
import { LoadingScreen } from "@components/LoadingScreen";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@components/ui/select";
import { useAuth } from "@contexts/AuthContext";
import {
	Calendar,
	ChartPie,
	CurrencyDollar,
	Heart,
	Minus,
	TrendDown,
	TrendUp,
	Warning,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import LogRocket from "logrocket";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export const Analytics = () => {
	const { t } = useTranslation();
	const { isAuthenticated, isLoading: authLoading, user } = useAuth();
	const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month">(
		"week",
	);

	// Log when Analytics page is loaded
	useEffect(() => {
		LogRocket.log("[Analytics] Page loaded", { isAuthenticated, authLoading });
	}, [isAuthenticated, authLoading]);

	// Fetch analytics data
	const {
		data: stats,
		isLoading: isStatsLoading,
		error: statsError,
		refetch: refetchStats,
	} = useQuery<StatsResponse>({
		queryKey: ["analytics", "stats", selectedPeriod],
		queryFn: () => analyticsService.getStats(selectedPeriod),
		enabled: isAuthenticated && !!user?.id,
		retry: 2,
	});

	const isLoading = isStatsLoading;
	const hasData = stats && stats.total_spent > 0;

	// Show loading state while checking authentication
	if (authLoading) {
		return <LoadingScreen />;
	}

	// Show login prompt if not authenticated
	if (!isAuthenticated) {
		return (
			<div className="container mx-auto py-8">
				<div className="text-center py-12">
					<h1 className="text-3xl font-bold mb-4">{t("analytics.title")}</h1>
					<div className="max-w-md mx-auto space-y-4">
						<p className="text-muted-foreground">{t("common.loginRequired")}</p>
						<div className="space-y-2">
							<Button asChild className="w-full">
								<Link to="/auth/login">{t("nav.login")}</Link>
							</Button>
							<Button asChild variant="outline" className="w-full">
								<Link to="/">{t("common.goHome")}</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Show loading state while fetching data
	if (isLoading) {
		return <LoadingScreen />;
	}

	// Show error state if API calls failed
	if (statsError && !isLoading) {
		return (
			<div className="container mx-auto py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold">{t("analytics.title")}</h1>
				</div>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center space-y-4">
							<Warning className="mx-auto h-12 w-12 text-red-500" />
							<p className="text-red-500 font-medium">
								{t("analytics.errorLoading")}
							</p>
							<p className="text-sm text-muted-foreground">
								{statsError.message}
							</p>
							<Button onClick={() => refetchStats()} variant="outline">
								{t("analytics.tryAgain")}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Show empty state if no data
	if (!hasData && !isLoading) {
		return (
			<div className="min-h-screen bg-[#f8fafc]">
				<div className="space-y-8">
					{/* Header Section */}
					<div className="px-4 pb-2">
						<h1 className="text-[#1e3a8a] text-2xl font-bold leading-tight">
							{t("analytics.title")}
						</h1>
						<p className="mt-2 text-[#64748b] text-sm">
							{t("analytics.description")}
						</p>
					</div>

					{/* Empty State */}
					<div className="mx-4">
						<Card>
							<CardContent className="pt-6">
								<div className="text-center space-y-4">
									<ChartPie className="mx-auto h-16 w-16 text-[#64748b]" />
									<div className="space-y-2">
										<h3 className="text-lg font-semibold text-[#1e3a8a]">
											{t("analytics.noAnalyticsData")}
										</h3>
										<p className="text-sm text-[#64748b]">
											{t("analytics.startTracking")}
										</p>
									</div>
									<div className="space-y-2">
										<Button asChild className="w-full">
											<Link to="/expenses">{t("analytics.viewExpenses")}</Link>
										</Button>
										<Button asChild variant="outline" className="w-full">
											<Link to="/">{t("common.goHome")}</Link>
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		);
	}

	// Calculate insights and trends (only if we have data)
	if (!stats) {
		return <LoadingScreen />;
	}

	const spendingTrend = analyticsService.calculateSpendingTrend(stats);
	const insights = analyticsService.getSpendingInsights(stats);
	const moodAnalysis = analyticsService.getMoodAnalysis(
		stats.emotion_stats || [],
	);

	const getTrendIcon = () => {
		switch (spendingTrend) {
			case "up":
				return <TrendUp className="h-4 w-4 text-red-500" />;
			case "down":
				return <TrendDown className="h-4 w-4 text-green-500" />;
			default:
				return <Minus className="h-4 w-4 text-yellow-500" />;
		}
	};

	const getTrendColor = () => {
		switch (spendingTrend) {
			case "up":
				return "text-red-500";
			case "down":
				return "text-green-500";
			default:
				return "text-yellow-600";
		}
	};

	return (
		<div className="min-h-screen bg-[#f8fafc]">
			<div className="space-y-8">
				{/* Header Section */}
				<div className="px-4 pb-2">
					<div className="flex justify-between items-start">
						<div>
							<h1 className="text-[#1e3a8a] text-2xl font-bold leading-tight">
								{t("analytics.title")}
							</h1>
							<p className="mt-2 text-[#64748b] text-sm">
								{t("analytics.description")}
							</p>
						</div>
						{/* Period Filter */}
						<Select
							value={selectedPeriod}
							onValueChange={(value: "week" | "month") =>
								setSelectedPeriod(value)
							}
						>
							<SelectTrigger className="w-32">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="week">{t("analytics.thisWeek")}</SelectItem>
								<SelectItem value="month">
									{t("analytics.thisMonth")}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="space-y-6">
					{/* Overview Cards */}
					<div className="mx-4 grid grid-cols-2 gap-4">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-[#64748b] flex items-center gap-2">
									<CurrencyDollar className="h-4 w-4" />
									{t("analytics.totalSpent")}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-[#1e3a8a]">
									{currencyService.formatCurrency(stats.total_spent, user)}
								</div>
								<div
									className={`text-sm flex items-center gap-1 mt-1 ${getTrendColor()}`}
								>
									{getTrendIcon()}
									{Math.abs(stats.change_percent).toFixed(1)}%{" "}
									{t("analytics.vsLast")} {stats.period}
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-[#64748b] flex items-center gap-2">
									<Calendar className="h-4 w-4" />
									{t("analytics.dailyAverage")}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-[#1e3a8a]">
									{currencyService.formatCurrency(stats.average_daily, user)}
								</div>
								<div className="text-sm text-[#64748b] mt-1">
									{t("analytics.max")}:{" "}
									{currencyService.formatCurrency(stats.max_daily_spent, user)}
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Top Categories */}
					<div className="mx-4">
						<Card>
							<CardHeader>
								<CardTitle className="text-lg font-semibold text-[#1e3a8a] flex items-center gap-2">
									<ChartPie className="h-5 w-5" />
									{t("analytics.topCategories")}
								</CardTitle>
							</CardHeader>
							<CardContent>
								{stats.top_categories && stats.top_categories.length > 0 ? (
									<div className="space-y-4">
										{stats.top_categories.slice(0, 5).map((category, index) => (
											<div
												key={category.category}
												className="flex justify-between items-center"
											>
												<div className="flex items-center gap-3">
													<div
														className="w-3 h-3 rounded-full"
														style={{
															backgroundColor: [
																"#69b4cd",
																"#f7a35c",
																"#90ed7d",
																"#7cb5ec",
																"#f15c80",
															][index % 5],
														}}
													/>
													<span className="text-sm font-medium text-[#1e3a8a]">
														{category.category}
													</span>
												</div>
												<div className="text-right">
													<div className="text-sm font-semibold text-[#1e3a8a]">
														{currencyService.formatCurrency(
															category.total,
															user,
														)}
													</div>
													<div className="text-xs text-[#64748b]">
														{category.percentage.toFixed(1)}% ({category.count}{" "}
														{t("analytics.items")})
													</div>
												</div>
											</div>
										))}
									</div>
								) : (
									<p className="text-sm text-[#64748b] text-center py-4">
										{t("analytics.noCategories")}
									</p>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Mood Analysis */}
					{stats.emotion_stats && stats.emotion_stats.length > 0 && (
						<div className="mx-4">
							<Card>
								<CardHeader>
									<CardTitle className="text-lg font-semibold text-[#1e3a8a] flex items-center gap-2">
										<Heart className="h-5 w-5" />
										{t("analytics.spendingMood")}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div className="grid grid-cols-3 gap-4 text-center">
											<div>
												<div className="text-lg font-bold text-green-600">
													{moodAnalysis.positive.toFixed(1)}%
												</div>
												<div className="text-xs text-[#64748b]">
													{t("analytics.positive")}
												</div>
											</div>
											<div>
												<div className="text-lg font-bold text-yellow-600">
													{moodAnalysis.neutral.toFixed(1)}%
												</div>
												<div className="text-xs text-[#64748b]">
													{t("analytics.neutral")}
												</div>
											</div>
											<div>
												<div className="text-lg font-bold text-red-600">
													{moodAnalysis.negative.toFixed(1)}%
												</div>
												<div className="text-xs text-[#64748b]">
													{t("analytics.negative")}
												</div>
											</div>
										</div>

										{stats.regret_amount > 0 && (
											<div className="bg-red-50 border border-red-200 rounded-lg p-3">
												<div className="flex items-center gap-2 text-red-700">
													<Warning className="h-4 w-4" />
													<span className="text-sm font-medium">
														{t("analytics.regretfulSpending")}:{" "}
														{currencyService.formatCurrency(
															stats.regret_amount,
															user,
														)}
													</span>
												</div>
											</div>
										)}

										{stats.most_common_emotion && (
											<div className="text-center">
												<div className="text-sm text-[#64748b]">
													{t("analytics.mostCommonFeeling")}
												</div>
												<div className="text-lg font-semibold text-[#1e3a8a] capitalize">
													{stats.most_common_emotion}
												</div>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						</div>
					)}

					{/* Insights */}
					{insights.length > 0 && (
						<div className="mx-4">
							<Card>
								<CardHeader>
									<CardTitle className="text-lg font-semibold text-[#1e3a8a]">
										{t("analytics.insightsAndTips")}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										{insights.map((insight) => (
											<div
												key={insight}
												className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
											>
												<div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
												<p className="text-sm text-blue-800">{insight}</p>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						</div>
					)}

					{/* Quick Actions */}
					<div className="mx-4 pb-8">
						<div className="grid grid-cols-2 gap-4">
							<Button asChild variant="outline" className="h-12">
								<Link to="/expenses">
									<CurrencyDollar className="h-4 w-4 mr-2" />
									{t("analytics.viewExpenses")}
								</Link>
							</Button>
							<Button asChild variant="outline" className="h-12">
								<Link to="/expenses/new">
									<Calendar className="h-4 w-4 mr-2" />
									{t("analytics.addExpense")}
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
