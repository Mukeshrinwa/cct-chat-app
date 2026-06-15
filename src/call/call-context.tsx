// @refresh reset
/**
 * CallContext — Central state machine for audio/video calls.
 *
 * States: idle → calling → ringing → incoming → connected → rejected | missed | ended
 *
 * Architecture:
 *  - Socket events drive state transitions
 *  - LiveKit SDK handles actual media (audio/video tracks)
 *  - REST API is a fallback for initiating/ending calls when socket fails
 */

import type { Room, LocalTrack, RemoteParticipant } from 'livekit-client';

import {
  RoomEvent,
  createLocalTracks,
} from 'livekit-client';
import React, {
  useRef,
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback,
  createContext,
} from 'react';

import { useChatStore } from 'src/store/useChatStore';
import { socketService } from 'src/socket/socket-service';
import { getCallHistory, sendCallWebhook } from 'src/api/call';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'incoming'
  | 'connected'
  | 'rejected'
  | 'missed'
  | 'ended';

export type CallType = 'audio' | 'video';

export interface CallerInfo {
  _id: string;
  name: string;
  avatar?: string;
}

export interface ActiveCallState {
  status: CallStatus;
  callType: CallType;
  roomName: string | null;
  livekitToken: string | null;
  caller: CallerInfo | null;
  participants: string[];
  isGroup: boolean;
  groupId?: string;
  initiatedBy?: string;
  startedAt: number | null; // timestamp ms — for timer
}

export interface RemoteParticipantState {
  identity: string;
  name: string;
  isMuted: boolean;
  hasCameraOff: boolean;
  audioTrack: MediaStreamTrack | null;
  videoTrack: MediaStreamTrack | null;
}

interface CallContextType {
  // State
  call: ActiveCallState;
  remoteParticipants: RemoteParticipantState[];
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;

  // Actions
  startCall: (participants: string[], callType: CallType, recipientName?: string, recipientAvatar?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;

  // LiveKit room ref (for advanced usage)
  livekitRoom: Room | null;
}

// ----------------------------------------------------------------------
// Defaults
// ----------------------------------------------------------------------

const DEFAULT_CALL: ActiveCallState = {
  status: 'idle',
  callType: 'audio',
  roomName: null,
  livekitToken: null,
  caller: null,
  participants: [],
  isGroup: false,
  startedAt: null,
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

// ----------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const currentUserId = useMemo(
    () => user?._id || user?.id || '',
    [user]
  );

  const [call, setCall] = useState<ActiveCallState>(DEFAULT_CALL);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipantState[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // LiveKit room instance
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null);

  // Local tracks refs for cleanup
  const localTracksRef = useRef<LocalTrack[]>([]);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const outgoingToneRef = useRef<HTMLAudioElement | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----------------------------------------------------------------------
  // Audio helpers
  // ----------------------------------------------------------------------

  const playIncomingRingtone = useCallback(() => {
    try {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio('/sounds/ringtone.mp3');
        ringtoneRef.current.loop = true;
      }
      ringtoneRef.current.play().catch(() => {});
    } catch {
      // ignore audio errors
    }
  }, []);

  const stopIncomingRingtone = useCallback(() => {
    try {
      ringtoneRef.current?.pause();
      if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    } catch {
      // ignore
    }
  }, []);

  const playOutgoingTone = useCallback(() => {
    try {
      if (!outgoingToneRef.current) {
        outgoingToneRef.current = new Audio('/sounds/outgoing.mp3');
        outgoingToneRef.current.loop = true;
      }
      outgoingToneRef.current.play().catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  const stopOutgoingTone = useCallback(() => {
    try {
      outgoingToneRef.current?.pause();
      if (outgoingToneRef.current) outgoingToneRef.current.currentTime = 0;
    } catch {
      // ignore
    }
  }, []);

  // ----------------------------------------------------------------------
  // Cleanup
  // ----------------------------------------------------------------------

  const cleanupMedia = useCallback(async () => {
    // Stop all local tracks
    localTracksRef.current.forEach((t) => t.stop());
    localTracksRef.current = [];

    // Disconnect LiveKit room
    if (livekitRoom) {
      try {
        await livekitRoom.disconnect(true);
      } catch {
        // ignore
      }
      setLivekitRoom(null);
    }

    setRemoteParticipants([]);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, [livekitRoom]);

  const resetCall = useCallback(
    async (nextStatus: CallStatus = 'idle') => {
      stopIncomingRingtone();
      stopOutgoingTone();
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      await cleanupMedia();
      setCall((prev) => ({ ...DEFAULT_CALL, status: nextStatus }));
    },
    [cleanupMedia, stopIncomingRingtone, stopOutgoingTone]
  );

  // ----------------------------------------------------------------------
  // LiveKit — connect to room
  // ----------------------------------------------------------------------

  const connectToLiveKit = useCallback(
    async (token: string, callType: CallType) => {
      try {
        // Dynamically import Room to avoid SSR issues
        const { Room: LKRoom } = await import('livekit-client');

        const room = new LKRoom({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720, frameRate: 30 },
          },
        });

        const LIVEKIT_WS_URL =
          import.meta.env.VITE_LIVEKIT_URL || 'wss://your-livekit-server.livekit.cloud';

        await room.connect(LIVEKIT_WS_URL, token, {
          autoSubscribe: true,
        });

        // Publish local tracks
        const tracks = await createLocalTracks({
          audio: true,
          video: callType === 'video',
        });
        localTracksRef.current = tracks;

        await Promise.all(
          tracks.map((track) => room.localParticipant.publishTrack(track))
        );

        // Wire up remote participant events
        const buildRemote = (p: RemoteParticipant): RemoteParticipantState => ({
          identity: p.identity,
          name: p.name || p.identity,
          isMuted: p.isMicrophoneEnabled === false,
          hasCameraOff: p.isCameraEnabled === false,
          audioTrack: null,
          videoTrack: null,
        });

        const syncParticipants = () => {
          setRemoteParticipants(Array.from(room.remoteParticipants.values()).map(buildRemote));
        };

        room.on(RoomEvent.ParticipantConnected, syncParticipants);
        room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
        room.on(RoomEvent.TrackSubscribed, syncParticipants);
        room.on(RoomEvent.TrackUnsubscribed, syncParticipants);
        room.on(RoomEvent.TrackMuted, syncParticipants);
        room.on(RoomEvent.TrackUnmuted, syncParticipants);

        room.on(RoomEvent.Disconnected, () => {
          resetCall('ended');
        });

        room.on(RoomEvent.Reconnecting, () => {
          toast.info('Reconnecting to call...');
        });

        room.on(RoomEvent.Reconnected, () => {
          toast.success('Reconnected to call');
        });

        syncParticipants();
        setLivekitRoom(room);

        setCall((prev) => ({
          ...prev,
          status: 'connected',
          startedAt: Date.now(),
        }));
      } catch (err) {
        console.error('[LiveKit] connect error:', err);
        toast.error('Failed to connect to call room');
        await resetCall('ended');
      }
    },
    [resetCall]
  );

  // ----------------------------------------------------------------------
  // START CALL (emit call_user)
  // ----------------------------------------------------------------------

  const startCall = useCallback(
    async (participants: string[], callType: CallType, recipientName?: string, recipientAvatar?: string) => {
      if (call.status !== 'idle') {
        toast.warning('Already in a call');
        return;
      }

      const payload = { participants, callType };

      let displayName = recipientName;
      let displayAvatar = recipientAvatar;

      if (!displayName) {
        const activeConvId = useChatStore.getState().activeConversationId;
        const activeConv = useChatStore.getState().conversations.find((c) => c._id === activeConvId);
        if (activeConv) {
          if ((activeConv as any).isGroup) {
            displayName = (activeConv as any).groupName || 'Group Call';
            displayAvatar = (activeConv as any).groupAvatar || '';
          } else {
            displayName = (activeConv as any).otherUser?.name || 'User';
            displayAvatar = (activeConv as any).otherUser?.avatarUrl || '';
          }
        } else {
          displayName = 'User';
        }
      }

      setCall({
        ...DEFAULT_CALL,
        status: 'calling',
        callType,
        participants,
        caller: { _id: currentUserId, name: displayName || 'User', avatar: displayAvatar },
      });

      playOutgoingTone();

      // 60-second auto-timeout
      callTimeoutRef.current = setTimeout(async () => {
        stopOutgoingTone();
        setCall((prev) => ({ ...prev, status: 'missed' }));
        toast.warning('No answer');
        await resetCall('idle');
      }, 60_000);

      try {
        socketService.emit('call_user', payload);
      } catch (socketErr) {
        // Fallback: REST API
        console.warn('[Call] socket emit failed, using REST fallback:', socketErr);
        try {
          await sendCallWebhook({
            event: 'room_started',
            room: { name: `call_fallback_${Date.now()}` },
          });
        } catch (apiErr) {
          console.error('[Call] REST fallback also failed:', apiErr);
          toast.error('Could not initiate call');
          await resetCall('idle');
        }
      }
    },
    [call.status, currentUserId, playOutgoingTone, stopOutgoingTone, resetCall]
  );

  // ----------------------------------------------------------------------
  // ACCEPT CALL (emit accept_call → connect LiveKit)
  // ----------------------------------------------------------------------

  const acceptCall = useCallback(async () => {
    if (!call.roomName) return;

    stopIncomingRingtone();

    socketService.emit('accept_call', { roomName: call.roomName });

    // Connect LiveKit if we already have a token (server may send via call_accepted ack)
    if (call.livekitToken) {
      await connectToLiveKit(call.livekitToken, call.callType);
    } else {
      // Optimistic — status changes to connected; LiveKit connects on call_accepted event
      setCall((prev) => ({ ...prev, status: 'connected', startedAt: Date.now() }));
    }
  }, [call.roomName, call.livekitToken, call.callType, stopIncomingRingtone, connectToLiveKit]);

  // ----------------------------------------------------------------------
  // REJECT CALL (emit reject_call)
  // ----------------------------------------------------------------------

  const rejectCall = useCallback(() => {
    if (!call.roomName) return;
    stopIncomingRingtone();
    socketService.emit('reject_call', { roomName: call.roomName });
    setCall({ ...DEFAULT_CALL, status: 'idle' });
  }, [call.roomName, stopIncomingRingtone]);

  // ----------------------------------------------------------------------
  // END CALL
  // ----------------------------------------------------------------------

  const endCall = useCallback(async () => {
    if (call.roomName) {
      try {
        socketService.emit('end_call', { roomName: call.roomName });
      } catch {
        // ignore
      }
    }
    await resetCall('ended');
    // Brief ended state then idle
    setTimeout(() => setCall({ ...DEFAULT_CALL, status: 'idle' }), 2000);
  }, [call.roomName, resetCall]);

  // ----------------------------------------------------------------------
  // Media controls
  // ----------------------------------------------------------------------

  const toggleMute = useCallback(() => {
    if (!livekitRoom) return;
    const enabled = !isMuted;
    livekitRoom.localParticipant.setMicrophoneEnabled(!enabled);
    setIsMuted(enabled);
  }, [livekitRoom, isMuted]);

  const toggleCamera = useCallback(() => {
    if (!livekitRoom) return;
    const enabled = !isCameraOff;
    livekitRoom.localParticipant.setCameraEnabled(!enabled);
    setIsCameraOff(enabled);
  }, [livekitRoom, isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    if (!livekitRoom) return;
    if (!isScreenSharing) {
      await livekitRoom.localParticipant.setScreenShareEnabled(true);
      setIsScreenSharing(true);
    } else {
      await livekitRoom.localParticipant.setScreenShareEnabled(false);
      setIsScreenSharing(false);
    }
  }, [livekitRoom, isScreenSharing]);

  // ----------------------------------------------------------------------
  // Socket event listeners (mount once)
  // ----------------------------------------------------------------------

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return undefined;

    // ── incoming_call ──────────────────────────────────────────────────
    const onIncomingCall = (payload: {
      roomName: string;
      caller: CallerInfo;
      callType: CallType;
      livekitToken?: string;
    }) => {
      // Ignore our own outgoing call reflection
      if (payload.caller._id === currentUserId) return;
      // If already in a call → answered_elsewhere from our perspective
      if (call.status !== 'idle') {
        socketService.emit('call_answered_elsewhere', { roomName: payload.roomName });
        return;
      }

      setCall({
        ...DEFAULT_CALL,
        status: 'incoming',
        callType: payload.callType,
        roomName: payload.roomName,
        livekitToken: payload.livekitToken || null,
        caller: payload.caller,
      });

      playIncomingRingtone();
    };

    // ── call_ringing ───────────────────────────────────────────────────
    const onCallRinging = (payload: { roomName: string }) => {
      setCall((prev) =>
        prev.status === 'calling' ? { ...prev, status: 'ringing', roomName: payload.roomName } : prev
      );
    };

    // ── call_accepted ──────────────────────────────────────────────────
    const onCallAccepted = async (payload: {
      userId: string;
      roomName: string;
      livekitToken?: string;
    }) => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      stopOutgoingTone();

      setCall((prev) => ({
        ...prev,
        status: 'connected',
        roomName: payload.roomName,
        livekitToken: payload.livekitToken || null,
        startedAt: Date.now(),
      }));

      if (payload.livekitToken) {
        await connectToLiveKit(payload.livekitToken, call.callType);
      }
    };

    // ── call_answered_elsewhere ────────────────────────────────────────
    const onCallAnsweredElsewhere = async (_payload: { roomName: string }) => {
      stopIncomingRingtone();
      toast.info('Call answered on another device');
      await resetCall('idle');
    };

    // ── call_missed ────────────────────────────────────────────────────
    const onCallMissed = async (_payload: { roomName: string }) => {
      stopOutgoingTone();
      stopIncomingRingtone();
      toast.warning('Call missed');
      setCall((prev) => ({ ...prev, status: 'missed' }));
      setTimeout(() => setCall({ ...DEFAULT_CALL, status: 'idle' }), 3000);
      // Refresh call history
      getCallHistory().catch(() => {});
    };

    // ── call_rejected ──────────────────────────────────────────────────
    const onCallRejected = async (_payload: { roomName: string }) => {
      stopOutgoingTone();
      toast.info('Call was declined');
      setCall((prev) => ({ ...prev, status: 'rejected' }));
      setTimeout(() => setCall({ ...DEFAULT_CALL, status: 'idle' }), 2000);
    };

    // ── group_call_started ─────────────────────────────────────────────
    const onGroupCallStarted = (payload: {
      groupId: string;
      roomId: string;
      initiatedBy: string;
      callType?: CallType;
      livekitToken?: string;
    }) => {
      if (payload.initiatedBy === currentUserId) return;
      setCall({
        ...DEFAULT_CALL,
        status: 'incoming',
        callType: payload.callType || 'video',
        roomName: payload.roomId,
        livekitToken: payload.livekitToken || null,
        isGroup: true,
        groupId: payload.groupId,
        initiatedBy: payload.initiatedBy,
        caller: { _id: payload.initiatedBy, name: 'Group Call' },
      });
      playIncomingRingtone();
    };

    // ── group_call_ended ───────────────────────────────────────────────
    const onGroupCallEnded = async (_payload: { roomId: string }) => {
      toast.info('Group call ended');
      await resetCall('ended');
      setTimeout(() => setCall({ ...DEFAULT_CALL, status: 'idle' }), 2000);
    };

    // ── participant_joined ─────────────────────────────────────────────
    const onParticipantJoined = (payload: { roomId: string; userId: string; user: any }) => {
      setCall((prev) => {
        if (!prev.participants.includes(payload.userId)) {
          return { ...prev, participants: [...prev.participants, payload.userId] };
        }
        return prev;
      });
    };

    // ── participant_left ───────────────────────────────────────────────
    const onParticipantLeft = (payload: { roomId: string; userId: string }) => {
      setCall((prev) => ({
        ...prev,
        participants: prev.participants.filter((id) => id !== payload.userId),
      }));
    };

    // ── end_call (server-pushed) ───────────────────────────────────────
    const onEndCall = async (_payload: { roomName: string }) => {
      await resetCall('ended');
      setTimeout(() => setCall({ ...DEFAULT_CALL, status: 'idle' }), 2000);
    };

    socket.on('incoming_call', onIncomingCall);
    socket.on('call_ringing', onCallRinging);
    socket.on('call_accepted', onCallAccepted);
    socket.on('call_answered_elsewhere', onCallAnsweredElsewhere);
    socket.on('call_missed', onCallMissed);
    socket.on('call_rejected', onCallRejected);
    socket.on('group_call_started', onGroupCallStarted);
    socket.on('group_call_ended', onGroupCallEnded);
    socket.on('participant_joined', onParticipantJoined);
    socket.on('participant_left', onParticipantLeft);
    socket.on('end_call', onEndCall);

    return () => {
      socket.off('incoming_call', onIncomingCall);
      socket.off('call_ringing', onCallRinging);
      socket.off('call_accepted', onCallAccepted);
      socket.off('call_answered_elsewhere', onCallAnsweredElsewhere);
      socket.off('call_missed', onCallMissed);
      socket.off('call_rejected', onCallRejected);
      socket.off('group_call_started', onGroupCallStarted);
      socket.off('group_call_ended', onGroupCallEnded);
      socket.off('participant_joined', onParticipantJoined);
      socket.off('participant_left', onParticipantLeft);
      socket.off('end_call', onEndCall);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // ----------------------------------------------------------------------
  // Memoized context value
  // ----------------------------------------------------------------------

  const value = useMemo<CallContextType>(
    () => ({
      call,
      remoteParticipants,
      isMuted,
      isCameraOff,
      isScreenSharing,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      livekitRoom,
    }),
    [
      call,
      remoteParticipants,
      isMuted,
      isCameraOff,
      isScreenSharing,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      livekitRoom,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
