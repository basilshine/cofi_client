import { ChartLineUp, ChartPie, ChartBar } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';

export const Analytics = () => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Get insights into your spending patterns and financial trends.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ChartLineUp className="h-5 w-5 text-primary" />
              <CardTitle>Spending Trends</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View your spending patterns over time.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ChartPie className="h-5 w-5 text-primary" />
              <CardTitle>Category Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              See how your expenses are distributed across categories.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ChartBar className="h-5 w-5 text-primary" />
              <CardTitle>Budget Analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Compare your spending against your budget.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 