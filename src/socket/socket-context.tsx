// @refresh reset
import type { Socket } from 'socket.io-client';

import { mutate } from 'swr';
import { toast } from 'sonner';
import React, { useMemo, useState, useEffect, useContext, createContext } from 'react';

import { normalizeMessage } from 'src/utils/chat-utils';

import { useChatStore } from 'src/store/useChatStore';
import { useAuthStore } from 'src/store/useAuthStore';

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

      const activeConvId = useChatStore.getState().activeConversationId;
      const matchingConv = useChatStore
        .getState()
        .conversations.find((c) => c._id === normalized.conversationId);

      console.log('[NEW_MESSAGE] Socket event:', {
        messageId: normalized.messageId,
        conversationId: normalized.conversationId,
        senderId: normalized.senderId,
        loggedInUserId,
        activeConvId,
        foundConv: !!matchingConv,
      });

      // Update zustand store unread count + last message
      useChatStore
        .getState()
        .updateConversationLastMessage(normalized.conversationId!, normalized, loggedInUserId);

      const { conversationId, senderId } = normalized;

      const parsedMessage = {
        id: normalized.messageId,
        body: normalized.text,
        senderId,
        contentType: normalized.messageType,
        createdAt: normalized.createdAt,
        attachments: (normalized as any).attachments || [],
        isDeleted: normalized.isDeletedForEveryone || false,
        reactions: normalized.reactions || [],
      };

      if (conversationId) {
        // Mutate conversation messages cache
        mutate(
          `/api/v1/chats/conversations/${conversationId}`,
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

        if (senderId && senderId !== currentUserId) {
          mutate(
            `/api/v1/chats/conversations/${senderId}`,
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
                (conv.unreadCount || 0) +
                (parsedMessage.senderId !== currentUserId ? 1 : 0),
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
        mutate(`/api/v1/chats/conversations/${payload.conversationId}`);
      }
    );

    // -----------------------------------------------------------------------
    // 6. TYPING - user_typing
    // -----------------------------------------------------------------------
    socketInstance.on(
      'user_typing',
      (payload: { conversationId: string; userId: string; typing?: boolean }) => {
        const { conversationId, userId } = payload;
        if (userId === currentUserId) return;

        const key = `${conversationId}-${userId}`;

        // Resolve name from store for zustand update
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

        // Update zustand chat store
        useChatStore.getState().setTypingUser(targetConvId, typingName, true);

        // Update local React state for fast UI
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
      }
    );

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
        useChatStore.getState().updateConversationUser(data.userId, data);
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
      (payload: { conversationId: string; mode: string; updatedBy: string }) => {
        mutate(`/api/v1/chats/conversations/${payload.conversationId}`);
        useChatStore
          .getState()
          .updateConversationDisappearingMode(payload.conversationId, payload.mode);
        toast.info(`Disappearing messages changed to ${payload.mode} by ${payload.updatedBy}`);
      }
    );

    // -----------------------------------------------------------------------
    // 11. UPLOAD COMPLETED
    // -----------------------------------------------------------------------
    socketInstance.on('upload_completed', (_payload: { uploadId: string; message: any }) => {
      mutate('/api/v1/chats/conversations');
    });

    // NOTE: call_* events (incoming_call, call_accepted, etc.)
    // are intentionally NOT handled here — they are managed in CallContext.

    // Cleanup
    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
      socketInstance.off('online_users');
      socketInstance.off('presence_update');
      socketInstance.off('presence_hidden');
      socketInstance.off('presence_restored');
      socketInstance.off('new_message');
      socketInstance.off('message_delivered');
      socketInstance.off('user_typing');
      socketInstance.off('user_recording');
      socketInstance.off('user_updated');
      socketInstance.off('user_blocked');
      socketInstance.off('user_unblocked');
      socketInstance.off('disappearing_mode_update');
      socketInstance.off('upload_completed');
      Object.values(typingTimeouts).forEach(clearTimeout);
    };
  }, [token, currentUserId]);

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
