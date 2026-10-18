import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => {
  const token = localStorage.getItem('worknest_token');
  const workspaceId = localStorage.getItem('worknest_workspace_id');

  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  if (!socket) {
    socket = io('/', {
      auth: { token, workspaceId },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket.IO connected to WorkNest server.');
      if (workspaceId) {
        socket?.emit('join_workspace', { workspaceId });
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection warning:', err.message);
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
