/**
 * Sensor data layer: MongoDB models + REST + Socket.IO.
 * Mounted on the main SIMATS BLOX HTTP server (shared port with SQLite auth API).
 */
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { getSensorEnv } from './config/env.js';
import { connectMongo } from './config/db.js';
import { JWT_SECRET } from './config/jwt.js';
import { setSocketIO } from './services/socketService.js';
import deviceRoutes from './routes/deviceRoutes.js';
import readingRoutes from './routes/readingRoutes.js';

/**
 * @param {import('http').Server} httpServer
 * @param {import('express').Express} app
 */
export async function setupSensorPlatform(httpServer, app) {
  const { mongodbUri, clientOrigin } = getSensorEnv();
  if (!mongodbUri) {
    console.warn(
      '[sensor] MONGODB_URI is not set — sensor APIs (/api/devices, /api/readings) and Socket.IO are disabled.',
    );
    return;
  }

  try {
    await connectMongo(mongodbUri);
    app.use('/api', deviceRoutes);
    app.use('/api', readingRoutes);

    const io = new Server(httpServer, {
      cors: {
        origin: clientOrigin === '*' ? true : clientOrigin.split(',').map((s) => s.trim()),
        methods: ['GET', 'POST'],
      },
    });

    io.use((socket, next) => {
      try {
        const raw = socket.handshake.auth?.token;
        const token = typeof raw === 'string' ? raw.trim() : '';
        if (!token) {
          return next(new Error('auth_required'));
        }
        const payload = jwt.verify(token, JWT_SECRET);
        if (!payload?.sub || typeof payload.sub !== 'string') {
          return next(new Error('auth_invalid'));
        }
        socket.userId = payload.sub;
        next();
      } catch {
        return next(new Error('auth_invalid'));
      }
    });

    io.on('connection', (socket) => {
      const uid = /** @type {string} */ (socket.userId);
      socket.join(`user:${uid}`);
    });

    setSocketIO(io);

    console.log('[sensor] MongoDB connected');
    console.log('[sensor] REST: JWT + POST/GET /api/devices, POST /api/readings (x-device-key)');
    console.log(`[sensor] Socket.IO: join user:<id> on connect; CORS origin: ${clientOrigin}`);
  } catch (e) {
    console.error('[sensor] Failed to start sensor platform:', e);
    throw e;
  }
}
