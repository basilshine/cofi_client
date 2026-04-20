import { currencyService } from "@/services/currency";
import type { components } from "@/types/api-types";
import { formatItemTagLabel } from "@/utils/expenseTags";
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

export const ExpenseItemCard = ({
	expenseItem,
	index,
	onEdit,
}: ExpenseItemCardProps) => {
	const { t } = useTranslation();
	const { user } = useAuth();

	const borderColors = ["#69b4cd", "#f7a35c", "#90ed7d", "#7cb5ec", "#f15c80"];
	const borderColor = borderColors[index % borderColors.length];
	const amount =
		typeof expenseItem.amount === "number" ? expenseItem.amount : 0;

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
							{formatItemTagLabel(expenseItem)}
						</p>
						<p className="text-[#666666] text-sm font-normal leading-normal">
							{expenseItem.expense_date
								? format(new Date(expenseItem.expense_date), "MMM dd")
								: expenseItem.created_at
									? format(new Date(expenseItem.created_at), "MMM dd")
									: "Today"}
						</p>
					</div>
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
