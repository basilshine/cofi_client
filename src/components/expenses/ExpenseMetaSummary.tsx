import type { components } from "@/types/api-types";
import { useTranslation } from "react-i18next";

type ExpenseMetaSummaryProps = {
	expense: components["schemas"]["Expense"];
};

/**
 * Compact vendor + business_meta line(s) for expense list cards when the API includes them.
 */
export const ExpenseMetaSummary = ({ expense }: ExpenseMetaSummaryProps) => {
	const { t } = useTranslation();
	const vendorName = expense.vendor?.name?.trim();
	const invoiceRef = expense.business_meta?.invoice_ref?.trim();
	const notes = expense.business_meta?.notes?.trim();

	if (!vendorName && !invoiceRef && !notes) {
		return null;
	}

	const notesDisplay =
		notes && notes.length > 120 ? `${notes.slice(0, 120)}…` : notes;

	return (
		<div className="mt-1.5 flex flex-col gap-1 border-t border-dashed border-gray-200/80 pt-1.5">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-snug text-[#64748b]">
				{vendorName ? (
					<span className="inline-flex max-w-full items-center rounded-md bg-[#e8f4fa] px-2 py-0.5 font-semibold text-[#1e3a8a]">
						{vendorName}
					</span>
				) : null}
				{invoiceRef ? (
					<span className="text-[#475569]">
						<span className="font-medium text-[#64748b]">
							{t("expenses.listInvoiceShort")}
						</span>
						{invoiceRef}
					</span>
				) : null}
			</div>
			{notes ? (
				<p
					className="line-clamp-2 text-[11px] leading-snug text-[#64748b]"
					title={notes}
				>
					{notesDisplay}
				</p>
			) : null}
		</div>
	);
};
