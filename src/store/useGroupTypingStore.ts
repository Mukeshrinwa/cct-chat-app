import { create } from 'zustand';

// ----------------------------------------------------------------------

interface TypingData {
  isTyping: boolean;
  timeoutId: any | null;
}

interface GroupTypingStore {
  // Keyed by conversationId, then by userId
  typingStates: Record<string, Record<string, TypingData>>;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  clearTyping: (conversationId: string, userId: string) => void;
}

// ----------------------------------------------------------------------

export const useGroupTypingStore = create<GroupTypingStore>((set, get) => ({
  typingStates: {},

  setTyping: (conversationId, userId, isTyping) => {
    const state = get();
    const convState = state.typingStates[conversationId] || {};
    const userState = convState[userId];

    // Clear existing timeout if any
    if (userState?.timeoutId) {
      clearTimeout(userState.timeoutId);
    }

    if (!isTyping) {
      set((s) => {
        const newConvState = { ...s.typingStates[conversationId] };
        delete newConvState[userId];
        return {
          typingStates: { ...s.typingStates, [conversationId]: newConvState },
        };
      });
      return;
    }

    // Auto-clear after 3 seconds
    const timeoutId = setTimeout(() => {
      get().clearTyping(conversationId, userId);
    }, 3000);

    set((s) => ({
      typingStates: {
        ...s.typingStates,
        [conversationId]: {
          ...(s.typingStates[conversationId] || {}),
          [userId]: { isTyping: true, timeoutId },
        },
      },
    }));
  },

  clearTyping: (conversationId, userId) => {
    set((s) => {
      const newConvState = { ...s.typingStates[conversationId] };
      if (newConvState[userId]?.timeoutId) {
        clearTimeout(newConvState[userId].timeoutId!);
      }
      delete newConvState[userId];
      return {
        typingStates: { ...s.typingStates, [conversationId]: newConvState },
      };
    });
  },
}));
