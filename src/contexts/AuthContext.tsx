import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import WebApp from '@twa-dev/sdk';
import { apiService } from '@services/api';
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  telegramId?: number;
  telegramUsername?: string;
  telegramPhotoUrl?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isWebApp: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName?: string) => Promise<void>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  handleTelegramAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: false,
    isLoading: true,
    error: null,
    isWebApp: WebApp.platform !== 'unknown',
  });

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            isLoading: false,
          }));
        }
      } catch (error) {
        logout();
      }
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const response = await apiService.auth.login({ email, password });

      localStorage.setItem('token', response.data.token);
      setState({
        ...state,
        user: response.data.user,
        token: response.data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      navigate('/dashboard');
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
    }
  };

  const register = async (email: string, password: string, firstName: string, lastName?: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const response = await apiService.auth.register({ email, password, name: firstName + ' ' + lastName });

      localStorage.setItem('token', response.data.token);
      setState({
        ...state,
        user: response.data.user,
        token: response.data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      navigate('/dashboard');
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      }));
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isWebApp: state.isWebApp,
    });
    navigate('/');
  };

  const requestPasswordReset = async (email: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const response = await apiService.auth.requestPasswordReset({ email });

      if (!response.ok) {
        throw new Error('Failed to request password reset');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Request failed',
      }));
    }
  };

  const resetPassword = async (token: string, newPassword: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const response = await apiService.auth.resetPassword({ token, newPassword });

      if (!response.ok) {
        throw new Error('Failed to reset password');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Reset failed',
      }));
    }
  };

  const handleTelegramAuth = () => {
    if (state.isWebApp) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.expand();
        window.Telegram.WebApp.ready();
      }
    } else {
      const botId = '7148755509'; // Your bot ID
      const redirectUrl = window.location.href;
      window.location.href = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(redirectUrl)}`;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        requestPasswordReset,
        resetPassword,
        handleTelegramAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 