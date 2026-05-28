import type { IChatMessage, IChatParticipant, IChatConversation } from 'src/types/chat';

import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';

import { keyBy } from 'src/utils/helper';
import axios, { fetcher, endpoints } from 'src/utils/axios';

import { useMockedUser } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: true,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
};

// ----------------------------------------------------------------------

function mapUserToParticipant(user: any): IChatParticipant {
  return {
    id: user._id || user.id || '',
    name: user.name || '',
    username: user.username || '',
    role: user.role || 'user',
    email: user.email || '',
    address: user.address || '',
    avatarUrl: user.avatar || '',
    phoneNumber: user.mobile || '',
    lastActivity: user.lastSeen || new Date().toISOString(),
    status: user.lastSeen === 'online' ? 'online' : 'offline',
  };
}

// ----------------------------------------------------------------------

type ContactsData = {
  contacts: IChatParticipant[];
};

export function useGetContacts() {
  const { data, isLoading, error, isValidating } = useSWR<any>(
    endpoints.user.getAll,
    fetcher,
    swrOptions
  );

  const contacts = useMemo(() => {
    const users: any[] = data?.data || [];
    return users.map(mapUserToParticipant);
  }, [data?.data]);

  const memoizedValue = useMemo(
    () => ({
      contacts,
      contactsLoading: isLoading,
      contactsError: error,
      contactsValidating: isValidating,
      contactsEmpty: !isLoading && !contacts.length,
    }),
    [contacts, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetConversations() {
  const { user } = useMockedUser();

  const { data: usersData } = useSWR<any>(
    endpoints.user.getAll,
    fetcher,
    swrOptions
  );

  const { data, isLoading, error, isValidating } = useSWR<any>(
    '/api/v1/chats/conversations',
    fetcher,
    {
      ...swrOptions,
      refreshInterval: 5000, // Poll every 5 seconds for conversation list updates
    }
  );

  const memoizedValue = useMemo(() => {
    const conversationsList: any[] = data?.data || [];
    const usersList: any[] = usersData?.data || [];

    const usersMap = new Map();
    usersList.forEach((u) => {
      usersMap.set(u._id || u.id, u);
    });

    const mappedConversations = conversationsList.map((conv: any) => {
      const participantsList: IChatParticipant[] = [];

      if (conv.participants && Array.isArray(conv.participants)) {
        conv.participants.forEach((pId: string) => {
          if (pId !== user?.id) {
            const resolvedUser = usersMap.get(pId);
            if (resolvedUser) {
              participantsList.push(mapUserToParticipant(resolvedUser));
            } else if (conv.otherUser && (conv.otherUser._id === pId || conv.otherUser.id === pId)) {
              participantsList.push(mapUserToParticipant(conv.otherUser));
            } else {
              participantsList.push({
                id: pId,
                name: 'User',
                username: '',
                role: 'user',
                email: '',
                address: '',
                avatarUrl: '',
                phoneNumber: '',
                lastActivity: new Date().toISOString(),
                status: 'offline',
              });
            }
          }
        });
      }

      if (participantsList.length === 0 && conv.otherUser) {
        participantsList.push(mapUserToParticipant(conv.otherUser));
      }

      // Ensure singleParticipant is never undefined
      if (participantsList.length === 0) {
        participantsList.push({
          id: 'dummy-participant',
          name: 'Chat Participant',
          username: '',
          role: 'user',
          email: '',
          address: '',
          avatarUrl: '',
          phoneNumber: '',
          lastActivity: new Date().toISOString(),
          status: 'offline',
        });
      }

      if (user) {
        participantsList.push({
          id: user.id,
          name: user.displayName,
          username: (user as any).username || '',
          role: user.role || 'user',
          email: user.email || '',
          address: user.address || '',
          avatarUrl: user.photoURL || '',
          phoneNumber: user.phoneNumber || '',
          lastActivity: new Date().toISOString(),
          status: 'online',
        });
      }

      const lastMsg = conv.lastMessage
        ? {
            id: conv.lastMessage.messageId || conv.lastMessage._id || '',
            body: conv.lastMessage.text || '',
            senderId: conv.lastMessage.senderId || (conv.lastMessage.sender === 'me' ? user?.id : conv.otherUser?._id) || '',
            contentType: conv.lastMessage.type || 'text',
            createdAt: conv.lastMessageAt || new Date().toISOString(),
            attachments: [],
          }
        : null;

      const messages = lastMsg ? [lastMsg] : [];

      return {
        id: conv._id,
        type: conv.type || 'direct',
        unreadCount: conv.unreadCount || 0,
        messages,
        participants: participantsList,
      };
    });

    const byId = mappedConversations.length ? keyBy(mappedConversations, 'id') : {};
    const allIds = Object.keys(byId);

    return {
      conversations: { byId, allIds },
      conversationsLoading: isLoading,
      conversationsError: error,
      conversationsValidating: isValidating,
      conversationsEmpty: !isLoading && !allIds.length,
    };
  }, [data?.data, usersData?.data, user, isLoading, error, isValidating]);

  return memoizedValue;
}

// ----------------------------------------------------------------------

type ConversationData = {
  conversation: IChatConversation;
};

async function fetchConversationDetail(conversationId: string, currentUser: any) {
  let realConvId = conversationId;
  let otherUser: any = null;
  let conversationData: any = null;

  // 1. Check if the ID is a recipient user ID
  try {
    const checkRes = await axios.get(`/api/v1/chats/check/${conversationId}`);
    if (checkRes.data && checkRes.data.exists) {
      realConvId = checkRes.data.conversationId;
      otherUser = checkRes.data.otherUser;
      conversationData = checkRes.data.conversation;

      // Update URL to the real conversation ID
      if (realConvId && realConvId !== conversationId) {
        const url = new URL(window.location.href);
        url.searchParams.set('id', realConvId);
        window.history.replaceState({}, '', url.pathname + url.search);
        window.dispatchEvent(new Event('popstate'));
      }
    } else if (checkRes.data && !checkRes.data.exists) {
      otherUser = checkRes.data.otherUser;
    }
  } catch (e) {
    console.log('Not a recipient ID or check failed:', e);
  }

  // 2. Fetch messages
  let messages: any[] = [];
  try {
    const msgRes = await axios.get(`/api/v1/chats/messages/${realConvId}`);
    messages = msgRes.data?.data || [];
  } catch (e) {
    console.error('Failed to fetch messages:', e);
  }

  // 3. Map messages to IChatMessage
  const mappedMessages = messages.map((msg: any) => ({
    id: msg.messageId || msg._id || '',
    body: msg.text || msg.message || '',
    senderId: msg.senderId || msg.senderDetails?._id || '',
    contentType: msg.type || msg.messageType || 'text',
    createdAt: msg.createdAt || new Date().toISOString(),
    attachments: msg.attachments || [],
  }));

  // 4. Resolve users list to map participants properly
  let usersList: any[] = [];
  try {
    const usersRes = await axios.get(endpoints.user.getAll);
    usersList = usersRes.data?.data || [];
  } catch (err) {
    console.error('Failed to fetch users list in detail:', err);
  }

  const usersMap = new Map();
  usersList.forEach((u) => {
    usersMap.set(u._id || u.id, u);
  });

  const participantIds = new Set<string>();

  if (conversationData && Array.isArray(conversationData.participants)) {
    conversationData.participants.forEach((p: any) => {
      participantIds.add(typeof p === 'object' && p ? p._id || p.id : p);
    });
  }

  messages.forEach((msg: any) => {
    if (msg.senderId) participantIds.add(msg.senderId);
    if (msg.recipientId) participantIds.add(msg.recipientId);
  });

  if (otherUser) {
    participantIds.add(otherUser._id || otherUser.id);
  }

  const participants: IChatParticipant[] = [];

  participantIds.forEach((pId: string) => {
    if (pId === currentUser?.id) {
      participants.push({
        id: currentUser.id,
        name: currentUser.displayName,
        username: (currentUser as any).username || '',
        role: currentUser.role || 'user',
        email: currentUser.email || '',
        address: currentUser.address || '',
        avatarUrl: currentUser.photoURL || '',
        phoneNumber: currentUser.phoneNumber || '',
        lastActivity: new Date().toISOString(),
        status: 'online',
      });
    } else {
      const resolvedUser = usersMap.get(pId);
      if (resolvedUser) {
        participants.push(mapUserToParticipant(resolvedUser));
      } else if (otherUser && (otherUser._id === pId || otherUser.id === pId)) {
        participants.push(mapUserToParticipant(otherUser));
      } else {
        participants.push({
          id: pId,
          name: 'User',
          username: '',
          role: 'user',
          email: '',
          address: '',
          avatarUrl: '',
          phoneNumber: '',
          lastActivity: new Date().toISOString(),
          status: 'offline',
        });
      }
    }
  });

  if (participants.length === 0) {
    if (otherUser) {
      participants.push(mapUserToParticipant(otherUser));
    }
    if (currentUser) {
      participants.push({
        id: currentUser.id,
        name: currentUser.displayName,
        username: (currentUser as any).username || '',
        role: currentUser.role || 'user',
        email: currentUser.email || '',
        address: currentUser.address || '',
        avatarUrl: currentUser.photoURL || '',
        phoneNumber: currentUser.phoneNumber || '',
        lastActivity: new Date().toISOString(),
        status: 'online',
      });
    }
  }

  // Ensure singleParticipant fallback is met
  const otherParticipants = participants.filter((p) => p.id !== currentUser?.id);
  if (otherParticipants.length === 0) {
    participants.push({
      id: 'dummy-participant',
      name: 'Chat Participant',
      username: '',
      role: 'user',
      email: '',
      address: '',
      avatarUrl: '',
      phoneNumber: '',
      lastActivity: new Date().toISOString(),
      status: 'offline',
    });
  }

  return {
    conversation: {
      id: realConvId,
      type: conversationData?.type || (participants.length > 2 ? 'group' : 'direct'),
      unreadCount: conversationData?.unreadCount || 0,
      messages: mappedMessages,
      participants,
    },
  };
}

export function useGetConversation(conversationId: string) {
  const { user } = useMockedUser();

  const url = conversationId && user
    ? `/api/v1/chats/conversations/${conversationId}`
    : '';

  const { data, isLoading, error, isValidating } = useSWR<ConversationData>(
    url,
    () => fetchConversationDetail(conversationId, user),
    {
      ...swrOptions,
      refreshInterval: 3000, // Poll every 3 seconds for active conversation messages
    }
  );

  const memoizedValue = useMemo(
    () => ({
      conversation: data?.conversation,
      conversationLoading: isLoading,
      conversationError: error,
      conversationValidating: isValidating,
    }),
    [data?.conversation, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export async function sendMessage(conversationId: string, messageData: IChatMessage) {
  let realConvId = conversationId;

  // 1. Check if conversationId is a recipient user ID
  try {
    const checkRes = await axios.get(`/api/v1/chats/check/${conversationId}`);
    if (checkRes.data && checkRes.data.exists) {
      realConvId = checkRes.data.conversationId;
    } else if (checkRes.data && !checkRes.data.exists) {
      // Create new conversation
      const createRes = await axios.post('/api/v1/chats/conversations', {
        recipientId: conversationId,
      });
      realConvId = createRes.data?.conversationId || createRes.data?.conversation?._id;

      // Update URL to the new conversation ID
      if (realConvId) {
        const url = new URL(window.location.href);
        url.searchParams.set('id', realConvId);
        window.history.replaceState({}, '', url.pathname + url.search);
        window.dispatchEvent(new Event('popstate'));
      }
    }
  } catch (error) {
    console.error('Check conversation error in sendMessage:', error);
  }

  // 2. Send message
  await axios.post('/api/v1/chats/message', {
    conversationId: realConvId,
    text: messageData.body,
  });

  // 3. Mutate caches
  mutate('/api/v1/chats/conversations');
  mutate(`/api/v1/chats/conversations/${realConvId}`);
}

// ----------------------------------------------------------------------

export async function createConversation(conversationData: any) {
  let payload: any = {};
  
  const senderId = conversationData.messages?.[0]?.senderId;
  const recipientUser = conversationData.participants.find((p: any) => p.id !== senderId);

  if (conversationData.type === 'GROUP' || conversationData.participants.length > 2) {
    payload = {
      name: conversationData.name || 'Group Chat',
      isGroup: true,
      participants: conversationData.participants.map((p: any) => p.id),
    };
  } else {
    payload = {
      recipientId: recipientUser?.id || conversationData.participants[0]?.id,
    };
  }

  const res = await axios.post('/api/v1/chats/conversations', payload);
  const newId = res.data?.conversationId || res.data?.conversation?._id || '';

  const initialMessage = conversationData.messages?.[0];
  if (initialMessage && initialMessage.body && newId) {
    try {
      await axios.post('/api/v1/chats/message', {
        conversationId: newId,
        text: initialMessage.body,
      });
    } catch (err) {
      console.error('Failed to send initial message:', err);
    }
  }

  mutate('/api/v1/chats/conversations');

  return {
    conversation: {
      id: newId,
    },
  };
}

// ----------------------------------------------------------------------

export async function clickConversation(conversationId: string) {
  try {
    await axios.post(`/api/v1/chats/read/${conversationId}`);
  } catch (error) {
    console.error('Failed to mark conversation as read:', error);
  }

  mutate('/api/v1/chats/conversations');
}
