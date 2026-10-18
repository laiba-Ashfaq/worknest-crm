import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';
import { User, Workspace } from '../types';

interface AuthContextType {
  user: User | null;
  workspaces: any[];
  activeWorkspace: any | null;
  activeMembershipId: string | null;
  myAvailability: string;
  permissions: string[];
  isLoading: boolean;
  login: (token: string, userData: User, workspacesData: any[], activeWs: any) => void;
  logout: () => void;
  switchWorkspace: (workspaceId: string) => void;
  updateMyAvailability: (status: 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'OFFLINE', reason?: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<any | null>(null);
  const [activeMembershipId, setActiveMembershipId] = useState<string | null>(null);
  const [myAvailability, setMyAvailability] = useState<string>('AVAILABLE');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = async () => {
    const token = localStorage.getItem('worknest_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setWorkspaces(res.data.workspaces || []);

      const savedWsId = localStorage.getItem('worknest_workspace_id');
      const found = res.data.workspaces?.find((w: any) => w.workspaceId === savedWsId) || res.data.workspaces?.[0];

      if (found) {
        setActiveWorkspace(found);
        setActiveMembershipId(found.membershipId);
        setMyAvailability(found.availability || 'AVAILABLE');
        setPermissions(found.permissions || []);
        localStorage.setItem('worknest_workspace_id', found.workspaceId);
      }

      getSocket();
    } catch (err) {
      console.error('Session refresh failed:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = (token: string, userData: User, workspacesData: any[], activeWs: any) => {
    localStorage.setItem('worknest_token', token);
    setUser(userData);
    setWorkspaces(workspacesData);

    const targetWs = activeWs || workspacesData[0];
    if (targetWs) {
      setActiveWorkspace(targetWs);
      setActiveMembershipId(targetWs.membershipId);
      setMyAvailability(targetWs.availability || 'AVAILABLE');
      localStorage.setItem('worknest_workspace_id', targetWs.workspaceId);
    }

    getSocket();
  };

  const logout = () => {
    localStorage.removeItem('worknest_token');
    localStorage.removeItem('worknest_workspace_id');
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    setActiveMembershipId(null);
    disconnectSocket();
  };

  const switchWorkspace = (workspaceId: string) => {
    const found = workspaces.find((w) => w.workspaceId === workspaceId);
    if (found) {
      setActiveWorkspace(found);
      setActiveMembershipId(found.membershipId);
      setMyAvailability(found.availability || 'AVAILABLE');
      setPermissions(found.permissions || []);
      localStorage.setItem('worknest_workspace_id', found.workspaceId);

      const socket = getSocket();
      socket?.emit('join_workspace', { workspaceId: found.workspaceId });

      window.location.reload(); // Clean state refresh for selected workspace
    }
  };

  const updateMyAvailability = async (status: 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'OFFLINE', reason?: string) => {
    if (!activeMembershipId || !activeWorkspace) return;

    try {
      await api.put(`/workspaces/members/${activeMembershipId}/availability`, {
        availability: status,
        reason,
      });

      setMyAvailability(status);
      setWorkspaces((prev) =>
        prev.map((w) => (w.membershipId === activeMembershipId ? { ...w, availability: status } : w))
      );
    } catch (err: any) {
      console.error('Failed to update availability:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        activeWorkspace,
        activeMembershipId,
        myAvailability,
        permissions,
        isLoading,
        login,
        logout,
        switchWorkspace,
        updateMyAvailability,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
