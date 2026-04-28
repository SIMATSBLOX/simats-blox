/**
 * Single JWT signing secret for auth + sensor Socket.IO + device REST guards.
 * Set JWT_SECRET in production — must match everywhere this process loads.
 */
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-JWT_SECRET-in-production';
