/** Local session keys shared by auth store + sensor Socket.IO (avoid import cycles). */

export const AUTH_TOKEN_KEY = 'simats-blox:auth-token:v1';
export const AUTH_LOGIN_KEY = 'simats-blox:auth-login:v1';

export function readAuthTokenFromStorage() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function readAuthLoginFromStorage() {
  try {
    return localStorage.getItem(AUTH_LOGIN_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {string | null} token
 * @param {string | null} login
 */
export function writeAuthSessionToStorage(token, login) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
    if (login) localStorage.setItem(AUTH_LOGIN_KEY, login);
    else localStorage.removeItem(AUTH_LOGIN_KEY);
  } catch {
    /* quota / private mode */
  }
}
