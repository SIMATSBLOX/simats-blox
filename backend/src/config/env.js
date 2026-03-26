/**
 * Sensor layer environment (read from process.env — typically repo root .env via server).
 */
export function getSensorEnv() {
  const mongodbUri = String(process.env.MONGODB_URI || '').trim();
  const clientOrigin = String(process.env.CLIENT_ORIGIN || 'http://localhost:5173').trim();
  return { mongodbUri, clientOrigin };
}
