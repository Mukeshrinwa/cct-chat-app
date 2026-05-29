import { create } from 'zustand';

// ----------------------------------------------------------------------

export type ProfileViewMode = 'self' | 'other';

interface ProfileState {
  isOpen: boolean;
  viewMode: ProfileViewMode;
  userToView: any | null;
  activeSubScreen: 'main' | 'privacy' | 'disappearing' | 'blocked' | null;

  openProfile: (mode: ProfileViewMode, userData?: any) => void;
  closeProfile: () => void;
  setSubScreen: (screen: 'main' | 'privacy' | 'disappearing' | 'blocked' | null) => void;
  closeContactDrawer: () => void;
}

// ----------------------------------------------------------------------

export const useProfileStore = create<ProfileState>((set) => ({
  isOpen: false,
  viewMode: 'self',
  userToView: null,
  activeSubScreen: null,

  openProfile: (mode, userData = null) =>
    set({
      isOpen: true,
      viewMode: mode,
      userToView: userData,
      activeSubScreen: 'main',
    }),

  closeProfile: () => set({ isOpen: false, activeSubScreen: null }),

  setSubScreen: (screen) => set({ activeSubScreen: screen }),

  closeContactDrawer: () => {
    set({ isOpen: false, activeSubScreen: null, userToView: null });
    console.log('[DRAWER_CLOSE] Profile drawer closed via centralized closeContactDrawer');
    window.dispatchEvent(new CustomEvent('focus-chat-input'));
    console.log('[CHAT_RESTORE] Chat input focus event dispatched');
  },
}));
