import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { ArrowLeft, Check, Trash, X } from "@phosphor-icons/react";
import type { Expense, ExpenseItem } from "@services/api/expenses";
import { expensesService } from "@services/api/expenses";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyTelegramWebApp } from "@utils/telegramWebApp";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import LogRocket from "logrocket";

export const ExpenseEdit = () => {
	const { t } = useTranslation();
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [editingItems, setEditingItems] = useState<ExpenseItem[]>([]);

	const {
		data: expense,
		isLoading,
		error,
	} = useQuery<Expense, Error>({
		queryKey: ["expense", id],
		queryFn: () => {
			LogRocket.log("[ExpenseEdit] useQuery.queryFn", { id });
			if (!id) throw new Error("No expense ID provided");
			return expensesService.getExpenseById(id).then((res) => {
				LogRocket.log("[ExpenseEdit] useQuery.queryFn result", res);
				return res;
			});
		},
		enabled: !!id,
	});

	// Логируем ошибки/успех через useEffect
	useEffect(() => {
		if (expense) LogRocket.log("[ExpenseEdit] useQuery success", expense);
		if (error) LogRocket.error("[ExpenseEdit] useQuery error", error);
	}, [expense, error]);

	// Update editing items when expense data changes
	useEffect(() => {
		if (expense && expense.items) {
			setEditingItems(expense.items);
		}
	}, [expense]);

	const updateMutation = useMutation({
		mutationFn: (data: Partial<Expense>) => {
			LogRocket.log("[ExpenseEdit] updateMutation.mutationFn", { id, data });
			if (!id) throw new Error("No expense ID provided");
			return expensesService.updateExpense(id, data).then((res) => {
				LogRocket.log("[ExpenseEdit] updateMutation result", res);
				return res;
			});
		},
		onSuccess: (data) => {
			LogRocket.log("[ExpenseEdit] updateMutation success", data);
			queryClient.invalidateQueries({ queryKey: ["expenses"] });
			queryClient.invalidateQueries({ queryKey: ["expense", id] });
			notifyTelegramWebApp("expense_updated");
			navigate("/expenses");
		},
		onError: (error) => {
			LogRocket.error("[ExpenseEdit] updateMutation error", error);
			console.error("Failed to update expense:", error);
		},
	});

	const approveMutation = useMutation({
		mutationFn: () => {
			LogRocket.log("[ExpenseEdit] approveMutation.mutationFn", { id });
			if (!id) throw new Error("No expense ID provided");
			return expensesService.approveExpense(id).then((res) => {
				LogRocket.log("[ExpenseEdit] approveMutation result", res);
				return res;
			});
		},
		onSuccess: (data) => {
			LogRocket.log("[ExpenseEdit] approveMutation success", data);
			queryClient.invalidateQueries({ queryKey: ["expenses"] });
			queryClient.invalidateQueries({ queryKey: ["expense", id] });
			notifyTelegramWebApp("expense_updated", { message: "Expense approved!" });
			navigate("/expenses");
		},
		onError: (error) => {
			LogRocket.error("[ExpenseEdit] approveMutation error", error);
			console.error("Failed to approve expense:", error);
		},
	});

	const cancelMutation = useMutation({
		mutationFn: () => {
			LogRocket.log("[ExpenseEdit] cancelMutation.mutationFn", { id });
			if (!id) throw new Error("No expense ID provided");
			return expensesService.cancelExpense(id).then((res) => {
				LogRocket.log("[ExpenseEdit] cancelMutation result", res);
				return res;
			});
		},
		onSuccess: (data) => {
			LogRocket.log("[ExpenseEdit] cancelMutation success", data);
			queryClient.invalidateQueries({ queryKey: ["expenses"] });
			notifyTelegramWebApp("expense_deleted", {
				message: "Expense cancelled!",
			});
			navigate("/expenses");
		},
		onError: (error) => {
			LogRocket.error("[ExpenseEdit] cancelMutation error", error);
			console.error("Failed to cancel expense:", error);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () => {
			LogRocket.log("[ExpenseEdit] deleteMutation.mutationFn", { id });
			if (!id) throw new Error("No expense ID provided");
			return expensesService.deleteExpense(id).then((res) => {
				LogRocket.log("[ExpenseEdit] deleteMutation result", res);
				return res;
			});
		},
		onSuccess: (data) => {
			LogRocket.log("[ExpenseEdit] deleteMutation success", data);
			queryClient.invalidateQueries({ queryKey: ["expenses"] });
			notifyTelegramWebApp("expense_deleted");
			navigate("/expenses");
		},
		onError: (error) => {
			LogRocket.error("[ExpenseEdit] deleteMutation error", error);
			console.error("Failed to delete expense:", error);
		},
	});

	const handleApprove = () => {
		if (window.confirm(t("expenses.confirmApprove"))) {
			approveMutation.mutate();
		}
	};

	const handleCancel = () => {
		if (window.confirm(t("expenses.confirmCancel"))) {
			cancelMutation.mutate();
		}
	};

	const handleDelete = () => {
		if (window.confirm(t("expenses.confirmDelete"))) {
			deleteMutation.mutate();
		}
	};

	const handleUpdateItems = () => {
		if (!expense) return;

		const updatedExpense: Partial<Expense> = {
			...expense,
			items: editingItems,
		};
		updateMutation.mutate(updatedExpense);
	};

	const handleBack = () => {
		navigate("/expenses");
	};

	const updateItem = (
		index: number,
		field: keyof ExpenseItem,
		value: string | number,
	) => {
		const newItems = [...editingItems];
		newItems[index] = { ...newItems[index], [field]: value };
		setEditingItems(newItems);
	};

	const removeItem = (index: number) => {
		const newItems = editingItems.filter((_, i) => i !== index);
		setEditingItems(newItems);
	};

	const addItem = () => {
		setEditingItems([
			...editingItems,
			{
				amount: 0,
				name: "",
				emotion: "",
			},
		]);
	};

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">{t("common.loading")}</p>
				</div>
			</div>
		);
	}

	if (error || !expense) {
		return (
			<div className="container mx-auto py-8">
				<div className="text-center">
					<p className="text-red-500">{t("expenses.notFound")}</p>
					<Button onClick={handleBack} className="mt-4">
						{t("common.goBack")}
					</Button>
				</div>
			</div>
		);
	}

	const isDraft = expense.status === "draft";
	const totalAmount = editingItems.reduce((sum, item) => sum + item.amount, 0);

	return (
		<div className="container mx-auto py-8 max-w-4xl">
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="sm" onClick={handleBack}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						{t("common.back")}
					</Button>
					<div>
						<h1 className="text-3xl font-bold">{t("expenses.editExpense")}</h1>
						<div className="flex items-center gap-2 mt-1">
							<span
								className={`px-2 py-1 text-xs rounded-full ${isDraft ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}
							>
								{isDraft ? t("expenses.draft") : t("expenses.approved")}
							</span>
							<span className="text-sm text-muted-foreground">
								{t("expenses.total")}: ${totalAmount.toFixed(2)}
							</span>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{isDraft ? (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={handleCancel}
								disabled={cancelMutation.isPending}
							>
								<X className="h-4 w-4 mr-2" />
								{t("expenses.cancel")}
							</Button>
							<Button
								size="sm"
								onClick={handleApprove}
								disabled={approveMutation.isPending}
							>
								<Check className="h-4 w-4 mr-2" />
								{t("expenses.approve")}
							</Button>
						</>
					) : (
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDelete}
							disabled={deleteMutation.isPending}
						>
							<Trash className="h-4 w-4 mr-2" />
							{t("common.delete")}
						</Button>
					)}
				</div>
			</div>

			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>{t("expenses.expenseDetails")}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div>
								<div className="text-sm font-medium">
									{t("expenses.description")}
								</div>
								<p className="text-sm text-muted-foreground mt-1">
									{expense.description || t("expenses.noDescription")}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle>
								{t("expenses.items")} ({editingItems.length})
							</CardTitle>
							{isDraft && (
								<Button variant="outline" size="sm" onClick={addItem}>
									{t("expenses.addItem")}
								</Button>
							)}
						</div>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{editingItems.map((item, index) => (
								<div
									key={item.id || `item-${index}-${item.name}`}
									className="flex items-center gap-4 p-4 border rounded-lg"
								>
									<div className="flex-1">
										<input
											type="text"
											value={item.name}
											onChange={(e) =>
												updateItem(index, "name", e.target.value)
											}
											placeholder={t("expenses.itemName")}
											className="w-full p-2 border rounded"
											disabled={!isDraft}
										/>
									</div>
									<div className="w-32">
										<input
											type="number"
											step="0.01"
											value={item.amount}
											onChange={(e) =>
												updateItem(
													index,
													"amount",
													Number.parseFloat(e.target.value) || 0,
												)
											}
											placeholder="0.00"
											className="w-full p-2 border rounded"
											disabled={!isDraft}
										/>
									</div>
									<div className="w-20">
										<input
											type="text"
											value={item.emotion || ""}
											onChange={(e) =>
												updateItem(index, "emotion", e.target.value)
											}
											placeholder="😊"
											className="w-full p-2 border rounded text-center"
											disabled={!isDraft}
										/>
									</div>
									{item.category && (
										<div className="text-sm text-muted-foreground">
											{item.category.name}
										</div>
									)}
									{isDraft && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => removeItem(index)}
										>
											<X className="h-4 w-4" />
										</Button>
									)}
								</div>
							))}
						</div>

						{isDraft && editingItems.length > 0 && (
							<div className="mt-6 pt-4 border-t">
								<Button
									onClick={handleUpdateItems}
									disabled={updateMutation.isPending}
									className="w-full"
								>
									{updateMutation.isPending
										? t("common.saving")
										: t("expenses.updateItems")}
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
