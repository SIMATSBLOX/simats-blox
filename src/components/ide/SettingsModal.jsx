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
 * @param {{ summary: string, children: import('react').ReactNode }} props
 */
function SecondaryDetails({ summary, children }) {
  return (
    <details className="rounded-md border border-studio-border/45 bg-[#1f242b]/90">
      <summary className="cursor-pointer px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {summary}
      </summary>
      <div className="space-y-2 border-t border-studio-border/40 px-2.5 py-2 text-[10px] leading-relaxed text-studio-muted">
        {children}
      </div>
    </details>
  );
}

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function SettingsModal({ open, onClose }) {
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
      ? 'Cloud account'
      : persistTarget === 'express_api'
        ? 'Local dev server'
        : 'This browser only';

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
        <div className="shrink-0 border-b border-studio-border px-4 py-2.5">
          <h2 id="settings-title" className="text-base font-semibold tracking-tight text-slate-100">
            Settings
          </h2>
          <p className="mt-0.5 text-[10px] text-studio-muted">
            Cloud account, where saves go, and IDE defaults.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-4">
            {/* Cloud account */}
            <section className="space-y-2">
              <SectionTitle>Cloud account</SectionTitle>
              <SecondaryDetails summary="More info">
                <p>
                  {demoOnly ? (
                    <>
                      Use the email sign-in below for cloud projects and{' '}
                      <span className="text-slate-400">Devices</span>. This build does not show a separate local-server
                      account.
                    </>
                  ) : (
                    <>
                      Your cloud account syncs projects across browsers. You can also work{' '}
                      <span className="text-slate-400">in this browser only</span> without signing in. Need a local dev
                      database? Expand <span className="text-slate-400">Developer · local server</span> below.
                    </>
                  )}
                </p>
              </SecondaryDetails>

              <div className="space-y-2">
                <Panel>
                  {!isSupabaseConfigured() ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-studio-muted">
                        Cloud storage isn’t configured. Expand below for steps.
                      </p>
                      <SecondaryDetails summary="Cloud setup (hosting)">
                        <p>
                          Add <code className="rounded bg-black/35 px-1 font-mono text-[10px]">VITE_SUPABASE_URL</code> and{' '}
                          <code className="rounded bg-black/35 px-1 font-mono text-[10px]">VITE_SUPABASE_ANON_KEY</code> to{' '}
                          <code className="rounded bg-black/35 px-1 font-mono text-[10px]">.env.local</code>, restart Vite,
                          and create <code className="rounded bg-black/35 px-1 font-mono text-[10px]">ide_projects</code> in
                          Supabase (see README).
                        </p>
                      </SecondaryDetails>
                    </div>
                  ) : sbUser ? (
                    <div>
                      <p className="text-[11px] font-medium text-emerald-200/90">Signed in</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-200">
                        {sbUser.email ?? sbUser.id}
                      </p>
                      <div className="mt-2">
                        <Button
                          variant="default"
                          className="!text-xs"
                          disabled={sbLoading}
                          onClick={() => void handleSupabaseSignOut()}
                        >
                          Sign out of cloud
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
                <SecondaryDetails summary="Developer · local server (optional)">
                  <p className="text-[10px] text-studio-muted">
                    For development: SQLite on your machine when the API is running. Not required for normal cloud use.
                  </p>
                  <Panel className="mt-2">
                    {isAuthenticated ? (
                      <div>
                        <p className="text-[11px] font-medium text-sky-200/90">Signed in (local server)</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-200">{login}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link
                            to="/devices"
                            onClick={() => onClose()}
                            className="inline-flex items-center justify-center rounded px-2.5 py-1 text-xs font-medium text-white bg-studio-accent border border-transparent hover:bg-studio-accentHover"
                          >
                            Open Devices & sensors
                          </Link>
                          <Button variant="default" className="!text-xs" onClick={handleSignOut}>
                            Sign out of local server
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
                </SecondaryDetails>
              ) : null}
            </section>

            {/* Save & open */}
            <section className="space-y-2">
              <SectionTitle>Save &amp; open</SectionTitle>
              <Panel className="py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Where Save / Open goes right now
                </p>
                <p className="mt-1 inline-flex items-center rounded-md bg-[#1a1d22] px-2 py-1 font-mono text-[11px] text-emerald-200/90 ring-1 ring-white/[0.06]">
                  {activeSaveLabel}
                </p>
                <div className="mt-2">
                  <SecondaryDetails summary="How saving works (priority, browser storage, File menu)">
                    <p>
                      <span className="font-medium text-slate-400">Order of use:</span>{' '}
                      {demoOnly ? (
                        <>
                          Cloud when signed in; otherwise this browser only. (Local dev server Save/Open is off in this
                          build.)
                        </>
                      ) : (
                        <>
                          Cloud when signed in; if you use a local dev server and sign in there, that can be next; otherwise
                          this browser only.
                        </>
                      )}
                    </p>
                    {isSupabaseConfigured() && sbUser ? (
                      <p>
                        Signed in to cloud: toolbar <span className="text-slate-400">Save / Open</span> uses cloud projects
                        when cloud has priority.
                      </p>
                    ) : null}
                    {!demoOnly && isAuthenticated ? (
                      <p>
                        Local dev server: projects live in SQLite when the API is running (
                        <span className="font-mono">npm run dev:full</span>). Use <span className="text-slate-400">Devices</span>{' '}
                        in the top bar for sensors.
                      </p>
                    ) : null}
                    <ul className="list-inside list-disc space-y-1">
                      <li>
                        <span className="text-slate-400">Cloud account</span> — same projects on any browser when you sign
                        in.
                      </li>
                      {!demoOnly ? (
                        <li>
                          <span className="text-slate-400">Local dev server</span> — SQLite on your machine; needs{' '}
                          <span className="font-mono">npm run server</span> / <span className="font-mono">dev:full</span>.
                        </li>
                      ) : null}
                      <li>
                        <span className="text-slate-400">This browser</span> —{' '}
                        <span className="font-mono">localStorage</span>; File →{' '}
                        <span className="text-slate-400">Save to this browser only</span> forces it.
                      </li>
                    </ul>
                    <p>
                      <span className="text-slate-400">File → Open…</span> lists cloud, optional local server, and this
                      browser in separate sections. <span className="text-slate-400">Export Project</span> always downloads
                      a file.
                    </p>
                    <p>
                      <span className="text-slate-400">Toolbar title &amp; notes</span> are stored with Save / Save As /
                      Export Project. <span className="text-slate-400">Clear canvas</span> keeps them;{' '}
                      <span className="text-slate-400">New project</span> resets title and notes.
                    </p>
                    <p>
                      <span className="text-slate-400">Unsaved session backup</span> — this browser may offer to restore your
                      last in-progress canvas after a refresh (separate from named saves).{' '}
                      <span className="text-slate-400">New project</span> clears that backup.
                    </p>
                  </SecondaryDetails>
                </div>
              </Panel>
            </section>

            {/* IDE preferences */}
            <section className="space-y-2">
              <SectionTitle>IDE preferences</SectionTitle>
              <Panel className="space-y-3 py-2">
                <div>
                  <span className="mb-0.5 block text-[11px] font-medium text-slate-400">Hardware target</span>
                  <p className={`${inputCls} border-studio-border/60 bg-[#1b1f24] text-slate-200`}>{BOARD_LABEL.esp32}</p>
                </div>
                <SecondaryDetails summary="Code preview &amp; upload">
                  <p>
                    The right panel shows MicroPython generated from blocks.{' '}
                    <span className="text-slate-300/90">Upload</span> writes preview code to{' '}
                    <span className="font-mono text-slate-400">main.py</span> over USB serial when connected.
                  </p>
                  <p className="text-amber-200/80">
                    <span className="font-medium text-amber-200/90">Serial:</span> Web Serial needs Chrome / Edge / Opera.{' '}
                    <span className="text-slate-400">Export Project</span> is always a .json backup;{' '}
                    <span className="text-slate-400">Export Code</span> downloads <span className="font-mono text-slate-400">.py</span>.
                  </p>
                </SecondaryDetails>
              </Panel>
            </section>

            {/* About */}
            <section>
              <SecondaryDetails summary={`More info · SIMATS BLOX v${pkg.version}`}>
                <p className="font-semibold text-slate-200">SIMATS BLOX</p>
                <p>
                  Block-based editor for ESP32 — hardware-oriented blocks and a live MicroPython preview.
                </p>
                <p className="font-mono text-slate-500">Version {pkg.version}</p>
              </SecondaryDetails>
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
