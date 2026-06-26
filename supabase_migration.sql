-- UrjaGram VET-OS Platform — Supabase Schema Migration
-- Run this ONCE in: https://supabase.com/dashboard → SQL Editor → New query
-- After running, the app will switch from sample data to live DB automatically.

-- ─── TABLES ───────────────────────────────────────────────────────────────────

create table if not exists villages (
  id          bigserial primary key,
  name        text not null unique,
  gp_name     text not null,
  district    text,
  state       text,
  lat         numeric(10, 6),
  lng         numeric(10, 6),
  population  integer,
  households  integer,
  status      text not null default 'not_started'
              check (status in ('assessed', 'pending', 'not_started')),
  created_at  timestamptz not null default now()
);

create table if not exists solar_assessments (
  id                 bigserial primary key,
  village_id         bigint references villages (id) on delete set null,
  village_name       text not null,
  roof_area_sqm      numeric(10, 2),
  usable_area_sqm    numeric(10, 2),
  panel_count        integer,
  system_kwp         numeric(10, 3),
  annual_kwh         numeric(12, 1),
  co2_offset_t       numeric(10, 3),
  coverage_pct       numeric(6, 2),
  subsidy_inr        integer,
  confidence         text check (confidence in ('low', 'medium', 'high')),
  orientation        text check (orientation in ('good', 'moderate', 'poor')),
  shading_pct        numeric(5, 2),
  roof_type_detected text,
  observations       text,
  panel_fit_notes    text,
  image_url          text,
  assessed_by        text,
  assessed_at        timestamptz not null default now()
);

create table if not exists viip_documents (
  id           bigserial primary key,
  village_name text not null,
  gp_name      text,
  state        text,
  district     text,
  content      text,
  priorities   text[],
  generated_by text,
  status       text not null default 'draft'
               check (status in ('draft', 'approved', 'submitted')),
  generated_at timestamptz not null default now()
);

create table if not exists mrv_records (
  id           bigserial primary key,
  village_id   bigint references villages (id) on delete set null,
  village_name text not null,
  month        integer not null check (month between 1 and 12),
  year         integer not null,
  actual_kwh   numeric(12, 2),
  forecast_kwh numeric(12, 2),
  co2_offset_t numeric(10, 4),
  recorded_at  timestamptz not null default now(),
  unique (village_id, month, year)
);

create table if not exists urjasakhi_data (
  id                 bigserial primary key,
  household_head     text not null,
  contact_number     text,
  address            text,
  family_size        integer,
  electricity_source text check (electricity_source in ('grid', 'offgrid', 'none')),
  monthly_bill       numeric(10, 2),
  roof_type          text check (roof_type in ('concrete', 'tin', 'kacha')),
  status             text not null default 'pending_push'
                     check (status in ('pending_push', 'pushed')),
  created_at         timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- App uses anon key directly (no auth). Policies allow full access via anon key.

alter table villages          enable row level security;
alter table solar_assessments enable row level security;
alter table viip_documents    enable row level security;
alter table mrv_records       enable row level security;
alter table urjasakhi_data    enable row level security;

-- Drop existing policies first (idempotent re-run support)
drop policy if exists "auth_all"   on villages;
drop policy if exists "auth_all"   on solar_assessments;
drop policy if exists "auth_all"   on viip_documents;
drop policy if exists "auth_all"   on mrv_records;
drop policy if exists "auth_all"   on urjasakhi_data;
drop policy if exists "public_all" on villages;
drop policy if exists "public_all" on solar_assessments;
drop policy if exists "public_all" on viip_documents;
drop policy if exists "public_all" on mrv_records;
drop policy if exists "public_all" on urjasakhi_data;

-- Allow full read + write via the anon key (no login required)
create policy "public_all" on villages          for all using (true) with check (true);
create policy "public_all" on solar_assessments for all using (true) with check (true);
create policy "public_all" on viip_documents    for all using (true) with check (true);
create policy "public_all" on mrv_records       for all using (true) with check (true);
create policy "public_all" on urjasakhi_data    for all using (true) with check (true);

-- ─── SEED VILLAGES ────────────────────────────────────────────────────────────

insert into villages (name, gp_name, district, state, lat, lng, population, households, status)
values
  ('Naultha',    'Panipat Gram Panchayat',   'Panipat', 'Haryana', 29.390900, 76.963500, 4200, 760,  'assessed'),
  ('Bapoli',     'Bapoli Gram Panchayat',    'Panipat', 'Haryana', 29.482100, 76.942300, 3900, 690,  'assessed'),
  ('Kutail',     'Kutail Gram Panchayat',    'Karnal',  'Haryana', 29.685700, 76.990500, 5100, 880,  'pending'),
  ('Rasulpur',   'Rasulpur Gram Panchayat',  'Sonipat', 'Haryana', 28.984500, 77.042300, 3600, 620,  'pending'),
  ('Gharaunda',  'Gharaunda Gram Panchayat', 'Karnal',  'Haryana', 29.538100, 77.006700, 6100, 1120, 'not_started')
on conflict (name) do nothing;

-- ─── ENABLE REALTIME ──────────────────────────────────────────────────────────
-- In Supabase dashboard: Database → Replication → enable solar_assessments table

-- Done! The app will now load live data and show "DB Live" in the top bar.
