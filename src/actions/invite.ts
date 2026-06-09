import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';

import axios, { fetcher } from 'src/utils/axios';

// ----------------------------------------------------------------------

export type InviteStatus = 'active' | 'expired' | 'revoked' | 'usedUp';

export interface InviteParams {
  roomId: string;
  role: string;
  singleUse: boolean;
  maxUses: number;
  expiresAt: string | null;
  allowedEmails?: string[];
  allowedDomains?: string[];
  redirectUrl?: string;
}

export interface InviteResponse {
  _id: string;
  groupId: string;
  createdBy: string;
  inviteCode: string;
  token?: string;
  type: 'single_use' | 'expiring' | 'limited' | 'standard';
  maxUses?: number;
  currentUses: number;
  expiresAt?: string;
  revoked: boolean;
  isActive: boolean;
  createdAt: string;
}

export const InviteService = {
  createInvite: async (params: InviteParams): Promise<InviteResponse> => {
    const {roomId} = params;
    
    // Transform payload to match Flutter app expectations
    let payload: any = { ...params };
    if (params.singleUse) {
      payload = { ...payload, type: 'single_use', maxUses: 1 };
    } else if (params.expiresAt) {
      const hours = Math.max(1, Math.round((new Date(params.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)));
      payload = { ...payload, type: 'expiring', expiresInHours: hours };
    } else if (params.maxUses && params.maxUses > 0) {
      payload = { ...payload, type: 'limited', maxUses: params.maxUses };
    } else {
      payload = { ...payload, type: 'standard' };
    }

    const res = await axios.post(`/api/v1/groups/${roomId}/invite-links`, payload);
    mutate(`/api/v1/groups/${roomId}/invite-links`);
    return res.data?.data || res.data;
  },

  validateInvite: async (inviteId: string, token?: string) => {
    const params = token ? { t: token } : undefined;
    const res = await axios.get(`/api/v1/groups/invite-links/${inviteId}/validate`, { params }).catch(() => 
      axios.get(`/api/v1/invites/${inviteId}/validate`, { params })
    );
    return res.data;
  },

  acceptInvite: async (inviteId: string, token?: string) => {
    const params = token ? { t: token } : undefined;
    const res = await axios.post(`/api/v1/groups/invite-links/${inviteId}/accept`, {}, { params }).catch(() => 
      axios.post(`/api/v1/invites/${inviteId}/accept`, {}, { params })
    );
    return res.data;
  },

  revokeInvite: async (inviteId: string, roomId?: string) => {
    const res = await axios.patch(
      roomId 
        ? `/api/v1/groups/${roomId}/invite-links/${inviteId}`
        : `/api/v1/groups/invite-links/${inviteId}`
    ).catch(() => 
      axios.patch(`/api/v1/invites/${inviteId}`)
    );
    if (roomId) {
      mutate(`/api/v1/groups/${roomId}/invite-links`);
    } else {
      mutate((key: any) => typeof key === 'string' && key.includes('invite-links'));
    }
    return res.data;
  }
};

export function useGetInvites(roomId: string) {
  const url = roomId ? `/api/v1/groups/${roomId}/invite-links` : null;
  
  const { data, isLoading, error, isValidating } = useSWR(url, fetcher);
  
  const memoizedValue = useMemo(() => ({
    inviteList: (data?.data || data || []) as InviteResponse[],
    invitesLoading: isLoading,
    invitesError: error,
    invitesValidating: isValidating,
    invitesEmpty: !isLoading && !(data?.data || data || []).length,
  }), [data, error, isLoading, isValidating]);
  
  return memoizedValue;
}
