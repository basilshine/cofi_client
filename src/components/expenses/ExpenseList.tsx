import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';

interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: Date;
}

const mockExpenses: Expense[] = [
  {
    id: '1',
    amount: 25.50,
    description: 'Lunch at Cafe',
    category: 'food',
    date: new Date('2024-03-15'),
  },
  {
    id: '2',
    amount: 45.00,
    description: 'Monthly Metro Pass',
    category: 'transport',
    date: new Date('2024-03-14'),
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
              <TableHead className="text-right">{t('expenses.amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockExpenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>{format(expense.date, 'MMM dd, yyyy')}</TableCell>
                <TableCell>{expense.description}</TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell className="text-right">
                  ${expense.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}; 