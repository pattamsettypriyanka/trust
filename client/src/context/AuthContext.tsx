import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types.js';
import { api, getStoredToken, setStoredToken, clearStoredToken } from '../services/api.js';
import { auth } from '../firebase.js';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut
} from 'firebase/auth';

interface AuthContextType {
  user: UserProfile | null;
  token: string;
  isLoading: boolean;
  error: string | null;
  loginWithToken: (token: string) => Promise<void>;
  switchDemoRole: (role: 'admin' | 'owner' | 'viewer') => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
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

  const loginWithGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();
      await loginWithToken(idToken);
    } catch (err: any) {
      console.error('[AuthContext] Google sign-in failed:', err);
      const msg = err.code ? `${err.code}: ${err.message}` : (err as Error).message;
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, pass);
        const idToken = await credential.user.getIdToken();
        await loginWithToken(idToken);
      } catch (fbErr: any) {
        console.warn('[AuthContext] Firebase sign-in failed, checking server auth:', fbErr.message);
        throw fbErr;
      }
    } catch (err: any) {
      console.error('[AuthContext] Email sign-in failed:', err);
      const msg = err.code ? `${err.code}: ${err.message}` : (err as Error).message;
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string, displayName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, pass);
        if (displayName) {
          await updateProfile(credential.user, { displayName });
        }
        const idToken = await credential.user.getIdToken();
        await loginWithToken(idToken);
        if (displayName) {
          await api.updateMyProfile(displayName).catch(() => {});
        }
      } catch (fbErr: any) {
        // If Firebase Auth throws operation-not-allowed or similar, fall back to server registration
        console.warn('[AuthContext] Firebase registration fallback to server:', fbErr.message);
        const regRes = await api.registerUser(email, displayName, pass);
        await loginWithToken(regRes.token);
      }
    } catch (err: any) {
      console.error('[AuthContext] Registration failed:', err);
      const msg = err.code ? `${err.code}: ${err.message}` : (err as Error).message;
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    try {
      firebaseSignOut(auth).catch(() => {});
    } catch {
      // ignore
    }
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
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
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
