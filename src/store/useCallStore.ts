import { create } from 'zustand';

// ----------------------------------------------------------------------

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'incoming'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'syncing_tracks'
  | 'active'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'
  | 'rejected'
  | 'busy'
  | 'missed'
  | 'ended';

interface CallState {
  roomName: string | null;
  token: string | null;
  caller: any | null;
  callType: 'audio' | 'video';
  status: CallStatus;
  isOutgoing: boolean;
  isMinimized: boolean;

  // Group call additions
  isGroupCall?: boolean;
  groupId?: string | null;
  groupName?: string | null;
  groupAvatar?: string | null;
  participantCount?: number;
  callId?: string | null;
  conversationId?: string | null;

  initiateOutgoingCall: (roomName: string, callType: 'audio' | 'video', caller: any, token: string, groupData?: any) => void;
  receiveIncomingCall: (roomName: string, caller: any, callType: 'audio' | 'video', groupData?: any) => void;
  acceptIncomingCall: (token: string, roomName: string) => void;
  callAcceptedByRemote: () => void;
  setCallStatus: (status: CallStatus) => void;
  setMinimized: (minimized: boolean) => void;
  endCall: () => void;
  restoreCall: (data: Partial<CallState>) => void;
}

// ----------------------------------------------------------------------

export const useCallStore = create<CallState>((set) => ({
  roomName: null,
  token: null,
  caller: null,
  callType: 'video',
  status: 'idle',
  isOutgoing: false,
  isGroupCall: false,
  isMinimized: false,
  groupId: null,
  groupName: null,
  groupAvatar: null,
  participantCount: 0,
  callId: null,
  conversationId: null,

  initiateOutgoingCall: (roomName, callType, caller, token, groupData) => {
    console.log(`[CALL_STATE_TRANSITION] idle -> calling | Room: ${roomName}`);
    const payload = {
      isOutgoing: true,
      roomName,
      callType,
      caller,
      token,
      status: 'calling' as CallStatus,
      isGroupCall: !!groupData,
      isMinimized: false,
      groupId: groupData?.groupId || null,
      groupName: groupData?.groupName || null,
      groupAvatar: groupData?.groupAvatar || null,
      participantCount: groupData?.participantCount || 0,
      callId: groupData?.callId || null,
      conversationId: groupData?.conversationId || null,
    };
    set(payload);
    sessionStorage.setItem('active_call', JSON.stringify(payload));
  },

  receiveIncomingCall: (roomName, caller, callType, groupData) => {
    console.log(`[CALL_STORE] receiveIncomingCall | Room: ${roomName} | Caller: ${caller?.name} | Type: ${callType}`);
    const payload = {
      isOutgoing: false,
      roomName,
      caller,
      callType,
      status: 'incoming' as CallStatus,
      isGroupCall: !!(groupData && groupData.isGroup),
      isMinimized: false,
      groupId: groupData?.groupId || null,
      groupName: groupData?.groupName || null,
      groupAvatar: groupData?.groupAvatar || null,
      participantCount: groupData?.participantCount || 0,
      callId: groupData?.callId || null,
      conversationId: groupData?.conversationId || null,
    };
    set(payload);
    sessionStorage.setItem('active_call', JSON.stringify(payload));
  },

  acceptIncomingCall: (token, roomName) => {
    const type = useCallStore.getState().callType;
    console.log(`[CALL_STORE] acceptIncomingCall | Room: ${roomName} | Type: ${type}`);
    set({ token, roomName, status: 'connecting', isMinimized: false });
    const saved = JSON.parse(sessionStorage.getItem('active_call') || '{}');
    sessionStorage.setItem(
      'active_call',
      JSON.stringify({ ...saved, token, roomName, status: 'connecting', isMinimized: false })
    );
  },

  callAcceptedByRemote: () => {
    console.log('[CALL_STORE] callAcceptedByRemote');
    set({ status: 'connecting', isMinimized: false });
    const saved = JSON.parse(sessionStorage.getItem('active_call') || '{}');
    sessionStorage.setItem(
      'active_call',
      JSON.stringify({ ...saved, status: 'connecting', isMinimized: false })
    );
  },

  setCallStatus: (status) => {
    const prevStatus = useCallStore.getState().status;
    console.log(`[CALL_STORE] setCallStatus | ${prevStatus} -> ${status}`);
    set({ status });
    if (status === 'idle' || status === 'ended') {
      sessionStorage.removeItem('active_call');
    } else {
      const saved = JSON.parse(sessionStorage.getItem('active_call') || '{}');
      sessionStorage.setItem('active_call', JSON.stringify({ ...saved, status }));
    }
  },

  setMinimized: (minimized) => {
    console.log(`[CALL_STORE] setMinimized | ${minimized}`);
    set({ isMinimized: minimized });
    const saved = JSON.parse(sessionStorage.getItem('active_call') || '{}');
    sessionStorage.setItem('active_call', JSON.stringify({ ...saved, isMinimized: minimized }));
  },

  endCall: () => {
    console.log('[CALL_STORE] endCall (Resetting state to idle)');
    set({
      roomName: null,
      token: null,
      caller: null,
      status: 'idle',
      isOutgoing: false,
      isGroupCall: false,
      isMinimized: false,
      groupId: null,
      groupName: null,
      groupAvatar: null,
      participantCount: 0,
      callId: null,
      conversationId: null,
    });
    sessionStorage.removeItem('active_call');
  },

  restoreCall: (data) => {
    const currentStatus = useCallStore.getState().status;
    console.log(`[CALL_STORE] restoreCall | Current: ${currentStatus} | Restoring:`, data);
    if (currentStatus !== 'idle' && (data.status === 'idle' || !data.status)) {
      console.warn('[CALL_STORE] restoreCall blocked: Attempted to restore idle state over active state');
      return;
    }
    set((state) => ({ ...state, ...data }));
  },
}));
