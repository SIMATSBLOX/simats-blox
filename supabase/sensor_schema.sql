-- ============================================================================
-- SIMATS BLOX — sensor_devices + sensor_readings (Supabase Postgres)
-- Paste into SQL Editor. Requires: auth.users (Supabase Auth enabled).
-- ============================================================================
-- api_key_hash   : verifier only (e.g. bcrypt/argon); never store raw key here.
-- api_key_lookup : deterministic, unique value for row lookup from x-device-key
--                  (e.g. HMAC-SHA256(server_secret, raw_key) hex — decided on Render).
--                  Render validates raw key against api_key_hash after SELECT by lookup.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- sensor_devices
-- ---------------------------------------------------------------------------
create table public.sensor_devices (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users (id)
    on delete cascade,

  device_id text not null,
  name text not null,
  sensor_type text not null,
  location text not null default '',

  api_key_hash text not null,
  api_key_lookup text not null,

  status text not null default 'offline',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sensor_devices_status_check
    check (status in ('online', 'offline')),

  constraint sensor_devices_user_device_unique
    unique (user_id, device_id),

  constraint sensor_devices_api_key_lookup_unique
    unique (api_key_lookup)
);

create index idx_sensor_devices_user_updated
  on public.sensor_devices (user_id, updated_at desc);

create index idx_sensor_devices_lookup
  on public.sensor_devices (api_key_lookup);

comment on table public.sensor_devices is
  'Per-account sensors; Render validates x-device-key using api_key_lookup + api_key_hash.';

comment on column public.sensor_devices.api_key_hash is
  'Verifier for device secret (e.g. bcrypt); plain key shown once at registration only.';

comment on column public.sensor_devices.api_key_lookup is
  'Unique indexed lookup derived from device key; enables O(1) row fetch before verify.';

-- ---------------------------------------------------------------------------
-- sensor_readings
-- ---------------------------------------------------------------------------
create table public.sensor_readings (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users (id)
    on delete cascade,

  device_row_id uuid not null
    references public.sensor_devices (id)
    on delete cascade,

  device_id text not null,
  sensor_type text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_sensor_readings_device_time
  on public.sensor_readings (device_row_id, created_at desc);

create index idx_sensor_readings_user_device_time
  on public.sensor_readings (user_id, device_row_id, created_at desc);

create index idx_sensor_readings_user_time
  on public.sensor_readings (user_id, created_at desc);

comment on table public.sensor_readings is
  'Append-only telemetry; browser reads via RLS; writes expected from Render (service_role).';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.sensor_devices enable row level security;
alter table public.sensor_readings enable row level security;

-- sensor_devices: owners manage their devices (narrow later if only Render writes)
create policy sensor_devices_select_own
  on public.sensor_devices
  for select
  using (auth.uid() = user_id);

create policy sensor_devices_insert_own
  on public.sensor_devices
  for insert
  with check (auth.uid() = user_id);

create policy sensor_devices_update_own
  on public.sensor_devices
  for update
  using (auth.uid() = user_id);

create policy sensor_devices_delete_own
  on public.sensor_devices
  for delete
  using (auth.uid() = user_id);

-- sensor_readings: owners read only; no insert/update/delete for authenticated (Render uses service_role)
create policy sensor_readings_select_own
  on public.sensor_readings
  for select
  using (auth.uid() = user_id);
