import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, getAuthToken } from '@/lib/api-client';

interface User {
  id: number;
  email: string | null;
  username: string;
  fullName: string | null;
  isAdmin: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  session: { user: User } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, username?: string, fullName?: string) => Promise<any>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const guestAuthContext: AuthContextType = {
  user: null,
  session: null,
  loading: false,
  signIn: async () => {
    throw new Error('AuthProvider is not available');
  },
  signUp: async () => {
    throw new Error('AuthProvider is not available');
  },
  signOut: async () => {},
  resetPassword: async () => {
    throw new Error('AuthProvider is not available');
  },
  updatePassword: async () => {
    throw new Error('AuthProvider is not available');
  },
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useOptionalAuth = () => {
  const context = useContext(AuthContext);
  return context ?? guestAuthContext;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ user: User } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }

      try {
        const { user } = await authApi.getCurrentUser();
        setUser(user);
        setSession(user ? { user } : null);
      } catch (error: any) {
        // Check if it's a connection error
        if (error.message?.includes('Backend server is not running')) {
          console.warn('Backend server is not running. Some features may not work.');
          // Don't show error to user, just set no user
        } else if (error.message?.includes('Token expired') || error.message?.includes('Invalid token')) {
          // Token is invalid or expired, clear it
          console.warn('Token expired or invalid, clearing session');
          authApi.signOut();
        }
        // Not authenticated or server error
        setUser(null);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Periodically check if user is still authenticated (every 5 minutes)
    const checkInterval = setInterval(async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const { user: currentUser } = await authApi.getCurrentUser();
          setUser(currentUser);
          setSession({ user: currentUser });
        } catch (error: any) {
          // Token expired or invalid, clear session
          if (error.message?.includes('Token expired') || error.message?.includes('Invalid token')) {
            console.warn('Session expired, logging out');
            authApi.signOut();
            setUser(null);
            setSession(null);
          }
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(checkInterval);
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await authApi.signIn(email, password);
    setUser(data.user);
    setSession({ user: data.user });
    return data;
  };

  const signUp = async (email: string, password: string, username?: string, fullName?: string) => {
    const data = await authApi.signUp(email, password, username, fullName);
    setUser(data.user);
    setSession({ user: data.user });
    return data;
  };

  const signOut = async () => {
    authApi.signOut();
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    return authApi.resetPassword(email);
  };

  const updatePassword = async (password: string) => {
    return authApi.updatePassword(password);
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
