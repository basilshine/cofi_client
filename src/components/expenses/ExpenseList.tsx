import { expensesService } from "@/services/api/expenses";
import type { components } from "@/types/api-types";
import { Button } from "@components/ui/button";
import { LoadingScreen } from "@components/LoadingScreen";
import { useAuth } from "@contexts/AuthContext";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import LogRocket from "logrocket";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export const ExpenseList = () => {
	const { t } = useTranslation();
	const { isAuthenticated, user } = useAuth();
	const queryClient = useQueryClient();

	const {
		data: expenses,
		isLoading,
		error,
	} = useQuery<components["schemas"]["Expense"][]>({
		queryKey: ["expenses"],
		queryFn: () => {
			if (!isAuthenticated) throw new Error("Not authenticated");
			LogRocket.log("[ExpenseList] useQuery.queryFn");
			return expensesService.getExpenses().then((res) => {
				LogRocket.log("[ExpenseList] useQuery result", {
					userId: user?.id,
					token: "present",
					expenses: res.length || 0,
				});
				return res;
			});
		},
		enabled: isAuthenticated,
	});

	// Логируем ошибки/успех через useEffect
	useEffect(() => {
		if (expenses) LogRocket.log("[ExpenseList] useQuery success", expenses);
		if (error) LogRocket.error("[ExpenseList] useQuery error", error);
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
	if (error) return <div>{t("common.error")}</div>;

	return (
		<div className="space-y-4">
			{expenses?.map((expense: components["schemas"]["Expense"], index) => {
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
							<div className="text-[#333333] flex items-center justify-center rounded-lg bg-[#e0f2f7] shrink-0 size-12">
								{mainItem?.emotion || "😐"}
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

			{/* Empty State */}
			{!expenses || expenses.length === 0 ? (
				<div className="text-center py-8">
					<p className="text-[#666666] text-sm">{t("expenses.noExpenses")}</p>
				</div>
			) : null}
		</div>
	);
};
