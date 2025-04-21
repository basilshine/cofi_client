import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import WebApp from '@twa-dev/sdk';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: TelegramUser | null;
  error: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!WebApp.initDataUnsafe.user) {
          setAuthState({
            isAuthenticated: false,
            user: null,
            error: 'User not authenticated',
            isLoading: false,
          });
          return;
        }

        const user = WebApp.initDataUnsafe.user;
        setAuthState({
          isAuthenticated: true,
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            photo_url: user.photo_url,
            auth_date: WebApp.initDataUnsafe.auth_date || 0,
            hash: WebApp.initDataUnsafe.hash || '',
          },
          error: null,
          isLoading: false,
        });
      } catch (error) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          error: error instanceof Error ? error.message : 'Authentication failed',
          isLoading: false,
        });
      }
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};

export const useTelegramAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useTelegramAuth must be used within an AuthProvider');
  }
  return context;
}; 