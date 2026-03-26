import { useToastStore } from '../store/toastStore.js';

/**
 * User-facing notification (also keep using the Log panel where applicable).
 * @param {'success' | 'info' | 'warning' | 'error'} kind
 * @param {string} message
 */
export function toast(kind, message) {
  useToastStore.getState().push(kind, message);
}
