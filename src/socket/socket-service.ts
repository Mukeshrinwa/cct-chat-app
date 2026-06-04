import type { Socket } from 'socket.io-client';

import { io } from 'socket.io-client';

// ----------------------------------------------------------------------
// Socket URL Configuration
// Backend is always on production server (not local)
// ----------------------------------------------------------------------

export const BASE_URL = 'https://chatserrver.pmitadmin.in/api/v1';

export const SOCKET_URL_BASE = 'https://chatserrver.pmitadmin.in';

// ----------------------------------------------------------------------
// SocketManager - Singleton Pattern
// Reference: cct_chat_employ_user_admin/src/sockets/SocketManager.ts
// ----------------------------------------------------------------------

class SocketManager {
  private static instance: SocketManager;

  private socket: Socket | null = null;

  private token: string | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public connect(
    token: string,
    url: string = SOCKET_URL_BASE
  ): Socket {
    // Reuse if same token — whether connected OR still connecting (active)
    if (this.token === token && this.socket && (this.socket.connected || this.socket.active)) {
      return this.socket;
    }

    // Fully tear down only when token actually changed
    if (this.socket) {
      // Remove all listeners first so no stale handlers fire during teardown
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.token = token;

    this.socket = io(`${url}/chat`, {
      auth: { token },
      query: { token }, // backward compat
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection Error:', error.message);
    });

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
    }
  }

  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  public emit(event: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket is not initialized'));
        return;
      }

      if (!this.socket.connected) {
        reject(new Error('Socket is not connected'));
        return;
      }

      this.socket.emit(event, payload, (ack: any) => {
        if (ack && ack.error) {
          reject(new Error(ack.error));
        } else {
          resolve(ack);
        }
      });

      // Resolve immediately for fire-and-forget events
      resolve(true);
    });
  }

  // --- Realtime Helpers ---

  public startRecording(payload: { conversationId: string; recipientId: string }) {
    this.emit('recording_start', payload);
  }

  public stopRecording(payload: { conversationId: string; recipientId: string }) {
    this.emit('recording_stop', payload);
  }

  public addMembers(payload: { groupId: string; members: string[] }) {
    return this.emit('add_members', payload);
  }

  public listenRecordingStatus(
    callback: (payload: { conversationId: string; userId: string; recording: boolean }) => void
  ) {
    if (!this.socket) return () => {};
    this.socket.on('user_recording', callback);
    return () => this.socket?.off('user_recording', callback);
  }
}

// Singleton export
export const socketManager = SocketManager.getInstance();

// Legacy compat alias
export const socketService = socketManager;

export default SocketManager;
