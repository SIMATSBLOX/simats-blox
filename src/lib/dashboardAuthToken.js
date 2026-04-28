import { readAuthTokenFromStorage } from './authStorage.js';

/**
 * Token for device/dashboard REST + Socket.IO from local backend auth storage.
 * @returns {Promise<{ token: string | null; source: 'express' | null }>}
 */
export async function getDashboardAccessToken() {
  const express = readAuthTokenFromStorage();
  if (express) return { token: express, source: 'express' };
  return { token: null, source: null };
}
