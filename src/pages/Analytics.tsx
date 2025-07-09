import type { components } from "@/types/api-types";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { useAuth } from "@contexts/AuthContext";
import { ChartBar, ChartLineUp, ChartPie } from "@phosphor-icons/react";
import { expensesService } from "@/services/api/expenses";
import { useQuery } from "@tanstack/react-query";
import LogRocket from "logrocket";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export const Analytics = () => {
	const { t } = useTranslation();
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const { user } = useAuth();
	// Log when Analytics page is loaded
	useEffect(() => {
		LogRocket.log("[Analytics] Page loaded", { isAuthenticated, authLoading });
	}, [isAuthenticated, authLoading]);

	const {
		data: summary,
		isLoading: isSummaryLoading,
		error: summaryError,
	} = useQuery<components["schemas"]["AnalyticsSummary"]>({
		queryKey: ["expenses", "summary"],
		queryFn: () => {
			LogRocket.log("[Analytics] getSummary queryFn");
			if (!user?.id) {
				throw new Error("User ID is required");
			}
			return expensesService.getSummary(Number(user?.id)).then((res) => {
				LogRocket.log("[Analytics] getSummary result", res);
				return res;
			});
		},
		enabled: isAuthenticated,
	});

	const {
		data: categories = [],
		isLoading: isCategoriesLoading,
		error: categoriesError,
	} = useQuery<components["schemas"]["Category"][]>({
		queryKey: ["expenses", "categories"],
		queryFn: () => {
			LogRocket.log("[Analytics] getMostUsedCategories queryFn");
			return expensesService.getMostUsedCategories().then((res) => {
				LogRocket.log("[Analytics] getMostUsedCategories result", res);
				return res;
			});
		},
		enabled: isAuthenticated,
	});

	const {
		data: expenses = [],
		isLoading: isExpensesLoading,
		error: expensesError,
	} = useQuery<components["schemas"]["Expense"][]>({
		queryKey: ["expenses"],
		queryFn: () => {
			LogRocket.log("[Analytics] getExpenses queryFn");
			return expensesService.getExpenses().then((res) => {
				LogRocket.log("[Analytics] getExpenses result", res);
				return res;
			});
		},
		enabled: isAuthenticated,
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
			? expenses.reduce((sum, expense) => sum + (expense.amount ?? 0), 0) /
				expenses.length
			: 0;

	LogRocket.log("[Analytics] Render state:", {
		isLoading,
		hasErrors,
		totalExpenses,
		averageExpense,
		summaryData: summary,
		categoriesCount: categories.length,
		isAuthenticated,
		authLoading,
	});

	// Show loading state while checking authentication
	if (authLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<p className="text-muted-foreground">{t("common.loading")}</p>
			</div>
		);
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
											${summary.totalExpenses?.toFixed(2) ?? "0.00"}
										</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-sm text-muted-foreground">
											{t("expenses.monthlyAverage")}
										</span>
										<span className="text-lg font-semibold">
											${((summary.thisMonth ?? 0) / 1).toFixed(2)}
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
											key={category.id}
											className="flex justify-between items-center"
										>
											<div className="flex items-center gap-2">
												<div
													className={`w-3 h-3 rounded-full bg-blue-${(index + 1) * 100}`}
												/>
												<span className="text-sm font-medium">
													{category.name}
												</span>
											</div>
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
