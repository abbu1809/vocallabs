"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';

interface AuthUser {
  id: string;
  email: string;
  display_name?: string;
  token: string;
}

interface OrgMembership {
  org_id: string;
  role: string;
  organization: {
    id: string;
    name: string;
    quota_limit?: number;
    quota_used?: number;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  currentOrg: OrgMembership | null;
  orgs: OrgMembership[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  setCurrentOrg: (org: OrgMembership) => void;
  setOrgs: (orgs: OrgMembership[]) => void;
  createWorkspace: (name: string) => Promise<OrgMembership>;
  userRole: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const FUNCTIONS_URL = typeof window !== 'undefined' ? '/api/backend' : (process.env.NEXT_PUBLIC_FUNCTIONS_URL || 'http://localhost:3001');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentOrg, setCurrentOrg] = useState<OrgMembership | null>(null);
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    const savedOrg = localStorage.getItem('current_org');
    const savedOrgs = localStorage.getItem('user_orgs');

    if (savedToken && savedUser) {
      try {
        const decoded: any = jwtDecode(savedToken);
        if (decoded.exp * 1000 > Date.now()) {
          setUser(JSON.parse(savedUser));
          setToken(savedToken);
          if (savedOrg) setCurrentOrg(JSON.parse(savedOrg));
          if (savedOrgs) setOrgs(JSON.parse(savedOrgs));
        } else {
          localStorage.clear();
        }
      } catch {
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${FUNCTIONS_URL}/api/login-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { email, password } }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }

    const data = await res.json();
    const authUser: AuthUser = {
      id: data.user_id,
      email,
      token: data.token,
    };

    setUser(authUser);
    setToken(data.token);
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(authUser));
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await fetch(`${FUNCTIONS_URL}/api/register-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { email, password, display_name: displayName } }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Registration failed');
    }

    const data = await res.json();
    const authUser: AuthUser = {
      id: data.user_id,
      email,
      display_name: displayName,
      token: data.token,
    };

    setUser(authUser);
    setToken(data.token);
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(authUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setCurrentOrg(null);
    setOrgs([]);
    localStorage.clear();
  }, []);

  const handleSetCurrentOrg = useCallback((org: OrgMembership) => {
    setCurrentOrg(org);
    localStorage.setItem('current_org', JSON.stringify(org));
  }, []);

  const handleSetOrgs = useCallback((newOrgs: OrgMembership[]) => {
    setOrgs(newOrgs);
    localStorage.setItem('user_orgs', JSON.stringify(newOrgs));
    if (!currentOrg && newOrgs.length > 0) {
      handleSetCurrentOrg(newOrgs[0]);
    }
  }, [currentOrg, handleSetCurrentOrg]);

  const createWorkspace = useCallback(async (name: string) => {
    if (!user) throw new Error("User not authenticated");
    const res = await fetch(`${FUNCTIONS_URL}/api/create-organization`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          name,
          user_id: user.id,
          email: user.email,
          display_name: user.display_name,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to create organization");
    }

    const data = await res.json();
    const newMembership: OrgMembership = {
      org_id: data.org_id,
      role: 'owner',
      organization: {
        id: data.org_id,
        name: data.name,
        quota_limit: 100,
        quota_used: 0,
      },
    };

    const updatedOrgs = [...orgs, newMembership];
    setOrgs(updatedOrgs);
    setCurrentOrg(newMembership);
    localStorage.setItem('user_orgs', JSON.stringify(updatedOrgs));
    localStorage.setItem('current_org', JSON.stringify(newMembership));
    return newMembership;
  }, [user, orgs]);

  const userRole = currentOrg?.role || null;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      currentOrg,
      orgs,
      isAuthenticated: !!user && !!token,
      isLoading,
      login,
      register,
      logout,
      setCurrentOrg: handleSetCurrentOrg,
      setOrgs: handleSetOrgs,
      createWorkspace,
      userRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
