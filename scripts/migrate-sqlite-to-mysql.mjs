import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const sqlitePath = process.env.SQLITE_PATH || path.join(rootDir, 'backend', 'data', 'ide.sqlite');

function sqliteQuery(sql) {
  const out = execFileSync('sqlite3', ['-json', sqlitePath, sql], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  const trimmed = out.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed);
}

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'simats_blox',
    charset: 'utf8mb4',
  };
}

async function countMySql(pool, table) {
  const [rows] = await pool.execute(`SELECT COUNT(*) AS c FROM ${table}`);
  return Number(rows[0]?.c || 0);
}

async function migrate() {
  const pool = await mysql.createPool(mysqlConfig());
  const conn = await pool.getConnection();
  try {
    console.log(`[migrate] SQLite source: ${sqlitePath}`);
    await conn.beginTransaction();

    const users = sqliteQuery('SELECT id, login, password_hash, created_at FROM users ORDER BY created_at ASC;');
    const projects = sqliteQuery(
      'SELECT id, user_id, project_name, description, board_id, blockly_json, version, updated_at FROM projects ORDER BY updated_at ASC;',
    );
    const devices = sqliteQuery(
      'SELECT id, owner_user_id, device_id, name, sensor_type, location, api_key, status, last_seen_at, created_at, updated_at FROM sensor_devices ORDER BY created_at ASC;',
    );
    const readings = sqliteQuery(
      'SELECT id, owner_user_id, device_id, sensor_type, data_json, created_at FROM sensor_readings ORDER BY created_at ASC;',
    );

    // Clear in FK-safe reverse order.
    await conn.execute('DELETE FROM sensor_readings');
    await conn.execute('DELETE FROM sensor_devices');
    await conn.execute('DELETE FROM projects');
    await conn.execute('DELETE FROM users');

    for (const r of users) {
      await conn.execute('INSERT INTO users (id, login, password_hash, created_at) VALUES (?, ?, ?, ?)', [
        r.id,
        r.login,
        r.password_hash,
        r.created_at,
      ]);
    }
    for (const r of projects) {
      await conn.execute(
        'INSERT INTO projects (id, user_id, project_name, description, board_id, blockly_json, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [r.id, r.user_id, r.project_name, r.description ?? '', r.board_id, r.blockly_json, Number(r.version || 1), r.updated_at],
      );
    }
    for (const r of devices) {
      await conn.execute(
        `INSERT INTO sensor_devices
         (id, owner_user_id, device_id, name, sensor_type, location, api_key, status, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          r.owner_user_id,
          r.device_id,
          r.name,
          r.sensor_type,
          r.location ?? '',
          r.api_key,
          r.status || 'offline',
          r.last_seen_at ?? null,
          r.created_at,
          r.updated_at,
        ],
      );
    }
    for (const r of readings) {
      await conn.execute(
        'INSERT INTO sensor_readings (id, owner_user_id, device_id, sensor_type, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [r.id, r.owner_user_id, r.device_id, r.sensor_type, r.data_json, r.created_at],
      );
    }

    const mysqlCounts = {
      users: await countMySql(conn, 'users'),
      projects: await countMySql(conn, 'projects'),
      sensor_devices: await countMySql(conn, 'sensor_devices'),
      sensor_readings: await countMySql(conn, 'sensor_readings'),
    };

    const sqliteCounts = {
      users: users.length,
      projects: projects.length,
      sensor_devices: devices.length,
      sensor_readings: readings.length,
    };

    for (const key of Object.keys(sqliteCounts)) {
      if (sqliteCounts[key] !== mysqlCounts[key]) {
        throw new Error(`[migrate] Row-count mismatch for ${key}: sqlite=${sqliteCounts[key]} mysql=${mysqlCounts[key]}`);
      }
    }

    await conn.commit();
    console.log('[migrate] Success. Row counts matched:', mysqlCounts);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
