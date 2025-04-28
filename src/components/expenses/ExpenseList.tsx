import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@components/ui/table';
import type { components } from '@/types/api-types';

type Expense = components['schemas']['Expense'];

const mockExpenses: Expense[] = [
	{
		id: '1',
		amount: 25.5,
		description: 'Lunch at Cafe',
		categoryId: 'food',
		createdAt: '2024-03-15T00:00:00Z',
		updatedAt: '2024-03-15T00:00:00Z',
		userId: 'user1',
	},
	{
		id: '2',
		amount: 45.0,
		description: 'Monthly Metro Pass',
		categoryId: 'transport',
		createdAt: '2024-03-14T00:00:00Z',
		updatedAt: '2024-03-14T00:00:00Z',
		userId: 'user1',
	},
];

export const ExpenseList = () => {
	const { t } = useTranslation();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('expenses.title')}</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t('expenses.date')}</TableHead>
							<TableHead>{t('expenses.description')}</TableHead>
							<TableHead>{t('expenses.category')}</TableHead>
							<TableHead className="text-right">
								{t('expenses.amount')}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{mockExpenses.map((expense) => (
							<TableRow key={expense.id}>
								<TableCell>
									{format(new Date(expense.createdAt ?? ''), 'MMM dd, yyyy')}
								</TableCell>
								<TableCell>{expense.description}</TableCell>
								<TableCell>{expense.categoryId}</TableCell>
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
