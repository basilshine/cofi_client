import type { components } from "@/types/api-types";
import { Button } from "@components/ui/button";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface RecurringExpenseListProps {
	recurringExpenses: components["schemas"]["RecurringExpense"][];
	isLoading: boolean;
}

export const RecurringExpenseList = ({
	recurringExpenses,
	isLoading,
}: RecurringExpenseListProps) => {
	if (isLoading) {
		return (
			<div className="flex justify-center py-8">
				<div className="animate-spin rounded-full h-8 w-8 border-2 border-[#69b4cd] border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
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
										${expense.amount?.toFixed(2) || "0.00"}
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
											? format(new Date(expense.startDate), "MMM dd")
											: "Unknown"}
									</p>
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
								<Link to={`/recurring/${expense.id ?? "unknown"}/edit`}>
									<PencilSimple className="h-6 w-6" />
								</Link>
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									// TODO: Add delete recurring expense functionality
									console.log("Delete recurring expense:", expense.id);
								}}
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
