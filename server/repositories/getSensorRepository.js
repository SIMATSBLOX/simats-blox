import { createSqliteSensorRepository } from './sqliteSensorRepository.js';
import { createSupabaseSensorRepository } from './supabaseSensorRepository.js';
import { getSupabaseServiceClient, resetSupabaseServiceClientForTests } from '../supabaseServiceClient.js';

/** @type {import('./sensorRepositoryContract.js').SensorRepository | null} */
let instance = null;

/**
 * Active sensor persistence backend. Default: `sqlite`. Use `supabase` with Postgres tables
 * `sensor_devices` and `sensor_readings` (service-role access).
 * @returns {import('./sensorRepositoryContract.js').SensorRepository}
 */
export function getSensorRepository() {
  if (instance) return instance;

  const backend = (process.env.SENSOR_DATA_BACKEND || 'sqlite').toLowerCase().trim();
  if (backend === 'supabase') {
    getSupabaseServiceClient();
    instance = createSupabaseSensorRepository();
    return instance;
  }
  if (backend !== 'sqlite') {
    throw new Error(
      `[sensor] SENSOR_DATA_BACKEND="${backend}" is unknown. Use sqlite or supabase.`,
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
  resetSupabaseServiceClientForTests();
}
