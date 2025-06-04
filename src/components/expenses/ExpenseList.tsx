import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@components/ui/table";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import type { Expense } from "@services/api/expenses";
import { expensesService } from "@services/api/expenses";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export const ExpenseList = () => {
	const { t } = useTranslation();
	const queryClient = useQueryClient();

	const {
		data: expenses,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["expenses"],
		queryFn: () => expensesService.getExpenses(),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => expensesService.deleteExpense(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["expenses"] });
		},
		onError: (error) => {
			console.error('Failed to delete expense:', error);
		},
	});

	const handleDelete = (id: string, description: string) => {
		if (window.confirm(t('expenses.confirmDelete', { description }))) {
			deleteMutation.mutate(id);
		}
	};

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
							<TableHead>{t("expenses.items")}</TableHead>
							<TableHead>{t("expenses.status")}</TableHead>
							<TableHead className="text-right">
								{t("expenses.amount")}
							</TableHead>
							<TableHead className="text-right">
								{t("common.actions")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{expenses?.map((expense: Expense) => (
							<TableRow key={expense.id}>
								<TableCell>
									{expense.createdAt ? format(new Date(expense.createdAt), "MMM dd, yyyy") : '-'}
								</TableCell>
								<TableCell>
									{expense.description || t('expenses.noDescription')}
								</TableCell>
								<TableCell>
									<div className="flex flex-col gap-1">
										{expense.items?.slice(0, 2).map((item, index) => (
											<div key={index} className="text-xs text-muted-foreground">
												{item.name} - ${item.amount.toFixed(2)}
												{item.emotion && <span className="ml-1">{item.emotion}</span>}
											</div>
										))}
										{expense.items && expense.items.length > 2 && (
											<div className="text-xs text-muted-foreground">
												+{expense.items.length - 2} {t('expenses.moreItems')}
											</div>
										)}
									</div>
								</TableCell>
								<TableCell>
									<span className={`px-2 py-1 text-xs rounded-full ${
										expense.status === 'draft' 
											? 'bg-yellow-100 text-yellow-800' 
											: expense.status === 'approved'
											? 'bg-green-100 text-green-800'
											: 'bg-gray-100 text-gray-800'
									}`}>
										{expense.status || 'unknown'}
									</span>
								</TableCell>
								<TableCell className="text-right">
									${expense.amount?.toFixed(2) || '0.00'}
								</TableCell>
								<TableCell className="text-right">
									<div className="flex items-center justify-end gap-2">
										<Button
											variant="ghost"
											size="sm"
											asChild
										>
											<Link to={`/expenses/${expense.id}/edit`}>
												<PencilSimple className="h-4 w-4" />
											</Link>
										</Button>
										{expense.status !== 'draft' && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleDelete(expense.id, expense.description || 'expense')}
												disabled={deleteMutation.isPending}
											>
												<Trash className="h-4 w-4" />
											</Button>
										)}
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
};
