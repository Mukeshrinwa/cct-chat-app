import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

/**
 * Profile API Types
 */

export type UpdateProfileParams = {
  name?: string;
  username?: string;
  avatar?: string;
  about?: string;
  fcm?: string;
  privacy?: {
    profilePhoto?: 'everyone' | 'contacts' | 'nobody';
    lastSeen?: 'everyone' | 'contacts' | 'nobody';
    readReceipts?: boolean;
  };
};

// ----------------------------------------------------------------------

/**
 * Update user profile
 * PUT /api/v1/users/update
 */
export async function updateProfile(params: UpdateProfileParams) {
  try {
    const res = await axios.put(endpoints.user.update, params);
    return res.data;
  } catch (error) {
    console.error('[API] updateProfile error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

/**
 * Upload profile avatar image
 * PUT /api/v1/users/update (multipart/form-data)
 *
 * Sends the avatar file along with any other profile fields.
 * The server expects a `avatar` field with the file.
 */
export async function uploadAvatar(file: File) {
  try {
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await axios.put(endpoints.user.update, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return res.data;
  } catch (error) {
    console.error('[API] uploadAvatar error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

/**
 * Check if a username is available
 * POST /api/v1/auth/check-username
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  try {
    const res = await axios.post(endpoints.auth.checkUsername, { username });
    return res.data?.available ?? true;
  } catch (error) {
    console.error('[API] checkUsername error:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

/**
 * Get current user profile
 * GET /api/v1/users/me
 */
export async function getMyProfile() {
  try {
    const res = await axios.get(endpoints.auth.me);
    return res.data;
  } catch (error) {
    console.error('[API] getMyProfile error:', error);
    throw error;
  }
}
