import { createSqliteSensorRepository } from './sqliteSensorRepository.js';

/** @type {import('./sensorRepositoryContract.js').SensorRepository | null} */
let instance = null;

/**
 * Active sensor persistence backend. Default: sqlite.
 * Set `SENSOR_DATA_BACKEND=supabase` only after a Supabase adapter exists.
 * @returns {import('./sensorRepositoryContract.js').SensorRepository}
 */
export function getSensorRepository() {
  if (instance) return instance;

  const backend = (process.env.SENSOR_DATA_BACKEND || 'sqlite').toLowerCase().trim();
  if (backend !== 'sqlite') {
    throw new Error(
      `[sensor] SENSOR_DATA_BACKEND="${backend}" is not implemented yet. Omit SENSOR_DATA_BACKEND or set it to sqlite.`,
    );
  }

  instance = createSqliteSensorRepository();
  return instance;
}

/**
 * Test-only reset (optional).
 */
export function resetSensorRepositoryForTests() {
  instance = null;
}
