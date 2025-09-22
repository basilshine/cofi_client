import { apiService } from "@/services/api";
import type { components } from "@/types/api-types";
import { LoadingScreen } from "@components/LoadingScreen";
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
import { useAuth } from "@contexts/AuthContext";
import {
	ArrowLeft,
	Calendar,
	CurrencyDollar,
	Repeat,
	Tag,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTelegramWebApp } from "@utils/isTelegramWebApp";
import {
	notifyCancelAndClose,
	notifyExpenseSavedAndClose,
} from "@utils/telegramWebApp";
import LogRocket from "logrocket";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export const RecurringExpenseEdit = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { isAuthenticated, user } = useAuth();
	const [formData, setFormData] = useState<
		Partial<components["schemas"]["RecurringExpense"]>
	>({
		name: "",
		amount: 0,
		interval: "monthly",
		startDate: new Date().toISOString().split("T")[0], // Today's date in YYYY-MM-DD format
		categoryId: undefined,
		category: undefined,
	});
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});

	// Determine if this is edit mode (has ID)
	const isEditMode = !!id;
	const isWebApp = isTelegramWebApp();

	// Fetch recurring expense for edit mode
	const {
		data: recurringExpense,
		isLoading,
		error,
	} = useQuery<components["schemas"]["RecurringExpense"], Error>({
		queryKey: ["recurring", "expense", id],
		queryFn: () => {
			LogRocket.log("[RecurringExpenseEdit] useQuery.queryFn", { id });
			if (!id) throw new Error("No recurring expense ID provided");
			return apiService.recurring.getById(id).then((res) => {
				LogRocket.log(
					"[RecurringExpenseEdit] useQuery.queryFn result",
					res.data,
				);
				return res.data;
			});
		},
		enabled: isEditMode,
	});

	// Fetch user categories
	const { data: categories = [] } = useQuery<
		components["schemas"]["Category"][]
	>({
		queryKey: ["categories", "user"],
		queryFn: () => {
			LogRocket.log("[RecurringExpenseEdit] getUserCategories queryFn");
			return apiService.categories.list().then((res) => {
				LogRocket.log(
					"[RecurringExpenseEdit] getUserCategories result",
					res.data,
				);
				return res.data;
			});
		},
		enabled: isAuthenticated,
	});

	// Initialize form data when recurring expense data is available
	useEffect(() => {
		if (isEditMode && recurringExpense) {
			setFormData({
				name: recurringExpense.name || "",
				amount: recurringExpense.amount || 0,
				interval: recurringExpense.interval || "monthly",
				startDate: recurringExpense.startDate
					? new Date(recurringExpense.startDate).toISOString().split("T")[0]
					: new Date().toISOString().split("T")[0],
				categoryId: recurringExpense.categoryId,
				category: recurringExpense.category,
			});
		}
	}, [recurringExpense, isEditMode]);

	const updateMutation = useMutation({
		mutationFn: (data: Partial<components["schemas"]["RecurringExpense"]>) => {
			LogRocket.log("[RecurringExpenseEdit] updateMutation.mutationFn", {
				id,
				data,
			});
			if (!id) throw new Error("No recurring expense ID provided");
			return apiService.recurring.update(id, data).then((res) => {
				LogRocket.log("[RecurringExpenseEdit] updateMutation result", res.data);
				return res.data;
			});
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["recurring"] });
			if (isWebApp) {
				notifyExpenseSavedAndClose({
					totalAmount: data.amount || 0,
					itemsCount: 1,
					status: "scheduled",
				});
			} else {
				navigate("/expenses");
			}
		},
		onError: (error) => {
			LogRocket.error("[RecurringExpenseEdit] updateMutation error", error);
			console.error("Failed to update recurring expense:", error);
		},
	});

	const createMutation = useMutation({
		mutationFn: (data: components["schemas"]["RecurringExpense"]) => {
			LogRocket.log("[RecurringExpenseEdit] createMutation.mutationFn", data);
			return apiService.recurring.create(data).then((res) => {
				LogRocket.log("[RecurringExpenseEdit] createMutation result", res.data);
				return res.data;
			});
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["recurring"] });
			if (isWebApp) {
				notifyExpenseSavedAndClose({
					totalAmount: data.amount || 0,
					itemsCount: 1,
					status: "scheduled",
				});
			} else {
				navigate("/expenses");
			}
		},
		onError: (error) => {
			LogRocket.error("[RecurringExpenseEdit] createMutation error", error);
			console.error("Failed to create recurring expense:", error);
		},
	});

	const validateForm = (): boolean => {
		const errors: Record<string, string> = {};

		if (!formData.name?.trim()) {
			errors.name = "Name is required";
		}

		if (!formData.amount || formData.amount <= 0) {
			errors.amount = "Amount must be greater than 0";
		}

		if (!formData.interval) {
			errors.interval = "Interval is required";
		}

		if (!formData.startDate) {
			errors.startDate = "Start date is required";
		}

		if (!formData.categoryId) {
			errors.category = "Category is required";
		}

		setFormErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleSave = () => {
		if (!validateForm()) {
			return;
		}

		const saveData: components["schemas"]["RecurringExpense"] = {
			...formData,
			userId: Number(user?.id),
			chatId: 0, // Default chat ID for web app
		} as components["schemas"]["RecurringExpense"];

		if (isEditMode) {
			updateMutation.mutate(saveData);
		} else {
			createMutation.mutate(saveData);
		}
	};

	const handleCancel = () => {
		if (isWebApp) {
			notifyCancelAndClose();
		} else {
			navigate("/expenses");
		}
	};

	const handleInputChange = (
		field: keyof components["schemas"]["RecurringExpense"],
		value: string | number | components["schemas"]["Category"] | undefined,
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		// Clear field error when user starts typing
		if (formErrors[field]) {
			setFormErrors((prev) => ({ ...prev, [field]: "" }));
		}
	};

	// Show loading state while checking authentication
	if (!isAuthenticated) {
		return <LoadingScreen />;
	}

	if (isEditMode && isLoading) {
		return <LoadingScreen />;
	}

	if (isEditMode && error) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen">
				<p className="text-red-500 mb-4">Failed to load recurring expense</p>
				<Button onClick={() => navigate("/expenses")}>Go Back</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-screen bg-[#f8f8f8]">
			{/* Header */}
			<header className="bg-white shadow-sm border-b border-gray-200 p-4">
				<div className="flex items-center gap-4">
					<Button
						variant="ghost"
						onClick={handleCancel}
						className="text-[#47c1ea] hover:bg-[#e0f2f7] p-2"
					>
						<ArrowLeft size={24} />
					</Button>
					<h1 className="text-xl font-semibold text-[#1e3a8a]">
						{isEditMode ? "Edit Schedule" : "Create Schedule"}
					</h1>
				</div>
			</header>

			{/* Main Content */}
			<main className="flex-1 p-4 space-y-6">
				{/* Schedule Details Card */}
				<Card className="bg-white rounded-xl shadow-sm">
					<CardHeader>
						<CardTitle className="text-[#1e3a8a] flex items-center gap-2">
							<Repeat size={20} />
							Schedule Details
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Name Field */}
						<div>
							<Label
								htmlFor="name"
								className="text-[#64748b] text-sm font-medium"
							>
								Schedule Name
							</Label>
							<Input
								id="name"
								value={formData.name || ""}
								onChange={(e) => handleInputChange("name", e.target.value)}
								placeholder="e.g., Monthly Rent, Netflix Subscription"
								className="bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]"
							/>
							{formErrors.name && (
								<p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
							)}
						</div>

						{/* Amount Field */}
						<div>
							<Label
								htmlFor="amount"
								className="text-[#64748b] text-sm font-medium"
							>
								Amount
							</Label>
							<div className="relative">
								<CurrencyDollar
									className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#64748b]"
									size={16}
								/>
								<Input
									id="amount"
									type="number"
									step="0.01"
									min="0"
									value={formData.amount || ""}
									onChange={(e) =>
										handleInputChange(
											"amount",
											Number.parseFloat(e.target.value) || 0,
										)
									}
									placeholder="0.00"
									className="pl-10 bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]"
								/>
							</div>
							{formErrors.amount && (
								<p className="text-red-500 text-xs mt-1">{formErrors.amount}</p>
							)}
						</div>

						{/* Category Field */}
						<div>
							<Label
								htmlFor="category"
								className="text-[#64748b] text-sm font-medium"
							>
								Category
							</Label>
							<Select
								value={formData.category?.name || ""}
								onValueChange={(value) => {
									const selectedCategory = categories.find(
										(cat) => cat.name === value,
									);
									handleInputChange("categoryId", selectedCategory?.id);
									handleInputChange("category", selectedCategory);
								}}
							>
								<SelectTrigger className="bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]">
									<div className="flex items-center gap-2">
										<Tag size={16} className="text-[#64748b]" />
										<SelectValue placeholder="Select category" />
									</div>
								</SelectTrigger>
								<SelectContent>
									{categories.map((category) => (
										<SelectItem key={category.id} value={category.name || ""}>
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
							{formErrors.category && (
								<p className="text-red-500 text-xs mt-1">
									{formErrors.category}
								</p>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Schedule Settings Card */}
				<Card className="bg-white rounded-xl shadow-sm">
					<CardHeader>
						<CardTitle className="text-[#1e3a8a] flex items-center gap-2">
							<Calendar size={20} />
							Schedule Settings
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Interval Field */}
						<div>
							<Label
								htmlFor="interval"
								className="text-[#64748b] text-sm font-medium"
							>
								Frequency
							</Label>
							<Select
								value={formData.interval || "monthly"}
								onValueChange={(value) => handleInputChange("interval", value)}
							>
								<SelectTrigger className="bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]">
									<div className="flex items-center gap-2">
										<Repeat size={16} className="text-[#64748b]" />
										<SelectValue placeholder="Select frequency" />
									</div>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="daily">Daily</SelectItem>
									<SelectItem value="weekly">Weekly</SelectItem>
									<SelectItem value="monthly">Monthly</SelectItem>
									<SelectItem value="yearly">Yearly</SelectItem>
								</SelectContent>
							</Select>
							{formErrors.interval && (
								<p className="text-red-500 text-xs mt-1">
									{formErrors.interval}
								</p>
							)}
						</div>

						{/* Start Date Field */}
						<div>
							<Label
								htmlFor="startDate"
								className="text-[#64748b] text-sm font-medium"
							>
								Start Date
							</Label>
							<div className="relative">
								<Calendar
									className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#64748b]"
									size={16}
								/>
								<Input
									id="startDate"
									type="date"
									value={formData.startDate || ""}
									onChange={(e) =>
										handleInputChange("startDate", e.target.value)
									}
									className="pl-10 bg-[#f8fafc] border-gray-200 focus:border-[#47c1ea] focus:ring-[#47c1ea] text-[#1e3a8a]"
								/>
							</div>
							{formErrors.startDate && (
								<p className="text-red-500 text-xs mt-1">
									{formErrors.startDate}
								</p>
							)}
						</div>

						{/* Next Run Preview */}
						{formData.startDate && formData.interval && (
							<div className="bg-[#e0f2f7] rounded-lg p-3">
								<p className="text-[#64748b] text-sm font-medium mb-1">
									Next Payment
								</p>
								<p className="text-[#1e3a8a] text-sm">
									{(() => {
										const startDate = new Date(formData.startDate);
										const nextDate = new Date(startDate);

										switch (formData.interval) {
											case "daily":
												nextDate.setDate(nextDate.getDate() + 1);
												break;
											case "weekly":
												nextDate.setDate(nextDate.getDate() + 7);
												break;
											case "monthly":
												nextDate.setMonth(nextDate.getMonth() + 1);
												break;
											case "yearly":
												nextDate.setFullYear(nextDate.getFullYear() + 1);
												break;
										}

										return nextDate.toLocaleDateString();
									})()}
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Action Buttons */}
				<div className="flex gap-4 pb-8">
					<Button
						onClick={handleSave}
						disabled={updateMutation.isPending || createMutation.isPending}
						className="flex-1 bg-[#47c1ea] hover:bg-[#3ba3c7] text-white rounded-xl py-3"
					>
						{updateMutation.isPending || createMutation.isPending
							? "Saving..."
							: isEditMode
								? "Update Schedule"
								: "Create Schedule"}
					</Button>
					<Button
						onClick={handleCancel}
						variant="outline"
						className="flex-1 border-[#47c1ea] text-[#47c1ea] hover:bg-[#e0f2f7] rounded-xl py-3"
					>
						Cancel
					</Button>
				</div>
			</main>
		</div>
	);
};
