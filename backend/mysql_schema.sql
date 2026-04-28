-- SIMATS BLOX local backend schema (MySQL 8+)
-- Covers:
-- 1) user login accounts
-- 2) login history logs
-- 3) sensor device registry
-- 4) live readings + historical readings

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  login VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS user_login_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NULL,
  login_input VARCHAR(191) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  status ENUM('success', 'failed') NOT NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_user_login_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE INDEX idx_user_login_logs_user_time
  ON user_login_logs(user_id, created_at DESC);

CREATE INDEX idx_user_login_logs_login_time
  ON user_login_logs(login_input, created_at DESC);

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  project_name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  board_id VARCHAR(64) NOT NULL,
  blockly_json LONGTEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_projects_user_updated ON projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS sensor_devices (
  id VARCHAR(64) PRIMARY KEY,
  owner_user_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  sensor_type VARCHAR(128) NOT NULL,
  location VARCHAR(255) NOT NULL DEFAULT '',
  api_key VARCHAR(255) NOT NULL,
  status ENUM('online', 'offline') NOT NULL DEFAULT 'offline',
  last_seen_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sensor_devices_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sensor_devices_owner ON sensor_devices(owner_user_id);
CREATE INDEX idx_sensor_devices_updated ON sensor_devices(owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id VARCHAR(64) PRIMARY KEY,
  owner_user_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(191) NOT NULL,
  sensor_type VARCHAR(128) NOT NULL,
  data_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sensor_readings_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sensor_readings_device FOREIGN KEY (device_id) REFERENCES sensor_devices(device_id) ON DELETE CASCADE
);

CREATE INDEX idx_readings_device_time ON sensor_readings(device_id, created_at DESC);
CREATE INDEX idx_readings_owner_device_time ON sensor_readings(owner_user_id, device_id, created_at DESC);
CREATE INDEX idx_readings_owner_time ON sensor_readings(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS device_event_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  owner_user_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(191) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  message VARCHAR(512) NULL,
  meta_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_device_event_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_device_event_device FOREIGN KEY (device_id) REFERENCES sensor_devices(device_id) ON DELETE CASCADE
);

CREATE INDEX idx_device_event_owner_time ON device_event_logs(owner_user_id, created_at DESC);
CREATE INDEX idx_device_event_device_time ON device_event_logs(device_id, created_at DESC);
