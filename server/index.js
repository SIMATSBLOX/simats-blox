/**
 * SIMATS BLOX API: auth (JWT) + per-user projects (SQLite) + optional sensor hub (MongoDB + Socket.IO).
 * Run: npm run server   (default port 3847)
 */
import http from 'node:http';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';
import { JWT_SECRET } from './jwtSecret.js';
import { setupSensorPlatform } from '../backend/src/sensorPlatform.js';

const PORT = Number(process.env.PORT || 3847);
const BCRYPT_ROUNDS = 12;

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '32mb' }));

const db = getDb();

function normalizeLogin(raw) {
  const s = String(raw ?? '').trim();
  return s.length ? s : '';
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  const token = h.slice(7).trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.sub || typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Invalid session.' });
    }
    req.user = { id: payload.sub, login: String(payload.login || '') };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid. Sign in again.' });
  }
}

function signToken(userId, login) {
  return jwt.sign({ sub: userId, login }, JWT_SECRET, { expiresIn: '14d' });
}

// --- Auth ---
app.post('/api/auth/signup', (req, res) => {
  const login = normalizeLogin(req.body?.login);
  const password = String(req.body?.password ?? '');

  if (login.length < 3 || login.length > 120) {
    return res.status(400).json({ error: 'Username or email must be 3–120 characters.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const createdAt = new Date().toISOString();

  try {
    db.prepare(
      'INSERT INTO users (id, login, password_hash, created_at) VALUES (?, ?, ?, ?)',
    ).run(id, login, passwordHash, createdAt);
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) {
      return res.status(409).json({ error: 'That username or email is already registered.' });
    }
    console.error(e);
    return res.status(500).json({ error: 'Could not create account.' });
  }

  const token = signToken(id, login);
  res.status(201).json({ token, login });
});

app.post('/api/auth/signin', (req, res) => {
  const login = normalizeLogin(req.body?.login);
  const password = String(req.body?.password ?? '');

  if (!login || !password) {
    return res.status(400).json({ error: 'Enter your username or email and password.' });
  }

  const row = db.prepare('SELECT id, login, password_hash FROM users WHERE login = ?').get(login);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username/email or password.' });
  }

  const token = signToken(row.id, row.login);
  res.json({ token, login: row.login });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ login: req.user.login });
});

// --- Projects ---
app.get('/api/projects', authMiddleware, (req, res) => {
  const rows = db
    .prepare(
      'SELECT id, project_name, description, board_id, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
    )
    .all(req.user.id);
  res.json(
    rows.map((r) => ({
      id: r.id,
      projectName: r.project_name,
      description: r.description || '',
      boardId: r.board_id,
      updatedAt: r.updated_at,
    })),
  );
});

app.get('/api/projects/:id', authMiddleware, (req, res) => {
  const row = db
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!row) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  let blockly;
  try {
    blockly = JSON.parse(row.blockly_json);
  } catch {
    return res.status(500).json({ error: 'Stored project data is corrupted.' });
  }
  if (!isPlainObject(blockly)) {
    return res.status(500).json({ error: 'Invalid Blockly data in storage.' });
  }
  res.json({
    version: row.version,
    projectName: row.project_name,
    description: row.description || '',
    boardId: row.board_id,
    blockly,
  });
});

app.post('/api/projects', authMiddleware, (req, res) => {
  const { projectName, description, boardId, blockly } = req.body ?? {};
  if (!isPlainObject(blockly)) {
    return res.status(400).json({ error: 'Missing or invalid "blockly" object.' });
  }
  const name = String(projectName ?? 'Untitled project').slice(0, 200);
  const desc = typeof description === 'string' ? description.slice(0, 2000) : '';
  const board = boardId === 'esp32' ? 'esp32' : 'arduino_uno';
  const id = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  let blocklyJson;
  try {
    blocklyJson = JSON.stringify(blockly);
  } catch {
    return res.status(400).json({ error: 'Could not serialize Blockly data.' });
  }

  db.prepare(
    `INSERT INTO projects (id, user_id, project_name, description, board_id, blockly_json, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(id, req.user.id, name, desc, board, blocklyJson, updatedAt);

  res.status(201).json({ id, updatedAt });
});

app.put('/api/projects/:id', authMiddleware, (req, res) => {
  const { projectName, description, boardId, blockly } = req.body ?? {};
  if (!isPlainObject(blockly)) {
    return res.status(400).json({ error: 'Missing or invalid "blockly" object.' });
  }
  const existing = db
    .prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const name = String(projectName ?? 'Untitled project').slice(0, 200);
  const desc = typeof description === 'string' ? description.slice(0, 2000) : '';
  const board = boardId === 'esp32' ? 'esp32' : 'arduino_uno';
  const updatedAt = new Date().toISOString();
  let blocklyJson;
  try {
    blocklyJson = JSON.stringify(blockly);
  } catch {
    return res.status(400).json({ error: 'Could not serialize Blockly data.' });
  }

  db.prepare(
    `UPDATE projects SET project_name = ?, description = ?, board_id = ?, blockly_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
  ).run(name, desc, board, blocklyJson, updatedAt, req.params.id, req.user.id);

  res.json({ id: req.params.id, updatedAt });
});

app.delete('/api/projects/:id', authMiddleware, (req, res) => {
  const r = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (r.changes === 0) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  res.status(204).end();
});

const httpServer = http.createServer(app);

(async () => {
  try {
    await setupSensorPlatform(httpServer, app);
  } catch (e) {
    console.error('[sensor] Sensor platform failed — SQLite API still available.', e?.message || e);
  }

  httpServer.listen(PORT, () => {
    console.log(`SIMATS BLOX API listening on http://127.0.0.1:${PORT}`);
    if (JWT_SECRET === 'dev-only-change-JWT_SECRET-in-production') {
      console.warn('[warn] Using default JWT_SECRET — set JWT_SECRET for production.');
    }
  });
})();
