import { type ExpenseFilters, expensesService } from "@/services/api/expenses";
import type { components } from "@/types/api-types";
import { LoadingScreen } from "@components/LoadingScreen";
import { Button } from "@components/ui/button";
import { useAuth } from "@contexts/AuthContext";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { format } from "date-fns";
import LogRocket from "logrocket";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

// Emotion mapping to emojis
const getEmotionEmoji = (emotion: string): string => {
	const emotions: Record<string, string> = {
		like: "👍",
		dislike: "👎",
		happy: "😊",
		sad: "😢",
		regret: "😤",
		joy: "😄",
		neutral: "😐",
		// Additional common emotions
		angry: "😠",
		surprised: "😲",
		worried: "😟",
		excited: "🤩",
		satisfied: "😌",
		disappointed: "😞",
	};
	return emotions[emotion?.toLowerCase()] || emotions.neutral;
};

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
			{expenses.map((expense: components["schemas"]["Expense"], index) => {
				const borderColors = [
					"#69b4cd",
					"#f7a35c",
					"#90ed7d",
					"#7cb5ec",
					"#f15c80",
				];
				const borderColor = borderColors[index % borderColors.length];
				const mainItem = expense.items?.[0];
				const itemsCount = expense.items?.length || 0;
				const totalAmount =
					typeof expense.amount === "number" ? expense.amount : 0;

				return (
					<div
						key={expense.id ?? `expense-${index}`}
						className="bg-white rounded-2xl p-4 shadow-sm border-l-4"
						style={{ borderLeftColor: borderColor }}
					>
						{/* Main Content */}
						<div className="flex items-center gap-4 mb-4">
							{/* Emotion Icon */}
							<div className="text-2xl flex items-center justify-center rounded-lg bg-[#e0f2f7] shrink-0 size-12">
								{getEmotionEmoji(mainItem?.emotion || "neutral")}
							</div>

							{/* Expense Details */}
							<div className="flex-grow">
								<div className="flex justify-between items-center">
									<div className="flex items-center gap-2">
										<p className="text-[#333333] text-base font-bold leading-normal">
											{expense.description ||
												mainItem?.name ||
												t("expenses.noDescription")}
										</p>
										{/* Status indicators could go here */}
									</div>
									<p className="text-[#333333] text-base font-bold leading-normal">
										${totalAmount.toFixed(2)}
									</p>
								</div>
								<div className="flex justify-between items-center">
									<p className="text-[#666666] text-sm font-normal leading-normal">
										{mainItem?.category?.name || "Uncategorized"}
									</p>
									<p className="text-[#666666] text-sm font-normal leading-normal">
										{expense.createdAt
											? format(new Date(expense.createdAt), "MMM dd")
											: "Today"}
									</p>
								</div>
								{/* Additional items preview */}
								{itemsCount > 1 && (
									<div className="text-xs text-[#666666] mt-1">
										+{itemsCount - 1} more items
									</div>
								)}
							</div>
						</div>

						{/* Items Summary */}
						<div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mb-4">
							<p className="text-[#666666] text-sm font-medium">
								{itemsCount} {itemsCount === 1 ? "item" : "items"}
							</p>
							<p className="text-[#333333] text-sm font-semibold">
								${totalAmount.toFixed(2)} total
							</p>
						</div>

						{/* Action Buttons */}
						<div className="flex justify-end gap-2">
							<Button
								variant="ghost"
								size="sm"
								asChild
								className="text-[#666666] hover:text-[#69b4cd]"
							>
								<Link to={`/expenses/${expense.id ?? "unknown"}/edit`}>
									<PencilSimple className="h-6 w-6" />
								</Link>
							</Button>
							{expense.status !== "draft" && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										handleDelete(
											(expense.id ?? "").toString(),
											expense.description || "expense",
										)
									}
									disabled={deleteMutation.isPending}
									className="text-red-400 hover:text-red-600"
								>
									<Trash className="h-6 w-6" />
								</Button>
							)}
						</div>
					</div>
				);
			})}

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
