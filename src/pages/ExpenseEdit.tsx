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

// Telegram WebApp types for proper typing (flexible interface)
interface TelegramWebApp {
	initData?: string;
	sendData?: (data: string) => void;
	close?: () => void;
	showAlert?: (message: string, callback?: () => void) => void;
	ready?: () => void;
	enableClosingConfirmation?: () => void;
	isExpanded?: boolean;
	viewportHeight?: number;
	MainButton?: {
		text: string;
		show: () => void;
		hide: () => void;
		onClick: (callback: () => void) => void;
	};
	// Allow additional properties that might exist
	[key: string]: unknown;
}

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
	const startappParam =
		typeof window !== "undefined"
			? new URLSearchParams(window.location.search).get("startapp")
			: null;
	const sessionStartapp =
		typeof window !== "undefined"
			? sessionStorage.getItem("cofi_telegram_startapp_param")
			: null;

	const cameThroughTelegramLink =
		isWebApp &&
		(startappParam ||
			sessionStartapp ||
			// Additional check: if we have telegram_edit_flow marker and we're in edit mode
			(isEditMode && sessionStorage.getItem("telegram_edit_flow")));

	// Debug logging for Telegram link detection and set edit flow marker
	useEffect(() => {
		console.log("[ExpenseEdit] Telegram link detection:", {
			isWebApp,
			startappParam,
			sessionStartapp,
			telegramEditFlow: sessionStorage.getItem("telegram_edit_flow"),
			cameThroughTelegramLink,
			currentURL: window.location.href,
		});
		LogRocket.log("[ExpenseEdit] Telegram link detection:", {
			isWebApp,
			startappParam,
			sessionStartapp,
			telegramEditFlow: sessionStorage.getItem("telegram_edit_flow"),
			cameThroughTelegramLink,
			currentURL: window.location.href,
		});

		// Set marker for telegram edit flow if we came through Telegram and are editing
		if (isWebApp && isEditMode && cameThroughTelegramLink) {
			sessionStorage.setItem("telegram_edit_flow", "true");
			console.log("[ExpenseEdit] Set telegram_edit_flow marker");
		}

		// Initialize Telegram WebApp if available
		if (isWebApp && window.Telegram?.WebApp) {
			const webApp = window.Telegram.WebApp as TelegramWebApp;
			console.log("[ExpenseEdit] Initializing Telegram WebApp");

			// Enable closing confirmation
			if (webApp.enableClosingConfirmation) {
				webApp.enableClosingConfirmation();
				console.log("[ExpenseEdit] Enabled closing confirmation");
			}

			// Auto-setup MainButton for Telegram edit mode
			if (webApp.MainButton && cameThroughTelegramLink) {
				console.log("[ExpenseEdit] Setting up MainButton automatically");
				webApp.MainButton.text = "Save & Close";
				webApp.MainButton.show();

				// Handle main button click
				webApp.MainButton.onClick(() => {
					console.log("[ExpenseEdit] MainButton clicked, saving expense");
					handleSaveChanges();
				});

				console.log(
					"[ExpenseEdit] MainButton configured for Telegram edit mode",
				);
			}

			// Ready the webapp
			if (webApp.ready) {
				webApp.ready();
				console.log("[ExpenseEdit] WebApp ready called");
			}
		}
	}, [
		isWebApp,
		cameThroughTelegramLink,
		isEditMode,
		startappParam,
		sessionStartapp,
	]);

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
			console.log("[ExpenseEdit] ✅ UPDATE MUTATION SUCCESS!");
			console.log("[ExpenseEdit] Success data:", data);
			console.log("[ExpenseEdit] About to check shouldCloseWebApp");

			LogRocket.log("[ExpenseEdit] updateMutation success", data);
			queryClient.invalidateQueries({ queryKey: ["expenses"] });
			queryClient.invalidateQueries({ queryKey: ["expense", id] });

			// Enhanced detection for Telegram WebApp flows
			const shouldCloseWebApp =
				isWebApp &&
				(cameThroughTelegramLink ||
					// Additional checks for edit flows
					(isEditMode && sessionStorage.getItem("telegram_edit_flow")) ||
					// Check if we're in a Telegram environment
					(isWebApp && window.location.pathname.includes("/edit")));

			console.log("[ExpenseEdit] shouldCloseWebApp evaluation:", {
				isWebApp,
				cameThroughTelegramLink,
				isEditMode,
				telegramEditFlow: sessionStorage.getItem("telegram_edit_flow"),
				pathIncludes: window.location.pathname.includes("/edit"),
				finalResult: shouldCloseWebApp,
			});

			if (shouldCloseWebApp) {
				console.log(
					"[ExpenseEdit] Telegram WebApp detected, closing after save",
				);
				const totalAmount = editingItems.reduce(
					(sum, item) => sum + (item.amount ?? 0),
					0,
				);

				// Clear telegram edit flow marker
				sessionStorage.removeItem("telegram_edit_flow");

				notifyExpenseSavedAndClose({
					totalAmount,
					itemsCount: editingItems.length,
					status: data.status || "approved",
					user,
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

			// Enhanced detection for Telegram WebApp flows (creation)
			const shouldCloseWebApp =
				isWebApp &&
				(cameThroughTelegramLink ||
					// Check if we're in a Telegram environment
					(isWebApp && window.location.pathname.includes("/add")));

			if (shouldCloseWebApp) {
				console.log(
					"[ExpenseEdit] Telegram WebApp detected, closing after create",
				);
				const totalAmount = editingItems.reduce(
					(sum, item) => sum + (item.amount ?? 0),
					0,
				);
				notifyExpenseSavedAndClose({
					totalAmount,
					itemsCount: editingItems.length,
					status: "approved",
					user,
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
		console.log("[ExpenseEdit] Save button clicked - Starting save process");
		console.log("[ExpenseEdit] Save context:", {
			isWebApp,
			cameThroughTelegramLink,
			isEditMode,
			isAddMode,
			telegramEditFlow: sessionStorage.getItem("telegram_edit_flow"),
			editingItemsCount: editingItems.length,
			expenseStatus: expense?.status,
		});

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

	// Debug function to test telegram close manually
	const handleTestTelegramClose = () => {
		console.log("[ExpenseEdit] Testing Telegram close manually");
		console.log("[ExpenseEdit] Debug info:", {
			isWebApp,
			cameThroughTelegramLink,
			isEditMode,
			telegramEditFlow: sessionStorage.getItem("telegram_edit_flow"),
			windowTelegram: !!window.Telegram,
			webApp: !!window.Telegram?.WebApp,
			currentURL: window.location.href,
			pathname: window.location.pathname,
		});

		if (window.Telegram?.WebApp) {
			const webApp = window.Telegram.WebApp as TelegramWebApp;
			console.log("[ExpenseEdit] WebApp object:", {
				initData: webApp.initData,
				sendData: !!webApp.sendData,
				close: !!webApp.close,
				showAlert: !!webApp.showAlert,
				isExpanded: webApp.isExpanded,
				viewportHeight: webApp.viewportHeight,
			});

			// Test data send
			const testData = JSON.stringify({
				action: "expense_saved",
				message: "🧪 Test message from manual button",
				totalAmount: 100,
				itemsCount: 1,
				status: "test",
			});

			if (webApp.sendData) {
				console.log("[ExpenseEdit] Testing sendData with:", testData);
				webApp.sendData(testData);
			} else if (webApp.showAlert) {
				console.log("[ExpenseEdit] sendData not available, testing showAlert");
				webApp.showAlert("🧪 Test alert - this should work", () => {
					console.log("[ExpenseEdit] Alert callback triggered");
					if (webApp.close) {
						console.log("[ExpenseEdit] Testing close");
						webApp.close();
					}
				});
			} else {
				console.log("[ExpenseEdit] No WebApp methods available");
			}
		} else {
			console.log("[ExpenseEdit] Telegram WebApp not available");
		}
	};

	// Alternative method using MainButton
	const handleTelegramMainButton = () => {
		console.log("[ExpenseEdit] Setting up Telegram MainButton");

		if (window.Telegram?.WebApp) {
			const webApp = window.Telegram.WebApp as TelegramWebApp;

			if (webApp.MainButton) {
				console.log("[ExpenseEdit] MainButton available, setting up");

				webApp.MainButton.text = "Save & Close";
				webApp.MainButton.show();

				// Handle main button click
				webApp.MainButton.onClick(() => {
					console.log("[ExpenseEdit] MainButton clicked, saving expense");
					handleSaveChanges();
				});

				console.log("[ExpenseEdit] MainButton configured");
			} else {
				console.log("[ExpenseEdit] MainButton not available");
			}
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

	// Determine if this is a clean Telegram edit mode (no header/footer)
	const isTelegramEditMode = isWebApp && cameThroughTelegramLink;

	return (
		<div
			className={`min-h-screen bg-[#f8fafc] ${isTelegramEditMode ? "" : "flex flex-col"}`}
		>
			{/* Debug Section - only show in WebApp mode */}
			{isWebApp && (
				<div className="bg-yellow-100 border border-yellow-400 p-3 m-4 rounded-lg">
					<h3 className="font-bold text-yellow-800 mb-2">🧪 Debug Info</h3>
					<div className="text-xs text-yellow-700 space-y-1">
						<div>WebApp: {isWebApp ? "✅" : "❌"}</div>
						<div>Telegram Link: {cameThroughTelegramLink ? "✅" : "❌"}</div>
						<div>Edit Mode: {isEditMode ? "✅" : "❌"}</div>
						<div>Telegram Edit Mode: {isTelegramEditMode ? "✅" : "❌"}</div>
						<div>
							Edit Flow Marker:{" "}
							{sessionStorage.getItem("telegram_edit_flow") ? "✅" : "❌"}
						</div>
						<div>
							Telegram Object:{" "}
							{typeof window !== "undefined" && window.Telegram ? "✅" : "❌"}
						</div>
						<div>
							WebApp Object:{" "}
							{typeof window !== "undefined" && window.Telegram?.WebApp
								? "✅"
								: "❌"}
						</div>
					</div>
					<div className="space-y-2">
						<Button
							onClick={handleTestTelegramClose}
							className="mt-2 text-xs h-8 bg-yellow-600 hover:bg-yellow-700 w-full"
						>
							🧪 Test Telegram Close
						</Button>
						<Button
							onClick={handleTelegramMainButton}
							className="text-xs h-8 bg-blue-600 hover:bg-blue-700 w-full"
						>
							🔧 Setup MainButton
						</Button>
					</div>
				</div>
			)}

			{/* Header - hide in Telegram edit mode */}
			{!isTelegramEditMode && (
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
			<main
				className={`${isTelegramEditMode ? "p-4 space-y-6" : "flex-1 p-4 space-y-6"} ${isWebApp ? "pt-0" : ""}`}
			>
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

				{/* Action Buttons - conditional based on mode */}
				{!isTelegramEditMode ? (
					/* Regular web mode - show normal buttons */
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
				) : (
					/* Telegram edit mode - minimal interface, MainButton handles save */
					<div className="mx-4 space-y-3">
						<div className="text-center text-[#64748b] text-sm py-4">
							💡 Use the <strong>"Save & Close"</strong> button below to save
							your changes
						</div>

						{/* Debug buttons for testing */}
						<div className="space-y-2">
							<Button
								onClick={handleTestTelegramClose}
								variant="outline"
								className="w-full border-yellow-400 text-yellow-600 hover:bg-yellow-50 rounded-xl py-2 text-xs"
							>
								🧪 Test Telegram Close Flow
							</Button>
							<Button
								onClick={handleTelegramMainButton}
								variant="outline"
								className="w-full border-blue-400 text-blue-600 hover:bg-blue-50 rounded-xl py-2 text-xs"
							>
								🔧 Setup MainButton
							</Button>
						</div>
					</div>
				)}
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
