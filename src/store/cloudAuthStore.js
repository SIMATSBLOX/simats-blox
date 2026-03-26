import { create } from 'zustand';

/**
 * Supabase Auth session mirror (UI + services). Unrelated to Express JWT in authStore.js.
 */
export const useCloudAuthStore = create((set) => ({
  /** @type {import('@supabase/supabase-js').Session | null} */
  session: null,
  /** @type {import('@supabase/supabase-js').User | null} */
  user: null,
  authLoading: false,
  authError: /** @type {string | null} */ (null),

  /**
   * @param {import('@supabase/supabase-js').Session | null} session
   */
  setFromSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      authError: null,
    }),

  setAuthLoading: (v) => set({ authLoading: !!v }),

  /** @param {string | null | undefined} msg */
  setAuthError: (msg) => set({ authError: msg ? String(msg) : null }),
}));
