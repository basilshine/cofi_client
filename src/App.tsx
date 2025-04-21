import { Routes, Route, Navigate } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { AuthProvider, useTelegramAuth } from '@hooks/useTelegramAuth';
import { Layout } from './layouts/Layout';
import { Promo } from './pages/Promo';
import { Home } from './pages/Home';
import { Expenses } from '@pages/Expenses';
import { Analytics } from '@pages/Analytics';
import { Settings } from '@pages/Settings';
import { Button } from '@components/ui/button';
import './i18n/config';

function AppContent() {
  const { isWebApp, error } = useTelegram();
  const { isAuthenticated, isLoading, error: authError } = useTelegramAuth();

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500">Error</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Promo />} />
      
      {/* Protected routes */}
      <Route
        path="/dashboard/*"
        element={
          isAuthenticated ? (
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* Auth routes */}
      <Route
        path="/login"
        element={
          !isAuthenticated ? (
            <div className="flex min-h-screen items-center justify-center">
              <div className="text-center space-y-4">
                <h1 className="text-2xl font-bold text-red-500">Authentication Required</h1>
                <p className="mt-2 text-muted-foreground">
                  {authError || 'Please login with Telegram to continue'}
                </p>
                <div className="space-y-2">
                  {isWebApp ? (
                    <Button
                      onClick={() => {
                        if (window.Telegram?.WebApp) {
                          window.Telegram.WebApp.expand();
                          window.Telegram.WebApp.ready();
                        }
                      }}
                      className="w-full"
                    >
                      Open in Telegram
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        const botId = '7148755509'; // Your bot ID
                        const redirectUrl = window.location.href;
                        window.location.href = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(redirectUrl)}`;
                      }}
                      className="w-full"
                    >
                      Login with Telegram
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {isWebApp
                      ? 'This app works best when opened in Telegram'
                      : 'You will be redirected to Telegram for authentication'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App; 