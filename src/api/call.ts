import useSWR from 'swr';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type ICallParticipant = {
  _id: string;
  name: string;
  username: string;
  avatar: string;
};

export type ICallRecord = {
  _id: string;
  callerId: ICallParticipant;
  participants: ICallParticipant[];
  roomName: string;
  conversationId: string;
  status: 'initiated' | 'accepted' | 'rejected' | 'missed' | 'ended';
  callType: 'audio' | 'video';
  isGroup: boolean;
  duration: number; // seconds
  createdAt: string;
  updatedAt: string;
};

// Payload shapes for webhook event
export type CallWebhookEvent =
  | {
      event: 'participant_joined';
      room: { name: string };
      participant: { identity: string };
    }
  | {
      event: 'participant_left';
      room: { name: string };
      participant: { identity: string };
    }
  | {
      event: 'room_started';
      room: { name: string };
    }
  | {
      event: 'room_finished';
      room: { name: string };
    };

// ----------------------------------------------------------------------
// API Functions
// ----------------------------------------------------------------------

/**
 * POST /api/v1/calls/webhook
 *
 * Handle a LiveKit / call-server webhook event (participant_joined, etc.).
 * Typically called from your backend but exposed here so the frontend
 * can forward or test the event.
 */
export async function sendCallWebhook(payload: CallWebhookEvent): Promise<{ success: boolean }> {
  try {
    const res = await axios.post(endpoints.calls.webhook, payload);
    return res.data;
  } catch (error) {
    console.error('[Call API] sendCallWebhook error:', error);
    throw error;
  }
}

/**
 * GET /api/v1/calls/history
 *
 * Fetch the call history for the authenticated user.
 */
export async function getCallHistory(): Promise<ICallRecord[]> {
  try {
    const res = await axios.get(endpoints.calls.history);
    return res.data;
  } catch (error) {
    console.error('[Call API] getCallHistory error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------
// SWR Hook
// ----------------------------------------------------------------------

/**
 * useCallHistory
 *
 * React hook that fetches and caches the user's call history.
 *
 * @example
 * const { callHistory, callHistoryLoading } = useCallHistory();
 */
export function useCallHistory() {
  const { data, isLoading, error, mutate } = useSWR<ICallRecord[]>(
    endpoints.calls.history,
    fetcher
  );

  return {
    callHistory: (data ?? []) as ICallRecord[],
    callHistoryLoading: isLoading,
    callHistoryError: error,
    refetchCallHistory: mutate,
  };
}
