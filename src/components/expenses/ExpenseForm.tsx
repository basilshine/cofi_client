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
import { useState } from "react";

const categories = [
	{ value: "food", label: "Food & Dining" },
	{ value: "transport", label: "Transportation" },
	{ value: "shopping", label: "Shopping" },
	{ value: "entertainment", label: "Entertainment" },
	{ value: "bills", label: "Bills & Utilities" },
	{ value: "other", label: "Other" },
];

export const ExpenseForm = () => {
	const [amount, setAmount] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState("");
	const [date, setDate] = useState<Date | undefined>(new Date());

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// TODO: Implement expense submission
		console.log({ amount, description, category, date });
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="amount">Amount</Label>
				<Input
					id="amount"
					type="number"
					placeholder="0.00"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Input
					id="description"
					placeholder="What did you spend on?"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="category">Category</Label>
				<Select value={category} onValueChange={setCategory}>
					<SelectTrigger>
						<SelectValue placeholder="Select a category" />
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
				<Label>Date</Label>
				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline" className="w-full justify-start">
							<CalendarIcon className="mr-2 h-4 w-4" />
							{date ? format(date, "PPP") : "Pick a date"}
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

			<Button type="submit" className="w-full">
				Add Expense
			</Button>
		</form>
	);
};
