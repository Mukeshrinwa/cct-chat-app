import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Groups API
// Reference: cct_chat_employ_user_admin/src/features/groups/api/groupsApi.ts
// ----------------------------------------------------------------------

/**
 * GET /api/v1/groups
 * Fetch all groups for the authenticated user.
 */
export async function getGroups(): Promise<any[]> {
  try {
    const res = await axios.get(endpoints.groups.list);
    return res.data.data;
  } catch (error) {
    console.error('[Groups API] getGroups error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

/**
 * GET /api/v1/groups/:groupId
 * Fetch details for a specific group.
 */
export async function getGroupDetails(groupId: string): Promise<any> {
  try {
    const res = await axios.get(endpoints.groups.details(groupId));
    return res.data.data;
  } catch (error) {
    console.error('[Groups API] getGroupDetails error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

/**
 * PATCH /api/v1/groups/:groupId
 * Update group name, avatar, description, permissions, etc.
 */
export async function updateGroupDetails(groupId: string, updates: any): Promise<any> {
  try {
    const res = await axios.patch(endpoints.groups.details(groupId), updates);
    return res.data.data;
  } catch (error) {
    console.error('[Groups API] updateGroupDetails error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

/**
 * POST /api/v1/groups/:groupId/add-member
 * Add members to a group.
 */
export async function addGroupMembers(groupId: string, members: string[]): Promise<any> {
  try {
    const res = await axios.post(endpoints.groups.addMember(groupId), { members });
    return res.data.data;
  } catch (error) {
    console.error('[Groups API] addGroupMembers error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

/**
 * POST /api/v1/groups/:groupId/remove-member
 * Remove a member from a group.
 */
export async function removeGroupMember(groupId: string, memberId: string): Promise<any> {
  try {
    const res = await axios.post(endpoints.groups.removeMember(groupId), { memberId });
    return res.data.data;
  } catch (error) {
    console.error('[Groups API] removeGroupMember error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

/**
 * POST /api/v1/groups/:groupId/leave
 * Leave a group.
 */
export async function leaveGroup(groupId: string): Promise<any> {
  try {
    const res = await axios.post(endpoints.groups.leave(groupId), {});
    return res.data.data;
  } catch (error) {
    console.error('[Groups API] leaveGroup error:', error);
    throw error;
  }
}
