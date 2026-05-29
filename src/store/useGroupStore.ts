import { create } from 'zustand';

// ----------------------------------------------------------------------

export interface GroupMetadata {
  _id: string;
  conversationId: string;
  groupName: string;
  groupAvatar: string;
  description: string;
  admins: string[];
  members: string[];
  permissions: {
    editGroupInfo: 'all' | 'admins';
    addMembers: 'all' | 'admins';
    removeMembers: 'admins';
    startCalls: 'all' | 'admins';
    manageMessages: 'admins';
  };
  metadata: any;
}

interface GroupStore {
  groups: Record<string, GroupMetadata>; // Keyed by conversationId
  setGroup: (conversationId: string, group: GroupMetadata) => void;
  removeGroup: (conversationId: string) => void;
  updateGroup: (conversationId: string, updates: Partial<GroupMetadata>) => void;
}

// ----------------------------------------------------------------------

export const useGroupStore = create<GroupStore>((set) => ({
  groups: {},

  setGroup: (conversationId, group) =>
    set((state) => ({
      groups: { ...state.groups, [conversationId]: group },
    })),

  removeGroup: (conversationId) =>
    set((state) => {
      const newGroups = { ...state.groups };
      delete newGroups[conversationId];
      return { groups: newGroups };
    }),

  updateGroup: (conversationId, updates) =>
    set((state) => {
      const existing = state.groups[conversationId];
      if (!existing) return state;
      return {
        groups: {
          ...state.groups,
          [conversationId]: { ...existing, ...updates },
        },
      };
    }),
}));
