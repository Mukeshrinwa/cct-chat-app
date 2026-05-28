import { paths } from 'src/routes/paths';

import axios from 'src/utils/axios';

import { STORAGE_KEY, REFRESH_STORAGE_KEY } from './constant';

// ----------------------------------------------------------------------

export function jwtDecode(token: string) {
  try {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length < 2) {
      throw new Error('Invalid token!');
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64));

    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export function isValidToken(accessToken: string) {
  if (!accessToken) {
    return false;
  }

  try {
    const decoded = jwtDecode(accessToken);

    if (!decoded || !('exp' in decoded)) {
      return false;
    }

    const currentTime = Date.now() / 1000;

    return decoded.exp > currentTime;
  } catch (error) {
    console.error('Error during token validation:', error);
    return false;
  }
}

// ----------------------------------------------------------------------

let expiredTimer: any = null;

export function tokenExpired(exp: number) {
  const currentTime = Date.now();
  const timeLeft = exp * 1000 - currentTime;

  if (expiredTimer) {
    clearTimeout(expiredTimer);
  }

  // Proactively refresh 10 seconds before the token expires
  const refreshTime = Math.max(0, timeLeft - 10000);

  expiredTimer = setTimeout(async () => {
    try {
      console.log('Access token is about to expire, proactively refreshing...');
      await refreshAccessToken();
    } catch (error) {
      console.error('Proactive token refresh failed:', error);
    }
  }, refreshTime);
}

// ----------------------------------------------------------------------

export async function setSession(accessToken: string | null, refreshToken?: string | null) {
  try {
    if (accessToken) {
      sessionStorage.setItem(STORAGE_KEY, accessToken);
      if (refreshToken) {
        sessionStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
      }

      axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      const decodedToken = jwtDecode(accessToken);

      if (decodedToken && 'exp' in decodedToken) {
        tokenExpired(decodedToken.exp);
      } else {
        throw new Error('Invalid access token!');
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(REFRESH_STORAGE_KEY);
      delete axios.defaults.headers.common.Authorization;

      if (expiredTimer) {
        clearTimeout(expiredTimer);
      }
    }
  } catch (error) {
    console.error('Error during set session:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export async function refreshAccessToken() {
  try {
    const refreshToken = sessionStorage.getItem(REFRESH_STORAGE_KEY);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post('/api/v1/auth/refresh-token', { refreshToken });
    const { token: newAccessToken } = response.data;

    if (!newAccessToken) {
      throw new Error('Refresh failed - no access token in response');
    }

    await setSession(newAccessToken, refreshToken);
    console.log('Successfully refreshed access token.');
    return newAccessToken;
  } catch (error) {
    console.error('Failed to refresh access token:', error);
    await setSession(null);
    window.location.href = paths.auth.jwt.signIn;
    throw error;
  }
}
