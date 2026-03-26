/** @type {import('socket.io').Server | null} */
let io = null;

/** @param {import('socket.io').Server} server */
export function setSocketIO(server) {
  io = server;
}

export function getSocketIO() {
  return io;
}

/**
 * @param {{
 *   ownerUserId: string;
 *   deviceId: string;
 *   sensorType: string;
 *   data: object;
 *   createdAt: Date;
 * }} payload
 */
export function emitSensorUpdate(payload) {
  if (!io) return;
  const evt = {
    deviceId: payload.deviceId,
    sensorType: payload.sensorType,
    data: payload.data,
    createdAt: payload.createdAt.toISOString(),
  };
  if (payload.ownerUserId) {
    io.to(`user:${payload.ownerUserId}`).emit('sensor:update', evt);
    return;
  }
  io.emit('sensor:update', evt);
}
