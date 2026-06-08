import { useEffect } from 'react';
import { mutate, useSWRConfig } from 'swr';

import { useChatStore } from 'src/store/useChatStore';
import { useGroupStore } from 'src/store/useGroupStore';
import { socketManager } from 'src/socket/socket-service';
import { useProfileStore } from 'src/store/useProfileStore';
import { useGroupCallStore } from 'src/store/useGroupCallStore';
import { useGroupTypingStore } from 'src/store/useGroupTypingStore';
import { useGroupRealtimeStore } from 'src/store/useGroupRealtimeStore';

// ----------------------------------------------------------------------
// Reference: cct_chat_employ_user_admin/src/features/groups/sockets/useGroupSockets.ts
// ----------------------------------------------------------------------

export const useGroupSockets = (currentUserId: string | undefined) => {
  const { cache } = useSWRConfig(); // access in-memory SWR cache (no extra HTTP calls)

  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket || !currentUserId) return undefined;

    // -----------------------------------------------------------------------
    // STRUCTURAL EVENTS
    // -----------------------------------------------------------------------

    const getConversationId = (g: any): string => {
      if (!g) return '';
      if (typeof g.conversationId === 'object' && g.conversationId) {
        return g.conversationId._id || g.conversationId.id || '';
      }
      return g.conversationId || '';
    };

    const handleGroupCreated = (data: any) => {
      const { conversation, group } = data;
      useGroupStore.getState().setGroup(conversation._id, group);
    };

    const handleGroupUpdated = (data: any) => {
      const { type, group, userId } = data;
      const groupConvId = getConversationId(group);
      useGroupStore.getState().updateGroup(groupConvId, group);

      if (type === 'member_added') {
        // ─── Optimistic update for ALL group members ────────────────────────
        // Pull new member IDs from the updated group payload
        const newMemberIds: string[] = group.members || [];
        const convKey = `/api/v1/chats/conversations/${groupConvId}`;

        mutate(
          convKey,
          (current: any) => {
            if (!current?.conversation) return current;

            const existingIds = new Set(
              current.conversation.participants.map((p: any) => p.id || p._id)
            );
            const addedIds = newMemberIds.filter((id) => !existingIds.has(id));
            if (!addedIds.length) return current;

            // Look up full user objects from the already-loaded users SWR cache
            const usersState = cache.get('/api/v1/users/get');
            const allUsers: any[] = usersState?.data?.data || [];

            const newParticipants = addedIds
              .map((id) => allUsers.find((u: any) => (u._id || u.id) === id))
              .filter(Boolean)
              .map((u: any) => ({
                id: u._id || u.id || '',
                name: u.name || u.displayName || 'User',
                username: u.username || '',
                role: u.role || 'user',
                email: u.email || '',
                address: u.address || '',
                avatarUrl: u.avatar || u.photoURL || '',
                phoneNumber: u.mobile || u.phoneNumber || '',
                lastActivity: u.lastSeen || new Date().toISOString(),
                status: 'offline' as const,
              }));

            if (!newParticipants.length) return current; // still revalidates below

            return {
              ...current,
              conversation: {
                ...current.conversation,
                participants: [...current.conversation.participants, ...newParticipants],
              },
            };
          },
          { revalidate: true } // background revalidate to stay in sync
        );
        // ───────────────────────────────────────────────────────────────────

        mutate('/api/v1/groups');
        mutate(`/api/v1/groups/${group._id}`);
        mutate('/api/v1/chats/conversations');
      }

      if (type === 'member_removed' || type === 'member_left') {
        // Instantly remove the participant from the conversation cache
        // for all remaining group members (including the current user)
        if (userId) {
          mutate(
            `/api/v1/chats/conversations/${groupConvId}`,
            (current: any) => {
              if (!current?.conversation) return current;
              return {
                ...current,
                conversation: {
                  ...current.conversation,
                  participants: current.conversation.participants.filter(
                    (p: any) => (p.id || p._id) !== userId
                  ),
                },
              };
            },
            { revalidate: true }
          );
        }

        if (userId === currentUserId) {
          useGroupStore.getState().removeGroup(groupConvId);
          useGroupRealtimeStore.getState().clearConversation(groupConvId);

          const chatStore = useChatStore.getState();
          if (chatStore.activeConversationId === groupConvId) {
            chatStore.setActiveConversation(null);
          }
          const updatedConvs = chatStore.conversations.filter(
            (c) => c._id !== groupConvId
          );
          chatStore.setConversations(updatedConvs);

          const callState = useGroupCallStore.getState();
          callState.removeActiveCall(group._id);
          if (callState.inCall) {
            const activeCall = callState.activeCalls[group._id];
            if (activeCall && callState.activeRoomId === activeCall.roomId) {
              callState.setInCall(false, undefined);
            }
          }

          useProfileStore.getState().closeContactDrawer();
        }
      }
    };

    const handleGroupDeleted = (data: { conversationId: string }) => {
      const { conversationId } = data;
      useGroupStore.getState().removeGroup(conversationId);
      useGroupRealtimeStore.getState().clearConversation(conversationId);

      const chatStore = useChatStore.getState();
      if (chatStore.activeConversationId === conversationId) {
        chatStore.setActiveConversation(null);
        // eslint-disable-next-line no-alert
        alert('This group was deleted by the creator.');
      }
      const updatedConvs = chatStore.conversations.filter((c) => c._id !== conversationId);
      chatStore.setConversations(updatedConvs);

      const callState = useGroupCallStore.getState();
      const groupEntry = Object.entries(useGroupStore.getState().groups).find(
        ([, g]) => getConversationId(g) === conversationId
      );
      if (groupEntry) {
        const [groupId] = groupEntry;
        callState.removeActiveCall(groupId);
        if (callState.inCall) {
          const activeCall = callState.activeCalls[groupId];
          if (activeCall && callState.activeRoomId === activeCall.roomId) {
            callState.setInCall(false, undefined);
          }
        }
      }

      useProfileStore.getState().closeContactDrawer();
    };

    const handleGroupMembershipInvalidated = (data: {
      conversationId: string;
      groupId: string;
      reason: 'removed' | 'left' | 'admin_removed';
      removedBy: string;
      timestamp: string;
    }) => {
      const { conversationId, groupId, reason } = data;

      useGroupStore.getState().removeGroup(conversationId);
      useGroupRealtimeStore.getState().clearConversation(conversationId);

      const chatStore = useChatStore.getState();
      if (chatStore.activeConversationId === conversationId) {
        chatStore.setActiveConversation(null);
        if (reason === 'removed') {
          // eslint-disable-next-line no-alert
          alert('You were removed from this group by the Admin.');
        } else if (reason === 'left') {
          // eslint-disable-next-line no-alert
        }
      }
      const updatedConvs = chatStore.conversations.filter((c) => c._id !== conversationId);
      chatStore.setConversations(updatedConvs);

      const callState = useGroupCallStore.getState();
      callState.removeActiveCall(groupId);
      if (callState.inCall) {
        const activeCall = callState.activeCalls[groupId];
        if (activeCall && callState.activeRoomId === activeCall.roomId) {
          callState.setInCall(false, undefined);
        }
      }

      useProfileStore.getState().closeContactDrawer();
    };

    const handleAddedToGroup = (group: any) => {
      useGroupStore.getState().setGroup(getConversationId(group), group);
    };


    // -----------------------------------------------------------------------
    // MESSAGING EVENTS
    // -----------------------------------------------------------------------

    const handleNewMessage = (message: any) => {
      const isGroupConv = !!useGroupStore.getState().groups[message.conversationId];
      if (isGroupConv) {
        useGroupRealtimeStore.getState().addMessage(message.conversationId, message);
      }
    };

    const handleMessagesRead = (data: { conversationId: string; readBy: string }) => {
      useGroupRealtimeStore.getState().markMessagesRead(data.conversationId, data.readBy);
    };

    // -----------------------------------------------------------------------
    // TYPING EVENTS
    // -----------------------------------------------------------------------

    const handleUserTyping = (data: {
      conversationId: string;
      userId: string;
      typing: boolean;
    }) => {
      useGroupTypingStore.getState().setTyping(data.conversationId, data.userId, data.typing);
    };

    // -----------------------------------------------------------------------
    // CALLING EVENTS
    // -----------------------------------------------------------------------

    const handleActiveCallAvailable = (data: any) => {
      useGroupCallStore.getState().setActiveCallAvailable(data.groupId, data);
    };

    const handleGroupCallStarted = (data: any) => {
      useGroupCallStore.getState().setActiveCallAvailable(data.groupId, data);
    };

    const handleParticipantJoined = (data: any) => {
      const state = useGroupCallStore.getState();
      const activeCallEntry = Object.entries(state.activeCalls).find(
        ([, call]) => call.roomId === data.roomId
      );
      if (activeCallEntry) {
        const [groupId, callData] = activeCallEntry;
        state.setActiveCallAvailable(groupId, {
          ...callData,
          activeParticipants: data.activeParticipants,
        });
      }
    };

    const handleParticipantLeft = (data: any) => {
      const state = useGroupCallStore.getState();
      const activeCallEntry = Object.entries(state.activeCalls).find(
        ([, call]) => call.roomId === data.roomId
      );
      if (activeCallEntry) {
        const [groupId, callData] = activeCallEntry;
        state.setActiveCallAvailable(groupId, {
          ...callData,
          activeParticipants: data.activeParticipants,
        });
      }
    };

    const handleGroupCallJoined = (data: any) => {
      console.log(`[GROUP_CALL_JOINED] Participant ${data.userId} joined Room ${data.roomId}`);
    };

    const handleGroupCallLeft = (data: any) => {
      console.log(`[GROUP_CALL_LEFT] Participant ${data.userId} left Room ${data.roomId}`);
    };

    const handleGroupCallDeclined = (data: { roomId: string; userId: string }) => {
      console.log(
        `[GROUP_CALL_DECLINED] Participant ${data.userId} declined Room ${data.roomId}`
      );
    };

    const handleGroupCallEnded = (data: { roomId: string }) => {
      const state = useGroupCallStore.getState();
      const activeCallEntry = Object.entries(state.activeCalls).find(
        ([, call]) => call.roomId === data.roomId
      );
      if (activeCallEntry) {
        const [groupId] = activeCallEntry;
        state.removeActiveCall(groupId);
        if (state.activeRoomId === data.roomId) {
          state.setInCall(false, undefined);
        }
      }
    };

    // -----------------------------------------------------------------------
    // JOIN REQUEST EVENTS
    // -----------------------------------------------------------------------

    const handleJoinRequestReceived = (data: any) => {
      const { groupId } = data;
      // Invalidate the join requests list so admins see the new request
      mutate(`/api/v1/groups/${groupId}/join-requests`);
    };

    const handleJoinRequestApproved = (data: any) => {
      const { groupId } = data;
      // Invalidate so the user sees the new group and conversation
      mutate('/api/v1/groups');
      mutate('/api/v1/chats/conversations');
      if (groupId) mutate(`/api/v1/groups/${groupId}`);
    };

    const handleJoinRequestRejected = (data: any) => {
      const { groupId } = data;
      // Just invalidate in case user is viewing their pending requests
      mutate('/api/v1/groups');
      if (groupId) mutate(`/api/v1/groups/${groupId}`);
    };


    // -----------------------------------------------------------------------
    // Register all listeners
    // -----------------------------------------------------------------------
    socket.on('group_created', handleGroupCreated);
    socket.on('group_updated', handleGroupUpdated);
    socket.on('group_deleted', handleGroupDeleted);
    socket.on('group_membership_invalidated', handleGroupMembershipInvalidated);
    socket.on('added_to_group', handleAddedToGroup);
    socket.on('new_message', handleNewMessage);
    socket.on('messages_read', handleMessagesRead);
    socket.on('user_typing', handleUserTyping);
    socket.on('active_call_available', handleActiveCallAvailable);
    socket.on('group_call_started', handleGroupCallStarted);
    socket.on('participant_joined', handleParticipantJoined);
    socket.on('participant_left', handleParticipantLeft);
    socket.on('group_call_joined', handleGroupCallJoined);
    socket.on('group_call_left', handleGroupCallLeft);
    socket.on('group_call_declined', handleGroupCallDeclined);
    socket.on('group_call_ended', handleGroupCallEnded);

    socket.on('join_request_received', handleJoinRequestReceived);
    socket.on('join_request_approved', handleJoinRequestApproved);
    socket.on('join_request_rejected', handleJoinRequestRejected);

    return () => {
      socket.off('group_created', handleGroupCreated);
      socket.off('group_updated', handleGroupUpdated);
      socket.off('group_deleted', handleGroupDeleted);
      socket.off('group_membership_invalidated', handleGroupMembershipInvalidated);
      socket.off('added_to_group', handleAddedToGroup);
      socket.off('new_message', handleNewMessage);
      socket.off('messages_read', handleMessagesRead);
      socket.off('user_typing', handleUserTyping);
      socket.off('active_call_available', handleActiveCallAvailable);
      socket.off('group_call_started', handleGroupCallStarted);
      socket.off('participant_joined', handleParticipantJoined);
      socket.off('participant_left', handleParticipantLeft);
      socket.off('group_call_joined', handleGroupCallJoined);
      socket.off('group_call_left', handleGroupCallLeft);
      socket.off('group_call_declined', handleGroupCallDeclined);
      socket.off('group_call_ended', handleGroupCallEnded);

      socket.off('join_request_received', handleJoinRequestReceived);
      socket.off('join_request_approved', handleJoinRequestApproved);
      socket.off('join_request_rejected', handleJoinRequestRejected);
    };
  }, [currentUserId, cache]);
};


