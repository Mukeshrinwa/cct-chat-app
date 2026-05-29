import type { AxiosRequestConfig } from 'axios';

import axios from 'axios';

import { CONFIG } from 'src/config-global';

// ----------------------------------------------------------------------

const axiosInstance = axios.create({ baseURL: CONFIG.site.serverUrl });

// Attach Authorization token on every request (sessionStorage -> localStorage fallback)
axiosInstance.interceptors.request.use(
  (config) => {
    const token =
      sessionStorage.getItem('jwt_access_token') || localStorage.getItem('token');
    if (token) {
      // eslint-disable-next-line no-param-reassign
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthRequest = originalRequest.url && (originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/register'));

    if (error.response && error.response.status === 401 && !originalRequest._retry && !isAuthRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = sessionStorage.getItem('jwt_refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(
          `${CONFIG.site.serverUrl}/api/v1/auth/refresh-token`,
          { refreshToken }
        );

        const newAccessToken = response.data?.token;
        if (!newAccessToken) {
          throw new Error('Refresh failed - no access token in response');
        }

        sessionStorage.setItem('jwt_access_token', newAccessToken);
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        return await axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        sessionStorage.removeItem('jwt_access_token');
        sessionStorage.removeItem('jwt_refresh_token');
        delete axiosInstance.defaults.headers.common.Authorization;
        
        window.location.href = '/auth/jwt/sign-in';
        return await Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject((error.response && error.response.data) || 'Something went wrong!');
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

export const fetcher = async (args: string | [string, AxiosRequestConfig]) => {
  try {
    const [url, config] = Array.isArray(args) ? args : [args];

    const res = await axiosInstance.get(url, { ...config });

    return res.data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
};

// ----------------------------------------------------------------------

export const endpoints = {
  chat: '/api/chat',
  kanban: '/api/kanban',
  calendar: '/api/calendar',
  auth: {
    me: '/api/v1/users/me',
    signIn: '/api/v1/auth/login',
    signUp: '/api/v1/auth/register',
    sendOtp: '/api/v1/auth/send-otp',
    verifyOtp: '/api/v1/auth/verify-otp',
    checkUsername: '/api/v1/auth/check-username',
  },
  user: {
    update: '/api/v1/users/update',
    search: '/api/v1/users/search',
    getAll: '/api/v1/users/get',
  },
  calls: {
    webhook: '/api/v1/calls/webhook',
    history: '/api/v1/calls/history',
    initiate: '/api/v1/calls/initiate',
    end: '/api/v1/calls/end',
  },
  groups: {
    list: '/api/v1/groups',
    details: (groupId: string) => `/api/v1/groups/${groupId}`,
    addMember: (groupId: string) => `/api/v1/groups/${groupId}/add-member`,
    removeMember: (groupId: string) => `/api/v1/groups/${groupId}/remove-member`,
    leave: (groupId: string) => `/api/v1/groups/${groupId}/leave`,
  },
  mail: {
    list: '/api/mail/list',
    details: '/api/mail/details',
    labels: '/api/mail/labels',
  },
  post: {
    list: '/api/post/list',
    details: '/api/post/details',
    latest: '/api/post/latest',
    search: '/api/post/search',
  },
  product: {
    list: '/api/product/list',
    details: '/api/product/details',
    search: '/api/product/search',
  },
};
