import { Button } from "@components/ui/button";
import { Calendar } from "@components/ui/calendar";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@components/ui/select";
import { Calendar as CalendarIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const categories = [
	{ value: "food", label: "Food & Dining" },
	{ value: "transport", label: "Transportation" },
	{ value: "shopping", label: "Shopping" },
	{ value: "entertainment", label: "Entertainment" },
	{ value: "bills", label: "Bills & Utilities" },
	{ value: "other", label: "Other" },
];

interface ExpenseFormData {
	amount: number;
	description: string;
	category: string;
	date: string;
}

interface ExpenseFormProps {
	initialData?: Partial<ExpenseFormData>;
	onSubmit: (data: ExpenseFormData) => void;
	isLoading?: boolean;
	submitButtonText?: string;
}

export const ExpenseForm = ({ 
	initialData, 
	onSubmit, 
	isLoading = false,
	submitButtonText 
}: ExpenseFormProps) => {
	const { t } = useTranslation();
	const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
	const [description, setDescription] = useState(initialData?.description || "");
	const [category, setCategory] = useState(initialData?.category || "");
	const [date, setDate] = useState<Date | undefined>(
		initialData?.date ? new Date(initialData.date) : new Date()
	);

	// Update form when initialData changes
	useEffect(() => {
		if (initialData) {
			setAmount(initialData.amount?.toString() || "");
			setDescription(initialData.description || "");
			setCategory(initialData.category || "");
			setDate(initialData.date ? new Date(initialData.date) : new Date());
		}
	}, [initialData]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		
		if (!date) return;

		const formData: ExpenseFormData = {
			amount: parseFloat(amount),
			description,
			category,
			date: date.toISOString(),
		};

		onSubmit(formData);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="amount">{t("expenses.amount")}</Label>
				<Input
					id="amount"
					type="number"
					step="0.01"
					placeholder="0.00"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="description">{t("expenses.description")}</Label>
				<Input
					id="description"
					placeholder={t("expenses.descriptionPlaceholder")}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="category">{t("expenses.category")}</Label>
				<Select value={category} onValueChange={setCategory}>
					<SelectTrigger>
						<SelectValue placeholder={t("expenses.selectCategory")} />
					</SelectTrigger>
					<SelectContent>
						{categories.map((cat) => (
							<SelectItem key={cat.value} value={cat.value}>
								{cat.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<Label>{t("expenses.date")}</Label>
				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline" className="w-full justify-start">
							<CalendarIcon className="mr-2 h-4 w-4" />
							{date ? format(date, "PPP") : t("expenses.pickDate")}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0">
						<Calendar
							mode="single"
							selected={date}
							onSelect={setDate}
							initialFocus
						/>
					</PopoverContent>
				</Popover>
			</div>

			<Button type="submit" className="w-full" disabled={isLoading}>
				{isLoading ? t("common.saving") : (submitButtonText || t("expenses.addExpense"))}
			</Button>
		</form>
	);
};
