import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getStoredToken } from '../services/api';
import { ConfigStatus, UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  configStatus: ConfigStatus | null;
  authRequired: boolean;
  checkStatus: () => Promise<ConfigStatus>;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);

  const checkStatus = async (): Promise<ConfigStatus> => {
    try {
      const status = await api.getStatus();
      setConfigStatus(status);
      return status;
    } catch {
      const fallbackStatus: ConfigStatus = {
        configured: false,
        missingKeys: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
        authRequired: false,
      };
      setConfigStatus(fallbackStatus);
      return fallbackStatus;
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setLoading(true);
      const status = await checkStatus();

      // Only attempt user profile loading if Supabase is configured and auth is required
      if (status.configured && status.authRequired) {
        const token = getStoredToken();
        if (token) {
          try {
            const userData = await api.getMe();
            if (isMounted) setUser(userData);
          } catch {
            if (isMounted) setUser(null);
          }
        }
      }

      if (isMounted) setLoading(false);
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setUser(res.user);
  };

  const signup = async (email: string, pass: string) => {
    const res = await api.signup(email, pass);
    if (res.user && res.session) {
      setUser(res.user);
    }
    return res.message;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const authRequired = Boolean(configStatus?.authRequired);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configStatus,
        authRequired,
        checkStatus,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
