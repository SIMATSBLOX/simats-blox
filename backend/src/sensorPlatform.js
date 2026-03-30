/**
 * Sensor data layer: SQLite tables + REST + Socket.IO.
 * Mounted on the main SIMATS BLOX HTTP server (shared port with SQLite auth API).
 */
import { Server } from 'socket.io';
import { verifyDashboardBearerToken } from '../../server/dashboardJwt.js';
import { getSensorEnv } from './config/env.js';
import { setSocketIO } from './services/socketService.js';
import deviceRoutes from './routes/deviceRoutes.js';
import readingRoutes from './routes/readingRoutes.js';

/**
 * @param {import('http').Server} httpServer
 * @param {import('express').Express} app
 */
export function setupSensorPlatform(httpServer, app) {
  const { clientOrigin } = getSensorEnv();

  app.use('/api', deviceRoutes);
  app.use('/api', readingRoutes);

  const io = new Server(httpServer, {
    cors: {
      origin: clientOrigin === '*' ? true : clientOrigin.split(',').map((s) => s.trim()),
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.auth?.token;
      const token = typeof raw === 'string' ? raw.trim() : '';
      if (!token) {
        return next(new Error('auth_required'));
      }
      const out = await verifyDashboardBearerToken(token);
      if (!out) {
        return next(new Error('auth_invalid'));
      }
      socket.userId = out.sub;
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

  console.log('[sensor] SQLite: sensor_devices, sensor_readings in server/data/ide.sqlite');
  console.log(
    '[sensor] Dashboard auth: Supabase getUser(access_token) when SUPABASE_URL + SERVICE_ROLE set; else Express JWT — REST + Socket',
  );
  console.log('[sensor] POST /api/readings uses x-device-key (unchanged)');
  console.log(`[sensor] Socket.IO: join user:<sub> on connect; CORS origin: ${clientOrigin}`);
}
