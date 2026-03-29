/** @type {import('socket.io').Server | null} */
let io = null;

/** @param {import('socket.io').Server} server */
export function setSocketIO(server) {
  io = server;
}

/**
 * @param {{
 *   ownerUserId: string;
 *   deviceId: string;
 *   sensorType: string;
 *   data: object;
 *   createdAt: Date | string;
 * }} payload
 */
export function emitSensorUpdate(payload) {
  if (!io) return;
  const created =
    payload.createdAt instanceof Date ? payload.createdAt : new Date(payload.createdAt);
  const evt = {
    deviceId: payload.deviceId,
    sensorType: payload.sensorType,
    data: payload.data,
    createdAt: created.toISOString(),
  };
  if (payload.ownerUserId) {
    io.to(`user:${payload.ownerUserId}`).emit('sensor:update', evt);
    return;
  }
  io.emit('sensor:update', evt);
}
