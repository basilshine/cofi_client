import { currencyService } from "@/services/currency";
import type { components } from "@/types/api-types";
import { getEmotionEmoji } from "@/utils/helper";
import { Button } from "@components/ui/button";
import { useAuth } from "@contexts/AuthContext";
import { PencilSimple } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface ExpenseItemCardProps {
	expenseItem: components["schemas"]["ExpenseItem"];
	index: number;
	onEdit: (expenseItem: components["schemas"]["ExpenseItem"]) => void;
}

export const ExpenseItemCard = ({ expenseItem, index, onEdit }: ExpenseItemCardProps) => {
	const { t } = useTranslation();
	const { user } = useAuth();

	const borderColors = [
		"#69b4cd",
		"#f7a35c",
		"#90ed7d",
		"#7cb5ec",
		"#f15c80",
	];
	const borderColor = borderColors[index % borderColors.length];
	const amount = typeof expenseItem.amount === "number" ? expenseItem.amount : 0;

	return (
		<div
			className="bg-white rounded-2xl p-4 shadow-sm border-l-4"
			style={{ borderLeftColor: borderColor }}
		>
			{/* Main Content */}
			<div className="flex items-center gap-4 mb-4">
				{/* Emotion Icon */}
				<div className="text-2xl flex items-center justify-center rounded-lg bg-[#e0f2f7] shrink-0 size-12">
					{getEmotionEmoji(expenseItem?.emotion || "neutral")}
				</div>

				{/* Expense Item Details */}
				<div className="flex-grow">
					<div className="flex justify-between items-center">
						<div className="flex items-center gap-2">
							<p className="text-[#333333] text-base font-bold leading-normal">
								{expenseItem.name || t("expenses.noDescription")}
							</p>
						</div>
						<p className="text-[#333333] text-base font-bold leading-normal">
							{currencyService.formatCurrency(amount, user)}
						</p>
					</div>
					<div className="flex justify-between items-center">
						<p className="text-[#666666] text-sm font-normal leading-normal">
							{expenseItem.category?.name || "Uncategorized"}
						</p>
						<p className="text-[#666666] text-sm font-normal leading-normal">
							{expenseItem.expenseDate
								? format(new Date(expenseItem.expenseDate), "MMM dd")
								: expenseItem.createdAt
									? format(new Date(expenseItem.createdAt), "MMM dd")
									: "Today"}
						</p>
					</div>
					{/* Tags */}
					{expenseItem.tags && expenseItem.tags.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-2">
							{expenseItem.tags.slice(0, 3).map((tag) => (
								<span
									key={tag.id}
									className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
								>
									{tag.name}
								</span>
							))}
							{expenseItem.tags.length > 3 && (
								<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
									+{expenseItem.tags.length - 3} more
								</span>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Action Buttons */}
			<div className="flex justify-end gap-2">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onEdit(expenseItem)}
					className="text-[#666666] hover:text-[#69b4cd]"
				>
					<PencilSimple className="h-6 w-6" />
				</Button>
			</div>
		</div>
	);
};
