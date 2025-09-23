import { apiService } from "@/services/api";
import { expensesService } from "@/services/api/expenses";
import { currencyService } from "@/services/currency";
import type { components } from "@/types/api-types";
import { LoadingScreen } from "@components/LoadingScreen";
import { Button } from "@components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@components/ui/select";
import { Separator } from "@components/ui/separator";
import { useAuth } from "@contexts/AuthContext";
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
	const { isAuthenticated, user } = useAuth();
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
	const [newCategoryName, setNewCategoryName] = useState("");

	// Determine if this is add mode (no ID) or edit mode (has ID)
	const isAddMode = !id;
	const isEditMode = !!id;
	const isWebApp = isTelegramWebApp();

	// Check if user came through Telegram link (with startapp parameter)
	const cameThroughTelegramLink =
		isWebApp &&
		(new URLSearchParams(window.location.search).get("startapp") ||
			sessionStorage.getItem("cofi_telegram_startapp_param"));

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
		enabled: isEditMode, // Only fetch if we're in edit mode
	});

	// Fetch user categories
	const { data: categories = [] } = useQuery<
		components["schemas"]["Category"][]
	>({
		queryKey: ["categories", "user"],
		queryFn: () => {
			LogRocket.log("[ExpenseEdit] getUserCategories queryFn");
			return apiService.categories.list().then((res) => {
				LogRocket.log("[ExpenseEdit] getUserCategories result", res.data);
				return res.data;
			});
		},
		enabled: isAuthenticated,
	});

	// Update editing items when expense data changes or initialize for add mode
	useEffect(() => {
		if (isEditMode && expense?.items) {
			setEditingItems(expense.items);
		} else if (isAddMode && editingItems.length === 0) {
			// Initialize with one empty item for add mode
			setEditingItems([
				{
					name: "",
					amount: 0,
					emotion: "😐",
					category: undefined,
				} as components["schemas"]["ExpenseItem"],
			]);
		}
	}, [expense, isAddMode, isEditMode, editingItems.length]);

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

			// If in Telegram WebApp and came through Telegram link, show success message and close
			if (isTelegramWebApp() && cameThroughTelegramLink) {
				console.log("[ExpenseEdit] Came through Telegram link, closing WebApp");
				const totalAmount = editingItems.reduce(
					(sum, item) => sum + (item.amount ?? 0),
					0,
				);
				notifyExpenseSavedAndClose({
					totalAmount,
					itemsCount: editingItems.length,
					status: data.status || "approved",
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

	const createMutation = useMutation({
		mutationFn: (data: Partial<components["schemas"]["Expense"]>) => {
			LogRocket.log("[ExpenseEdit] createMutation.mutationFn", { data });
			return expensesService.createExpense(data).then((res) => {
				LogRocket.log("[ExpenseEdit] createMutation result", res);
				return res;
			});
		},
		onSuccess: (data) => {
			LogRocket.log("[ExpenseEdit] createMutation success", data);
			queryClient.invalidateQueries({ queryKey: ["expenses"] });

			// If in Telegram WebApp and came through Telegram link, show success message and close
			if (isTelegramWebApp() && cameThroughTelegramLink) {
				console.log("[ExpenseEdit] Came through Telegram link, closing WebApp");
				const totalAmount = editingItems.reduce(
					(sum, item) => sum + (item.amount ?? 0),
					0,
				);
				notifyExpenseSavedAndClose({
					totalAmount,
					itemsCount: editingItems.length,
					status: "approved",
				});
			} else {
				// Regular web navigation
				navigate("/expenses");
			}
		},
		onError: (error) => {
			LogRocket.error("[ExpenseEdit] createMutation error", error);
			console.error("Failed to create expense:", error);
		},
	});

	const handleSaveChanges = () => {
		const expenseData: Partial<components["schemas"]["Expense"]> = {
			items: editingItems,
		};

		if (isEditMode) {
			if (!expense) return;
			const updatedExpense: Partial<components["schemas"]["Expense"]> = {
				...expense,
				items: editingItems,
				// Change status from "draft" to "approved" when editing in WebApp mode and came through Telegram link
				...(isWebApp && cameThroughTelegramLink && expense.status === "draft"
					? { status: "approved" }
					: {}),
			};
			console.log(
				"[ExpenseEdit] Updating expense with status:",
				updatedExpense.status,
			);
			updateMutation.mutate(updatedExpense);
		} else {
			// Add mode - create new expense
			createMutation.mutate(expenseData);
		}
	};

	const handleCancel = () => {
		console.log(
			"[ExpenseEdit] Cancel clicked, isWebApp:",
			isWebApp,
			"cameThroughTelegramLink:",
			cameThroughTelegramLink,
		);
		// If in Telegram WebApp and came through Telegram link, show cancel message and close
		if (isTelegramWebApp() && cameThroughTelegramLink) {
			console.log(
				"[ExpenseEdit] Came through Telegram link, closing WebApp on cancel",
			);
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

	// Only show loading for edit mode
	if (isEditMode && isLoading) {
		return <LoadingScreen />;
	}

	// Only show error for edit mode
	if (isEditMode && error) {
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

	// Only check for expense existence in edit mode
	if (isEditMode && !expense) {
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
		<div className="min-h-screen bg-[#f8fafc] flex flex-col">
			{/* Header - only show if not in WebApp mode */}
			{!isWebApp && (
				<header className="sticky top-0 z-10 bg-[#f8fafc] border-b border-gray-200">
					<div className="flex items-center justify-between p-4">
						<Button variant="ghost" size="sm" onClick={handleCancel}>
							<X className="h-5 w-5 text-[#1e3a8a]" />
						</Button>
						<h1 className="text-xl font-bold font-heading text-[#1e3a8a]">
							{isAddMode ? "Add Expense" : "Edit Expense"}
						</h1>
						<div className="w-8" />
					</div>
				</header>
			)}

			{/* Main Content */}
			<main className={`flex-1 p-4 space-y-6 ${isWebApp ? "pt-0" : ""}`}>
				{/* Total Amount Card */}
				<div className="mx-4">
					<div className="bg-white rounded-xl shadow-sm p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-[#64748b]">Total Amount</p>
								<p className="text-2xl font-bold text-[#1e3a8a]">
									{currencyService.formatCurrency(totalAmount, user)}
								</p>
							</div>
							<div className="text-right">
								<p className="text-sm text-[#64748b]">Date</p>
								<p className="font-medium text-[#1e3a8a]">
									{isEditMode && expense?.createdAt
										? new Date(expense.createdAt).toLocaleDateString()
										: "Today"}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Items Section */}
				<div className="mx-4">
					<h2 className="text-[#1e3a8a] text-lg font-semibold leading-tight pb-2">
						Items
					</h2>
					<div className="space-y-3">
						{editingItems.map((item, index) => (
							<div
								key={item.id || `item-${index}`}
								className="bg-white rounded-xl shadow-sm"
							>
								{/* Collapsed View */}
								<button
									type="button"
									className="flex items-center justify-between p-4 w-full text-left hover:bg-[#e0f2f7] transition-colors"
									onClick={() => toggleItemExpansion(index)}
								>
									<div>
										<p className="font-medium text-[#1e3a8a]">
											{item.name || "Unnamed Item"}
										</p>
										<p className="text-sm text-[#64748b]">
											{item.category?.name || "Uncategorized"}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<div className="text-right">
											<p className="font-bold text-[#1e3a8a]">
												{currencyService.formatCurrency(item.amount || 0, user)}
											</p>
										</div>
										{expandedItems.has(index) ? (
											<CaretUp className="h-5 w-5 text-[#64748b]" />
										) : (
											<CaretDown className="h-5 w-5 text-[#64748b]" />
										)}
									</div>
								</button>

								{/* Expanded View */}
								{expandedItems.has(index) && (
									<div className="p-4 border-t border-gray-200 space-y-4">
										<div className="flex items-center justify-between">
											<p className="font-bold text-lg text-[#1e3a8a]">
												Edit Item
											</p>
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.stopPropagation();
													removeItem(index);
												}}
												className="text-red-500 hover:text-red-600"
											>
												<Trash className="h-4 w-4" />
											</Button>
										</div>

										<div className="space-y-4">
											<div>
												<Label
													htmlFor={`item-description-${index}`}
													className="text-[#64748b] text-sm font-medium"
												>
													Description
												</Label>
												<Input
													id={`item-description-${index}`}
													value={item.name || ""}
													onChange={(e) =>
														updateItem(index, "name", e.target.value)
													}
													placeholder="e.g., Coffee with friend"
													className="bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]"
												/>
											</div>

											<div>
												<Label
													htmlFor={`item-amount-${index}`}
													className="text-[#64748b] text-sm font-medium"
												>
													Amount
												</Label>
												<div className="relative">
													<span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]">
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
														className="pl-7 bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]"
													/>
												</div>
											</div>

											<div>
												<Label
													htmlFor={`item-category-${index}`}
													className="text-[#64748b] text-sm font-medium"
												>
													Category
												</Label>
												<Select
													onValueChange={(value) =>
														updateItem(index, "category", value)
													}
												>
													<SelectTrigger className="bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]">
														<SelectValue placeholder="Select category" />
													</SelectTrigger>
													<SelectContent>
														{categories.map((category) => (
															<SelectItem
																key={category.id}
																value={category.name || ""}
															>
																{category.name}
															</SelectItem>
														))}
														{categories.length === 0 && (
															<SelectItem value="" disabled>
																No categories found
															</SelectItem>
														)}
													</SelectContent>
												</Select>
											</div>

											<div>
												<Label
													htmlFor={`item-feeling-${index}`}
													className="text-[#64748b] text-sm font-medium"
												>
													Emotional Feeling
												</Label>
												<Select
													onValueChange={(value) =>
														updateItem(index, "emotion", value)
													}
												>
													<SelectTrigger className="bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]">
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
										</div>
									</div>
								)}
							</div>
						))}
					</div>
				</div>

				{/* Add New Item Button */}
				<div className="mx-4">
					<Button
						onClick={addNewItem}
						className="w-full bg-[#47c1ea] hover:bg-[#3ba8d4] text-white rounded-xl py-3"
					>
						<Plus className="h-5 w-5 mr-2" />
						Add New Item
					</Button>
				</div>

				{/* Action Buttons */}
				<div className="mx-4 space-y-3">
					<Button
						onClick={handleSaveChanges}
						className="w-full bg-[#47c1ea] hover:bg-[#3ba8d4] text-white rounded-xl py-3"
						disabled={updateMutation.isPending || createMutation.isPending}
					>
						{updateMutation.isPending || createMutation.isPending
							? "Saving..."
							: "Save Changes"}
					</Button>
					<Button
						onClick={handleCancel}
						variant="outline"
						className="w-full border-[#47c1ea] text-[#47c1ea] hover:bg-[#e0f2f7] rounded-xl py-3"
					>
						Cancel
					</Button>
				</div>
			</main>

			{/* New Item Modal */}
			{showNewItemModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-lg w-full max-w-md">
						<CardHeader>
							<CardTitle className="text-[#1e3a8a]">
								{newItemStep === 1 && "Item Description"}
								{newItemStep === 2 && "Item Amount"}
								{newItemStep === 3 && "Item Category"}
								{newItemStep === 4 && "Emotional Feeling"}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{newItemStep === 1 && (
								<div>
									<Label
										htmlFor="new-item-description"
										className="text-[#64748b] text-sm font-medium"
									>
										Description
									</Label>
									<Input
										id="new-item-description"
										value={newItem.name || ""}
										onChange={(e) =>
											setNewItem({ ...newItem, name: e.target.value })
										}
										placeholder="e.g., Coffee with friend"
										className="bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]"
									/>
								</div>
							)}

							{newItemStep === 2 && (
								<div>
									<Label
										htmlFor="new-item-amount"
										className="text-[#64748b] text-sm font-medium"
									>
										Amount
									</Label>
									<div className="relative">
										<span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]">
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
											className="pl-7 bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]"
										/>
									</div>
								</div>
							)}

							{newItemStep === 3 && (
								<div>
									<Label
										htmlFor="new-item-category"
										className="text-[#64748b] text-sm font-medium"
									>
										Category
									</Label>
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
										<SelectTrigger className="bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]">
											<SelectValue placeholder="Select category" />
										</SelectTrigger>
										<SelectContent>
											{categories.map((category) => (
												<SelectItem
													key={category.id}
													value={category.name || ""}
												>
													{category.name}
												</SelectItem>
											))}
											{categories.length === 0 && (
												<SelectItem value="" disabled>
													No categories found
												</SelectItem>
											)}
											<Separator className="my-2" />
											<div className="p-2">
												<Input
													placeholder="Create new category"
													value={newCategoryName}
													onChange={(e) => setNewCategoryName(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === "Enter" && newCategoryName.trim()) {
															// Create new category logic here
															setNewItem({
																...newItem,
																category: {
																	name: newCategoryName.trim(),
																} as components["schemas"]["Category"],
															});
															setNewCategoryName("");
														}
													}}
													className="text-sm"
												/>
											</div>
										</SelectContent>
									</Select>
								</div>
							)}

							{newItemStep === 4 && (
								<div>
									<Label
										htmlFor="new-item-feeling"
										className="text-[#64748b] text-sm font-medium"
									>
										Emotional Feeling
									</Label>
									<Select
										onValueChange={(value) =>
											setNewItem({ ...newItem, emotion: value })
										}
									>
										<SelectTrigger className="bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]">
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
						<div className="flex justify-between items-center p-6 border-t border-gray-200">
							<Button
								variant="outline"
								onClick={handleNewItemBack}
								disabled={newItemStep === 1}
								className="border-[#47c1ea] text-[#47c1ea] hover:bg-[#e0f2f7]"
							>
								Back
							</Button>
							<Button
								onClick={handleNewItemNext}
								className="bg-[#47c1ea] hover:bg-[#3ba8d4] text-white"
							>
								{newItemStep < 4 ? "Next" : "Finish"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
