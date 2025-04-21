import { Button } from '@components/ui/button';
import { useTelegramAuth } from '@hooks/useTelegramAuth';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export const Promo = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useTelegramAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-semibold">{t('app.name')}</h1>
          {isAuthenticated ? (
            <Button asChild>
              <Link to="/dashboard">{t('nav.dashboard')}</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/login">{t('nav.login')}</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <section className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold">{t('promo.title')}</h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t('promo.description')}
          </p>
        </section>

        <section className="grid gap-8 md:grid-cols-3">
          <div className="rounded-lg border p-6">
            <h3 className="mb-2 text-xl font-semibold">{t('promo.features.1.title')}</h3>
            <p className="text-muted-foreground">{t('promo.features.1.description')}</p>
          </div>
          <div className="rounded-lg border p-6">
            <h3 className="mb-2 text-xl font-semibold">{t('promo.features.2.title')}</h3>
            <p className="text-muted-foreground">{t('promo.features.2.description')}</p>
          </div>
          <div className="rounded-lg border p-6">
            <h3 className="mb-2 text-xl font-semibold">{t('promo.features.3.title')}</h3>
            <p className="text-muted-foreground">{t('promo.features.3.description')}</p>
          </div>
        </section>

        <section className="mt-16 text-center">
          <Button size="lg" asChild>
            <Link to={isAuthenticated ? '/dashboard' : '/login'}>
              {isAuthenticated ? t('nav.dashboard') : t('nav.get_started')}
            </Link>
          </Button>
        </section>
      </main>
    </div>
  );
}; 