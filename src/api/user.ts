import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

/**
 * User API Types
 */

export type UserData = {
  _id: string;
  name: string;
  username: string;
  avatar: string;
  about: string;
  lastSeen: string;
  role: string;
  status?: string;
  isOnline?: boolean;
  privacy?: {
    lastSeen: string;
    profilePhoto: string;
    about: string;
    readReceipts: boolean;
  };
};

// ----------------------------------------------------------------------

/**
 * Search users by query (username/name)
 * GET /api/v1/users/search?query=<query>
 */
export async function searchUsers(query: string): Promise<UserData[]> {
  try {
    const res = await axios.get(endpoints.user.search, {
      params: { query },
    });
    return res.data?.data || [];
  } catch (error) {
    console.error('[API] searchUsers error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

/**
 * Get all users
 * GET /api/v1/users/get
 */
export async function getAllUsers(): Promise<UserData[]> {
  try {
    const res = await axios.get(endpoints.user.getAll);
    return res.data?.data || [];
  } catch (error) {
    console.error('[API] getAllUsers error:', error);
    throw error;
  }
}
