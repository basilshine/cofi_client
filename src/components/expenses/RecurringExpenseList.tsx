import { apiService } from "@/services/api";
import { currencyService } from "@/services/currency";
import type { components } from "@/types/api-types";
import { Button } from "@components/ui/button";
import { Pause, PencilSimple, Play, Plus } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import LogRocket from "logrocket";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

interface RecurringExpenseListProps {
	recurringExpenses: components["schemas"]["RecurringExpense"][];
	isLoading: boolean;
	user?: components["schemas"]["User"] | null;
}

const isSchedulePaused = (
	expense: components["schemas"]["RecurringExpense"],
): boolean => {
	const raw = expense as { paused?: boolean };
	return raw.paused === true;
};

export const RecurringExpenseList = ({
	recurringExpenses,
	isLoading,
	user,
}: RecurringExpenseListProps) => {
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	const pauseMutation = useMutation({
		mutationFn: (id: string) => {
			LogRocket.log("[RecurringExpenseList] pauseMutation", { id });
			return apiService.recurring.pause(id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["recurring"] });
		},
		onError: (error) => {
			LogRocket.error("[RecurringExpenseList] pauseMutation error", error);
			console.error("Failed to pause recurring schedule:", error);
		},
	});

	const resumeMutation = useMutation({
		mutationFn: (id: string) => {
			LogRocket.log("[RecurringExpenseList] resumeMutation", { id });
			return apiService.recurring.resume(id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["recurring"] });
		},
		onError: (error) => {
			LogRocket.error("[RecurringExpenseList] resumeMutation error", error);
			console.error("Failed to resume recurring schedule:", error);
		},
	});

	const handlePause = (id: string, name: string) => {
		if (
			window.confirm(
				`Pause "${name}"? Future automatic charges will stop until you resume.`,
			)
		) {
			pauseMutation.mutate(id);
		}
	};

	const handleResume = (id: string) => {
		resumeMutation.mutate(id);
	};

	const pending = pauseMutation.isPending || resumeMutation.isPending;

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
						{t("expenses.addExpense")}
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
				const paused = isSchedulePaused(expense);

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
									<div className="flex items-center gap-2 flex-wrap">
										<p className="text-[#333333] text-base font-bold leading-normal">
											{expense.name || "Expense Schedule"}
										</p>
										<span className="bg-[#e0f2f7] text-[#69b4cd] text-xs px-2 py-1 rounded-full">
											{expense.interval || "monthly"}
										</span>
										{paused ? (
											<span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
												{t("expenses.paused", "Paused")}
											</span>
										) : null}
									</div>
									<p className="text-[#333333] text-base font-bold leading-normal">
										{currencyService.formatCurrency(expense.amount || 0, user)}
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
									Tag:{" "}
									{(expense as { tag_label?: string }).tag_label ??
										expense.tagLabel ??
										"—"}{" "}
									| ID: {expense.id} | Raw NextRun: {expense.nextRun} | Raw
									StartDate: {expense.startDate}
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
							{paused ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleResume((expense.id ?? "").toString())}
									disabled={pending}
									className="text-[#69b4cd] hover:text-[#47a0c4]"
									aria-label={t("expenses.resumeSchedule", "Resume schedule")}
								>
									<Play className="h-6 w-6" weight="bold" />
								</Button>
							) : (
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										handlePause(
											(expense.id ?? "").toString(),
											expense.name || "schedule",
										)
									}
									disabled={pending}
									className="text-amber-600 hover:text-amber-800"
									aria-label={t("expenses.pauseSchedule", "Pause schedule")}
								>
									<Pause className="h-6 w-6" weight="bold" />
								</Button>
							)}
						</div>
					</div>
				);
			})}

			{/* Empty State */}
			{recurringExpenses.length === 0 ? (
				<div className="text-center py-8">
					<p className="text-[#666666] text-sm">{t("expenses.noExpenses")}</p>
					<p className="text-[#666666] text-xs mt-2">
						{t("expenses.createSchedulesDescription")}
					</p>
				</div>
			) : null}
		</div>
	);
};
