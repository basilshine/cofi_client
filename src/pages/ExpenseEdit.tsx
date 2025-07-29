import { expensesService } from "@/services/api/expenses";
import type { components } from "@/types/api-types";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@components/ui/select";
import { CaretDown, CaretUp, Plus, Trash, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTelegramWebApp } from "@utils/isTelegramWebApp";
import {
	notifyCancelAndClose,
	notifyExpenseSavedAndClose,
} from "@utils/telegramWebApp";
import LogRocket from "logrocket";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

export const ExpenseEdit = () => {
	const { t } = useTranslation();
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [editingItems, setEditingItems] = useState<
		components["schemas"]["ExpenseItem"][]
	>([]);
	const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
	const [showNewItemModal, setShowNewItemModal] = useState(false);
	const [newItemStep, setNewItemStep] = useState(1);
	const [newItem, setNewItem] = useState<
		Partial<components["schemas"]["ExpenseItem"]>
	>({
		name: "",
		amount: 0,
		emotion: "😐",
		category: undefined,
	});

	const {
		data: expense,
		isLoading,
		error,
	} = useQuery<components["schemas"]["Expense"], Error>({
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

	// Update editing items when expense data changes
	useEffect(() => {
		if (expense?.items) {
			setEditingItems(expense.items);
		}
	}, [expense]);

	const updateMutation = useMutation({
		mutationFn: (data: Partial<components["schemas"]["Expense"]>) => {
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

			// If in Telegram WebApp, show success message and close
			if (isTelegramWebApp()) {
				const totalAmount = editingItems.reduce(
					(sum, item) => sum + (item.amount ?? 0),
					0,
				);
				notifyExpenseSavedAndClose({
					totalAmount,
					itemsCount: editingItems.length,
					status: "saved",
				});
			} else {
				// Regular web navigation
				navigate("/expenses");
			}
		},
		onError: (error) => {
			LogRocket.error("[ExpenseEdit] updateMutation error", error);
			console.error("Failed to update expense:", error);
		},
	});

	const handleSaveChanges = () => {
		if (!expense) return;

		const updatedExpense: Partial<components["schemas"]["Expense"]> = {
			...expense,
			items: editingItems,
		};
		updateMutation.mutate(updatedExpense);
	};

	const handleCancel = () => {
		// If in Telegram WebApp, show cancel message and close
		if (isTelegramWebApp()) {
			notifyCancelAndClose();
		} else {
			// Regular web navigation
			navigate("/expenses");
		}
	};

	const updateItem = (
		index: number,
		field: keyof components["schemas"]["ExpenseItem"],
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

	const toggleItemExpansion = (index: number) => {
		const newExpanded = new Set(expandedItems);
		if (newExpanded.has(index)) {
			newExpanded.delete(index);
		} else {
			newExpanded.add(index);
		}
		setExpandedItems(newExpanded);
	};

	const addNewItem = () => {
		if (newItem.name && newItem.amount) {
			setEditingItems([
				...editingItems,
				newItem as components["schemas"]["ExpenseItem"],
			]);
			setNewItem({ name: "", amount: 0, emotion: "😐", category: undefined });
			setNewItemStep(1);
			setShowNewItemModal(false);
		}
	};

	const handleNewItemNext = () => {
		if (newItemStep < 4) {
			setNewItemStep(newItemStep + 1);
		} else {
			addNewItem();
		}
	};

	const handleNewItemBack = () => {
		if (newItemStep > 1) {
			setNewItemStep(newItemStep - 1);
		}
	};

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="text-center">
					<p className="text-muted-foreground">{t("common.loading")}</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="text-center">
					<p className="text-destructive">
						{error.message || t("expenses.notFound")}
					</p>
					<Button onClick={() => navigate("/expenses")} className="mt-4">
						{t("common.goBack")}
					</Button>
				</div>
			</div>
		);
	}

	if (!expense) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="text-center">
					<p className="text-destructive">{t("expenses.notFound")}</p>
					<Button onClick={() => navigate("/expenses")} className="mt-4">
						{t("common.goBack")}
					</Button>
				</div>
			</div>
		);
	}

	const totalAmount = editingItems.reduce(
		(sum, item) => sum + (item.amount ?? 0),
		0,
	);

	return (
		<div className="min-h-screen bg-background flex flex-col">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-background border-b">
				<div className="flex items-center justify-between p-4">
					<Button variant="ghost" size="sm" onClick={handleCancel}>
						<X className="h-5 w-5" />
					</Button>
					<h1 className="text-xl font-bold font-heading">Edit Expense</h1>
					<div className="w-8" />
				</div>
			</header>

			{/* Main Content */}
			<main className="flex-1 p-4 space-y-6">
				{/* Total Amount Card */}
				<Card className="bg-card">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Total Amount</p>
								<p className="text-2xl font-bold">${totalAmount.toFixed(2)}</p>
							</div>
							<div className="text-right">
								<p className="text-sm text-muted-foreground">Date</p>
								<p className="font-medium">
									{expense.createdAt
										? new Date(expense.createdAt).toLocaleDateString()
										: "Today"}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Items Section */}
				<div>
					<h2 className="text-lg font-bold font-heading mb-4">Items</h2>
					<div className="space-y-2">
						{editingItems.map((item, index) => (
							<Card key={item.id || `item-${index}`} className="bg-card">
								{/* Collapsed View */}
								<button
									type="button"
									className="flex items-center justify-between p-4 w-full text-left hover:bg-accent/50 transition-colors"
									onClick={() => toggleItemExpansion(index)}
								>
									<div>
										<p className="font-medium">{item.name || "Unnamed Item"}</p>
										<p className="text-sm text-muted-foreground">
											{item.category?.name || "Uncategorized"}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<div className="text-right">
											<p className="font-bold">
												${(item.amount || 0).toFixed(2)}
											</p>
										</div>
										{expandedItems.has(index) ? (
											<CaretUp className="h-5 w-5 text-muted-foreground" />
										) : (
											<CaretDown className="h-5 w-5 text-muted-foreground" />
										)}
									</div>
								</button>

								{/* Expanded View */}
								{expandedItems.has(index) && (
									<div className="p-4 border-t space-y-4">
										<div className="flex items-center justify-between">
											<p className="font-bold text-lg">Edit Item</p>
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.stopPropagation();
													removeItem(index);
												}}
												className="text-destructive hover:text-destructive"
											>
												<Trash className="h-4 w-4" />
											</Button>
										</div>

										<div className="space-y-4">
											<div>
												<Label htmlFor={`item-description-${index}`}>
													Description
												</Label>
												<Input
													id={`item-description-${index}`}
													value={item.name || ""}
													onChange={(e) =>
														updateItem(index, "name", e.target.value)
													}
													placeholder="e.g., Coffee with friend"
													className="bg-muted border-none"
												/>
												<div className="text-xs text-muted-foreground mt-1 space-x-1">
													<span>Suggestions:</span>
													<button
														type="button"
														className="bg-accent px-2 py-0.5 rounded-full text-xs hover:bg-accent/80"
													>
														{item.category?.name || "Food"}
													</button>
													<button
														type="button"
														className="bg-accent px-2 py-0.5 rounded-full text-xs hover:bg-accent/80"
													>
														Coffee
													</button>
												</div>
											</div>

											<div className="grid grid-cols-2 gap-4">
												<div>
													<Label htmlFor={`item-amount-${index}`}>Amount</Label>
													<div className="relative">
														<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
															$
														</span>
														<Input
															id={`item-amount-${index}`}
															type="number"
															step="0.01"
															value={item.amount || 0}
															onChange={(e) =>
																updateItem(
																	index,
																	"amount",
																	Number.parseFloat(e.target.value) || 0,
																)
															}
															placeholder="0.00"
															className="pl-7 bg-muted border-none"
														/>
													</div>
												</div>
												<div>
													<Label htmlFor={`item-date-${index}`}>Date</Label>
													<Input
														id={`item-date-${index}`}
														type="date"
														defaultValue={
															new Date().toISOString().split("T")[0]
														}
														className="bg-muted border-none"
													/>
												</div>
											</div>

											<div>
												<Label htmlFor={`item-category-${index}`}>
													Category
												</Label>
												<Select
													defaultValue={item.category?.name || "Groceries"}
												>
													<SelectTrigger className="bg-muted border-none">
														<SelectValue placeholder="Select category" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="Groceries">Groceries</SelectItem>
														<SelectItem value="Food">Food</SelectItem>
														<SelectItem value="Transport">Transport</SelectItem>
														<SelectItem value="Entertainment">
															Entertainment
														</SelectItem>
													</SelectContent>
												</Select>
												<div className="text-xs text-muted-foreground mt-1">
													Most frequent: Food, Groceries
												</div>
											</div>

											<div className="grid grid-cols-2 gap-4">
												<div>
													<Label htmlFor={`item-feeling-${index}`}>
														Emotional Feeling
													</Label>
													<Select defaultValue={item.emotion || "😐"}>
														<SelectTrigger className="bg-muted border-none">
															<SelectValue placeholder="Select feeling" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="😀">😀 Happy</SelectItem>
															<SelectItem value="😐">😐 Neutral</SelectItem>
															<SelectItem value="😔">😔 Sad</SelectItem>
															<SelectItem value="😌">😌 Satisfied</SelectItem>
														</SelectContent>
													</Select>
												</div>
												<div>
													<Label htmlFor={`tags-${index}`}>Tags</Label>
													<Input
														id={`tags-${index}`}
														placeholder="e.g., organic, lactose-free"
														className="bg-muted border-none"
													/>
												</div>
											</div>
										</div>
									</div>
								)}
							</Card>
						))}
					</div>

					{/* Add New Item Button */}
					<Button
						variant="outline"
						className="w-full mt-4 border-dashed"
						onClick={() => setShowNewItemModal(true)}
					>
						<Plus className="h-4 w-4 mr-2" />
						Add New Item
					</Button>
				</div>
			</main>

			{/* Footer */}
			<footer className="sticky bottom-0 bg-background p-4 border-t">
				<div className="grid grid-cols-2 gap-4">
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
					<Button
						onClick={handleSaveChanges}
						disabled={updateMutation.isPending}
					>
						{updateMutation.isPending ? "Saving..." : "Save Changes"}
					</Button>
				</div>
			</footer>

			{/* New Item Modal */}
			{showNewItemModal && (
				<div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
					<Card className="w-full max-w-md">
						<CardHeader>
							<div className="flex justify-between items-center">
								<CardTitle>Add New Item</CardTitle>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowNewItemModal(false)}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
							<div className="space-y-2">
								<div className="flex justify-between text-sm text-muted-foreground">
									<span>Step {newItemStep} of 4</span>
								</div>
								<div className="w-full bg-muted rounded-full h-2">
									<div
										className="bg-primary h-2 rounded-full transition-all duration-300"
										style={{ width: `${(newItemStep / 4) * 100}%` }}
									/>
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							{newItemStep === 1 && (
								<div>
									<Label htmlFor="new-item-description">Description</Label>
									<Input
										id="new-item-description"
										value={newItem.name || ""}
										onChange={(e) =>
											setNewItem({ ...newItem, name: e.target.value })
										}
										placeholder="e.g., Coffee with friend"
										className="bg-muted border-none"
									/>
								</div>
							)}

							{newItemStep === 2 && (
								<div>
									<Label htmlFor="new-item-amount">Amount</Label>
									<div className="relative">
										<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
											$
										</span>
										<Input
											id="new-item-amount"
											type="number"
											step="0.01"
											value={newItem.amount || 0}
											onChange={(e) =>
												setNewItem({
													...newItem,
													amount: Number.parseFloat(e.target.value) || 0,
												})
											}
											placeholder="0.00"
											className="pl-7 bg-muted border-none"
										/>
									</div>
								</div>
							)}

							{newItemStep === 3 && (
								<div>
									<Label htmlFor="new-item-category">Category</Label>
									<Select
										onValueChange={(value) =>
											setNewItem({
												...newItem,
												category: {
													name: value,
												} as components["schemas"]["Category"],
											})
										}
									>
										<SelectTrigger className="bg-muted border-none">
											<SelectValue placeholder="Select category" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="Food">Food</SelectItem>
											<SelectItem value="Groceries">Groceries</SelectItem>
											<SelectItem value="Transport">Transport</SelectItem>
											<SelectItem value="Entertainment">
												Entertainment
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							)}

							{newItemStep === 4 && (
								<div>
									<Label htmlFor="new-item-feeling">Emotional Feeling</Label>
									<Select
										onValueChange={(value) =>
											setNewItem({ ...newItem, emotion: value })
										}
									>
										<SelectTrigger className="bg-muted border-none">
											<SelectValue placeholder="Select feeling" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="😀">😀 Happy</SelectItem>
											<SelectItem value="😐">😐 Neutral</SelectItem>
											<SelectItem value="😔">😔 Sad</SelectItem>
											<SelectItem value="😌">😌 Satisfied</SelectItem>
										</SelectContent>
									</Select>
								</div>
							)}
						</CardContent>
						<div className="flex justify-between items-center p-6 border-t">
							<Button
								variant="outline"
								onClick={handleNewItemBack}
								disabled={newItemStep === 1}
							>
								Back
							</Button>
							<Button onClick={handleNewItemNext}>
								{newItemStep < 4 ? "Next" : "Finish"}
							</Button>
						</div>
					</Card>
				</div>
			)}
		</div>
	);
};
