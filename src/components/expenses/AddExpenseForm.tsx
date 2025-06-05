import { Button } from "@components/ui/button";
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
import { Minus, Plus } from "@phosphor-icons/react";
import { expensesService } from "@services/api/expenses";
import {
	getTelegramExpenseData,
	notifyTelegramWebApp,
} from "@utils/telegramWebApp";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface ExpenseItem {
	amount: string;
	name: string;
	category: string;
}

interface AddExpenseFormProps {
	onExpenseAdded: () => void;
}

export const AddExpenseForm = ({ onExpenseAdded }: AddExpenseFormProps) => {
	const { t } = useTranslation();
	const [description, setDescription] = useState("");
	const [items, setItems] = useState<ExpenseItem[]>([
		{ amount: "", name: "", category: "" },
	]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Check for pre-filled data from Telegram bot
	useEffect(() => {
		const telegramData = getTelegramExpenseData();
		if (telegramData) {
			if (telegramData.description) {
				setDescription(String(telegramData.description));
			}
			if (telegramData.amount || telegramData.category) {
				setItems([
					{
						amount: telegramData.amount ? String(telegramData.amount) : "",
						name: telegramData.description
							? String(telegramData.description)
							: "",
						category: telegramData.category
							? String(telegramData.category)
							: "",
					},
				]);
			}
		}
	}, []);

	const addItem = () => {
		setItems([...items, { amount: "", name: "", category: "" }]);
	};

	const removeItem = (index: number) => {
		if (items.length > 1) {
			setItems(items.filter((_, i) => i !== index));
		}
	};

	const updateItem = (
		index: number,
		field: keyof ExpenseItem,
		value: string,
	) => {
		const updatedItems = [...items];
		updatedItems[index][field] = value;
		setItems(updatedItems);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			// Validate that all items have required fields
			const validItems = items.filter(
				(item) => item.amount && item.name && item.category,
			);

			if (validItems.length === 0) {
				throw new Error("Please add at least one expense item");
			}

			await expensesService.createExpense({
				amount: validItems.reduce(
					(sum, item) => sum + Number.parseFloat(item.amount),
					0,
				),
				description: description || "Multiple expense items",
				status: "approved",
				items: validItems.map((item) => ({
					amount: Number.parseFloat(item.amount),
					name: item.name,
					category: { id: 1, name: item.category },
				})),
			});

			// Reset form
			setDescription("");
			setItems([{ amount: "", name: "", category: "" }]);
			notifyTelegramWebApp("expense_created");
			onExpenseAdded();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create expense");
		} finally {
			setIsSubmitting(false);
		}
	};

	const categories = [
		"food",
		"transport",
		"entertainment",
		"utilities",
		"shopping",
		"other",
	];

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			{error && <p className="text-sm text-red-500">{error}</p>}

			{/* Expense Description */}
			<div className="space-y-2">
				<Label htmlFor="description">{t("expenses.description")}</Label>
				<Input
					id="description"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder={t("expenses.expenseDescription")}
				/>
			</div>

			<Separator />

			{/* Expense Items */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<Label className="text-base font-semibold">
						{t("expenses.items")} ({items.length})
					</Label>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={addItem}
						className="flex items-center gap-2"
					>
						<Plus className="h-4 w-4" />
						{t("expenses.addItem")}
					</Button>
				</div>

				{items.map((item, index) => (
					<div
						key={`item-${index}-${item.name}`}
						className="p-4 border rounded-lg space-y-3 bg-gray-50"
					>
						<div className="flex items-center justify-between">
							<h4 className="font-medium">
								{t("expenses.item")} {index + 1}
							</h4>
							{items.length > 1 && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => removeItem(index)}
									className="text-red-600 hover:text-red-700"
								>
									<Minus className="h-4 w-4" />
								</Button>
							)}
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
							<div className="space-y-1">
								<Label htmlFor={`item-name-${index}`}>
									{t("expenses.itemName")}
								</Label>
								<Input
									id={`item-name-${index}`}
									value={item.name}
									onChange={(e) => updateItem(index, "name", e.target.value)}
									placeholder={t("expenses.itemNamePlaceholder")}
									required
								/>
							</div>

							<div className="space-y-1">
								<Label htmlFor={`item-amount-${index}`}>
									{t("expenses.amount")}
								</Label>
								<Input
									id={`item-amount-${index}`}
									type="number"
									step="0.01"
									value={item.amount}
									onChange={(e) => updateItem(index, "amount", e.target.value)}
									placeholder="0.00"
									required
								/>
							</div>

							<div className="space-y-1">
								<Label htmlFor={`item-category-${index}`}>
									{t("expenses.category")}
								</Label>
								<Select
									value={item.category}
									onValueChange={(value) =>
										updateItem(index, "category", value)
									}
								>
									<SelectTrigger id={`item-category-${index}`}>
										<SelectValue placeholder={t("expenses.selectCategory")} />
									</SelectTrigger>
									<SelectContent>
										{categories.map((category) => (
											<SelectItem key={category} value={category}>
												{t(`expenses.categories.${category}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>
				))}
			</div>

			<div className="flex items-center justify-between pt-4">
				<div className="text-sm text-muted-foreground">
					{t("expenses.totalItems")}:{" "}
					{
						items.filter((item) => item.amount && item.name && item.category)
							.length
					}
				</div>
				<Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
					{isSubmitting ? t("common.saving") : t("expenses.addExpense")}
				</Button>
			</div>
		</form>
	);
};
