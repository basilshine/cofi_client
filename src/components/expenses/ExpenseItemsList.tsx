import { type ExpenseFilters, expensesService } from "@/services/api/expenses";
import type { components } from "@/types/api-types";
import { LoadingScreen } from "@components/LoadingScreen";
import { ExpenseItemCard } from "@components/expenses/ExpenseItemCard";
import { useAuth } from "@contexts/AuthContext";
import { useInfiniteQuery } from "@tanstack/react-query";
import LogRocket from "logrocket";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

interface ExpenseItemsListProps {
	filters?: ExpenseFilters;
}

export const ExpenseItemsList = ({ filters = {} }: ExpenseItemsListProps) => {
	const { t } = useTranslation();
	const { isAuthenticated } = useAuth();
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
				(expenseItem: components["schemas"]["ExpenseItem"], index) => (
					<ExpenseItemCard
						key={expenseItem.id ?? `expense-item-${index}`}
						expenseItem={expenseItem}
						index={index}
						onEdit={handleEditItem}
					/>
				),
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
