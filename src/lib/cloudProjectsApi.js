import { API_PREFIX } from './apiConfig.js';
import { getAuthToken } from '../store/authStore.js';

/**
 * @param {string} path
 * @param {RequestInit} [options]
 */
export async function apiJson(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_PREFIX}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      'Cannot reach the project server. Run `npm run server` (or `npm run dev:full`) and try again.',
    );
  }

  if (res.status === 204) {
    if (!res.ok) {
      const msg = `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return null;
  }

  const text = await res.text();
  /** @type {unknown} */
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 200) };
    }
  }

  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && data !== null && 'error' in data
        ? String(data.error)
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/** @returns {Promise<Array<{ id: string, projectName: string, boardId: string, updatedAt: string }>>} */
export function listCloudProjects() {
  return apiJson('/projects', { method: 'GET' });
}

/** @returns {Promise<object>} full project payload for Blockly load */
export function getCloudProject(id) {
  return apiJson(`/projects/${encodeURIComponent(id)}`, { method: 'GET' });
}

/**
 * @param {object} payload — { projectName, description?, boardId, blockly }
 * @returns {Promise<{ id: string, updatedAt: string }>}
 */
export function createCloudProject(payload) {
  return apiJson('/projects', { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * @param {string} id
 * @param {object} payload
 * @returns {Promise<{ id: string, updatedAt: string }>}
 */
export function updateCloudProject(id, payload) {
  return apiJson(`/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export function deleteCloudProject(id) {
  return apiJson(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
