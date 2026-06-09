// @refresh reset
import type { Socket } from 'socket.io-client';

import { toast } from 'sonner';
import { mutate, useSWRConfig } from 'swr';
import React, { useMemo, useState, useEffect, useContext, createContext } from 'react';

import axios from 'src/utils/axios';
import { normalizeMessage } from 'src/utils/chat-utils';

import { clickConversation } from 'src/actions/chat';
import { useAuthStore } from 'src/store/useAuthStore';
import { useChatStore } from 'src/store/useChatStore';

import { useAuthContext } from 'src/auth/hooks';

import { socketManager } from './socket-service';

// ----------------------------------------------------------------------
// NOTE: Socket provider handles BOTH chat/messaging AND presence events.
// Call state is managed by CallContext (src/call/call-context.tsx).
// Group socket events are handled by useGroupSockets hook.
// Reference: cct_chat_employ_user_admin/src/sockets/socket-provider.tsx
// ----------------------------------------------------------------------

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  typingUsers: Record<string, string[]>; // conversationId -> userIds[]
  recordingUsers: Record<string, string[]>; // conversationId -> userIds[]
  onlineUsers: Set<string>;

  sendMessage: (payload: { messageId: string; conversationId: string; text: string }) => void;
  startTyping: (payload: { conversationId: string }) => void;
  stopTyping: (payload: { conversationId: string }) => void;
  markRead: (payload: { conversationId: string }) => void;
  setDisappearingMode: (payload: { conversationId: string; mode: 'off' | '24h' | '7d' | '90d' }) => void;
  startRecording: (payload: { conversationId: string; recipientId: string }) => void;
  stopRecording: (payload: { conversationId: string; recipientId: string }) => void;
  callUser: (payload: { participants: string[]; callType: 'audio' | 'video' }) => void;
  acceptCall: (payload: { roomName: string }) => void;
  rejectCall: (payload: { roomName: string }) => void;
  createGroup: (payload: { name: string; participants: string[] }) => void;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

type SocketProviderProps = {
  children: React.ReactNode;
};

export function SocketProvider({ children }: SocketProviderProps) {
  const { user } = useAuthContext();
  const { cache } = useSWRConfig();

  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [recordingUsers, setRecordingUsers] = useState<Record<string, string[]>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const currentUserId = useMemo(() => user?._id || user?.id || '', [user]);
  const token = useMemo(
    () => user?.accessToken || sessionStorage.getItem('jwt_access_token') || '',
    [user]
  );

  const activeConversationId = useChatStore((state) => state.activeConversationId);

  // Expose currentUserId to non-React code (e.g. optimistic reaction updater)
  useEffect(() => {
    if (currentUserId) {
      (window as any).__chatCurrentUserId = currentUserId;
    }
  }, [currentUserId]);

  // Sync auth store with current JWT context so other stores can access token
  useEffect(() => {
    if (user && token) {
      const existing = useAuthStore.getState();
      if (!existing.token || existing.token !== token) {
        useAuthStore.getState().setAuth(user as any, token);
      }
    }
  }, [user, token]);

  // Join room when active conversation changes
  useEffect(() => {
    const socketInstance = socketManager.getSocket();
    if (socketInstance && isConnected && activeConversationId) {
      console.log(`[SOCKET_EXPLICIT_JOIN] Emitting join_conversation room: ${activeConversationId}`);
      socketInstance.emit('join_conversation', { conversationId: activeConversationId });
      socketInstance.emit('join_conversation_screen', { conversationId: activeConversationId });
      socketInstance.emit('mark_read', { conversationId: activeConversationId });
    }
  }, [activeConversationId, isConnected]);

  // Connect socket when token changes/is available
  useEffect(() => {
    if (!token) {
      socketManager.disconnect();
      setIsConnected(false);
      return undefined;
    }

    const socketInstance = socketManager.connect(token);
    setIsConnected(socketInstance.connected);

    const onConnect = () => {
      setIsConnected(true);
      console.log(`[SOCKET_CONNECTED] Socket ID: ${socketInstance.id} | TS: ${Date.now()}`);
    };

    // 🔍 DEBUG: log ALL incoming socket events to find exact event names
    const onAnyEvent = (eventName: string, ...args: any[]) => {
      console.log(`[SOCKET_EVENT] "${eventName}"`, JSON.stringify(args).slice(0, 300));
    };
    socketInstance.onAny(onAnyEvent);

    const onDisconnect = (reason: string) => {
      setIsConnected(false);
      console.log(`[SOCKET_DISCONNECTED] Reason: ${reason} | TS: ${Date.now()}`);
    };

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);

    // Dynamic timeout mapping for typing statuses
    const typingTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

    // -----------------------------------------------------------------------
    // 1. PRESENCE - online_users (bulk on connect)
    // -----------------------------------------------------------------------
    socketInstance.on('online_users', (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
      userIds.forEach((uId) => useChatStore.getState().updateOnlineUser(uId, 'online'));
    });

    // -----------------------------------------------------------------------
    // 2. PRESENCE - presence_update
    // -----------------------------------------------------------------------
    socketInstance.on(
      'presence_update',
      (data: { userId: string; status: string; lastSeen?: string }) => {
        console.log(
          `[PRESENCE_UPDATE] User ${data.userId} -> ${data.status}, lastSeen:`,
          data.lastSeen
        );
        const finalStatus =
          data.status === 'offline' && data.lastSeen ? data.lastSeen : data.status;

        // Update zustand store
        useChatStore.getState().updateOnlineUser(data.userId, finalStatus);
        useChatStore
          .getState()
          .updateConversationUser(data.userId, { lastSeen: finalStatus });

        // Update local Set for fast UI lookup
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (data.status === 'online') {
            next.add(data.userId);
          } else {
            next.delete(data.userId);
          }
          return next;
        });
      }
    );

    // -----------------------------------------------------------------------
    // 3. PRESENCE - presence_hidden / presence_restored
    // -----------------------------------------------------------------------
    socketInstance.on('presence_hidden', (payload: { userId: string; status: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(payload.userId);
        return next;
      });
    });

    socketInstance.on('presence_restored', (payload: { userId: string; status: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.add(payload.userId);
        return next;
      });
    });

    // -----------------------------------------------------------------------
    // 4. MESSAGES - new_message
    // -----------------------------------------------------------------------
    socketInstance.on('new_message', (data: any) => {
      // Try normalizing as reference project format first
      const normalized = normalizeMessage(data);
      if (!normalized) return;

      const loggedInUserId = currentUserId;

      const { conversationId, senderId } = normalized;
      // Auto-unarchive if a new message is received from someone else
      if (conversationId && senderId !== loggedInUserId) {
        try {
          const archivedStr = localStorage.getItem('cct_archived_conversations');
          if (archivedStr) {
            const archived = JSON.parse(archivedStr);
            if (Array.isArray(archived) && archived.includes(conversationId)) {
              const updated = archived.filter((id: string) => id !== conversationId);
              localStorage.setItem('cct_archived_conversations', JSON.stringify(updated));
              window.dispatchEvent(new Event('cct_archive_changed'));
            }
          }
        } catch (e) {
          console.error('Failed to auto-unarchive on new message:', e);
        }
      }

      const activeConvId = useChatStore.getState().activeConversationId;
      const matchingConv = useChatStore
        .getState()
        .conversations.find((c) => c._id === conversationId);

      console.log('[NEW_MESSAGE] Socket event:', {
        messageId: normalized.messageId,
        conversationId,
        senderId,
        loggedInUserId,
        activeConvId,
        foundConv: !!matchingConv,
      });

      // Update zustand store unread count + last message
      useChatStore
        .getState()
        .updateConversationLastMessage(normalized.conversationId!, normalized, loggedInUserId);

      if (conversationId && conversationId === activeConvId && senderId !== currentUserId) {
        // Emit mark_read to socket immediately (bypass clickConversation debounce for instant read ticks)
        socketInstance.emit('mark_read', { conversationId });
        
        // Mark as read in backend via HTTP API instantly
        axios.post(`/api/v1/chats/read/${conversationId}`).catch((err) => {
          console.error('[NEW_MESSAGE_READ] HTTP mark read error:', err);
        });

        // Trigger clickConversation for SWR mutate list update
        clickConversation(conversationId);
      }

      const parsedMessage = {
        id: normalized.messageId,
        _id: normalized._id || '',
        body: normalized.text,
        senderId,
        contentType: normalized.messageType,
        createdAt: normalized.createdAt,
        attachments: (normalized as any).attachments || [],
        isDeleted: normalized.isDeletedForEveryone || false,
        reactions: normalized.reactions || [],
        status: normalized.status || data.status || 'sent',
        parentMessageId: normalized.parentMessageId || undefined,
      };

      if (conversationId) {
        // Mutate conversation messages cache
        const convCacheKey = `/api/v1/chats/conversations/${conversationId}`;
        if (cache.get(convCacheKey)?.data !== undefined) {
          mutate(
            convCacheKey,
            (current: any) => {
              if (!current || !current.conversation) return current;
              const exists = current.conversation.messages.some(
                (m: any) => m.id === parsedMessage.id
              );
              if (exists) return current;
              return {
                ...current,
                conversation: {
                  ...current.conversation,
                  messages: [...current.conversation.messages, parsedMessage],
                },
              };
            },
            { revalidate: false }
          );
        }

        if (senderId && senderId !== currentUserId) {
          const senderCacheKey = `/api/v1/chats/conversations/${senderId}`;
          if (cache.get(senderCacheKey)?.data !== undefined) {
            mutate(
              senderCacheKey,
              (current: any) => {
                if (!current || !current.conversation) return current;
                const exists = current.conversation.messages.some(
                  (m: any) => m.id === parsedMessage.id
                );
                if (exists) return current;
                return {
                  ...current,
                  conversation: {
                    ...current.conversation,
                    messages: [...current.conversation.messages, parsedMessage],
                  },
                };
              },
              { revalidate: false }
            );
          }
        }

        // Mutate conversation list
        mutate(
          '/api/v1/chats/conversations',
          (current: any) => {
            if (!current || !current.data) return current;
            const conversationsList = current.data;
            const index = conversationsList.findIndex((c: any) => c._id === conversationId);
            if (index === -1) {
              mutate('/api/v1/chats/conversations');
              return current;
            }
            const updatedList = [...conversationsList];
            const conv = updatedList[index];
            const updatedConv = {
              ...conv,
              lastMessage: {
                _id: parsedMessage.id,
                text: parsedMessage.body,
                senderId: parsedMessage.senderId,
                type: parsedMessage.contentType,
              },
              lastMessageAt: parsedMessage.createdAt,
              unreadCount:
                conversationId === activeConvId
                  ? 0
                  : (conv.unreadCount || 0) + (parsedMessage.senderId !== currentUserId ? 1 : 0),
            };
            updatedList.splice(index, 1);
            updatedList.unshift(updatedConv);
            return { ...current, data: updatedList };
          },
          { revalidate: false }
        );
      }
    });

    // -----------------------------------------------------------------------
    // 5. MESSAGES - message_delivered
    // -----------------------------------------------------------------------
    socketInstance.on(
      'message_delivered',
      (payload: { messageId: string; conversationId: string; userId: string }) => {
        const key = `/api/v1/chats/conversations/${payload.conversationId}`;
        if (cache.get(key)?.data !== undefined) {
          mutate(key);
        }
      }
    );

    // -----------------------------------------------------------------------
    // 6. TYPING - user_typing
    // -----------------------------------------------------------------------
    const handleTypingEvent = (payload: { conversationId: string; userId: string; typing?: boolean }, isTyping: boolean) => {
      const { conversationId, userId } = payload;
      if (userId === currentUserId) return;

      const key = `${conversationId}-${userId}`;

      // Resolve name from store
      const {conversations} = useChatStore.getState();
      let typingName = 'Someone';
      let targetConvId = conversationId;

      if (targetConvId === 'temp') {
        const directConv = conversations.find(
          (c) =>
            !c.isGroup &&
            (c.otherUser?._id === userId || c.otherUser?.id === userId)
        );
        if (directConv) targetConvId = directConv._id;
      }

      const targetConv = conversations.find((c) => c._id === targetConvId);
      if (targetConv) {
        const participant = targetConv.participants?.find((p: any) => {
          const pId = typeof p === 'string' ? p : p._id || p.id;
          return pId === userId;
        });
        if (participant && typeof participant === 'object' && participant.name) {
          typingName = participant.name;
        } else if (
          targetConv.otherUser &&
          (targetConv.otherUser._id === userId || targetConv.otherUser.id === userId)
        ) {
          typingName = targetConv.otherUser.name;
        }
      }

      if (isTyping === false) {
        if (typingTimeouts[key]) {
          clearTimeout(typingTimeouts[key]);
          delete typingTimeouts[key];
        }
        useChatStore.getState().setTypingUser(targetConvId, typingName, false);
        setTypingUsers((prev) => {
          const list = prev[conversationId] || [];
          return { ...prev, [conversationId]: list.filter((id) => id !== userId) };
        });
        return;
      }

      useChatStore.getState().setTypingUser(targetConvId, typingName, true);
      setTypingUsers((prev) => {
        const list = prev[conversationId] || [];
        if (list.includes(userId)) return prev;
        return { ...prev, [conversationId]: [...list, userId] };
      });

      if (typingTimeouts[key]) clearTimeout(typingTimeouts[key]);
      typingTimeouts[key] = setTimeout(() => {
        useChatStore.getState().setTypingUser(targetConvId, typingName, false);
        setTypingUsers((prev) => {
          const list = prev[conversationId] || [];
          return { ...prev, [conversationId]: list.filter((id) => id !== userId) };
        });
        delete typingTimeouts[key];
      }, 4000);
    };

    socketInstance.on('user_typing', (payload) => handleTypingEvent(payload, payload.typing ?? true));
    socketInstance.on('typing_start', (payload) => handleTypingEvent(payload, true));
    socketInstance.on('typing_stop', (payload) => handleTypingEvent(payload, false));

    // -----------------------------------------------------------------------
    // 7. RECORDING - user_recording
    // -----------------------------------------------------------------------
    socketInstance.on(
      'user_recording',
      (payload: { conversationId: string; userId: string; recording: boolean }) => {
        const { conversationId, userId, recording } = payload;
        if (userId === currentUserId) return;

        const {conversations} = useChatStore.getState();
        let recordingName = 'Someone';
        let targetConvId = conversationId;

        if (targetConvId === 'temp') {
          const directConv = conversations.find(
            (c) =>
              !c.isGroup &&
              (c.otherUser?._id === userId || c.otherUser?.id === userId)
          );
          if (directConv) targetConvId = directConv._id;
        }

        const targetConv = conversations.find((c) => c._id === targetConvId);
        if (targetConv) {
          const participant = targetConv.participants?.find((p: any) => {
            const pId = typeof p === 'string' ? p : p._id || p.id;
            return pId === userId;
          });
          if (participant && typeof participant === 'object' && participant.name) {
            recordingName = participant.name;
          } else if (
            targetConv.otherUser &&
            (targetConv.otherUser._id === userId || targetConv.otherUser.id === userId)
          ) {
            recordingName = targetConv.otherUser.name;
          }
        }

        // Update zustand store
        useChatStore.getState().setRecordingUser(targetConvId, recordingName, recording);

        // Update local React state
        setRecordingUsers((prev) => {
          const list = prev[conversationId] || [];
          if (recording) {
            if (list.includes(userId)) return prev;
            return { ...prev, [conversationId]: [...list, userId] };
          }
          return { ...prev, [conversationId]: list.filter((id) => id !== userId) };
        });
      }
    );

    // -----------------------------------------------------------------------
    // 8. USER PROFILE - user_updated
    // -----------------------------------------------------------------------
    socketInstance.on(
      'user_updated',
      (data: { userId: string; name: string; avatar: string; about: string; privacy: any }) => {
        // Update Zustand store
        useChatStore.getState().updateConversationUser(data.userId, data);

        // Update SWR cache for active conversation details
        const liveActiveConversationId = useChatStore.getState().activeConversationId;
        if (liveActiveConversationId) {
          const detailCacheKey = `/api/v1/chats/conversations/${liveActiveConversationId}`;
          if (cache.get(detailCacheKey)?.data !== undefined) {
            mutate(
              detailCacheKey,
              (current: any) => {
                if (!current || !current.conversation) return current;
                return {
                  ...current,
                  conversation: {
                    ...current.conversation,
                    participants: current.conversation.participants.map((p: any) => {
                      if (p.id === data.userId) {
                        return {
                          ...p,
                          name: data.name !== undefined ? data.name : p.name,
                          avatarUrl: data.avatar !== undefined ? data.avatar : p.avatarUrl,
                          about: data.about !== undefined ? data.about : p.about,
                        };
                      }
                      return p;
                    }),
                  },
                };
              },
              { revalidate: false }
            );
          }
        }

        // Update SWR cache for conversations list
        const conversationsListKey = '/api/v1/chats/conversations';
        if (cache.get(conversationsListKey)?.data !== undefined) {
          mutate(
            conversationsListKey,
            (current: any) => {
              if (!current || !current.data) return current;
              return {
                ...current,
                data: current.data.map((c: any) => {
                  if (!c.isGroup && c.otherUser?._id === data.userId) {
                    return {
                      ...c,
                      name: data.name !== undefined ? data.name : c.name,
                      avatar: data.avatar !== undefined ? data.avatar : c.avatar,
                      otherUser: { ...c.otherUser, ...data },
                    };
                  }
                  const hasParticipant = c.participants?.some(
                    (p: any) => (p._id || p.id || p) === data.userId
                  );
                  if (hasParticipant) {
                    return {
                      ...c,
                      participants: c.participants.map((p: any) => {
                        const pId = p._id || p.id || p;
                        if (pId === data.userId) {
                          return typeof p === 'object'
                            ? {
                                ...p,
                                ...data,
                                name: data.name !== undefined ? data.name : p.name,
                                avatar: data.avatar !== undefined ? data.avatar : p.avatar,
                                about: data.about !== undefined ? data.about : p.about,
                              }
                            : p;
                        }
                        return p;
                      }),
                    };
                  }
                  return c;
                }),
              };
            },
            { revalidate: false }
          );
        }

        // Update SWR cache for contacts list
        const contactsCacheKey = '/api/v1/users/get';
        if (cache.get(contactsCacheKey)?.data !== undefined) {
          mutate(
            contactsCacheKey,
            (current: any) => {
              if (!current || !current.data) return current;
              return {
                ...current,
                data: current.data.map((u: any) => {
                  if (u._id === data.userId) {
                    return {
                      ...u,
                      ...data,
                    };
                  }
                  return u;
                }),
              };
            },
            { revalidate: false }
          );
        }
      }
    );

    // -----------------------------------------------------------------------
    // 9. BLOCKING - user_blocked / user_unblocked
    // -----------------------------------------------------------------------
    socketInstance.on('user_blocked', (payload: { targetUserId: string }) => {
      console.log(`[BLOCK_UI_UPDATE] I blocked target user: ${payload.targetUserId}`);
      useAuthStore.getState().toggleBlockUser(payload.targetUserId, true);

      const {conversations} = useChatStore.getState();
      const directConv = conversations.find(
        (c) => !c.isGroup && c.otherUser?._id === payload.targetUserId
      );
      if (directConv) {
        useChatStore.getState().setTypingUser(directConv._id, 'Someone', false);
      }

      toast.error(`Blocked user ${payload.targetUserId}`);
      mutate((_endpoints: any) => true);
    });

    socketInstance.on('user_unblocked', (payload: { targetUserId: string }) => {
      console.log(`[UNBLOCK_UI_UPDATE] I unblocked target user: ${payload.targetUserId}`);
      useAuthStore.getState().toggleBlockUser(payload.targetUserId, false);
      toast.success(`Unblocked user ${payload.targetUserId}`);
      mutate((_endpoints: any) => true);
    });

    // -----------------------------------------------------------------------
    // 10. DISAPPEARING MODE
    // -----------------------------------------------------------------------
    socketInstance.on(
      'disappearing_mode_update',
      (payload: { conversationId: string; mode: string; updatedBy: any }) => {
        const key = `/api/v1/chats/conversations/${payload.conversationId}`;
        if (cache.get(key)?.data !== undefined) {
          mutate(key);
        }
        // Also refresh the conversations list so disappearingMode badge updates
        mutate('/api/v1/chats/conversations');

        useChatStore
          .getState()
          .updateConversationDisappearingMode(payload.conversationId, payload.mode);

        // Resolve the updater name — backend may send an id, object, or nothing
        const updaterName: string =
          (typeof payload.updatedBy === 'object' && payload.updatedBy !== null
            ? payload.updatedBy.name || payload.updatedBy.username
            : typeof payload.updatedBy === 'string' && payload.updatedBy.length < 40
              ? payload.updatedBy   // short string → likely a name
              : null) || 'Someone';

        // Skip toast for the user who made the change (they already got a success toast)
        const isMe = payload.updatedBy === currentUserId ||
          (typeof payload.updatedBy === 'object' && payload.updatedBy !== null &&
            (payload.updatedBy._id === currentUserId || payload.updatedBy.id === currentUserId));
        if (isMe) return;

        const MODE_LABELS: Record<string, string> = {
          off: 'Off',
          '24h': '24 Hours',
          '7d': '7 Days',
          '30d': '30 Days',
          '90d': '90 Days',
        };
        const modeLabel = (payload.mode && MODE_LABELS[payload.mode]) || payload.mode || 'Unknown';

        toast.info(`${updaterName} set disappearing messages to ${modeLabel}`);
      }
    );

    // -----------------------------------------------------------------------
    // 11. UPLOAD COMPLETED
    // -----------------------------------------------------------------------
    socketInstance.on('upload_completed', (payload: { uploadId: string; message: any }) => {
      mutate('/api/v1/chats/conversations');
      const convId = payload?.message?.conversationId || useChatStore.getState().activeConversationId;
      if (convId) {
        const key = `/api/v1/chats/conversations/${convId}`;
        if (cache.get(key)?.data !== undefined) {
          mutate(key);
        }
      }
    });

    // -----------------------------------------------------------------------
    // 12. REACTIONS - message_reactions (real-time for all participants)
    // -----------------------------------------------------------------------
    const handleMessageReaction = (payload: {
      messageId: string;
      conversationId: string;
      reactions: Array<{ emoji: string; senderId: string; username?: string }>;
      emoji?: string;
      senderId?: string;
    }) => {
      const convId = payload.conversationId;
      if (!convId) return;

      // Patch reactions in SWR cache without a network refetch
      const key = `/api/v1/chats/conversations/${convId}`;
      if (cache.get(key)?.data !== undefined) {
        mutate(
          key,
          (current: any) => {
            if (!current?.conversation?.messages) return current;
            return {
              ...current,
              conversation: {
                ...current.conversation,
                messages: current.conversation.messages.map((m: any) =>
                  m.id === payload.messageId
                    ? { ...m, reactions: payload.reactions }
                    : m
                ),
              },
            };
          },
          { revalidate: false }
        );
      }
    };

    socketInstance.on('message_reaction', handleMessageReaction);
    socketInstance.on('message_reaction_added', handleMessageReaction);
    socketInstance.on('message_reaction_updated', handleMessageReaction);
    socketInstance.on('message_reaction_removed', handleMessageReaction);

    // -----------------------------------------------------------------------
    // 13. MESSAGES READ - messages_read
    // -----------------------------------------------------------------------
    socketInstance.on(
      'messages_read',
      (payload: { conversationId: string; readBy: string }) => {
        const { conversationId, readBy } = payload;
        if (!conversationId) return;

        // 1. Update unreadCount locally in conversations list
        mutate(
          '/api/v1/chats/conversations',
          (current: any) => {
            if (!current || !current.data) return current;
            return {
              ...current,
              data: current.data.map((c: any) =>
                c._id === conversationId ? { ...c, unreadCount: readBy === currentUserId ? 0 : c.unreadCount } : c
              ),
            };
          },
          { revalidate: false }
        );

        // 2. Mark messages as read in the conversation cache
        const key = `/api/v1/chats/conversations/${conversationId}`;
        if (cache.get(key)?.data !== undefined) {
          mutate(
            key,
            (current: any) => {
              if (!current || !current.conversation) return current;
              return {
                ...current,
                conversation: {
                  ...current.conversation,
                  messages: current.conversation.messages.map((m: any) => {
                    if (m.senderId !== readBy) {
                      return { ...m, status: 'read' };
                    }
                    return m;
                  }),
                },
              };
            },
            { revalidate: false }
          );
        }
      }
    );

    // NOTE: call_* events (incoming_call, call_accepted, etc.)
    // are intentionally NOT handled here — they are managed in CallContext.

    // Cleanup
    return () => {
      socketInstance.offAny(onAnyEvent);
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
      socketInstance.off('online_users');
      socketInstance.off('presence_update');
      socketInstance.off('presence_hidden');
      socketInstance.off('presence_restored');
      socketInstance.off('new_message');
      socketInstance.off('message_delivered');
      socketInstance.off('user_typing');
      socketInstance.off('typing_start');
      socketInstance.off('typing_stop');
      socketInstance.off('user_recording');
      socketInstance.off('user_updated');
      socketInstance.off('user_blocked');
      socketInstance.off('user_unblocked');
      socketInstance.off('disappearing_mode_update');
      socketInstance.off('upload_completed');
      socketInstance.off('message_reaction', handleMessageReaction);
      socketInstance.off('message_reaction_added', handleMessageReaction);
      socketInstance.off('message_reaction_updated', handleMessageReaction);
      socketInstance.off('message_reaction_removed', handleMessageReaction);
      socketInstance.off('messages_read');
      Object.values(typingTimeouts).forEach(clearTimeout);
    };
  }, [token, currentUserId, cache]);

  // -----------------------------------------------------------------------
  // Emitters
  // -----------------------------------------------------------------------

  const sendMessage = (payload: { messageId: string; conversationId: string; text: string }) => {
    socketManager.emit('send_message', payload);
  };

  const startTyping = (payload: { conversationId: string }) => {
    socketManager.emit('typing_start', payload);
  };

  const stopTyping = (payload: { conversationId: string }) => {
    socketManager.emit('typing_stop', payload);
  };

  const markRead = (payload: { conversationId: string }) => {
    socketManager.emit('mark_read', payload);
  };

  const setDisappearingMode = (payload: {
    conversationId: string;
    mode: 'off' | '24h' | '7d' | '90d';
  }) => {
    socketManager.emit('set_disappearing_mode', payload);
  };

  const startRecording = (payload: { conversationId: string; recipientId: string }) => {
    socketManager.emit('recording_start', payload);
  };

  const stopRecording = (payload: { conversationId: string; recipientId: string }) => {
    socketManager.emit('recording_stop', payload);
  };

  // Thin pass-throughs — actual state management is in CallContext
  const callUser = (payload: { participants: string[]; callType: 'audio' | 'video' }) => {
    socketManager.emit('call_user', payload);
  };

  const acceptCall = (payload: { roomName: string }) => {
    socketManager.emit('accept_call', payload);
  };

  const rejectCall = (payload: { roomName: string }) => {
    socketManager.emit('reject_call', payload);
  };

  const createGroup = (payload: { name: string; participants: string[] }) => {
    socketManager.emit('create_group', payload);
  };

  const memoizedValue = useMemo(
    () => ({
      socket: socketManager.getSocket(),
      isConnected,
      typingUsers,
      recordingUsers,
      onlineUsers,
      sendMessage,
      startTyping,
      stopTyping,
      markRead,
      setDisappearingMode,
      startRecording,
      stopRecording,
      callUser,
      acceptCall,
      rejectCall,
      createGroup,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isConnected, typingUsers, recordingUsers, onlineUsers]
  );

  return <SocketContext.Provider value={memoizedValue}>{children}</SocketContext.Provider>;
}
