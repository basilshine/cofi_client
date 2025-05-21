import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@components/ui/table";
import { expensesService } from "@services/api/expenses";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export const ExpenseList = () => {
	const { t } = useTranslation();

	const {
		data: expenses,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["expenses"],
		queryFn: () => expensesService.getExpenses(),
	});

	if (isLoading) return <div>{t("common.loading")}</div>;
	if (error) return <div>{t("common.error")}</div>;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("expenses.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("expenses.date")}</TableHead>
							<TableHead>{t("expenses.description")}</TableHead>
							<TableHead>{t("expenses.category")}</TableHead>
							<TableHead className="text-right">
								{t("expenses.amount")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{expenses?.map((expense) => (
							<TableRow key={expense.id}>
								<TableCell>
									{format(new Date(expense.date ?? ""), "MMM dd, yyyy")}
								</TableCell>
								<TableCell>{expense.description}</TableCell>
								<TableCell>{expense.category}</TableCell>
								<TableCell className="text-right">
									${expense.amount?.toFixed(2)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
};
