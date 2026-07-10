import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { prisma } from './config/db';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import conversationRoutes from './routes/conversation';
import messageRoutes from './routes/message';
import uploadRoutes from './routes/upload';
import { setupSocket } from './socket';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: true,
  },
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

app.use('/api', apiLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api', messageRoutes);
app.use('/api/uploads', uploadRoutes);
app.use(errorHandler);

setupSocket(io);

  const start = async () => {
    try {
      fs.mkdirSync(path.resolve(env.UPLOAD_DIR, 'avatars'), { recursive: true });
      fs.mkdirSync(path.resolve(env.UPLOAD_DIR, 'attachments'), { recursive: true });

      await prisma.$connect();
      console.log('Database connected');

    server.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
