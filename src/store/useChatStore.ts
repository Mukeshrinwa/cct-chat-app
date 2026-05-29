import { create } from 'zustand';

// ----------------------------------------------------------------------

interface Conversation {
  _id: string;
  isGroup: boolean;
  participants: any[];
  lastMessage?: any;
  lastMessageAt?: string;
  unreadCount?: number;
  name?: string;
  avatar?: string;
  otherUser?: any;
  type?: 'direct' | 'group';
  disappearingMode?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  tempConversation: Conversation | null;
  onlineUsers: Record<string, 'online' | string>;
  typingUsers: Record<string, string[]>;
  recordingUsers: Record<string, string[]>;
  blockedByUsers: string[];
  replyingToMessage: any | null;

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setTempConversation: (conv: Conversation | null) => void;
  updateOnlineUser: (userId: string, status: string) => void;
  updateConversationLastMessage: (conversationId: string, message: any, currentUserId?: string) => void;
  setTypingUser: (conversationId: string, userName: string, isTyping: boolean) => void;
  setRecordingUser: (conversationId: string, userName: string, isRecording: boolean) => void;
  updateConversationDisappearingMode: (conversationId: string, mode: string) => void;
  updateConversationUser: (userId: string, data: { name?: string; avatar?: string; about?: string; privacy?: any; lastSeen?: string }) => void;
  updateBlockedStatus: (userId: string, isBlocked: boolean, wasBlockedByThem?: boolean) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  setReplyingToMessage: (message: any | null) => void;
  resetStore: () => void;
}

// ----------------------------------------------------------------------

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  tempConversation: null,
  onlineUsers: {},
  typingUsers: {},
  recordingUsers: {},
  blockedByUsers: [],
  replyingToMessage: null,

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (id) =>
    set((state) => ({
      activeConversationId: id,
      tempConversation: null,
      replyingToMessage: null,
      conversations: state.conversations.map((c) => (c._id === id ? { ...c, unreadCount: 0 } : c)),
    })),

  setTempConversation: (conv) => set({ tempConversation: conv, activeConversationId: null }),

  updateOnlineUser: (userId, status) =>
    set((state) => ({
      onlineUsers: { ...state.onlineUsers, [userId]: status },
    })),

  updateConversationLastMessage: (conversationId, message, currentUserId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId
          ? {
              ...c,
              lastMessage: message,
              lastMessageAt: message.createdAt,
              unreadCount:
                state.activeConversationId === conversationId ||
                (currentUserId && message.senderId === currentUserId)
                  ? 0
                  : (c.unreadCount || 0) + 1,
            }
          : c
      ),
    })),

  setTypingUser: (conversationId, userName, isTyping) =>
    set((state) => {
      const currentTyping = state.typingUsers[conversationId] || [];
      if (isTyping && !currentTyping.includes(userName)) {
        return {
          typingUsers: { ...state.typingUsers, [conversationId]: [...currentTyping, userName] },
        };
      }
      if (!isTyping) {
        return {
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: currentTyping.filter((name) => name !== userName),
          },
        };
      }
      return state;
    }),

  setRecordingUser: (conversationId, userName, isRecording) =>
    set((state) => {
      const currentRecording = state.recordingUsers[conversationId] || [];
      if (isRecording && !currentRecording.includes(userName)) {
        return {
          recordingUsers: {
            ...state.recordingUsers,
            [conversationId]: [...currentRecording, userName],
          },
        };
      }
      if (!isRecording) {
        return {
          recordingUsers: {
            ...state.recordingUsers,
            [conversationId]: currentRecording.filter((name) => name !== userName),
          },
        };
      }
      return state;
    }),

  updateConversationDisappearingMode: (conversationId, mode) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId ? { ...c, disappearingMode: mode } : c
      ),
    })),

  updateConversationUser: (userId, data) =>
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (!c.isGroup && c.otherUser?._id === userId) {
          return {
            ...c,
            name: data.name !== undefined ? data.name : c.name,
            avatar: data.avatar !== undefined ? data.avatar : c.avatar,
            otherUser: { ...c.otherUser, ...data },
          };
        }
        const hasParticipant = c.participants.some((p) => (p._id || p) === userId);
        if (hasParticipant) {
          return {
            ...c,
            participants: c.participants.map((p) => {
              const pId = p._id || p;
              if (pId === userId) {
                return typeof p === 'object' ? { ...p, ...data } : p;
              }
              return p;
            }),
          };
        }
        return c;
      }),
    })),

  updateBlockedStatus: (userId, isBlocked, wasBlockedByThem) =>
    set((state) => {
      if (wasBlockedByThem) {
        const newBlockedBy = isBlocked
          ? Array.from(new Set([...state.blockedByUsers, userId]))
          : state.blockedByUsers.filter((id) => id !== userId);
        return { blockedByUsers: newBlockedBy };
      }
      return state;
    }),

  removeMessage: (conversationId, messageId) =>
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (
          c._id === conversationId &&
          (c.lastMessage?._id === messageId || c.lastMessage?.messageId === messageId)
        ) {
          return {
            ...c,
            lastMessage: {
              ...c.lastMessage,
              text: 'This message was deleted.',
              type: 'system',
              isDeleted: true,
            },
          };
        }
        return c;
      }),
    })),

  setReplyingToMessage: (message) => set({ replyingToMessage: message }),

  resetStore: () =>
    set({
      conversations: [],
      activeConversationId: null,
      tempConversation: null,
      onlineUsers: {},
      typingUsers: {},
      recordingUsers: {},
      blockedByUsers: [],
      replyingToMessage: null,
    }),
}));
