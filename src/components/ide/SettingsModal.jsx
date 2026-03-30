import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import { BOARD_LABEL, useIdeStore } from '../../store/ideStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { useCloudAuthStore } from '../../store/cloudAuthStore.js';
import { isSupabaseConfigured } from '../../lib/supabaseClient.js';
import { isDemoSupabaseOnly } from '../../lib/demoSupabaseOnly.js';
import * as supabaseAuth from '../../lib/authService.js';
import { toast } from '../../lib/toast.js';
import { formatSupabaseUserMessage, formatUserSafeError } from '../../lib/projectIo.js';
import pkg from '../../../package.json';

/**
 * @param {{ children: import('react').ReactNode }} props
 */
function SectionTitle({ children }) {
  return (
    <h3 className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{children}</h3>
  );
}

/**
 * @param {{ children: import('react').ReactNode, className?: string }} props
 */
function Panel({ children, className = '' }) {
  return (
    <div
      className={`rounded-lg border border-studio-border/70 bg-[#252a32] px-3 py-2.5 text-[12px] text-slate-200 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function SettingsModal({ open, onClose }) {
  const boardId = useIdeStore((s) => s.boardId);
  const setBoardId = useIdeStore((s) => s.setBoardId);
  const setCloudProjectId = useIdeStore((s) => s.setCloudProjectId);
  const persistTarget = useIdeStore((s) => s.persistTarget);

  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signOut = useAuthStore((s) => s.signOut);

  const sbUser = useCloudAuthStore((s) => s.user);
  const sbLoading = useCloudAuthStore((s) => s.authLoading);
  const sbStoreError = useCloudAuthStore((s) => s.authError);

  const [sbMode, setSbMode] = useState(/** @type {'in' | 'up'} */ ('in'));
  const [sbEmail, setSbEmail] = useState('');
  const [sbPassword, setSbPassword] = useState('');
  const [sbConfirm, setSbConfirm] = useState('');
  const [sbFormError, setSbFormError] = useState('');

  const [authMode, setAuthMode] = useState(/** @type {'in' | 'up'} */ ('in'));
  const [formLogin, setFormLogin] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirm, setFormConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const demoOnly = isDemoSupabaseOnly();

  if (!open) return null;

  const handleSignOut = () => {
    signOut();
    setCloudProjectId(null);
    toast('success', 'Signed out of local API.');
    onClose();
  };

  const submitSupabaseAuth = async () => {
    setSbFormError('');
    const em = sbEmail.trim();
    const pw = sbPassword;
    if (!em || !pw) {
      setSbFormError('Enter email and password.');
      return;
    }
    if (sbMode === 'up') {
      if (pw.length < 8) {
        setSbFormError('Password must be at least 8 characters.');
        return;
      }
      if (pw !== sbConfirm) {
        setSbFormError('Passwords do not match.');
        return;
      }
    }
    try {
      if (sbMode === 'up') {
        const data = await supabaseAuth.signUp(em, pw);
        setSbPassword('');
        setSbConfirm('');
        setSbFormError('');
        if (data?.session) toast('success', 'Signed in to cloud storage.');
        else toast('info', 'Check your email to confirm your account, then sign in.');
      } else {
        await supabaseAuth.signIn(em, pw);
        setSbPassword('');
        setSbConfirm('');
        setSbFormError('');
        toast('success', 'Signed in to cloud storage.');
      }
    } catch (e) {
      const friendly = formatSupabaseUserMessage(e);
      setSbFormError(friendly);
      toast('error', friendly);
    }
  };

  const handleSupabaseSignOut = async () => {
    setSbFormError('');
    try {
      await supabaseAuth.signOut();
      toast('success', 'Signed out of cloud storage.');
    } catch (e) {
      const friendly = formatSupabaseUserMessage(e);
      setSbFormError(friendly);
      toast('error', friendly);
    }
  };

  const submitAuth = async () => {
    setFormError('');
    const l = formLogin.trim();
    const p = formPassword;
    if (!l || !p) {
      setFormError('Enter username or email and password.');
      return;
    }
    if (authMode === 'up') {
      if (p.length < 8) {
        setFormError('Password must be at least 8 characters.');
        return;
      }
      if (p !== formConfirm) {
        setFormError('Passwords do not match.');
        return;
      }
    }
    setBusy(true);
    try {
      if (authMode === 'up') await signUp(l, p);
      else await signIn(l, p);
      setFormPassword('');
      setFormConfirm('');
      setFormError('');
      toast(
        'success',
        authMode === 'up' ? 'Account created. Signed in to local API.' : 'Signed in to local API.',
      );
      onClose();
    } catch (e) {
      const friendly = formatUserSafeError(e);
      setFormError(friendly);
      toast('error', friendly);
    } finally {
      setBusy(false);
    }
  };

  const activeSaveLabel =
    persistTarget === 'supabase'
      ? 'Supabase cloud'
      : persistTarget === 'express_api'
        ? 'Local API (SQLite)'
        : 'This browser only (localStorage)';

  const inputCls =
    'w-full rounded border border-studio-border bg-[#1b1f24] px-2 py-1.5 text-xs text-slate-100 focus:border-studio-accent/60 focus:outline-none focus:ring-1 focus:ring-studio-accent/30';

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="flex max-h-[min(36rem,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-studio-border bg-[#2a2f36] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-studio-border px-4 py-3">
          <h2 id="settings-title" className="text-base font-semibold tracking-tight text-slate-100">
            Settings
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-studio-muted">
            SIMATS BLOX — accounts, where projects are stored, and a few editor preferences.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-6">
            {/* Account */}
            <section className="space-y-2">
              <SectionTitle>Account</SectionTitle>
              <p className="text-[11px] leading-relaxed text-studio-muted">
                {demoOnly ? (
                  <>
                    <span className="text-amber-200/90">Demo mode (Supabase only):</span> sign in with Supabase for cloud
                    projects, <span className="text-slate-400">Devices</span>, and dashboard APIs. Express / local API
                    accounts are hidden.
                  </>
                ) : (
                  <>
                    Sign in to save and open projects on Supabase or on the optional local dev API. With{' '}
                    <span className="text-slate-400">Local API</span> sign-in you also get{' '}
                    <span className="text-slate-400">Devices</span> in the toolbar for live ESP32 sensors. You can always
                    use <span className="text-slate-400">this browser only</span> without an account.
                  </>
                )}
              </p>

              <div className="space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Supabase cloud</p>
                <Panel>
                  {!isSupabaseConfigured() ? (
                    <p className="text-[11px] leading-relaxed text-studio-muted">
                      Not configured. Add{' '}
                      <code className="rounded bg-black/35 px-1 font-mono text-[10px]">VITE_SUPABASE_URL</code> and{' '}
                      <code className="rounded bg-black/35 px-1 font-mono text-[10px]">VITE_SUPABASE_ANON_KEY</code> to{' '}
                      <code className="rounded bg-black/35 px-1 font-mono text-[10px]">.env.local</code>, restart Vite, and
                      create <code className="rounded bg-black/35 px-1 font-mono text-[10px]">ide_projects</code> in
                      Supabase (see README).
                    </p>
                  ) : sbUser ? (
                    <div>
                      <p className="text-[11px] font-medium text-emerald-200/90">Signed in</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-200">
                        {sbUser.email ?? sbUser.id}
                      </p>
                      <p className="mt-2 text-[10px] leading-relaxed text-studio-muted">
                        Toolbar <span className="text-slate-400">Save / Open</span> can use your cloud projects when
                        Supabase has priority (see Save &amp; projects below).
                      </p>
                      <div className="mt-2">
                        <Button
                          variant="default"
                          className="!text-xs"
                          disabled={sbLoading}
                          onClick={() => void handleSupabaseSignOut()}
                        >
                          Sign out (Supabase)
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            sbMode === 'in'
                              ? 'bg-emerald-900/45 text-slate-100'
                              : 'text-studio-muted hover:bg-white/5'
                          }`}
                          onClick={() => {
                            setSbMode('in');
                            setSbFormError('');
                          }}
                        >
                          Sign in
                        </button>
                        <button
                          type="button"
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            sbMode === 'up'
                              ? 'bg-emerald-900/45 text-slate-100'
                              : 'text-studio-muted hover:bg-white/5'
                          }`}
                          onClick={() => {
                            setSbMode('up');
                            setSbFormError('');
                          }}
                        >
                          Sign up
                        </button>
                      </div>
                      <label className="block text-[10px] text-studio-muted" htmlFor="sb-email">
                        Email
                      </label>
                      <input
                        id="sb-email"
                        type="email"
                        autoComplete="email"
                        value={sbEmail}
                        onChange={(e) => setSbEmail(e.target.value)}
                        className={inputCls}
                      />
                      <label className="block text-[10px] text-studio-muted" htmlFor="sb-password">
                        Password
                      </label>
                      <input
                        id="sb-password"
                        type="password"
                        autoComplete={sbMode === 'up' ? 'new-password' : 'current-password'}
                        value={sbPassword}
                        onChange={(e) => setSbPassword(e.target.value)}
                        className={inputCls}
                      />
                      {sbMode === 'up' ? (
                        <>
                          <label className="block text-[10px] text-studio-muted" htmlFor="sb-confirm">
                            Confirm password
                          </label>
                          <input
                            id="sb-confirm"
                            type="password"
                            autoComplete="new-password"
                            value={sbConfirm}
                            onChange={(e) => setSbConfirm(e.target.value)}
                            className={inputCls}
                          />
                        </>
                      ) : null}
                      {sbFormError || sbStoreError ? (
                        <p className="text-[11px] text-red-300/90">{sbFormError || sbStoreError}</p>
                      ) : null}
                      <Button
                        variant="primary"
                        className="!text-xs"
                        disabled={sbLoading}
                        onClick={() => void submitSupabaseAuth()}
                      >
                        {sbLoading ? 'Please wait…' : sbMode === 'up' ? 'Create account' : 'Sign in'}
                      </Button>
                    </div>
                  )}
                </Panel>
              </div>

              {!demoOnly ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Local API <span className="font-normal normal-case text-studio-muted">(optional, dev server)</span>
                  </p>
                  <Panel>
                    {isAuthenticated ? (
                      <div>
                        <p className="text-[11px] font-medium text-sky-200/90">Signed in</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-200">{login}</p>
                        <p className="mt-2 text-[10px] leading-relaxed text-studio-muted">
                          Projects live in SQLite when the API is running (<span className="font-mono">npm run dev:full</span>
                          ). Use <span className="text-slate-400">Devices</span> in the top bar for sensors.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link
                            to="/devices"
                            onClick={() => onClose()}
                            className="inline-flex items-center justify-center rounded px-2.5 py-1 text-xs font-medium text-white bg-studio-accent border border-transparent hover:bg-studio-accentHover"
                          >
                            Open Devices & sensors
                          </Link>
                          <Button variant="default" className="!text-xs" onClick={handleSignOut}>
                            Sign out (local API)
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              authMode === 'in'
                                ? 'bg-studio-accent/25 text-slate-100'
                                : 'text-studio-muted hover:bg-white/5'
                            }`}
                            onClick={() => {
                              setAuthMode('in');
                              setFormError('');
                            }}
                          >
                            Sign in
                          </button>
                          <button
                            type="button"
                            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              authMode === 'up'
                                ? 'bg-studio-accent/25 text-slate-100'
                                : 'text-studio-muted hover:bg-white/5'
                            }`}
                            onClick={() => {
                              setAuthMode('up');
                              setFormError('');
                            }}
                          >
                            Sign up
                          </button>
                        </div>
                        <label className="block text-[10px] text-studio-muted" htmlFor="set-login">
                          Username or email
                        </label>
                        <input
                          id="set-login"
                          autoComplete="username"
                          value={formLogin}
                          onChange={(e) => setFormLogin(e.target.value)}
                          className={inputCls}
                        />
                        <label className="block text-[10px] text-studio-muted" htmlFor="set-password">
                          Password
                        </label>
                        <input
                          id="set-password"
                          type="password"
                          autoComplete={authMode === 'up' ? 'new-password' : 'current-password'}
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          className={inputCls}
                        />
                        {authMode === 'up' ? (
                          <>
                            <label className="block text-[10px] text-studio-muted" htmlFor="set-confirm">
                              Confirm password
                            </label>
                            <input
                              id="set-confirm"
                              type="password"
                              autoComplete="new-password"
                              value={formConfirm}
                              onChange={(e) => setFormConfirm(e.target.value)}
                              className={inputCls}
                            />
                          </>
                        ) : null}
                        {formError ? <p className="text-[11px] text-red-300/90">{formError}</p> : null}
                        <Button variant="primary" className="!text-xs" disabled={busy} onClick={() => void submitAuth()}>
                          {busy ? 'Please wait…' : authMode === 'up' ? 'Create account' : 'Sign in'}
                        </Button>
                        <p className="text-[10px] leading-relaxed text-studio-muted">
                          Server must be running. Tokens stay in this browser; passwords are hashed on the server.
                        </p>
                      </div>
                    )}
                  </Panel>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Local API</p>
                  <Panel>
                    <p className="text-[11px] leading-relaxed text-studio-muted">
                      Not available in demo mode. Use <span className="text-slate-400">Supabase cloud</span> above for
                      sign-in; device APIs use your Supabase access token only.
                    </p>
                  </Panel>
                </div>
              )}
            </section>

            {/* Save & projects */}
            <section className="space-y-2">
              <SectionTitle>Save &amp; projects</SectionTitle>
              <Panel>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Active Save / Open target</p>
                <p className="mt-1.5 inline-flex items-center rounded-md bg-[#1a1d22] px-2 py-1 font-mono text-[11px] text-emerald-200/90 ring-1 ring-white/[0.06]">
                  {activeSaveLabel}
                </p>
                <p className="mt-3 text-[11px] leading-relaxed text-studio-muted">
                  <span className="font-medium text-slate-400">Priority:</span>{' '}
                  {demoOnly ? (
                    <>
                      Supabase (when signed in) → otherwise this browser only. Local API Save/Open is disabled in demo
                      mode.
                    </>
                  ) : (
                    <>
                      Supabase (when configured and you’re signed in) → then local API (when signed in) → otherwise this
                      browser only.
                    </>
                  )}
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-relaxed text-studio-muted">
                  <li>
                    <span className="text-slate-400">Supabase</span> — cloud database; same account on any browser.
                  </li>
                  {!demoOnly ? (
                    <li>
                      <span className="text-slate-400">Local API</span> — SQLite on your machine; needs{' '}
                      <span className="font-mono">npm run server</span> / <span className="font-mono">dev:full</span>.
                    </li>
                  ) : null}
                  <li>
                    <span className="text-slate-400">This browser</span> — <span className="font-mono">localStorage</span>
                    ; File → <span className="text-slate-400">Save to this browser only</span> forces it.
                  </li>
                </ul>
                <p className="mt-2 border-t border-studio-border/50 pt-2 text-[10px] leading-relaxed text-studio-muted">
                  <span className="text-slate-400">File → Open…</span> lists Supabase, local API, and browser projects in
                  separate sections. <span className="text-slate-400">Export Project</span> always downloads a file.
                </p>
                <p className="mt-2 text-[10px] leading-relaxed text-studio-muted">
                  <span className="text-slate-400">Toolbar title &amp; notes</span> are stored with Save / Save As / Export
                  Project. <span className="text-slate-400">Clear canvas</span> keeps them; <span className="text-slate-400">New project</span>{' '}
                  resets title and notes. Changing the board does not clear them.
                </p>
                <p className="mt-2 text-[10px] leading-relaxed text-studio-muted">
                  <span className="text-slate-400">Unsaved session backup</span> — this browser may offer to restore your last
                  in-progress canvas after a refresh (separate from named saves). <span className="text-slate-400">New project</span>{' '}
                  clears that backup.
                </p>
              </Panel>
            </section>

            {/* IDE preferences */}
            <section className="space-y-2">
              <SectionTitle>IDE preferences</SectionTitle>
              <Panel className="space-y-4">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400" htmlFor="set-board">
                    Default board
                  </label>
                  <select
                    id="set-board"
                    value={boardId}
                    onChange={(e) => setBoardId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="arduino_uno">{BOARD_LABEL.arduino_uno}</option>
                    <option value="esp32">{BOARD_LABEL.esp32}</option>
                  </select>
                  <p className="mt-1 text-[10px] text-studio-muted">
                    Matches the toolbar board: Uno → Arduino C++ preview + .ino export; ESP32 → MicroPython preview + .py
                    export and serial Upload.
                  </p>
                </div>
                <div>
                  <span className="mb-1 block text-[11px] font-medium text-slate-400">Theme</span>
                  <select
                    disabled
                    className="w-full cursor-not-allowed rounded border border-studio-border/60 bg-[#1a1d22] px-2 py-1.5 text-xs text-slate-500"
                    value="dark"
                    aria-label="Theme — dark only for now"
                  >
                    <option value="dark">Dark (only option today)</option>
                  </select>
                  <p className="mt-1 text-[10px] text-studio-muted">More themes may be added later.</p>
                </div>
                <div>
                  <span className="mb-1 block text-[11px] font-medium text-slate-400">Layout density</span>
                  <p className="text-[11px] text-slate-300">Standard</p>
                  <p className="mt-1 text-[10px] italic text-studio-muted">
                    Compact UI is not available yet — this is a placeholder for a future setting.
                  </p>
                </div>
                <div className="border-t border-studio-border/50 pt-3">
                  <span className="block text-[11px] font-medium text-slate-400">Code preview</span>
                  <p className="mt-1 text-[10px] leading-relaxed text-studio-muted">
                    Right panel is live for the selected board:{' '}
                    {boardId === 'esp32' ? 'MicroPython for ESP32 (Upload writes main.py when serial is connected).' : 'C++ sketch for Arduino Uno (flash via Arduino IDE; Export .ino).'}
                  </p>
                </div>
              </Panel>
            </section>

            {/* About */}
            <section className="space-y-2">
              <SectionTitle>About</SectionTitle>
              <Panel>
                <p className="text-sm font-semibold text-slate-100">SIMATS BLOX</p>
                <p className="mt-1 text-[11px] leading-relaxed text-studio-muted">
                  Block-based editor for Arduino Uno and ESP32 — build sketches with hardware-oriented blocks and a live
                  code preview.
                </p>
                <p className="mt-2 font-mono text-[10px] text-slate-500">Version {pkg.version}</p>
                <p className="mt-3 text-[10px] leading-relaxed text-amber-200/75">
                  <span className="font-medium text-amber-200/90">Board modes:</span>{' '}
                  <span className="text-slate-300/90">ESP32</span> —{' '}
                  <span className="text-slate-300/90">Upload</span> sends preview MicroPython to{' '}
                  <span className="font-mono text-slate-400">main.py</span> over USB serial when connected.{' '}
                  <span className="text-slate-300/90">Arduino Uno</span> — no in-browser flash; use{' '}
                  <span className="text-slate-300/90">Export Code (.ino)</span> and Arduino IDE;{' '}
                  <span className="text-slate-300/90">Connect</span> is for Serial Monitor only. Web Serial needs Chrome /
                  Edge / Opera. <span className="text-slate-400">Export Project</span> is always a .json backup.
                </p>
              </Panel>
            </section>
          </div>
        </div>

        <div className="shrink-0 flex justify-end border-t border-studio-border px-4 py-2.5">
          <Button variant="ghost" className="!text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
