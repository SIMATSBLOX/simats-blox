import { createMysqlSensorRepository } from './mysqlSensorRepository.js';

/** @type {import('./sensorRepositoryContract.js').SensorRepository | null} */
let instance = null;

/**
 * Active sensor persistence backend (local MySQL only).
 * @returns {import('./sensorRepositoryContract.js').SensorRepository}
 */
export function getSensorRepository() {
  if (instance) return instance;
  instance = createMysqlSensorRepository();
  return instance;
}

/**
 * Test-only reset (optional).
 */
export function resetSensorRepositoryForTests() {
  instance = null;
}
