import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';

let io: SocketIOServer | null = null;

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Authentication & Workspace authorization middleware for WebSocket
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      const workspaceId = socket.handshake.auth?.workspaceId || (socket.handshake.headers['x-workspace-id'] as string);

      if (!token) {
        return next(new Error('Authentication required for real-time connection.'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, fullName: true },
      });

      if (!user) {
        return next(new Error('User not found.'));
      }

      // If workspaceId is provided, verify membership
      if (workspaceId) {
        const membership = await prisma.workspaceMembership.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: user.id,
            },
          },
        });

        if (!membership || membership.status !== 'ACTIVE') {
          return next(new Error('Access denied to workspace real-time room.'));
        }

        socket.data.membership = membership;
        socket.join(`workspace:${workspaceId}`);
        socket.join(`membership:${membership.id}`);
      }

      socket.data.user = user;
      socket.join(`user:${user.id}`);
      next();
    } catch (err) {
      next(new Error('Invalid token or connection unauthorized.'));
    }
  });

  io.on('connection', (socket: Socket) => {
    // Client can switch or join a specific workspace room
    socket.on('join_workspace', async (data: { workspaceId: string }) => {
      try {
        if (!socket.data.user?.id || !data.workspaceId) return;
        const membership = await prisma.workspaceMembership.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: data.workspaceId,
              userId: socket.data.user.id,
            },
          },
        });

        if (membership && membership.status === 'ACTIVE') {
          socket.join(`workspace:${data.workspaceId}`);
          socket.join(`membership:${membership.id}`);
          socket.emit('workspace_joined', { workspaceId: data.workspaceId, membershipId: membership.id });
        }
      } catch (e) {
        console.error('Socket join_workspace error:', e);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
};

export const emitToWorkspace = (workspaceId: string, event: string, payload: any) => {
  if (io) {
    io.to(`workspace:${workspaceId}`).emit(event, payload);
  }
};

export const emitToMember = (membershipId: string, event: string, payload: any) => {
  if (io) {
    io.to(`membership:${membershipId}`).emit(event, payload);
  }
};
