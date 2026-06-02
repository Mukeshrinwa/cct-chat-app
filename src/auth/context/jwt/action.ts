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
  const finalMobile = mobile.trim();
  try {
    await axios.post(endpoints.auth.sendOtp, { mobile: finalMobile });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    throw new Error(error?.response?.data?.error || error?.response?.data?.message || 'Failed to send OTP');
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
  const finalMobile = mobile.trim();
  try {
    await axios.post(endpoints.auth.verifyOtp, { mobile: finalMobile, otp, deviceType });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    throw new Error(error?.response?.data?.error || error?.response?.data?.message || 'Failed to verify OTP');
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
  } catch (error: any) {
    console.error('Error checking username:', error);
    throw new Error(error?.response?.data?.error || error?.response?.data?.message || 'Failed to check username');
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
  const finalMobile = mobile.trim();

  const params = {
    mobile: finalMobile,
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
  } catch (error: any) {
    console.error('Error during sign up:', error);
    throw new Error(error?.response?.data?.error || error?.response?.data?.message || 'Registration failed');
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

    const finalIdentifier = trimmed;

    const params = isMobile
      ? { mobile: finalIdentifier, password }
      : { username: trimmed, password };

    const res = await axios.post(endpoints.auth.signIn, params);

    const { token: accessToken, refreshToken } = res.data;

    if (!accessToken) {
      throw new Error('Access token not found in response');
    }

    setSession(accessToken, refreshToken);
  } catch (error: any) {
    console.error('Error during sign in:', error);
    throw new Error(error?.response?.data?.error || error?.response?.data?.message || 'Login failed');
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
