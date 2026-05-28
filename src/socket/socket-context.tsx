import type { Socket } from 'socket.io-client';

import { mutate } from 'swr';
import { toast } from 'sonner';
import React, { useMemo, useState, useEffect, useContext, createContext } from 'react';

import { useAuthContext } from 'src/auth/hooks';

import { socketService } from './socket-service';

// ----------------------------------------------------------------------

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  typingUsers: Record<string, string[]>; // conversationId -> userIds[]
  recordingUsers: Record<string, string[]>; // conversationId -> userIds[]
  onlineUsers: Set<string>;
  activeCall: CallState | null;
  
  sendMessage: (payload: { messageId: string; conversationId: string; text: string }) => void;
  startTyping: (payload: { conversationId: string }) => void;
  markRead: (payload: { conversationId: string }) => void;
  setDisappearingMode: (payload: { conversationId: string; mode: 'off' | '24h' | '7d' | '90d' }) => void;
  startRecording: (payload: { conversationId: string; recipientId: string }) => void;
  stopRecording: (payload: { conversationId: string; recipientId: string }) => void;
  callUser: (payload: { participants: string[]; callType: 'audio' | 'video' }) => void;
  acceptCall: (payload: { roomName: string }) => void;
  rejectCall: (payload: { roomName: string }) => void;
  createGroup: (payload: { name: string; participants: string[] }) => void;
}

export interface CallState {
  roomName?: string;
  roomId?: string;
  groupId?: string;
  initiatedBy?: string;
  participants?: string[];
  callType?: 'audio' | 'video';
  status: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

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
  const [activeCall, setActiveCall] = useState<CallState | null>(null);

  const currentUserId = useMemo(() => user?._id || user?.id || '', [user]);
  const token = useMemo(() => user?.accessToken || sessionStorage.getItem('jwt_access_token') || '', [user]);

  // Connect socket when token changes/is available
  useEffect(() => {
    if (!token) {
      socketService.disconnect();
      setIsConnected(false);
      return undefined;
    }

    const socket = socketService.connect(token);
    setIsConnected(socket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Dynamic timeout mapping for typing statuses
    const typingTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

    // --- Events Listeners ---

    // 1. new_message
    socket.on('new_message', (data: any) => {
      const { message, sender, conversationId, attachments, timestamp } = data;
      
      const senderId = typeof sender === 'object' && sender ? sender._id || sender.id || '' : sender || '';
      const messageBody = typeof message === 'object' && message ? message.text || message.message || '' : message || '';

      const parsedMessage = {
        id: message?.messageId || message?._id || data.messageId || data._id || String(Date.now()),
        body: messageBody,
        senderId,
        contentType: message?.type || message?.messageType || 'text',
        createdAt: timestamp || message?.createdAt || new Date().toISOString(),
        attachments: attachments || message?.attachments || [],
        isDeleted: false,
        reactions: [],
      };

      // Mutate conversation messages
      mutate(`/api/v1/chats/conversations/${conversationId}`, (current: any) => {
        if (!current || !current.conversation) return current;
        const exists = current.conversation.messages.some((m: any) => m.id === parsedMessage.id);
        if (exists) return current;
        return {
          ...current,
          conversation: {
            ...current.conversation,
            messages: [...current.conversation.messages, parsedMessage],
          },
        };
      }, { revalidate: false });

      if (senderId && senderId !== currentUserId) {
        mutate(`/api/v1/chats/conversations/${senderId}`, (current: any) => {
          if (!current || !current.conversation) return current;
          const exists = current.conversation.messages.some((m: any) => m.id === parsedMessage.id);
          if (exists) return current;
          return {
            ...current,
            conversation: {
              ...current.conversation,
              messages: [...current.conversation.messages, parsedMessage],
            },
          };
        }, { revalidate: false });
      }

      // Mutate conversation list
      mutate('/api/v1/chats/conversations', (current: any) => {
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
          unreadCount: (conv.unreadCount || 0) + (parsedMessage.senderId !== currentUserId ? 1 : 0),
        };

        updatedList.splice(index, 1);
        updatedList.unshift(updatedConv);

        return {
          ...current,
          data: updatedList,
        };
      }, { revalidate: false });
    });

    // 2. message_delivered
    socket.on('message_delivered', (payload: { messageId: string; conversationId: string; userId: string }) => {
      const { conversationId } = payload;
      mutate(`/api/v1/chats/conversations/${conversationId}`);
    });

    // 3. user_typing
    socket.on('user_typing', (payload: { conversationId: string; userId: string }) => {
      const { conversationId, userId } = payload;
      if (userId === currentUserId) return;

      const key = `${conversationId}-${userId}`;

      setTypingUsers((prev) => {
        const list = prev[conversationId] || [];
        if (list.includes(userId)) return prev;
        return { ...prev, [conversationId]: [...list, userId] };
      });

      if (typingTimeouts[key]) {
        clearTimeout(typingTimeouts[key]);
      }

      typingTimeouts[key] = setTimeout(() => {
        setTypingUsers((prev) => {
          const list = prev[conversationId] || [];
          return { ...prev, [conversationId]: list.filter((id) => id !== userId) };
        });
        delete typingTimeouts[key];
      }, 4000);
    });

    // 4. disappearing_mode_update
    socket.on('disappearing_mode_update', (payload: { conversationId: string; mode: string; updatedBy: string }) => {
      const { conversationId, mode, updatedBy } = payload;
      mutate(`/api/v1/chats/conversations/${conversationId}`);
      toast.info(`Disappearing messages mode changed to ${mode} by ${updatedBy}`);
    });

    // 5. user_recording
    socket.on('user_recording', (payload: { conversationId: string; userId: string; recording: boolean }) => {
      const { conversationId, userId, recording } = payload;
      if (userId === currentUserId) return;

      setRecordingUsers((prev) => {
        const list = prev[conversationId] || [];
        if (recording) {
          if (list.includes(userId)) return prev;
          return { ...prev, [conversationId]: [...list, userId] };
        }
        return { ...prev, [conversationId]: list.filter((id) => id !== userId) };
      });
    });

    // 6. user_blocked / user_unblocked
    socket.on('user_blocked', (payload: { targetUserId: string }) => {
      toast.error(`You have been blocked by user ${payload.targetUserId}`);
      mutate(endpoints => true); // Revalidate everything
    });

    socket.on('user_unblocked', (payload: { targetUserId: string }) => {
      toast.success(`You have been unblocked by user ${payload.targetUserId}`);
      mutate(endpoints => true); // Revalidate everything
    });

    // 7. presence_hidden / presence_restored
    socket.on('presence_hidden', (payload: { userId: string; status: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(payload.userId);
        return next;
      });
    });

    socket.on('presence_restored', (payload: { userId: string; status: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.add(payload.userId);
        return next;
      });
    });

    // 8. call_accepted
    socket.on('call_accepted', (payload: { userId: string; roomName: string }) => {
      setActiveCall((prev) => prev ? { ...prev, status: 'connected', roomName: payload.roomName } : null);
      toast.success(`Call accepted by user`);
    });

    // 9. call_answered_elsewhere
    socket.on('call_answered_elsewhere', (payload: { roomName: string }) => {
      setActiveCall(null);
      toast.info(`Call answered on another device`);
    });

    // 10. call_missed
    socket.on('call_missed', (payload: { roomName: string }) => {
      setActiveCall(null);
      toast.warning(`Call missed`);
    });

    // 11. group_call_started
    socket.on('group_call_started', (payload: { groupId: string; roomId: string; initiatedBy: string }) => {
      setActiveCall({
        groupId: payload.groupId,
        roomId: payload.roomId,
        initiatedBy: payload.initiatedBy,
        status: 'incoming',
        callType: 'video',
      });
      toast.info(`Group call started`);
    });

    // 12. group_call_ended
    socket.on('group_call_ended', (payload: { roomId: string }) => {
      setActiveCall(null);
      toast.info(`Group call ended`);
    });

    // 13. participant_joined / participant_left
    socket.on('participant_joined', (payload: { roomId: string; userId: string; user: any }) => {
      setActiveCall((prev) => {
        if (!prev) return prev;
        const currentParticipants = prev.participants || [];
        if (currentParticipants.includes(payload.userId)) return prev;
        return {
          ...prev,
          participants: [...currentParticipants, payload.userId],
        };
      });
      toast.info(`Participant joined the call`);
    });

    socket.on('participant_left', (payload: { roomId: string; userId: string }) => {
      setActiveCall((prev) => {
        if (!prev) return prev;
        const currentParticipants = prev.participants || [];
        return {
          ...prev,
          participants: currentParticipants.filter((id) => id !== payload.userId),
        };
      });
      toast.info(`Participant left the call`);
    });

    // 14. upload_completed
    socket.on('upload_completed', (payload: { uploadId: string; message: any }) => {
      mutate('/api/v1/chats/conversations');
    });

    // Cleanup listeners
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new_message');
      socket.off('message_delivered');
      socket.off('user_typing');
      socket.off('disappearing_mode_update');
      socket.off('user_recording');
      socket.off('user_blocked');
      socket.off('user_unblocked');
      socket.off('presence_hidden');
      socket.off('presence_restored');
      socket.off('call_accepted');
      socket.off('call_answered_elsewhere');
      socket.off('call_missed');
      socket.off('group_call_started');
      socket.off('group_call_ended');
      socket.off('participant_joined');
      socket.off('participant_left');
      socket.off('upload_completed');
      
      Object.values(typingTimeouts).forEach(clearTimeout);
    };
  }, [token, currentUserId]);

  // --- Emitters ---

  const sendMessage = (payload: { messageId: string; conversationId: string; text: string }) => {
    socketService.emit('send_message', payload);
  };

  const startTyping = (payload: { conversationId: string }) => {
    socketService.emit('typing_start', payload);
  };

  const markRead = (payload: { conversationId: string }) => {
    socketService.emit('mark_read', payload);
  };

  const setDisappearingMode = (payload: { conversationId: string; mode: 'off' | '24h' | '7d' | '90d' }) => {
    socketService.emit('set_disappearing_mode', payload);
  };

  const startRecording = (payload: { conversationId: string; recipientId: string }) => {
    socketService.emit('recording_start', payload);
  };

  const stopRecording = (payload: { conversationId: string; recipientId: string }) => {
    socketService.emit('recording_stop', payload);
  };

  const callUser = (payload: { participants: string[]; callType: 'audio' | 'video' }) => {
    setActiveCall({
      participants: payload.participants,
      callType: payload.callType,
      status: 'calling',
    });
    socketService.emit('call_user', payload);
  };

  const acceptCall = (payload: { roomName: string }) => {
    setActiveCall((prev) => prev ? { ...prev, status: 'connected', roomName: payload.roomName } : null);
    socketService.emit('accept_call', payload);
  };

  const rejectCall = (payload: { roomName: string }) => {
    setActiveCall(null);
    socketService.emit('reject_call', payload);
  };

  const createGroup = (payload: { name: string; participants: string[] }) => {
    socketService.emit('create_group', payload);
  };

  const memoizedValue = useMemo(
    () => ({
      socket: socketService.getSocket(),
      isConnected,
      typingUsers,
      recordingUsers,
      onlineUsers,
      activeCall,
      sendMessage,
      startTyping,
      markRead,
      setDisappearingMode,
      startRecording,
      stopRecording,
      callUser,
      acceptCall,
      rejectCall,
      createGroup,
    }),
    [isConnected, typingUsers, recordingUsers, onlineUsers, activeCall]
  );

  return <SocketContext.Provider value={memoizedValue}>{children}</SocketContext.Provider>;
}
