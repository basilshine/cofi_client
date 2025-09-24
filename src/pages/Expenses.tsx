import { apiService } from "@/services/api";
import { expensesService } from "@/services/api/expenses";
import { currencyService } from "@/services/currency";
import type { components } from "@/types/api-types";
import { LoadingScreen } from "@components/LoadingScreen";
import { ExpenseItemsList } from "@components/expenses/ExpenseItemsList";
import { ExpenseList } from "@components/expenses/ExpenseList";
import { RecurringExpenseList } from "@components/expenses/RecurringExpenseList";
import { Button } from "@components/ui/button";
import { Card } from "@components/ui/card";
import { useAuth } from "@contexts/AuthContext";
import { Plus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import LogRocket from "logrocket";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

// Filter types
type FilterType = "category" | "date" | "emotion" | null;
type ExpenseType = "regular" | "items" | "recurring";

interface ExpenseFilters {
	category?: string;
	dateRange?: string;
	emotion?: string;
	search?: string;
}

export const Expenses = () => {
	const { t } = useTranslation();
	const { isAuthenticated, isLoading: authLoading, user } = useAuth();
	const [activeFilter, setActiveFilter] = useState<FilterType>(null);
	const [filters, setFilters] = useState<ExpenseFilters>({});
	const [searchTerm, setSearchTerm] = useState("");
	const [expenseType, setExpenseType] = useState<ExpenseType>("regular");

	// Log when Expenses page is loaded
	useEffect(() => {
		LogRocket.log("[Expenses] Page loaded", { isAuthenticated, authLoading });
	}, [isAuthenticated, authLoading]);

	// Only fetch data if user is authenticated
	const { data: summary, error: summaryError } = useQuery({
		queryKey: ["expenses", "summary"],
		queryFn: () => {
			LogRocket.log("[Expenses] getSummary queryFn");
			if (!user?.id) {
				throw new Error("User ID is required");
			}
			return expensesService.getSummary(Number(user?.id)).then((res) => {
				LogRocket.log("[Expenses] getSummary result", res);
				return res;
			});
		},
		enabled: isAuthenticated, // Only run query if authenticated
	});

	// Fetch all user categories (not just most used)
	const { data: categories = [], error: categoriesError } = useQuery<
		components["schemas"]["Category"][]
	>({
		queryKey: ["categories", "user"],
		queryFn: () => {
			LogRocket.log("[Expenses] getUserCategories queryFn");
			return apiService.categories.list().then((res) => {
				LogRocket.log("[Expenses] getUserCategories result", res.data);
				return res.data;
			});
		},
		enabled: isAuthenticated, // Only run query if authenticated
	});

	// Fetch recurring expenses
	const { data: recurringExpenses = [], error: recurringError } = useQuery<
		components["schemas"]["RecurringExpense"][]
	>({
		queryKey: ["recurring", "expenses"],
		queryFn: () => {
			LogRocket.log("[Expenses] getRecurringExpenses queryFn");
			return apiService.recurring.list().then((res) => {
				LogRocket.log("[Expenses] getRecurringExpenses result", res.data);
				return res.data;
			});
		},
		enabled: isAuthenticated && expenseType === "recurring",
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
		if (categories && categories.length > 0) {
			LogRocket.log("[Expenses] Categories loaded:", categories);
		}
		if (categoriesError) {
			LogRocket.error("[Expenses] Categories error:", categoriesError);
		}
	}, [categories, categoriesError]);

	useEffect(() => {
		if (recurringExpenses && recurringExpenses.length > 0) {
			LogRocket.log("[Expenses] Recurring expenses loaded:", recurringExpenses);
			console.log("[Expenses] Recurring expenses data:", recurringExpenses);
		}
		if (recurringError) {
			LogRocket.error("[Expenses] Recurring expenses error:", recurringError);
			console.error("[Expenses] Recurring expenses error:", recurringError);
		}
	}, [recurringExpenses, recurringError]);

	// Filter handlers
	const handleFilterClick = (filterType: FilterType) => {
		if (activeFilter === filterType) {
			// If clicking the same filter, deactivate it
			setActiveFilter(null);
			setFilters({});
		} else {
			setActiveFilter(filterType);
			// You could open a modal or dropdown here for filter selection
			// For now, we'll implement basic filtering
		}
	};

	const handleSearchChange = (value: string) => {
		setSearchTerm(value);
		setFilters((prev) => ({ ...prev, search: value }));
	};

	// Loading and error states handled individually in components

	// Show loading state while checking authentication
	if (authLoading) {
		return <LoadingScreen />;
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
		<div className="flex flex-col min-h-screen bg-[#f8f8f8]">
			{/* Spending Breakdown Section */}
			<div className="px-4 py-6">
				<Card className="bg-white rounded-3xl shadow-md p-6">
					<h3 className="text-2xl font-semibold text-[#333333] mb-4">
						Spending Breakdown
					</h3>
					<div className="flex flex-col items-center gap-4">
						{/* Pie Chart Placeholder - could be enhanced with actual chart library */}
						<div className="relative w-48 h-48">
							<div className="w-full h-full rounded-full bg-gradient-conic from-[#69b4cd] via-[#f7a35c] to-[#90ed7d]" />
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="bg-white rounded-full w-28 h-28 flex flex-col items-center justify-center shadow-inner">
									<span className="text-sm text-[#666666]">Total</span>
									<span className="text-2xl font-bold text-[#333333]">
										{currencyService.formatCurrency(
											summary?.totalExpenses ?? 0,
											user,
										)}
									</span>
								</div>
							</div>
						</div>

						{/* Legend */}
						<div className="flex flex-wrap justify-center gap-4 text-sm">
							{categories.slice(0, 3).map((category, index) => {
								const colors = ["#69b4cd", "#f7a35c", "#90ed7d"];
								return (
									<div key={category.name} className="flex items-center gap-2">
										<span
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: colors[index] }}
										/>
										<span>{category.name}</span>
									</div>
								);
							})}
						</div>
					</div>
				</Card>
			</div>

			{/* Tabs and Content */}
			<div className="px-4 flex-1">
				{/* Tab Navigation */}
				<div className="flex rounded-full bg-gray-200 p-1 mb-4">
					<button
						type="button"
						onClick={() => setExpenseType("regular")}
						className={`flex-1 rounded-full py-2 text-center text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
							expenseType === "regular"
								? "bg-[#69b4cd] text-white"
								: "text-[#666666] hover:text-[#69b4cd]"
						}`}
					>
						<span>Expenses</span>
					</button>
					<button
						type="button"
						onClick={() => setExpenseType("items")}
						className={`flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors ${
							expenseType === "items"
								? "bg-[#69b4cd] text-white"
								: "text-[#666666] hover:text-[#69b4cd]"
						}`}
					>
						<span>Items</span>
					</button>
					<button
						type="button"
						onClick={() => setExpenseType("recurring")}
						className={`flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors ${
							expenseType === "recurring"
								? "bg-[#69b4cd] text-white"
								: "text-[#666666] hover:text-[#69b4cd]"
						}`}
					>
						<span>Schedules</span>
					</button>
				</div>

				{/* Search Bar */}
				<div className="mb-4">
					<div className="flex w-full items-stretch rounded-full h-12 shadow-sm">
						<div className="text-[#666666] flex bg-white items-center justify-center pl-4 rounded-l-full border-r-0 border border-gray-200">
							<svg
								fill="currentColor"
								height="24px"
								viewBox="0 0 256 256"
								width="24px"
								aria-label="Search"
								role="img"
							>
								<path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
							</svg>
						</div>
						<input
							className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-full text-[#333333] focus:outline-0 focus:ring-0 border-none bg-white focus:border-none h-full placeholder:text-[#666666] px-4 pl-2 text-base font-normal leading-normal border border-l-0 border-gray-200"
							placeholder="Search expenses"
							value={searchTerm}
							onChange={(e) => handleSearchChange(e.target.value)}
						/>
					</div>
				</div>

				{/* Filter Buttons - Only show for regular expenses and items */}
				{(expenseType === "regular" || expenseType === "items") && (
					<div className="flex gap-3 mb-4 overflow-x-auto">
						<button
							type="button"
							onClick={() => handleFilterClick("category")}
							className={`rounded-full px-4 py-2 flex items-center gap-x-2 shrink-0 hover:bg-opacity-80 transition-colors ${
								activeFilter === "category"
									? "bg-[#69b4cd] text-white"
									: "bg-[#e0f2f7] text-[#69b4cd]"
							}`}
						>
							<svg
								fill="currentColor"
								height="20px"
								viewBox="0 0 256 256"
								width="20px"
								aria-label="Filter by category"
								role="img"
							>
								<path d="M230.6,49.53A15.81,15.81,0,0,0,216,40H40A16,16,0,0,0,28.19,66.76l.08.09L96,139.17V216a16,16,0,0,0,24.87,13.32l32-21.34A16,16,0,0,0,160,194.66V139.17l67.74-72.32.08-.09A15.8,15.8,0,0,0,230.6,49.53ZM40,56h0Zm108.34,72.28A15.92,15.92,0,0,0,144,139.17v55.49L112,216V139.17a15.92,15.92,0,0,0-4.32-10.94L40,56H216Z" />
							</svg>
							<span>Category</span>
						</button>
						<button
							type="button"
							onClick={() => handleFilterClick("date")}
							className={`rounded-full px-4 py-2 flex items-center gap-x-2 shrink-0 hover:bg-opacity-80 transition-colors ${
								activeFilter === "date"
									? "bg-[#69b4cd] text-white"
									: "bg-[#e0f2f7] text-[#69b4cd]"
							}`}
						>
							<svg
								fill="currentColor"
								height="20px"
								viewBox="0 0 256 256"
								width="20px"
								aria-label="Filter by date"
								role="img"
							>
								<path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-96-88v64a8,8,0,0,1-16,0V132.94l-4.42,2.22a8,8,0,0,1-7.16-14.32l16-8A8,8,0,0,1,112,120Zm59.16,30.45L152,176h16a8,8,0,0,1,0,16H136a8,8,0,0,1-6.4-12.8l28.78-38.37A8,8,0,1,0,145.07,132a8,8,0,1,1-13.85-8A24,24,0,0,1,176,136A23.76,23.76,0,0,1,171.16,150.45Z" />
							</svg>
							<span>Date</span>
						</button>
						<button
							type="button"
							onClick={() => handleFilterClick("emotion")}
							className={`rounded-full px-4 py-2 flex items-center gap-x-2 shrink-0 hover:bg-opacity-80 transition-colors ${
								activeFilter === "emotion"
									? "bg-[#69b4cd] text-white"
									: "bg-[#e0f2f7] text-[#69b4cd]"
							}`}
						>
							<svg
								fill="currentColor"
								height="20px"
								viewBox="0 0 256 256"
								width="20px"
								aria-label="Filter by emotion"
								role="img"
							>
								<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM80,108a12,12,0,1,1,12,12A12,12,0,0,1,80,108Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,176,108Zm-1.07,48c-10.29,17.79-27.4,28-46.93,28s-36.63-10.2-46.92-28a8,8,0,1,1,13.84-8c7.47,12.91,19.21,20,33.08,20s25.61-7.1,33.07-20a8,8,0,0,1,13.86,8Z" />
							</svg>
							<span>Emotion</span>
						</button>
					</div>
				)}

				{/* Filter Dropdowns - Only show for regular expenses and items */}
				{(expenseType === "regular" || expenseType === "items") &&
					activeFilter === "category" && (
						<div className="mb-4 bg-white rounded-xl p-4 shadow-sm">
							<h4 className="text-sm font-medium text-[#64748b] mb-3">
								Filter by Category
							</h4>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => {
										setFilters((prev) => ({ ...prev, category: undefined }));
										setActiveFilter(null);
									}}
									className={`p-2 rounded-lg text-sm transition-colors ${
										!filters.category
											? "bg-[#69b4cd] text-white"
											: "bg-gray-100 text-gray-700 hover:bg-gray-200"
									}`}
								>
									All Categories
								</button>
								{categories.map((category) => (
									<button
										key={category.id}
										type="button"
										onClick={() => {
											setFilters((prev) => ({
												...prev,
												category: category.name,
											}));
											setActiveFilter(null);
										}}
										className={`p-2 rounded-lg text-sm transition-colors ${
											filters.category === category.name
												? "bg-[#69b4cd] text-white"
												: "bg-gray-100 text-gray-700 hover:bg-gray-200"
										}`}
									>
										{category.name}
									</button>
								))}
							</div>
						</div>
					)}

				{(expenseType === "regular" || expenseType === "items") &&
					activeFilter === "emotion" && (
						<div className="mb-4 bg-white rounded-xl p-4 shadow-sm">
							<h4 className="text-sm font-medium text-[#64748b] mb-3">
								Filter by Emotion
							</h4>
							<div className="grid grid-cols-3 gap-2">
								<button
									type="button"
									onClick={() => {
										setFilters((prev) => ({ ...prev, emotion: undefined }));
										setActiveFilter(null);
									}}
									className={`p-2 rounded-lg text-sm transition-colors ${
										!filters.emotion
											? "bg-[#69b4cd] text-white"
											: "bg-gray-100 text-gray-700 hover:bg-gray-200"
									}`}
								>
									All Emotions
								</button>
								{[
									{ key: "happy", label: "😊 Happy", value: "happy" },
									{ key: "sad", label: "😢 Sad", value: "sad" },
									{ key: "neutral", label: "😐 Neutral", value: "neutral" },
									{ key: "regret", label: "😤 Regret", value: "regret" },
									{ key: "joy", label: "😄 Joy", value: "joy" },
									{ key: "like", label: "👍 Like", value: "like" },
									{ key: "dislike", label: "👎 Dislike", value: "dislike" },
								].map((emotion) => (
									<button
										key={emotion.key}
										type="button"
										onClick={() => {
											setFilters((prev) => ({
												...prev,
												emotion: emotion.value,
											}));
											setActiveFilter(null);
										}}
										className={`p-2 rounded-lg text-sm transition-colors ${
											filters.emotion === emotion.value
												? "bg-[#69b4cd] text-white"
												: "bg-gray-100 text-gray-700 hover:bg-gray-200"
										}`}
									>
										{emotion.label}
									</button>
								))}
							</div>
						</div>
					)}

				{(expenseType === "regular" || expenseType === "items") &&
					activeFilter === "date" && (
						<div className="mb-4 bg-white rounded-xl p-4 shadow-sm">
							<h4 className="text-sm font-medium text-[#64748b] mb-3">
								Filter by Date
							</h4>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => {
										setFilters((prev) => ({ ...prev, dateRange: undefined }));
										setActiveFilter(null);
									}}
									className={`p-2 rounded-lg text-sm transition-colors ${
										!filters.dateRange
											? "bg-[#69b4cd] text-white"
											: "bg-gray-100 text-gray-700 hover:bg-gray-200"
									}`}
								>
									All Time
								</button>
								{[
									{ key: "today", label: "Today", value: "today" },
									{ key: "week", label: "This Week", value: "week" },
									{ key: "month", label: "This Month", value: "month" },
									{ key: "year", label: "This Year", value: "year" },
								].map((period) => (
									<button
										key={period.key}
										type="button"
										onClick={() => {
											setFilters((prev) => ({
												...prev,
												dateRange: period.value,
											}));
											setActiveFilter(null);
										}}
										className={`p-2 rounded-lg text-sm transition-colors ${
											filters.dateRange === period.value
												? "bg-[#69b4cd] text-white"
												: "bg-gray-100 text-gray-700 hover:bg-gray-200"
										}`}
									>
										{period.label}
									</button>
								))}
							</div>
						</div>
					)}

				{/* Add Expense Button - Only for regular expenses */}
				{expenseType === "regular" && (
					<div className="mb-4">
						<Button
							asChild
							className="w-full bg-[#69b4cd] hover:bg-[#69b4cd]/90 text-white rounded-full"
						>
							<Link to="/expenses/add">
								<Plus className="mr-2 h-4 w-4" />
								{t("expenses.addExpense")}
							</Link>
						</Button>
					</div>
				)}

				{/* Expenses List */}
				<div className="space-y-4 pb-32">
					{expenseType === "regular" ? (
						<ExpenseList filters={filters} />
					) : expenseType === "items" ? (
						<ExpenseItemsList filters={filters} />
					) : (
						<RecurringExpenseList
							recurringExpenses={recurringExpenses}
							isLoading={false}
							user={user}
						/>
					)}
				</div>
			</div>
		</div>
	);
};
