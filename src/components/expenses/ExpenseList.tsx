import { type ExpenseFilters, expensesService } from "@/services/api/expenses";
import type { components } from "@/types/api-types";
import { LoadingScreen } from "@components/LoadingScreen";
import { ExpenseCard } from "@components/expenses/ExpenseCard";
import { useAuth } from "@contexts/AuthContext";
import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import LogRocket from "logrocket";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface ExpenseListProps {
	filters?: ExpenseFilters;
}

export const ExpenseList = ({ filters = {} }: ExpenseListProps) => {
	const { t } = useTranslation();
	const { isAuthenticated } = useAuth();
	const queryClient = useQueryClient();
	const loadMoreRef = useRef<HTMLDivElement>(null);

	const {
		data,
		isLoading,
		error,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useInfiniteQuery({
		queryKey: ["expenses", "paginated", filters],
		queryFn: ({ pageParam = 1 }) => {
			if (!isAuthenticated) throw new Error("Not authenticated");
			LogRocket.log("[ExpenseList] useInfiniteQuery.queryFn", {
				pageParam,
				filters,
			});

			return expensesService.getExpensesWithFilters({
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
	const expenses = data?.pages?.flatMap((page) => page?.expenses || []) || [];

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

	// Логируем ошибки/успех через useEffect
	useEffect(() => {
		if (expenses)
			LogRocket.log("[ExpenseList] useInfiniteQuery success", expenses);
		if (error) LogRocket.error("[ExpenseList] useInfiniteQuery error", error);
	}, [expenses, error]);

	const deleteMutation = useMutation({
		mutationFn: (id: string) => {
			LogRocket.log("[ExpenseList] deleteMutation.mutationFn", { id });
			return expensesService.deleteExpense(id).then((res) => {
				LogRocket.log("[ExpenseList] deleteMutation result", res);
				return res;
			});
		},
		onSuccess: (data) => {
			LogRocket.log("[ExpenseList] deleteMutation success", data);
			queryClient.invalidateQueries({ queryKey: ["expenses"] });
		},
		onError: (error) => {
			LogRocket.error("[ExpenseList] deleteMutation error", error);
			console.error("Failed to delete expense:", error);
		},
	});

	const handleDelete = (id: string, description: string) => {
		if (window.confirm(t("expenses.confirmDelete", { description }))) {
			deleteMutation.mutate(id);
		}
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
				<p className="text-red-500 text-sm">Error loading expenses</p>
				<p className="text-[#666666] text-xs mt-2">
					Please try refreshing the page
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4 min-h-[200px]">
			{expenses.map((expense: components["schemas"]["Expense"], index) => (
				<ExpenseCard
					key={expense.id ?? `expense-${index}`}
					expense={expense}
					index={index}
					onDelete={handleDelete}
					isDeleting={deleteMutation.isPending}
				/>
			))}

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
							Load more expenses
						</button>
					)}
				</div>
			)}

			{/* Empty State */}
			{expenses.length === 0 && !isLoading ? (
				<div className="text-center py-8">
					<p className="text-[#666666] text-sm">
						{filters?.search || filters?.category || filters?.emotion
							? "No expenses match your filters"
							: t("expenses.noExpenses")}
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
