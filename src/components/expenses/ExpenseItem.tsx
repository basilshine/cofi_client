import { currencyService } from "@/services/currency";
import type { components } from "@/types/api-types";
import { getEmotionEmoji } from "@/utils/helper";
import { Button } from "@components/ui/button";
import { useAuth } from "@contexts/AuthContext";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

interface ExpenseItemProps {
	expense: components["schemas"]["Expense"];
	index: number;
	onDelete: (id: string, description: string) => void;
	isDeleting: boolean;
}

export const ExpenseItem = ({
	expense,
	index,
	onDelete,
	isDeleting,
}: ExpenseItemProps) => {
	const { t } = useTranslation();
	const { user } = useAuth();

	const borderColors = ["#69b4cd", "#f7a35c", "#90ed7d", "#7cb5ec", "#f15c80"];
	const borderColor = borderColors[index % borderColors.length];
	const mainItem = expense.items?.[0];
	const itemsCount = expense.items?.length || 0;
	const totalAmount = typeof expense.amount === "number" ? expense.amount : 0;

	return (
		<div
			className="bg-white rounded-2xl p-4 shadow-sm border-l-4"
			style={{ borderLeftColor: borderColor }}
		>
			{/* Main Content */}
			<div className="flex items-center gap-4 mb-4">
				{/* Emotion Icon */}
				<div className="text-2xl flex items-center justify-center rounded-lg bg-[#e0f2f7] shrink-0 size-12">
					{getEmotionEmoji(mainItem?.emotion || "neutral")}
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
							{currencyService.formatCurrency(totalAmount, user)}
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
					{currencyService.formatCurrency(totalAmount, user)} total
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
							onDelete(
								(expense.id ?? "").toString(),
								expense.description || "expense",
							)
						}
						disabled={isDeleting}
						className="text-red-400 hover:text-red-600"
					>
						<Trash className="h-6 w-6" />
					</Button>
				)}
			</div>
		</div>
	);
};
