import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UserRole = 'ADMIN' | 'RISK_MANAGER' | 'OPERATOR' | 'AUDITOR' | 'VIEWER';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  is_2fa_enabled: boolean;
}

export interface UserPermissions {
  canExecuteTrades: boolean;
  canModifyRisk: boolean;
  canRouteTreasury: boolean;
  canEmergencyPause: boolean;
  canViewAuditChain: boolean;
  canManageUsers: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  permissions: UserPermissions;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchRole: (targetRole: UserRole) => Promise<void>;
  prompt2FA: (actionName: string, onVerified: (code: string) => void | Promise<void>) => void;
  pending2FA: { actionName: string; onVerified: (code: string) => void | Promise<void> } | null;
  close2FAModal: () => void;
}

const defaultPermissions: UserPermissions = {
  canExecuteTrades: false,
  canModifyRisk: false,
  canRouteTreasury: false,
  canEmergencyPause: false,
  canViewAuditChain: true,
  canManageUsers: false
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>({
    id: 'usr_admin_01',
    email: 'admin@aegisquant.finance',
    role: 'ADMIN',
    fullName: 'Dr. Evelyn Vance (Chief Risk & System Architect)',
    is_2fa_enabled: true
  });
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pending2FA, setPending2FA] = useState<{ actionName: string; onVerified: (code: string) => void | Promise<void> } | null>(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (e) {
      console.error('Error loading session profile', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string, twoFactorCode?: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, twoFactorCode })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || data.error };
      }
      setUser(data.user);
      setToken(data.token);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    setUser({
      id: 'usr_viewer_05',
      email: 'viewer@aegisquant.finance',
      role: 'VIEWER',
      fullName: 'Institutional LP Viewer',
      is_2fa_enabled: false
    });
    setToken(null);
  };

  const switchRole = async (targetRole: UserRole) => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setToken(data.token);
      }
    } catch (e) {
      console.error('Failed to switch role', e);
    } finally {
      setLoading(false);
    }
  };

  const prompt2FA = (actionName: string, onVerified: (code: string) => void | Promise<void>) => {
    setPending2FA({ actionName, onVerified });
  };

  const close2FAModal = () => {
    setPending2FA(null);
  };

  const currentRole: UserRole = user?.role || 'VIEWER';

  const permissions: UserPermissions = {
    canExecuteTrades: ['ADMIN', 'OPERATOR'].includes(currentRole),
    canModifyRisk: ['ADMIN', 'RISK_MANAGER'].includes(currentRole),
    canRouteTreasury: ['ADMIN', 'RISK_MANAGER'].includes(currentRole),
    canEmergencyPause: ['ADMIN', 'RISK_MANAGER'].includes(currentRole),
    canViewAuditChain: true,
    canManageUsers: currentRole === 'ADMIN'
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: currentRole,
        isAuthenticated: !!user && user.role !== 'VIEWER',
        permissions,
        token,
        loading,
        login,
        logout,
        switchRole,
        prompt2FA,
        pending2FA,
        close2FAModal
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
