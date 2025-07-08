import { AddExpenseForm } from "@components/expenses/AddExpenseForm";
import { ExpenseList } from "@components/expenses/ExpenseList";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@components/ui/dialog";
import { useAuth } from "@contexts/AuthContext";
import { Plus } from "@phosphor-icons/react";
import type { MostUsedCategories } from "@services/api/expenses";
import { expensesService } from "@services/api/expenses";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LogRocket from "logrocket";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export const Expenses = () => {
	const { t } = useTranslation();
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const queryClient = useQueryClient();
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	// Log when Expenses page is loaded
	useEffect(() => {
		LogRocket.log("[Expenses] Page loaded", { isAuthenticated, authLoading });
	}, [isAuthenticated, authLoading]);

	// Only fetch data if user is authenticated
	const {
		data: summary,
		isLoading: isSummaryLoading,
		error: summaryError,
	} = useQuery({
		queryKey: ["expenses", "summary"],
		queryFn: () => {
			LogRocket.log("[Expenses] getSummary queryFn");
			return expensesService.getSummary().then((res) => {
				LogRocket.log("[Expenses] getSummary result", res);
				return res;
			});
		},
		enabled: isAuthenticated, // Only run query if authenticated
	});

	// Fetch categories
	const {
		data: categories = [],
		isLoading: isCategoriesLoading,
		error: categoriesError,
	} = useQuery<MostUsedCategories[]>({
		queryKey: ["expenses", "categories"],
		queryFn: () => {
			LogRocket.log("[Expenses] getMostUsedCategories queryFn");
			return expensesService.getMostUsedCategories().then((res) => {
				LogRocket.log("[Expenses] getMostUsedCategories result", res);
				return res;
			});
		},
		enabled: isAuthenticated, // Only run query if authenticated
	});

	// Log results
	useEffect(() => {
		if (summary) {
			LogRocket.log("[Expenses] Summary loaded:", summary);
		}
		if (summaryError) {
			LogRocket.error("[Expenses] Summary error:", summaryError);
		}
	}, [summary, summaryError]);

	useEffect(() => {
		if (categories.length > 0) {
			LogRocket.log("[Expenses] Categories loaded:", categories);
		}
		if (categoriesError) {
			LogRocket.error("[Expenses] Categories error:", categoriesError);
		}
	}, [categories, categoriesError]);

	const isLoading = isSummaryLoading || isCategoriesLoading;
	const error = summaryError?.message || categoriesError?.message || null;

	const handleExpenseAdded = () => {
		LogRocket.log("[Expenses] Expense added, invalidating queries");
		setIsDialogOpen(false);
		queryClient.invalidateQueries({ queryKey: ["expenses"] });
	};

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
			<div className="space-y-6">
				<div className="text-center py-12">
					<h1 className="text-3xl font-bold tracking-tight mb-4">
						{t("expenses.title")}
					</h1>
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

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-bold tracking-tight">
					{t("expenses.title")}
				</h1>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							{t("expenses.addExpense")}
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>{t("expenses.addExpense")}</DialogTitle>
						</DialogHeader>
						<AddExpenseForm onExpenseAdded={handleExpenseAdded} />
					</DialogContent>
				</Dialog>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>{t("expenses.recentExpenses")}</CardTitle>
					</CardHeader>
					<CardContent>
						<ExpenseList />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t("expenses.monthlySummary")}</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<p className="text-sm text-muted-foreground">
								{t("common.loading")}
							</p>
						) : error ? (
							<p className="text-sm text-red-500">{error}</p>
						) : summary ? (
							<div className="space-y-2">
								<div className="flex justify-between">
									<span className="text-sm text-muted-foreground">
										{t("expenses.total")}
									</span>
									<span className="font-medium">
										${summary.total.toFixed(2)}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-sm text-muted-foreground">
										{t("expenses.monthlyAverage")}
									</span>
									<span className="font-medium">
										${summary.monthlyAverage.toFixed(2)}
									</span>
								</div>
							</div>
						) : null}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{t("expenses.mostUsedCategories")}</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<p className="text-sm text-muted-foreground">
								{t("common.loading")}
							</p>
						) : error ? (
							<p className="text-sm text-red-500">{error}</p>
						) : categories.length > 0 ? (
							<div className="space-y-2">
								{categories.map((category) => (
									<div key={category.category} className="flex justify-between">
										<span className="text-sm text-muted-foreground">
											{category.category}
										</span>
										<span className="font-medium">{category.count}</span>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								{t("expenses.noCategories")}
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
