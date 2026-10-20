import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types.js';
import { api, getStoredToken, setStoredToken, clearStoredToken } from '../services/api.js';

interface AuthContextType {
  user: UserProfile | null;
  token: string;
  isLoading: boolean;
  error: string | null;
  loginWithToken: (token: string) => Promise<void>;
  switchDemoRole: (role: 'admin' | 'owner' | 'viewer') => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string>(getStoredToken());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getMe();
      setUser(res.user);
    } catch (err) {
      console.warn('[AuthContext] Failed to load profile:', (err as Error).message);
      setError((err as Error).message);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const loginWithToken = async (newToken: string) => {
    setStoredToken(newToken);
    setTokenState(newToken);
  };

  const switchDemoRole = async (role: 'admin' | 'owner' | 'viewer') => {
    const devToken = `dev_${role}`;
    setStoredToken(devToken);
    setTokenState(devToken);
  };

  const logout = () => {
    clearStoredToken();
    setTokenState('');
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        loginWithToken,
        switchDemoRole,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
