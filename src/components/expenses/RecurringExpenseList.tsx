import { apiService } from "@/services/api";
import { currencyService } from "@/services/currency";
import type { components } from "@/types/api-types";
import { Button } from "@components/ui/button";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import LogRocket from "logrocket";
import { Link } from "react-router-dom";

interface RecurringExpenseListProps {
	recurringExpenses: components["schemas"]["RecurringExpense"][];
	isLoading: boolean;
}

export const RecurringExpenseList = ({
	recurringExpenses,
	isLoading,
}: RecurringExpenseListProps) => {
	const queryClient = useQueryClient();

	const deleteMutation = useMutation({
		mutationFn: (id: string) => {
			LogRocket.log("[RecurringExpenseList] deleteMutation.mutationFn", { id });
			return apiService.recurring.delete(id).then((res) => {
				LogRocket.log("[RecurringExpenseList] deleteMutation result", res);
				return res;
			});
		},
		onSuccess: () => {
			LogRocket.log("[RecurringExpenseList] deleteMutation success");
			queryClient.invalidateQueries({ queryKey: ["recurring"] });
		},
		onError: (error) => {
			LogRocket.error("[RecurringExpenseList] deleteMutation error", error);
			console.error("Failed to delete recurring expense:", error);
		},
	});

	const handleDelete = (id: string, name: string) => {
		if (
			window.confirm(
				`Are you sure you want to delete the schedule "${name}"? This will stop all future automatic expenses from this schedule.`,
			)
		) {
			deleteMutation.mutate(id);
		}
	};

	if (isLoading) {
		return (
			<div className="flex justify-center py-8">
				<div className="animate-spin rounded-full h-8 w-8 border-2 border-[#69b4cd] border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Add Schedule Button */}
			<div className="mb-4">
				<Button
					asChild
					className="w-full bg-[#47c1ea] hover:bg-[#3ba3c7] text-white rounded-xl py-3"
				>
					<Link to="/recurring/add">
						<Plus className="mr-2 h-4 w-4" />
						Create New Schedule
					</Link>
				</Button>
			</div>
			{recurringExpenses.map((expense, index) => {
				const borderColors = [
					"#69b4cd",
					"#f7a35c",
					"#90ed7d",
					"#7cb5ec",
					"#f15c80",
				];
				const borderColor = borderColors[index % borderColors.length];

				return (
					<div
						key={expense.id ?? `recurring-${index}`}
						className="bg-white rounded-2xl p-4 shadow-sm border-l-4"
						style={{ borderLeftColor: borderColor }}
					>
						{/* Main Content */}
						<div className="flex items-center gap-4 mb-4">
							{/* Recurring Icon */}
							<div className="text-2xl flex items-center justify-center rounded-lg bg-[#e0f2f7] shrink-0 size-12">
								🔄
							</div>

							{/* Expense Details */}
							<div className="flex-grow">
								<div className="flex justify-between items-center">
									<div className="flex items-center gap-2">
										<p className="text-[#333333] text-base font-bold leading-normal">
											{expense.name || "Expense Schedule"}
										</p>
										<span className="bg-[#e0f2f7] text-[#69b4cd] text-xs px-2 py-1 rounded-full">
											{expense.interval || "monthly"}
										</span>
									</div>
									<p className="text-[#333333] text-base font-bold leading-normal">
										{currencyService.formatCurrency(expense.amount || 0)}
									</p>
								</div>
								<div className="flex justify-between items-center">
									<p className="text-[#666666] text-sm font-normal leading-normal">
										Next:{" "}
										{expense.nextRun
											? format(new Date(expense.nextRun), "MMM dd, yyyy")
											: "Not scheduled"}
									</p>
									<p className="text-[#666666] text-sm font-normal leading-normal">
										Started:{" "}
										{expense.startDate
											? format(new Date(expense.startDate), "MMM dd, yyyy")
											: "Unknown"}
									</p>
								</div>
								{/* Debug info */}
								<div className="text-xs text-gray-400 mt-1">
									Category: {expense.category?.name || "No category"} | ID:{" "}
									{expense.id} | Raw NextRun: {expense.nextRun} | Raw StartDate:{" "}
									{expense.startDate}
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex justify-end gap-2">
							<Button
								variant="ghost"
								size="sm"
								asChild
								className="text-[#666666] hover:text-[#69b4cd]"
							>
								<Link to={`/recurring/${expense.id ?? "unknown"}`}>
									<PencilSimple className="h-6 w-6" />
								</Link>
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									handleDelete(
										(expense.id ?? "").toString(),
										expense.name || "schedule",
									)
								}
								disabled={deleteMutation.isPending}
								className="text-red-400 hover:text-red-600"
							>
								<Trash className="h-6 w-6" />
							</Button>
						</div>
					</div>
				);
			})}

			{/* Empty State */}
			{recurringExpenses.length === 0 ? (
				<div className="text-center py-8">
					<p className="text-[#666666] text-sm">No expense schedules found</p>
					<p className="text-[#666666] text-xs mt-2">
						Create schedules to automatically track recurring payments like
						rent, subscriptions, etc.
					</p>
				</div>
			) : null}
		</div>
	);
};
