import { Routes, Route } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { Layout } from './layouts/Layout';
import { Home } from './pages/Home';
import { Expenses } from './pages/Expenses';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

function App() {
  const { isWebApp, error } = useTelegram();

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

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default App; 