import { createSupabaseSensorRepository } from './supabaseSensorRepository.js';

/** @type {import('./sensorRepositoryContract.js').SensorRepository | null} */
let instance = null;

/**
 * Active sensor persistence backend (Supabase Postgres).
 * @returns {import('./sensorRepositoryContract.js').SensorRepository}
 */
export function getSensorRepository() {
  if (instance) return instance;
  instance = createSupabaseSensorRepository();
  return instance;
}

/**
 * Test-only reset (optional).
 */
export function resetSensorRepositoryForTests() {
  instance = null;
}
