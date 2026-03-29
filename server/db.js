/**
 * Single SQLite database for SIMATS BLOX: auth, Blockly projects, and sensor registry + readings.
 * File: server/data/ide.sqlite (WAL mode). All server-side persistence uses this connection.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'ide.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    login TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    board_id TEXT NOT NULL,
    blockly_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS sensor_devices (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    device_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    last_seen_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_sensor_devices_owner ON sensor_devices(owner_user_id);
  CREATE INDEX IF NOT EXISTS idx_sensor_devices_updated ON sensor_devices(owner_user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS sensor_readings (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES sensor_devices(device_id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_readings_device_time ON sensor_readings(device_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_readings_owner_device ON sensor_readings(owner_user_id, device_id, created_at DESC);
`);

export function getDb() {
  return db;
}
