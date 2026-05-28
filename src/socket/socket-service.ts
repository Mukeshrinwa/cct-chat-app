import type { Socket } from 'socket.io-client';

import { io } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  private token: string | null = null;

  connect(token: string) {
    if (this.socket && this.token === token) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.token = token;
    this.socket = io('https://chatserrver.pmitadmin.in/chat', {
      query: {
        token,
      },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }

  emit(event: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket is not initialized'));
        return;
      }
      
      // If disconnected, let the promise fail so fallback works, or emit if connected
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
      
      // Socket.io standard emit doesn't always have an ack callback unless specified on the server,
      // so for most fire-and-forget events, we can resolve immediately.
      resolve(true);
    });
  }
}

export const socketService = new SocketService();
export default SocketService;
