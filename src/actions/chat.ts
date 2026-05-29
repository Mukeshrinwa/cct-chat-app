import type { IChatMessage, IChatParticipant, IChatConversation } from 'src/types/chat';

import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';

import { keyBy } from 'src/utils/helper';
import axios, { fetcher, endpoints } from 'src/utils/axios';

import { socketService } from 'src/socket/socket-service';

import { useMockedUser } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: true,
  revalidateOnFocus: false, // Turn off automatic refetch on window focus since socket handles sync
  revalidateOnReconnect: true,
};

// ----------------------------------------------------------------------

function mapUserToParticipant(user: any): IChatParticipant {
  return {
    id: user._id || user.id || '',
    name: user.name || user.displayName || 'User',
    username: user.username || '',
    role: user.role || 'user',
    email: user.email || '',
    address: user.address || '',
    avatarUrl: user.avatar || user.photoURL || '',
    phoneNumber: user.mobile || user.phoneNumber || '',
    lastActivity: user.lastSeen || new Date().toISOString(),
    status: user.lastSeen === 'online' ? 'online' : 'offline',
  };
}

// ----------------------------------------------------------------------

// type ContactsData = {
//   contacts: IChatParticipant[];
// };

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
    swrOptions
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
        conv.participants.forEach((p: any) => {
          const pId = typeof p === 'object' && p ? p._id || p.id : p;
          if (pId && pId !== user?.id) {
            const resolvedUser = usersMap.get(pId) || (typeof p === 'object' ? p : null);
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
        if (conv.otherUser) {
          participantsList.push(mapUserToParticipant(conv.otherUser));
        } else if (user) {
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
        } else {
          participantsList.push({
            id: 'dummy-participant',
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
      ({ conversationId: realConvId, otherUser, conversation: conversationData } = checkRes.data);

      // Update URL to the real conversation ID
      if (realConvId && realConvId !== conversationId) {
        const url = new URL(window.location.href);
        url.searchParams.set('id', realConvId);
        window.history.replaceState({}, '', url.pathname + url.search);
        window.dispatchEvent(new Event('popstate'));
      }
    } else if (checkRes.data && !checkRes.data.exists) {
      ({ otherUser } = checkRes.data);
    }
  } catch (e) {
    console.log('Not a recipient ID or check failed:', e);
  }

  // 1b. If not a recipient ID, try to load conversation details directly
  if (!conversationData && realConvId) {
    try {
      const convRes = await axios.get(`/api/v1/chats/conversations/${realConvId}`);
      if (convRes.data) {
        conversationData = convRes.data.data || convRes.data.conversation || convRes.data;
      }
    } catch (e) {
      console.log('Failed to fetch conversation details directly:', e);
    }
  }

  // 1c. If still null, try to load from the conversations list
  if (!conversationData && realConvId) {
    try {
      const convListRes = await axios.get('/api/v1/chats/conversations');
      const convList = convListRes.data?.data || convListRes.data || [];
      const foundConv = convList.find((c: any) => c._id === realConvId || c.id === realConvId);
      if (foundConv) {
        conversationData = foundConv;
      }
    } catch (e) {
      console.log('Failed to fetch conversation list for fallback:', e);
    }
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
    isDeleted: msg.isDeleted || false,
    deleteType: msg.deleteType,
    reactions: msg.reactions || [],
    editedAt: msg.editedAt,
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

  const conversationParticipantsMap = new Map();
  if (conversationData && Array.isArray(conversationData.participants)) {
    conversationData.participants.forEach((p: any) => {
      if (p && typeof p === 'object') {
        const id = p._id || p.id;
        if (id) conversationParticipantsMap.set(id, p);
      }
    });
  }

  const messageUsersMap = new Map();
  messages.forEach((msg: any) => {
    if (msg.senderDetails && typeof msg.senderDetails === 'object') {
      const sId = msg.senderDetails._id || msg.senderDetails.id;
      if (sId) messageUsersMap.set(sId, msg.senderDetails);
    }
    if (msg.recipientDetails && typeof msg.recipientDetails === 'object') {
      const rId = msg.recipientDetails._id || msg.recipientDetails.id;
      if (rId) messageUsersMap.set(rId, msg.recipientDetails);
    }
  });

  const participantIds = new Set<string>();

  if (conversationData && Array.isArray(conversationData.participants)) {
    conversationData.participants.forEach((p: any) => {
      const pId = typeof p === 'object' && p ? p._id || p.id : p;
      if (pId && typeof pId === 'string') participantIds.add(pId);
    });
  }

  messages.forEach((msg: any) => {
    const sId = msg.senderId || msg.senderDetails?._id || msg.sender?._id || msg.sender;
    const rId = msg.recipientId || msg.recipientDetails?._id || msg.recipient?._id || msg.recipient;
    if (sId && typeof sId === 'string') participantIds.add(sId);
    if (rId && typeof rId === 'string') participantIds.add(rId);
  });

  if (otherUser) {
    const oId = otherUser._id || otherUser.id;
    if (oId && typeof oId === 'string') participantIds.add(oId);
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
      const resolvedUser = usersMap.get(pId) || conversationParticipantsMap.get(pId) || messageUsersMap.get(pId);
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
    if (currentUser) {
      // Self-chat or no other participant, let's keep currentUser
    } else {
      participants.push({
        id: 'dummy-participant',
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
    swrOptions
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

  // 3. Mutate caches optimistically
  const updateConversationCache = (current: any) => {
    if (!current || !current.conversation) return current;
    const exists = current.conversation.messages.some((m: any) => m.id === messageData.id);
    if (exists) return current;
    return {
      ...current,
      conversation: {
        ...current.conversation,
        messages: [...current.conversation.messages, messageData],
      },
    };
  };

  const updateConversationListCache = (current: any) => {
    if (!current || !current.data) return current;
    const conversationsList = current.data;
    const index = conversationsList.findIndex((c: any) => c._id === realConvId);
    
    if (index === -1) return current;

    const updatedList = [...conversationsList];
    const conv = updatedList[index];

    const updatedConv = {
      ...conv,
      lastMessage: {
        _id: messageData.id,
        text: messageData.body,
        senderId: messageData.senderId,
        type: messageData.contentType,
      },
      lastMessageAt: messageData.createdAt,
    };

    updatedList.splice(index, 1);
    updatedList.unshift(updatedConv);

    return {
      ...current,
      data: updatedList,
    };
  };

  mutate('/api/v1/chats/conversations', updateConversationListCache, { revalidate: false });
  mutate(`/api/v1/chats/conversations/${conversationId}`, updateConversationCache, { revalidate: false });
  if (realConvId !== conversationId) {
    mutate(`/api/v1/chats/conversations/${realConvId}`, updateConversationCache, { revalidate: false });
  }

  // 2. Send message via socket or HTTP
  let socketSent = false;
  const msgType = messageData.contentType || 'text';
  const isFileMessage = msgType === 'image' || msgType === 'audio' || msgType === 'video' || msgType === 'document';

  if (isFileMessage) {
    // File messages — upload via FormData to /api/v1/files/upload
    // body contains base64 string
    try {
      // Convert base64 to Blob
      const base64Data = messageData.body as string;
      const byteString = atob(base64Data.split(',')[1] || base64Data);
      const mimeString = base64Data.split(',')[0]?.split(':')[1]?.split(';')[0] || (msgType === 'audio' ? 'audio/webm' : 'image/jpeg');
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i += 1) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const ext = mimeString.split('/')[1] || 'bin';
      const fileName = `${msgType}_${Date.now()}.${ext}`;
      const file = new File([blob], fileName, { type: mimeString });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', realConvId);
      formData.append('messageId', messageData.id);

      await axios.post('/api/v1/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log(`[${msgType.toUpperCase()}_UPLOAD] File sent via FormData upload`);
      socketSent = true; // backend will emit new_message via socket
    } catch (uploadError) {
      console.error(`[${msgType.toUpperCase()}_UPLOAD] Failed:`, uploadError);
    }
  } else {
    // Text messages — send via socket
    try {
      if (socketService.isConnected()) {
        await socketService.emit('send_message', {
          messageId: messageData.id,
          conversationId: realConvId,
          text: messageData.body,
          type: 'text',
        });
        socketSent = true;
        console.log('Message sent via socket');
      }
    } catch (socketError) {
      console.error('Socket sendMessage failed, falling back to HTTP API:', socketError);
    }

    // HTTP fallback for text
    if (!socketSent) {
      await axios.post('/api/v1/chats/message', {
        conversationId: realConvId,
        text: messageData.body,
        type: 'text',
      });
      console.log('Text message sent via HTTP API fallback');
    }
  }

  // 3. Mutate caches in background after a delay
  setTimeout(() => {
    mutate('/api/v1/chats/conversations');
    mutate(`/api/v1/chats/conversations/${realConvId}`);
    if (conversationId !== realConvId) {
      mutate(`/api/v1/chats/conversations/${conversationId}`);
    }
  }, 1000);
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
    if (socketService.isConnected()) {
      await socketService.emit('mark_read', { conversationId });
      console.log('Marked read via socket');
    }
  } catch (error) {
    console.error('Socket mark_read failed:', error);
  }

  // Always hit the HTTP API to ensure the backend marks it as read
  try {
    await axios.post(`/api/v1/chats/read/${conversationId}`);
    console.log('Marked read via HTTP API');
  } catch (error) {
    console.error('Failed to mark conversation as read via HTTP API:', error);
  }

  mutate('/api/v1/chats/conversations');
}

// ----------------------------------------------------------------------

export async function deleteMessage(messageId: string, deleteType: 'everyone' | 'me', conversationId?: string) {
  try {
    await axios.delete(`/api/v1/chats/message/${messageId}`, {
      data: { deleteType },
    });
    if (conversationId) {
      mutate(`/api/v1/chats/conversations/${conversationId}`);
    }
    mutate('/api/v1/chats/conversations');
  } catch (error) {
    console.error('Failed to delete message:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function editMessage(messageId: string, text: string, attachments: any[] = [], conversationId?: string) {
  try {
    await axios.put(`/api/v1/chats/message/${messageId}`, {
      text,
      attachments,
    });
    if (conversationId) {
      mutate(`/api/v1/chats/conversations/${conversationId}`);
    }
    mutate('/api/v1/chats/conversations');
  } catch (error) {
    console.error('Failed to edit message:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function reactToMessage(messageId: string, emoji: string, conversationId?: string) {
  try {
    await axios.post(`/api/v1/chats/message/${messageId}/react`, {
      emoji,
    });
    if (conversationId) {
      mutate(`/api/v1/chats/conversations/${conversationId}`);
    }
    mutate('/api/v1/chats/conversations');
  } catch (error) {
    console.error('Failed to react to message:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function forwardMessage(messageId: string, conversationIds: string[]) {
  try {
    await axios.post('/api/v1/chats/messages/forward', {
      messageId,
      conversationIds,
    });
    conversationIds.forEach((id) => {
      mutate(`/api/v1/chats/conversations/${id}`);
    });
    mutate('/api/v1/chats/conversations');
  } catch (error) {
    console.error('Failed to forward message:', error);
    throw error;
  }
}

