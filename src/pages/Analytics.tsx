import { ChartLineUp, ChartPie, ChartBar } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';

export const Analytics = () => {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('analytics.description')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartLineUp className="h-5 w-5" />
              {t('analytics.spending_trends')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('analytics.spending_trends_desc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartPie className="h-5 w-5" />
              {t('analytics.category_breakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('analytics.category_breakdown_desc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBar className="h-5 w-5" />
              {t('analytics.budget_analysis')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('analytics.budget_analysis_desc')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 