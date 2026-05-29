import { useEffect } from 'react';

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
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket || !currentUserId) return undefined;

    // -----------------------------------------------------------------------
    // STRUCTURAL EVENTS
    // -----------------------------------------------------------------------

    const handleGroupCreated = (data: any) => {
      const { conversation, group } = data;
      useGroupStore.getState().setGroup(conversation._id, group);
    };

    const handleGroupUpdated = (data: any) => {
      const { type, group, userId } = data;
      useGroupStore.getState().updateGroup(group.conversationId, group);

      if (type === 'member_removed' || type === 'member_left') {
        if (userId === currentUserId) {
          useGroupStore.getState().removeGroup(group.conversationId);
          useGroupRealtimeStore.getState().clearConversation(group.conversationId);

          const chatStore = useChatStore.getState();
          if (chatStore.activeConversationId === group.conversationId) {
            chatStore.setActiveConversation(null);
          }
          const updatedConvs = chatStore.conversations.filter(
            (c) => c._id !== group.conversationId
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
        ([, g]) => g.conversationId === conversationId
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
          alert('You left the group.');
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
      useGroupStore.getState().setGroup(group.conversationId, group);
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
    };
  }, [currentUserId]);
};
