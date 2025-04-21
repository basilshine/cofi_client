import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData?: string;
        ready: () => void;
        expand: () => void;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
      };
    };
  }
}

export const useTelegram = () => {
  const [isWebApp, setIsWebApp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        setIsWebApp(true);
      }
    } catch (err) {
      setError('Failed to initialize Telegram WebApp');
      console.error('Telegram WebApp initialization error:', err);
    }
  }, []);

  return { isWebApp, error };
}; 