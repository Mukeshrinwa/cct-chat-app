import { create } from 'zustand';

// ----------------------------------------------------------------------

export interface GroupMessage {
  _id: string;
  messageId: string;
  conversationId: string;
  senderId: any;
  text: string;
  type: string;
  attachments: any[];
  callData?: any;
  readBy: { userId: string; at: string }[];
  deliveredTo: { userId: string; at: string }[];
  createdAt: string;
}

interface GroupRealtimeStore {
  messages: Record<string, GroupMessage[]>; // Keyed by conversationId

  setMessages: (conversationId: string, messages: GroupMessage[]) => void;
  addMessage: (conversationId: string, message: GroupMessage) => void;
  updateMessage: (conversationId: string, message: GroupMessage) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  markMessagesRead: (conversationId: string, readByUserId: string) => void;
  clearConversation: (conversationId: string) => void;
}

// ----------------------------------------------------------------------

export const useGroupRealtimeStore = create<GroupRealtimeStore>((set) => ({
  messages: {},

  setMessages: (conversationId, newMessages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: newMessages },
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const currentList = state.messages[conversationId] || [];
      // Deduplication based on messageId
      const exists = currentList.find((m) => m.messageId === message.messageId);
      if (exists) return state;
      return {
        messages: { ...state.messages, [conversationId]: [...currentList, message] },
      };
    }),

  updateMessage: (conversationId, message) =>
    set((state) => {
      const currentList = state.messages[conversationId] || [];
      const index = currentList.findIndex(
        (m) => m.messageId === message.messageId || m._id === message._id
      );
      if (index === -1) return state;
      const newList = [...currentList];
      newList[index] = message;
      return { messages: { ...state.messages, [conversationId]: newList } };
    }),

  removeMessage: (conversationId, messageId) =>
    set((state) => {
      const currentList = state.messages[conversationId] || [];
      const newList = currentList.filter(
        (m) => m.messageId !== messageId && m._id !== messageId
      );
      return { messages: { ...state.messages, [conversationId]: newList } };
    }),

  markMessagesRead: (conversationId, readByUserId) =>
    set((state) => {
      const currentList = state.messages[conversationId] || [];
      const newList = currentList.map((msg) => {
        if (!msg.readBy.find((r) => r.userId === readByUserId)) {
          return {
            ...msg,
            readBy: [...msg.readBy, { userId: readByUserId, at: new Date().toISOString() }],
          };
        }
        return msg;
      });
      return { messages: { ...state.messages, [conversationId]: newList } };
    }),

  clearConversation: (conversationId) =>
    set((state) => {
      const newMessages = { ...state.messages };
      delete newMessages[conversationId];
      return { messages: newMessages };
    }),
}));
