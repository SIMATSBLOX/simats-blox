/** SIMATS BLOX API: Express + Supabase Postgres storage + Socket.IO. */
import http from 'node:http';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb, initDb } from './db.js';
import { JWT_SECRET } from './jwtSecret.js';
import { setupSensorPlatform } from './src/sensorPlatform.js';

const PORT = Number(process.env.PORT || 8184);
const BCRYPT_ROUNDS = 12;

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '32mb' }));

const dbPromise = getDb();

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

function getClientMeta(req) {
  const ipAddress =
    (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].split(',')[0]?.trim()) ||
    req.socket?.remoteAddress ||
    null;
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 512) : null;
  return { ipAddress, userAgent };
}

async function logLoginEvent(db, { userId = null, loginInput = '', ipAddress = null, userAgent = null, status, reason = null }) {
  try {
    const { error } = await db.from('user_login_logs').insert([
      {
        user_id: userId,
        login_input: String(loginInput || '').slice(0, 191),
        ip_address: ipAddress,
        user_agent: userAgent,
        status,
        reason,
      },
    ]);
    if (error) {
      console.warn('[auth log] could not write user_login_logs:', error.message || error);
    }
  } catch (e) {
    console.warn('[auth log] could not write user_login_logs:', e?.message || e);
  }
}

app.post('/api/auth/signup', async (req, res) => {
  const login = normalizeLogin(req.body?.login);
  const password = String(req.body?.password ?? '');
  const db = await dbPromise;
  const { ipAddress, userAgent } = getClientMeta(req);

  if (login.length < 3 || login.length > 120) {
    await logLoginEvent(db, {
      loginInput: login,
      ipAddress,
      userAgent,
      status: 'failed',
      reason: 'invalid_login_length',
    });
    return res.status(400).json({ error: 'Username or email must be 3–120 characters.' });
  }
  if (password.length < 8) {
    await logLoginEvent(db, {
      loginInput: login,
      ipAddress,
      userAgent,
      status: 'failed',
      reason: 'weak_password',
    });
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const createdAt = new Date().toISOString();

  try {
    const { error } = await db.from('users').insert([
      {
        id,
        login,
        password_hash: passwordHash,
        created_at: createdAt,
      },
    ]);
    if (error) {
      if (error.code === '23505' || String(error.details || '').includes('already exists')) {
        await logLoginEvent(db, {
          loginInput: login,
          ipAddress,
          userAgent,
          status: 'failed',
          reason: 'signup_duplicate',
        });
        return res.status(409).json({ error: 'That username or email is already registered.' });
      }
      throw error;
    }
  } catch (e) {
    console.error(e);
    await logLoginEvent(db, {
      loginInput: login,
      ipAddress,
      userAgent,
      status: 'failed',
      reason: 'signup_internal_error',
    });
    return res.status(500).json({ error: 'Could not create account.' });
  }

  await logLoginEvent(db, {
    userId: id,
    loginInput: login,
    ipAddress,
    userAgent,
    status: 'success',
    reason: 'signup',
  });
  const token = signToken(id, login);
  res.status(201).json({ token, login });
});

app.post('/api/auth/signin', async (req, res) => {
  const login = normalizeLogin(req.body?.login);
  const password = String(req.body?.password ?? '');
  const db = await dbPromise;
  const { ipAddress, userAgent } = getClientMeta(req);

  if (!login || !password) {
    await logLoginEvent(db, {
      loginInput: login,
      ipAddress,
      userAgent,
      status: 'failed',
      reason: 'missing_credentials',
    });
    return res.status(400).json({ error: 'Enter your username or email and password.' });
  }

  const { data: row, error } = await db.from('users').select('id, login, password_hash').eq('login', login).maybeSingle();
  if (error) {
    console.error(error);
    await logLoginEvent(db, {
      loginInput: login,
      ipAddress,
      userAgent,
      status: 'failed',
      reason: 'signin_internal_error',
    });
    return res.status(500).json({ error: 'Could not sign in.' });
  }
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    await logLoginEvent(db, {
      loginInput: login,
      ipAddress,
      userAgent,
      status: 'failed',
      reason: 'invalid_credentials',
    });
    return res.status(401).json({ error: 'Incorrect username/email or password.' });
  }

  await logLoginEvent(db, {
    userId: row.id,
    loginInput: row.login,
    ipAddress,
    userAgent,
    status: 'success',
    reason: 'signin',
  });
  const token = signToken(row.id, row.login);
  res.json({ token, login: row.login });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ login: req.user.login });
});

app.get('/api/projects', authMiddleware, async (req, res) => {
  const db = await dbPromise;
  const { data: rows, error } = await db
    .from('projects')
    .select('id, project_name, description, board_id, updated_at')
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[projects] list error', error);
    return res.status(500).json({ error: 'Could not load projects.' });
  }
  res.json(
    (rows || []).map((r) => ({
      id: r.id,
      projectName: r.project_name,
      description: r.description || '',
      boardId: r.board_id,
      updatedAt: r.updated_at,
    })),
  );
});

app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  const db = await dbPromise;
  const { data: row, error } = await db
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (error) {
    console.error('[projects] fetch error', error);
    return res.status(500).json({ error: 'Could not load project.' });
  }
  if (!row) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const blockly = typeof row.blockly_json === 'object' ? row.blockly_json : JSON.parse(String(row.blockly_json || '{}'));
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

app.post('/api/projects', authMiddleware, async (req, res) => {
  const { projectName, description, boardId, blockly } = req.body ?? {};
  void boardId;
  if (!isPlainObject(blockly)) {
    return res.status(400).json({ error: 'Missing or invalid "blockly" object.' });
  }
  const name = String(projectName ?? 'Untitled project').slice(0, 200);
  const desc = typeof description === 'string' ? description.slice(0, 2000) : '';
  const board = 'esp32';
  const id = crypto.randomUUID();
  const updatedAt = new Date().toISOString();

  const db = await dbPromise;
  const { error } = await db.from('projects').insert([
    {
      id,
      user_id: req.user.id,
      project_name: name,
      description: desc,
      board_id: board,
      blockly_json: blockly,
      version: 1,
      updated_at: updatedAt,
    },
  ]);
  if (error) {
    console.error('[projects] create error', error);
    return res.status(500).json({ error: 'Could not save project.' });
  }
  res.status(201).json({ id, updatedAt });
});

app.put('/api/projects/:id', authMiddleware, async (req, res) => {
  const { projectName, description, boardId, blockly } = req.body ?? {};
  void boardId;
  if (!isPlainObject(blockly)) {
    return res.status(400).json({ error: 'Missing or invalid "blockly" object.' });
  }
  const db = await dbPromise;
  const { data: existing, error: existingError } = await db
    .from('projects')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (existingError) {
    console.error('[projects] check error', existingError);
    return res.status(500).json({ error: 'Could not update project.' });
  }
  if (!existing) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const name = String(projectName ?? 'Untitled project').slice(0, 200);
  const desc = typeof description === 'string' ? description.slice(0, 2000) : '';
  const board = 'esp32';
  const updatedAt = new Date().toISOString();

  const { data, error } = await db
    .from('projects')
    .update({
      project_name: name,
      description: desc,
      board_id: board,
      blockly_json: blockly,
      updated_at: updatedAt,
    })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('updated_at')
    .maybeSingle();
  if (error) {
    console.error('[projects] update error', error);
    return res.status(500).json({ error: 'Could not save project.' });
  }
  res.json({ id: req.params.id, updatedAt });
});

app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  const db = await dbPromise;
  const { data, error } = await db.from('projects').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) {
    console.error('[projects] delete error', error);
    return res.status(500).json({ error: 'Could not delete project.' });
  }
  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  res.status(204).end();
});

async function start() {
  await initDb();
  const httpServer = http.createServer(app);

  try {
    setupSensorPlatform(httpServer, app);
  } catch (e) {
    console.error('[sensor] Sensor platform failed — API still available.', e?.message || e);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SIMATS BLOX API listening on http://127.0.0.1:${PORT} (all interfaces — use LAN IP from other devices)`);
    if (JWT_SECRET === 'dev-only-change-JWT_SECRET-in-production') {
      console.warn('[warn] Using default JWT_SECRET — set JWT_SECRET for production.');
    }
  });
}

start().catch((error) => {
  console.error('[startup] Failed to initialize backend:', error?.message || error);
  process.exit(1);
});
