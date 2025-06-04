import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { ChartBar, ChartLineUp, ChartPie } from "@phosphor-icons/react";
import { expensesService } from "@services/api/expenses";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

export const Analytics = () => {
	const { t } = useTranslation();

	const { data: summary, isLoading: isSummaryLoading } = useQuery({
		queryKey: ['expenses', 'summary'],
		queryFn: expensesService.getSummary,
	});

	const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
		queryKey: ['expenses', 'categories'],
		queryFn: expensesService.getMostUsedCategories,
	});

	const { data: expenses = [], isLoading: isExpensesLoading } = useQuery({
		queryKey: ['expenses'],
		queryFn: expensesService.getExpenses,
	});

	const isLoading = isSummaryLoading || isCategoriesLoading || isExpensesLoading;

	// Calculate additional analytics
	const totalExpenses = expenses.length;
	const averageExpense = expenses.length > 0 
		? expenses.reduce((sum, expense) => sum + expense.amount, 0) / expenses.length 
		: 0;

	return (
		<div className="container mx-auto py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">{t("analytics.title")}</h1>
				<p className="mt-2 text-muted-foreground">
					{t("analytics.description")}
				</p>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-8">
					<p className="text-muted-foreground">{t("common.loading")}</p>
				</div>
			) : (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ChartLineUp className="h-5 w-5" />
								{t("analytics.spending_trends")}
							</CardTitle>
						</CardHeader>
						<CardContent>
							{summary ? (
								<div className="space-y-3">
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">
											{t("expenses.total")}
										</span>
										<span className="text-2xl font-bold">
											${summary.total.toFixed(2)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">
											{t("expenses.monthlyAverage")}
										</span>
										<span className="text-lg font-semibold">
											${summary.monthlyAverage.toFixed(2)}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">
											{t("analytics.totalTransactions")}
										</span>
										<span className="text-lg font-semibold">
											{totalExpenses}
										</span>
									</div>
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									{t("analytics.noData")}
								</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ChartPie className="h-5 w-5" />
								{t("analytics.category_breakdown")}
							</CardTitle>
						</CardHeader>
						<CardContent>
							{categories.length > 0 ? (
								<div className="space-y-3">
									{categories.slice(0, 5).map((category, index) => (
										<div key={category.category} className="flex justify-between items-center">
											<div className="flex items-center gap-2">
												<div 
													className={`w-3 h-3 rounded-full bg-blue-${(index + 1) * 100}`}
												/>
												<span className="text-sm font-medium">
													{category.category}
												</span>
											</div>
											<span className="text-sm text-muted-foreground">
												{category.count} {t("analytics.transactions")}
											</span>
										</div>
									))}
									{categories.length > 5 && (
										<p className="text-xs text-muted-foreground mt-2">
											{t("analytics.andMore", { count: categories.length - 5 })}
										</p>
									)}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									{t("analytics.noCategories")}
								</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ChartBar className="h-5 w-5" />
								{t("analytics.budget_analysis")}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								<div className="flex justify-between items-center">
									<span className="text-sm text-muted-foreground">
										{t("analytics.averageExpense")}
									</span>
									<span className="text-lg font-semibold">
										${averageExpense.toFixed(2)}
									</span>
								</div>
								{summary?.byCategory && (
									<div className="space-y-2">
										<p className="text-sm font-medium">
											{t("analytics.topCategory")}
										</p>
										{Object.entries(summary.byCategory)
											.sort(([,a], [,b]) => b - a)
											.slice(0, 1)
											.map(([category, amount]) => (
												<div key={category} className="flex justify-between">
													<span className="text-sm text-muted-foreground">
														{category}
													</span>
													<span className="text-sm font-medium">
														${amount.toFixed(2)}
													</span>
												</div>
											))
										}
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
};
