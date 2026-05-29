import { create } from 'zustand';

import { useChatStore } from './useChatStore';

// ----------------------------------------------------------------------

interface User {
  _id?: string;
  id?: string;
  name: string;
  username: string;
  avatar: string;
  mobile?: string;
  role?: string;
  blockedUsers?: string[];
  accessToken?: string;
  privacy?: {
    lastSeen?: string;
    profilePhoto?: string;
    about?: string;
    readReceipts?: boolean;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string, isFreshLogin?: boolean) => void;
  updateUser: (updatedUser: Partial<User>) => void;
  logout: () => void;
  toggleBlockUser: (userId: string, isBlocked: boolean) => void;
}

// ----------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,

  setAuth: (user, token, isFreshLogin = false) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    if (isFreshLogin) {
      try {
        sessionStorage.removeItem('activeChatId');
      } catch (e) {
        console.error('Failed to remove activeChatId:', e);
      }
      useChatStore.getState().resetStore();
    }
    set({ user, token });
  },

  updateUser: (updatedUser) =>
    set((state) => {
      const newUser = state.user ? { ...state.user, ...updatedUser } : null;
      if (newUser) {
        localStorage.setItem('user', JSON.stringify(newUser));
      }
      return { user: newUser };
    }),

  logout: () => {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    // Clear sessionStorage
    try {
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear sessionStorage:', e);
    }

    // Clear cookies
    try {
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });
    } catch (e) {
      console.error('Failed to clear cookies:', e);
    }

    try {
      useChatStore.getState().resetStore();
    } catch (e) {
      console.error('Failed to reset chat store on logout:', e);
    }

    set({ user: null, token: null });
  },

  toggleBlockUser: (userId, isBlocked) =>
    set((state) => {
      if (!state.user) return state;
      const currentBlocked = state.user.blockedUsers || [];
      const newBlocked = isBlocked
        ? Array.from(new Set([...currentBlocked, userId]))
        : currentBlocked.filter((id) => id !== userId);
      const newUser = { ...state.user, blockedUsers: newBlocked };
      localStorage.setItem('user', JSON.stringify(newUser));
      return { user: newUser };
    }),
}));
