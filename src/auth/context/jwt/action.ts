import axios, { endpoints } from 'src/utils/axios';

import { setSession } from './utils';

// ----------------------------------------------------------------------

export type SignInParams = {
  identifier: string;
  password: string;
};

export type SignUpParams = {
  mobile: string;
  otp: string;
  name: string;
  username: string;
  password: string;
  avatar?: string;
  about?: string;
  role?: string;
};

/** **************************************
 * Send OTP
 *************************************** */
export const sendOtp = async (mobile: string): Promise<void> => {
  try {
    await axios.post(endpoints.auth.sendOtp, { mobile });
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
};

/** **************************************
 * Verify OTP
 *************************************** */
export const verifyOtp = async (
  mobile: string,
  otp: string,
  deviceType: string = 'web'
): Promise<void> => {
  try {
    await axios.post(endpoints.auth.verifyOtp, { mobile, otp, deviceType });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};

/** **************************************
 * Check username availability
 *************************************** */
export const checkUsername = async (username: string): Promise<boolean> => {
  try {
    const res = await axios.post(endpoints.auth.checkUsername, { username });
    // Assuming API returns { available: true/false } or similar
    return res.data?.available ?? true;
  } catch (error) {
    console.error('Error checking username:', error);
    throw error;
  }
};

/** **************************************
 * Sign up (Register)
 *************************************** */
export const signUp = async ({
  mobile,
  otp,
  name,
  username,
  password,
  avatar,
  about,
  role,
}: SignUpParams): Promise<void> => {
  const params = {
    mobile,
    otp,
    name,
    username,
    password,
    avatar: avatar || 'https://api-dev-minimal-v6.vercel.app/assets/images/avatar/avatar-25.webp',
    about: about || 'Hey there! I am using this app.',
    role: role || 'user',
  };

  try {
    const res = await axios.post(endpoints.auth.signUp, params);

    const { token: accessToken, refreshToken } = res.data;

    if (!accessToken) {
      throw new Error('Access token not found in response');
    }

    setSession(accessToken, refreshToken);
  } catch (error) {
    console.error('Error during sign up:', error);
    throw error;
  }
};
/** **************************************
 * Sign in
 *************************************** */
export const signInWithPassword = async ({ identifier, password }: SignInParams): Promise<void> => {
  try {
    // Detect if identifier is a mobile number (starts with + or contains only digits)
    const trimmed = identifier.trim();
    const isMobile = /^\+?\d{7,15}$/.test(trimmed);

    const params = isMobile
      ? { mobile: trimmed, password }
      : { username: trimmed, password };

    const res = await axios.post(endpoints.auth.signIn, params);

    const { token: accessToken, refreshToken } = res.data;

    if (!accessToken) {
      throw new Error('Access token not found in response');
    }

    setSession(accessToken, refreshToken);
  } catch (error) {
    console.error('Error during sign in:', error);
    throw error;
  }
};


/** **************************************
 * Sign out
 *************************************** */
export const signOut = async (): Promise<void> => {
  try {
    await setSession(null);
  } catch (error) {
    console.error('Error during sign out:', error);
    throw error;
  }
};
