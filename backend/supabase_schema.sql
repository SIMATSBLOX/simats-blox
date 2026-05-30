-- SIMATS BLOX Supabase/Postgres schema
-- Tables: users, user_login_logs, projects, sensor_devices, sensor_readings, device_event_logs

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  login citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_login_logs (
  id bigserial PRIMARY KEY,
  user_id text NULL REFERENCES users(id) ON DELETE SET NULL,
  login_input text NOT NULL,
  ip_address varchar(64) NULL,
  user_agent varchar(512) NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_login_logs_user_time ON user_login_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_login_time ON user_login_logs(login_input, created_at DESC);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_name varchar(200) NOT NULL,
  description text NOT NULL DEFAULT '',
  board_id varchar(64) NOT NULL,
  blockly_json jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS sensor_devices (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id varchar(191) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  sensor_type varchar(128) NOT NULL,
  location varchar(255) NOT NULL DEFAULT '',
  api_key varchar(255) NOT NULL,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  last_seen_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensor_devices_owner ON sensor_devices(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sensor_devices_updated ON sensor_devices(owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id varchar(191) NOT NULL REFERENCES sensor_devices(device_id) ON DELETE CASCADE,
  sensor_type varchar(128) NOT NULL,
  data_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readings_device_time ON sensor_readings(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_owner_device_time ON sensor_readings(owner_user_id, device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_owner_time ON sensor_readings(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS device_event_logs (
  id bigserial PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id varchar(191) NOT NULL REFERENCES sensor_devices(device_id) ON DELETE CASCADE,
  event_type varchar(64) NOT NULL,
  message varchar(512) NULL,
  meta_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_event_owner_time ON device_event_logs(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_event_device_time ON device_event_logs(device_id, created_at DESC);
