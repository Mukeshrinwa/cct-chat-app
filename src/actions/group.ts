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
    '/api/v1/groups/list',
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

export async function createGroup(groupData: { name: string; participants: string[]; avatar?: string }) {
  try {
    let socketSent = false;
    try {
      if (socketService.isConnected()) {
        await socketService.emit('create_group', {
          name: groupData.name,
          participants: groupData.participants,
        });
        socketSent = true;
        console.log('Group created via socket');
      }
    } catch (socketError) {
      console.error('Socket createGroup failed, falling back to HTTP API:', socketError);
    }

    let resData = null;
    if (!socketSent) {
      const res = await axios.post('/api/v1/groups/create', groupData);
      resData = res.data;
      console.log('Group created via HTTP API fallback');
    }

    mutate('/api/v1/groups/list');
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
  }
) {
  try {
    const res = await axios.patch(`/api/v1/groups/${groupId}`, updateData);

    mutate('/api/v1/groups/list');
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

    mutate('/api/v1/groups/list');
    mutate('/api/v1/chats/conversations');

    return res.data;
  } catch (error) {
    console.error('Failed to delete group:', error);
    throw error;
  }
}
