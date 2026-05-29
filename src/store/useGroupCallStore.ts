import { create } from 'zustand';

// ----------------------------------------------------------------------

export interface ActiveCallData {
  groupId: string;
  roomId: string;
  initiatedBy: string;
  status: 'initiated' | 'ongoing' | 'ended';
  activeParticipants: string[];
}

interface GroupCallStore {
  activeCalls: Record<string, ActiveCallData>; // Keyed by groupId
  inCall: boolean;
  activeRoomId: string | null;

  setActiveCallAvailable: (groupId: string, data: ActiveCallData) => void;
  removeActiveCall: (groupId: string) => void;
  setInCall: (status: boolean, roomId?: string) => void;
}

// ----------------------------------------------------------------------

export const useGroupCallStore = create<GroupCallStore>((set) => ({
  activeCalls: {},
  inCall: false,
  activeRoomId: null,

  setActiveCallAvailable: (groupId, data) =>
    set((state) => ({
      activeCalls: { ...state.activeCalls, [groupId]: data },
    })),

  removeActiveCall: (groupId) =>
    set((state) => {
      const newCalls = { ...state.activeCalls };
      delete newCalls[groupId];
      return { activeCalls: newCalls };
    }),

  setInCall: (status, roomId) =>
    set({
      inCall: status,
      activeRoomId: roomId || null,
    }),
}));
