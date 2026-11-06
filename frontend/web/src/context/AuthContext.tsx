import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, RoleName } from '../types';
import { AuthService } from '../services';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: RoleName) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    const token = sessionStorage.getItem('ecoflow_access_token');
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const data: any = await AuthService.getMe();
      const profile: UserProfile = {
        id: data.userId || data.id,
        email: data.email,
        firstName: data.firstName || data.first_name || (data.email ? data.email.split('@')[0] : 'User'),
        lastName: data.lastName || data.last_name || '',
        roles: data.roles || [],
        permissions: data.permissions || [],
      };
      setUser(profile);
    } catch (err) {
      setUser(null);
      sessionStorage.removeItem('ecoflow_access_token');
      sessionStorage.removeItem('ecoflow_refresh_token');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    const handleSessionExpired = () => {
      setUser(null);
    };

    window.addEventListener('ecoflow:auth:session_expired', handleSessionExpired);
    return () => {
      window.removeEventListener('ecoflow:auth:session_expired', handleSessionExpired);
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const data = await AuthService.login(credentials);
      sessionStorage.setItem('ecoflow_access_token', data.accessToken);
      if (data.refreshToken) {
        sessionStorage.setItem('ecoflow_refresh_token', data.refreshToken);
      }
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { email: string; password: string; firstName: string; lastName: string }) => {
    setIsLoading(true);
    try {
      await AuthService.register(data);
      await login({ email: data.email, password: data.password });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await AuthService.logout();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const hasRole = (role: RoleName): boolean => {
    if (!user || !user.roles) return false;
    return user.roles.includes(role);
  };

  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false;
    if (user.permissions.includes('admin:all')) return true;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        hasRole,
        hasPermission,
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

