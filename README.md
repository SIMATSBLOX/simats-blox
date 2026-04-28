# SIMATS BLOX (hardware block IDE)

Blockly editor for **ESP32** with **MicroPython** preview. **Connect, Upload, and serial** may be partial or placeholder depending on the screen — blocks and generated code are the source of truth.

## Architecture (quick overview)

This repo is **one website** (React) talking to **one Node server** (Express). You do **not** run two separate backends.

1. **Frontend entry:** `index.html` loads **`src/main.jsx`**, which renders **`src/App.jsx`**. All UI, Blockly, and device pages live under **`src/`**. Static assets and example JSON live under **`public/`**. Vite serves the UI in dev (often port **8183**).
2. **Backend entry:** **`server/index.js`** is what **`npm run server`** runs. That file creates the HTTP server, handles **sign-in** and **saved projects** (SQLite), and attaches the sensor API.
3. **`server/` + `backend/src/` together:** **`server/index.js`** imports **`backend/src/sensorPlatform.js`**, which registers **device + readings routes** and **Socket.IO** on the **same** Express app. So **`server/`** = main API process and database helpers; **`backend/src/`** = sensor/readings module (routes, controllers, validation). Both run in **one process** on **one port** (default **8184**).
4. **SQLite:** The local API stores data in **`server/data/`** (e.g. `ide.sqlite`). That folder is gitignored so your local DB is not committed.
5. **Local development commands:** See **Install & run** and **Run with account projects** below. Short version: **`npm install`**, then **`npm run dev`** (UI only) or **`npm run dev:full`** (API + UI together).

## Requirements

- Node.js 18+
- npm 9+

## Supabase (optional — cloud auth + projects)

Without **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`**, the app stays in **local-only** mode for Supabase: no crashes, no fake login. Copy **`.env.example`** to **`.env.local`**, paste your project credentials from the Supabase dashboard, then restart Vite.

**Dashboard checklist (next steps after creating a project):**

1. **Project Settings → API** — copy **Project URL** and **anon public** key into `.env.local`.
2. **Authentication → Providers** — enable **Email** (or your chosen provider).
3. **SQL Editor** — run the following (table name must match `ide_projects` — see `src/lib/projectCloudSchema.js`):

```sql
create table public.ide_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  board_id text not null,
  workspace_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ide_projects enable row level security;

create policy "ide_projects_select_own" on public.ide_projects
  for select using (auth.uid() = user_id);

create policy "ide_projects_insert_own" on public.ide_projects
  for insert with check (auth.uid() = user_id);

create policy "ide_projects_update_own" on public.ide_projects
  for update using (auth.uid() = user_id);

create policy "ide_projects_delete_own" on public.ide_projects
  for delete using (auth.uid() = user_id);
```

The toolbar **Save / Open** flow still uses the **Express API + browser storage** until you wire `cloudRouting` / `projectCloudService` into `TopToolbar`. **Settings** already exposes real Supabase **Sign in / Sign up / Sign out** when env vars are set.

## Install & run (UI only)

```bash
npm install
npm run dev
```

Open the URL shown (often `http://localhost:8183`).

## Run with account projects (API + UI)

Saves **Open / Save / Save As** to a **SQLite** database per user when signed in. Vite proxies `/api` to the API in dev.

```bash
npm run dev:full
```

Or two terminals: `npm run server` (port **8184**) and `npm run dev`. Then **Settings → Sign up / Sign in**.

- Database file: `server/data/ide.sqlite` (Created automatically; listed in `.gitignore`.)
- Production: set **`JWT_SECRET`** to a long random string. Optional: **`PORT`**.

`npm run preview` serves static files only — start `npm run server` separately. For a static build talking to the API on another origin, set **`VITE_API_URL`** before `npm run build` (e.g. `https://api.example.com`).

Clean reinstall:

```bash
rm -rf node_modules dist && npm install
```

## Build

```bash
npm run build
npm run preview   # optional: test dist/ locally
```

## ZIP / share (source)

**Include:** `src/`, `server/`, `public/` (includes `examples/` starter JSON), `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `README.md`, `.gitignore`, `.env.example`

**Exclude:** `node_modules/`, `dist/`, `.vite/`, `.DS_Store`, `__MACOSX/`

Unpack → `npm install` → `npm run dev` or `npm run build`.

**Examples:** Toolbar **Examples** loads JSON from `public/examples/index.json` and the listed `.json` files. Regenerate everything (including the manifest) with `npm run build:examples` after changing blocks or the generator script.
