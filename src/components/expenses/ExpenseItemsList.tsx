import { type ExpenseFilters, expensesService } from "@/services/api/expenses";
import { currencyService } from "@/services/currency";
import type { components } from "@/types/api-types";
import { getEmotionEmoji } from "@/utils/helper";
import { LoadingScreen } from "@components/LoadingScreen";
import { Button } from "@components/ui/button";
import { useAuth } from "@contexts/AuthContext";
import { PencilSimple } from "@phosphor-icons/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import LogRocket from "logrocket";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

interface ExpenseItemsListProps {
	filters?: ExpenseFilters;
}

export const ExpenseItemsList = ({ filters = {} }: ExpenseItemsListProps) => {
	const { t } = useTranslation();
	const { isAuthenticated, user } = useAuth();
	const navigate = useNavigate();
	const loadMoreRef = useRef<HTMLDivElement>(null);

	const {
		data,
		isLoading,
		error,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useInfiniteQuery({
		queryKey: ["expense-items", "paginated", filters],
		queryFn: ({ pageParam = 1 }) => {
			if (!isAuthenticated) throw new Error("Not authenticated");
			LogRocket.log("[ExpenseItemsList] useInfiniteQuery.queryFn", {
				pageParam,
				filters,
			});

			return expensesService.getExpenseItemsWithFilters({
				...filters,
				page: pageParam as number,
				limit: 20,
			});
		},
		initialPageParam: 1,
		getNextPageParam: (lastPage: { has_more: boolean; page: number }) => {
			return lastPage.has_more ? lastPage.page + 1 : undefined;
		},
		enabled: isAuthenticated,
	});

	// Flatten all pages into a single array with safety checks
	const expenseItems =
		data?.pages?.flatMap((page) => page?.expense_items || []) || [];

	// Intersection observer for infinite scroll
	const handleObserver = useCallback(
		(entries: IntersectionObserverEntry[]) => {
			const [target] = entries;
			if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
				fetchNextPage();
			}
		},
		[hasNextPage, isFetchingNextPage, fetchNextPage],
	);

	useEffect(() => {
		const element = loadMoreRef.current;
		if (!element) return;

		const observer = new IntersectionObserver(handleObserver, {
			threshold: 0.1,
		});
		observer.observe(element);

		return () => observer.disconnect();
	}, [handleObserver]);

	// Log results
	useEffect(() => {
		if (expenseItems)
			LogRocket.log(
				"[ExpenseItemsList] useInfiniteQuery success",
				expenseItems,
			);
		if (error)
			LogRocket.error("[ExpenseItemsList] useInfiniteQuery error", error);
	}, [expenseItems, error]);

	const handleEditItem = (
		expenseItem: components["schemas"]["ExpenseItem"],
	) => {
		// Navigate to expense edit page with item anchor and return URL
		const currentPath = window.location.pathname + window.location.search;
		navigate(
			`/expenses/${expenseItem.expenseId}/edit?item=${expenseItem.id}&returnTo=${encodeURIComponent(currentPath)}`,
		);
	};

	if (!isAuthenticated) {
		return (
			<div className="text-sm text-muted-foreground">
				{t("common.loginRequired")}
			</div>
		);
	}

	if (isLoading) return <LoadingScreen />;
	if (error) {
		return (
			<div className="text-center py-8">
				<p className="text-red-500 text-sm">Error loading expense items</p>
				<p className="text-[#666666] text-xs mt-2">
					Please try refreshing the page
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4 min-h-[200px]">
			{expenseItems.map(
				(expenseItem: components["schemas"]["ExpenseItem"], index) => {
					const borderColors = [
						"#69b4cd",
						"#f7a35c",
						"#90ed7d",
						"#7cb5ec",
						"#f15c80",
					];
					const borderColor = borderColors[index % borderColors.length];
					const amount =
						typeof expenseItem.amount === "number" ? expenseItem.amount : 0;

					return (
						<div
							key={expenseItem.id ?? `expense-item-${index}`}
							className="bg-white rounded-2xl p-4 shadow-sm border-l-4"
							style={{ borderLeftColor: borderColor }}
						>
							{/* Main Content */}
							<div className="flex items-center gap-4 mb-4">
								{/* Emotion Icon */}
								<div className="text-2xl flex items-center justify-center rounded-lg bg-[#e0f2f7] shrink-0 size-12">
									{getEmotionEmoji(expenseItem?.emotion || "neutral")}
								</div>

								{/* Expense Item Details */}
								<div className="flex-grow">
									<div className="flex justify-between items-center">
										<div className="flex items-center gap-2">
											<p className="text-[#333333] text-base font-bold leading-normal">
												{expenseItem.name || t("expenses.noDescription")}
											</p>
										</div>
										<p className="text-[#333333] text-base font-bold leading-normal">
											{currencyService.formatCurrency(amount, user)}
										</p>
									</div>
									<div className="flex justify-between items-center">
										<p className="text-[#666666] text-sm font-normal leading-normal">
											{expenseItem.category?.name || "Uncategorized"}
										</p>
										<p className="text-[#666666] text-sm font-normal leading-normal">
											{expenseItem.expenseDate
												? format(new Date(expenseItem.expenseDate), "MMM dd")
												: expenseItem.createdAt
													? format(new Date(expenseItem.createdAt), "MMM dd")
													: "Today"}
										</p>
									</div>
									{/* Tags */}
									{expenseItem.tags && expenseItem.tags.length > 0 && (
										<div className="flex flex-wrap gap-1 mt-2">
											{expenseItem.tags.slice(0, 3).map((tag) => (
												<span
													key={tag.id}
													className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
												>
													{tag.name}
												</span>
											))}
											{expenseItem.tags.length > 3 && (
												<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
													+{expenseItem.tags.length - 3} more
												</span>
											)}
										</div>
									)}
								</div>
							</div>

							{/* Action Buttons */}
							<div className="flex justify-end gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleEditItem(expenseItem)}
									className="text-[#666666] hover:text-[#69b4cd]"
								>
									<PencilSimple className="h-6 w-6" />
								</Button>
							</div>
						</div>
					);
				},
			)}

			{/* Infinite Scroll Trigger */}
			{hasNextPage && (
				<div ref={loadMoreRef} className="flex justify-center py-4">
					{isFetchingNextPage ? (
						<div className="flex items-center gap-2 text-[#666666]">
							<div className="animate-spin rounded-full h-4 w-4 border-2 border-[#69b4cd] border-t-transparent" />
							<span className="text-sm">Loading more...</span>
						</div>
					) : (
						<button
							type="button"
							onClick={() => fetchNextPage()}
							className="text-[#69b4cd] text-sm hover:text-[#5a9bb0] transition-colors"
						>
							Load more items
						</button>
					)}
				</div>
			)}

			{/* Empty State */}
			{expenseItems.length === 0 && !isLoading ? (
				<div className="text-center py-8">
					<p className="text-[#666666] text-sm">
						{filters?.search || filters?.category || filters?.emotion
							? "No expense items match your filters"
							: "No expense items found"}
					</p>
					{(filters?.search || filters?.category || filters?.emotion) && (
						<p className="text-[#666666] text-xs mt-2">
							Try adjusting your search or filters
						</p>
					)}
				</div>
			) : null}
		</div>
	);
};
