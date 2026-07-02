import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';

import axios, { fetcher } from 'src/utils/axios';

import { socketService } from 'src/socket/socket-service';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: true,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
};

// ----------------------------------------------------------------------

export function useGetGroups() {
  const { data, isLoading, error, isValidating } = useSWR<any>(
    '/api/v1/groups',
    fetcher,
    swrOptions
  );

  const memoizedValue = useMemo(
    () => ({
      groups: data?.data || [],
      groupsLoading: isLoading,
      groupsError: error,
      groupsValidating: isValidating,
      groupsEmpty: !isLoading && !(data?.data || []).length,
    }),
    [data?.data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetGroup(groupId: string) {
  const url = groupId ? `/api/v1/groups/${groupId}` : '';

  const { data, isLoading, error, isValidating } = useSWR<any>(
    url,
    fetcher,
    swrOptions
  );

  const memoizedValue = useMemo(
    () => ({
      group: data?.data || null,
      groupLoading: isLoading,
      groupError: error,
      groupValidating: isValidating,
    }),
    [data?.data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export async function createGroup(groupData: { name: string; participants: string[]; avatarFile?: File }) {
  try {
    let socketSent = false;
    let resData = null;

    try {
      if (socketService.isConnected() && !groupData.avatarFile) {
        // Only use socket for creation if there's no avatar to upload
        await socketService.emit('create_group', {
          name: groupData.name,
          participants: groupData.participants,
        });
        socketSent = true;
      }
    } catch (socketError) {
      console.error('Socket createGroup failed, falling back to HTTP API:', socketError);
    }

    if (!socketSent) {
      const payload = {
        name: groupData.name,
        participants: groupData.participants,
      };
      
      // Step 1: Create the group
      const res = await axios.post('/api/v1/groups', payload);
      resData = res.data;

      // Step 2: Upload the avatar if one was provided
      if (groupData.avatarFile) {
        const newGroupId = resData?.data?.conversationId?._id || resData?.data?.conversationId || resData?.conversationId?._id || resData?.conversationId || resData?.data?._id;
        
        if (newGroupId) {
          const formData = new FormData();
          formData.append('avatar', groupData.avatarFile);
          
          await axios.post(`/api/v1/groups/${newGroupId}/avatar`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }
    }

    mutate('/api/v1/groups');
    mutate('/api/v1/chats/conversations');

    return resData || { success: true };
  } catch (error) {
    console.error('Failed to create group:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function updateGroup(
  groupId: string,
  updateData: {
    groupName?: string;
    description?: string;
    groupAvatar?: string;
    metadata?: any;
    permissions?: any;
    settings?: any;
  }
) {
  try {
    const res = await axios.patch(`/api/v1/groups/${groupId}`, updateData);

    mutate('/api/v1/groups');
    mutate(`/api/v1/groups/${groupId}`);
    mutate('/api/v1/chats/conversations');
    if (res.data?.data?.conversationId?._id) {
      mutate(`/api/v1/chats/conversations/${res.data.data.conversationId._id}`);
    }

    return res.data;
  } catch (error) {
    console.error('Failed to update group:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function deleteGroup(groupId: string) {
  try {
    const res = await axios.delete(`/api/v1/groups/${groupId}`);

    mutate('/api/v1/groups');
    mutate('/api/v1/chats/conversations');

    return res.data;
  } catch (error) {
    console.error('Failed to delete group:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function addMembersToGroup(groupId: string, members: string[]) {
  try {
    let socketSent = false;

    // Primary: emit via socket (backend will broadcast group_updated + system new_message)
    try {
      if (socketService.isConnected()) {
        await socketService.emit('add_members', { groupId, members });
        socketSent = true;
      }
    } catch (socketError) {
      console.warn('[Group] Socket add_members failed, falling back to HTTP:', socketError);
    }

    // Fallback: REST API
    if (!socketSent) {
      await axios.post(`/api/v1/groups/${groupId}/add-member`, { members });
    }

    // Invalidate SWR caches so UI reflects the updated member list
    mutate('/api/v1/groups');
    mutate(`/api/v1/groups/${groupId}`);
    mutate('/api/v1/chats/conversations');

    return { success: true };
  } catch (error) {
    console.error('[Group] Failed to add group members:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function removeMemberFromGroup(groupId: string, memberId: string) {
  try {
    const res = await axios.delete(`/api/v1/groups/${groupId}/members`, {
      data: { userId: memberId },
    });

    mutate('/api/v1/groups');
    mutate(`/api/v1/groups/${groupId}`);
    mutate('/api/v1/chats/conversations');

    return res.data;
  } catch (error) {
    console.error('Failed to remove group member:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function leaveGroupById(groupId: string) {
  try {
    const res = await axios.post(`/api/v1/groups/${groupId}/leave`, {});

    mutate('/api/v1/groups');
    mutate(`/api/v1/groups/${groupId}`);
    mutate('/api/v1/chats/conversations');

    return res.data;
  } catch (error) {
    console.error('Failed to leave group:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function promoteToAdmin(groupId: string, userId: string) {
  try {
    const res = await axios.patch(`/api/v1/groups/${groupId}/admins/promote`, { userId });
    mutate('/api/v1/groups');
    mutate(`/api/v1/groups/${groupId}`);
    return res.data;
  } catch (error) {
    console.error('Failed to promote member to admin:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function demoteFromAdmin(groupId: string, userId: string) {
  try {
    const res = await axios.patch(`/api/v1/groups/${groupId}/admins/demote`, { memberId: userId });
    mutate('/api/v1/groups');
    mutate(`/api/v1/groups/${groupId}`);
    return res.data;
  } catch (error) {
    console.error('Failed to demote admin:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function generateGroupInviteLink(groupId: string) {
  try {
    const res = await axios.post(`/api/v1/groups/${groupId}/invite-links`);
    mutate('/api/v1/groups');
    mutate(`/api/v1/groups/${groupId}`);
    return res.data;
  } catch (error) {
    console.error('Failed to generate invite link:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function updateDisappearingMessages(conversationId: string, mode: string) {
  try {
    const res = await axios.post('/api/v1/chats/disappearing', {
      conversationId,
      mode,
    });

    // Optimistically update the groups list cache so group.conversationId.disappearingMode
    // is correct the next time the dialog opens (without needing a full re-fetch).
    // Per the API response, disappearingMode lives inside the nested conversationId object.
    mutate(
      '/api/v1/groups',
      (current: any) => {
        if (!current?.data) return current;
        return {
          ...current,
          data: current.data.map((g: any) => {
            const gConvId = g.conversationId?._id || g.conversationId;
            if (gConvId === conversationId) {
              return {
                ...g,
                conversationId: {
                  ...g.conversationId,
                  disappearingMode: mode,
                },
              };
            }
            return g;
          }),
        };
      },
      { revalidate: false }
    );

    mutate('/api/v1/chats/conversations');
    mutate(`/api/v1/chats/conversations/${conversationId}`);
    return res.data;
  } catch (error) {
    console.error('Failed to update disappearing messages:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function joinGroupByLink(inviteLinkOrCode: string) {
  try {
    let code = inviteLinkOrCode;
    let extractedToken = '';
    
    // Parse URL if it's a full URL
    try {
      const url = new URL(inviteLinkOrCode.startsWith('http') ? inviteLinkOrCode : `http://localhost${inviteLinkOrCode.startsWith('/') ? '' : '/'}${inviteLinkOrCode}`);
      const match = url.pathname.match(/\/group\/invite\/([^/]+)/);
      if (match && match[1]) {
        code = match[1];
      }
      extractedToken = url.searchParams.get('token') || '';
    } catch {
      const match = inviteLinkOrCode.match(/\/group\/invite\/([^/?]+)/);
      if (match && match[1]) {
        code = match[1];
      }
    }

    const payload: any = {
      inviteLink: code,
      inviteCode: code
    };
    
    if (extractedToken) {
      payload.token = extractedToken;
    } else {
      payload.token = code;
    }

    const res = await axios.post('/api/v1/groups/join-by-link', payload);
    
    mutate('/api/v1/groups');
    mutate('/api/v1/chats/conversations');
    return res.data;
  } catch (error) {
    console.error('Failed to join group by link:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function sendJoinRequest(groupId: string) {
  try {
    const res = await axios.post(`/api/v1/groups/${groupId}/join-request`);
    mutate(`/api/v1/groups/${groupId}`);
    return res.data;
  } catch (error) {
    console.error('Failed to send join request:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export function useGetJoinRequests(groupId: string) {
  const url = groupId ? `/api/v1/groups/${groupId}/join-requests` : '';

  const { data, isLoading, error, isValidating } = useSWR<any>(
    url,
    fetcher,
    swrOptions
  );

  const memoizedValue = useMemo(
    () => {
      let reqs: any[] = [];
      if (Array.isArray(data)) {
        reqs = data;
      } else if (data?.data && Array.isArray(data.data)) {
        reqs = data.data;
      } else if (data?.requests) {
        reqs = data.requests;
      } else if (data?.data?.requests) {
        reqs = data.data.requests;
      }

      return {
        requests: reqs,
        requestsLoading: isLoading,
        requestsError: error,
        requestsValidating: isValidating,
        requestsEmpty: !isLoading && !reqs.length,
      };
    },
    [data, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export async function approveJoinRequest(groupId: string, requestId: string) {
  try {
    const res = await axios.patch(`/api/v1/groups/${groupId}/join-requests/${requestId}/approve`);
    mutate(`/api/v1/groups/${groupId}/join-requests`);
    mutate(`/api/v1/groups/${groupId}`);
    mutate('/api/v1/groups');
    return res.data;
  } catch (error) {
    console.error('Failed to approve join request:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function rejectJoinRequest(groupId: string, requestId: string) {
  try {
    const res = await axios.patch(`/api/v1/groups/${groupId}/join-requests/${requestId}/reject`);
    mutate(`/api/v1/groups/${groupId}/join-requests`);
    return res.data;
  } catch (error) {
    console.error('Failed to reject join request:', error);
    throw error;
  }
}
export async function bulkHandleJoinRequests(groupId: string, action: 'approve' | 'reject', requestIds?: string[]) {
  try {
    const res = await axios.post(`/api/v1/groups/${groupId}/join-requests/bulk`, { action, requestIds });
    mutate(`/api/v1/groups/${groupId}/join-requests`);
    mutate(`/api/v1/groups/${groupId}`);
    mutate('/api/v1/groups');
    return res.data;
  } catch (error) {
    console.error(`Failed to bulk ${action} join requests:`, error);
    throw error;
  }
}
