import { create } from 'zustand';
import { uuid } from '../lib/uuid.js';

const MAX = 6;

/**
 * @typedef {{ id: string, kind: 'success' | 'info' | 'warning' | 'error', message: string }} ToastItem
 */

export const useToastStore = create((set, get) => ({
  /** @type {ToastItem[]} */
  toasts: [],

  /**
   * @param {'success' | 'info' | 'warning' | 'error'} kind
   * @param {string} message
   */
  push(kind, message) {
    const text = String(message ?? '').trim().slice(0, 180);
    if (!text) return;
    const id = uuid();
    const ms = kind === 'error' || kind === 'warning' ? 7000 : 5000;
    set((s) => ({
      toasts: [...s.toasts, { id, kind, message: text }].slice(-MAX),
    }));
    window.setTimeout(() => get().dismiss(id), ms);
  },

  /** @param {string} id */
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
