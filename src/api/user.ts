import axios, { endpoints } from 'src/utils/axios';

import { CONFIG } from 'src/config-global';

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

// ----------------------------------------------------------------------

/**
 * Block a user
 * POST /api/v1/users/block
 */
export async function blockUser(targetUserId: string): Promise<void> {
  try {
    await axios.post(endpoints.user.block, { targetUserId });
  } catch (error) {
    console.error('[API] blockUser error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

/**
 * Unblock a user
 * POST /api/v1/users/unblock
 */
export async function unblockUser(targetUserId: string): Promise<void> {
  try {
    await axios.post(endpoints.user.unblock, { targetUserId });
  } catch (error) {
    console.error('[API] unblockUser error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------
/**
 * Send account deactivation OTP
 * POST /api/v1/auth/account-deactivation/send-otp
 */
export async function sendAccountDeactivationOtp(mobile: string): Promise<string> {
  try {
    const baseUrl = CONFIG.site.deactivationUrl || CONFIG.site.serverUrl;
    const res = await axios.post(
      `${baseUrl}/api/v1/auth/account-deactivation/send-otp`,
      { mobile: mobile.trim() }
    );
    return res.data?.message || 'Verification code sent successfully.';
  } catch (error: any) {
    console.error('[API] sendAccountDeactivationOtp error:', error);
    throw new Error(
      error?.response?.data?.error || error?.response?.data?.message || 'Failed to send account deactivation OTP'
    );
  }
}

// ----------------------------------------------------------------------
export type VerifyAccountDeactivationResponse = {
  success: boolean;
  message: string;
  scheduledDeletionDate?: string;
};

/**
 * Verify account deactivation OTP
 * POST /api/v1/auth/account-deactivation/verify-otp
 */
export async function verifyAccountDeactivationOtp(
  mobile: string,
  otp: string
): Promise<VerifyAccountDeactivationResponse> {
  try {
    const baseUrl = CONFIG.site.deactivationUrl || CONFIG.site.serverUrl;
    const res = await axios.post(
      `${baseUrl}/api/v1/auth/account-deactivation/verify-otp`,
      { mobile: mobile.trim(), otp }
    );
    return res.data;
  } catch (error: any) {
    console.error('[API] verifyAccountDeactivationOtp error:', error);
    throw new Error(
      error?.response?.data?.error || error?.response?.data?.message || 'Failed to verify account deactivation OTP'
    );
  }
}
