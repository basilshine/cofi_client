import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { ChartBar, ChartLineUp, ChartPie } from "@phosphor-icons/react";
import { expensesService } from "@services/api/expenses";
import { useQuery } from "@tanstack/react-query";
import LogRocket from "logrocket";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export const Analytics = () => {
	const { t } = useTranslation();

	// Log when Analytics page is loaded
	useEffect(() => {
		LogRocket.log("[Analytics] Page loaded");
	}, []);

	const {
		data: summary,
		isLoading: isSummaryLoading,
		error: summaryError,
	} = useQuery({
		queryKey: ["expenses", "summary"],
		queryFn: expensesService.getSummary,
	});

	const {
		data: categories = [],
		isLoading: isCategoriesLoading,
		error: categoriesError,
	} = useQuery({
		queryKey: ["expenses", "categories"],
		queryFn: expensesService.getMostUsedCategories,
	});

	const {
		data: expenses = [],
		isLoading: isExpensesLoading,
		error: expensesError,
	} = useQuery({
		queryKey: ["expenses"],
		queryFn: expensesService.getExpenses,
	});

	// Log fetch results
	useEffect(() => {
		if (summary) {
			LogRocket.log("[Analytics] Summary loaded:", summary);
		}
		if (summaryError) {
			LogRocket.error("[Analytics] Summary error:", summaryError);
		}
	}, [summary, summaryError]);

	useEffect(() => {
		if (categories.length > 0) {
			LogRocket.log("[Analytics] Categories loaded:", categories);
		}
		if (categoriesError) {
			LogRocket.error("[Analytics] Categories error:", categoriesError);
		}
	}, [categories, categoriesError]);

	useEffect(() => {
		if (expenses.length > 0) {
			LogRocket.log("[Analytics] Expenses loaded:", { count: expenses.length });
		}
		if (expensesError) {
			LogRocket.error("[Analytics] Expenses error:", expensesError);
		}
	}, [expenses, expensesError]);

	const isLoading =
		isSummaryLoading || isCategoriesLoading || isExpensesLoading;
	const hasErrors = summaryError || categoriesError || expensesError;

	// Calculate additional analytics
	const totalExpenses = expenses.length;
	const averageExpense =
		expenses.length > 0
			? expenses.reduce((sum, expense) => sum + expense.amount, 0) /
				expenses.length
			: 0;

	LogRocket.log("[Analytics] Render state:", {
		isLoading,
		hasErrors,
		totalExpenses,
		averageExpense,
		summaryData: summary,
		categoriesCount: categories.length,
	});

	// Show error state if any API calls failed
	if (hasErrors && !isLoading) {
		return (
			<div className="container mx-auto py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold">{t("analytics.title")}</h1>
				</div>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center space-y-4">
							<p className="text-red-500 font-medium">
								Error loading analytics data
							</p>
							<div className="text-sm text-muted-foreground space-y-2">
								{summaryError && <p>Summary: {summaryError.message}</p>}
								{categoriesError && (
									<p>Categories: {categoriesError.message}</p>
								)}
								{expensesError && <p>Expenses: {expensesError.message}</p>}
							</div>
							<p className="text-xs text-muted-foreground">
								Check browser console and LogRocket for detailed error
								information.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

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
										<div
											key={category.category}
											className="flex justify-between items-center"
										>
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
											.sort(([, a], [, b]) => b - a)
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
											))}
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
