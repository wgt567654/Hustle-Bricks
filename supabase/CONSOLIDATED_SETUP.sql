-- ═══════════════════════════════════════════════════════════════════════════
-- HustleBricks — CONSOLIDATED DATABASE SETUP
-- Generated 2026-07-19 from all 40 migration files in /supabase.
--
-- WHAT THIS IS
--   ONE file that takes a COMPLETELY EMPTY Supabase project (or one you just
--   reset) to the full current HustleBricks schema (53 tables) in a single
--   SQL-editor paste. Paste the whole file into the Supabase SQL editor and
--   click Run. It should finish with two result sets: a table count and the
--   list of tables.
--
-- ⚠ WARNING — SECTION 0 WIPES THE public SCHEMA.
--   Every table and all data in the "public" schema of this project will be
--   PERMANENTLY DELETED. Only run this on a fresh project or one you truly
--   want to reset. Auth users, storage files, and other schemas are NOT
--   touched.
--
-- MANUAL DASHBOARD STEPS (cannot be done in SQL — do these once, after):
--   1. Storage: create bucket "lead-photos"  (public read)  — canvassing photos
--   2. Storage: create bucket "signatures"   (public read)  — job sign-offs
--
-- RECONSTRUCTED OBJECTS (flagged per task instructions)
--   Six tables and five businesses columns are used by the app but were never
--   captured in any .sql file in the repo (they were created ad-hoc in the
--   dashboard). Without them, later migrations in this file would ERROR:
--     * team_messages          — altered by messaging_and_service_areas.sql
--     * message_templates      — altered by customization.sql
--     * businesses.city        — referenced by get_business_service_areas()
--     * worker_availability    — DDL copied verbatim from the in-app helper
--                                (src/app/(dashboard)/calendar/CalendarClient.tsx)
--     * service_plans, competitor_intel, payment_reminder_sends
--     * businesses.payment_reminders_enabled / auto_invoice_enabled /
--       morning_briefing_enabled / ai_sms_enabled
--   They are reconstructed from app-code usage in the section marked
--   "GAP-FILL (RECONSTRUCTED)". Everything else below is verbatim from the
--   source files, in dependency order.
--
-- ONE DELIBERATE REORDER
--   schema.sql defines jobs BEFORE team_members but jobs has a foreign key to
--   team_members — that ordering errors on an empty database. The Team
--   Members block is moved ahead of the Jobs block. No statement text changed.
--
-- DEDUPES
--   RUN_ME_launch_migrations.sql was a bundle repeating stripe_connect.sql,
--   rls_tenant_scoping.sql, book_slug.sql and canvassing_enhancements.sql.
--   Those copies are skipped; only its unique payments index is included at
--   the end.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ SECTION 0: RESET PREAMBLE ══════════════════════════════════════════════
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  DANGER ZONE: drops and recreates the entire public schema.              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- The signup trigger lives on auth.users (outside public), so drop it first
-- or it would be left pointing at a dropped function.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

drop schema public cascade;
create schema public;

-- Restore the grants Supabase expects on a fresh project.
grant usage  on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres;
grant all    on schema public to postgres, service_role;
comment on schema public is 'standard public schema';

-- Default privileges so PostgREST (anon/authenticated/service_role) can see
-- every table/function/sequence created below.
alter default privileges in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- Extensions: none needed. gen_random_uuid() is built into Postgres 13+
-- (and pgcrypto is preinstalled in the extensions schema on Supabase).


-- ═══ source: schema.sql (commit 2026-03-19) ═════════════════════════════════
-- NOTE: Team Members block moved ahead of Jobs (see header). Otherwise verbatim.

-- HustleBricks Database Schema

-- ─── Profiles ────────────────────────────────────────────────────────────────
-- Extends auth.users with display info. Populated automatically on signup via trigger.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view and update their own profile"
  on public.profiles for all
  using (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── Businesses ──────────────────────────────────────────────────────────────
create table public.businesses (
  id                          uuid primary key default gen_random_uuid(),
  owner_id                    uuid not null references auth.users (id) on delete cascade,
  name                        text not null,
  logo_url                    text,
  venmo_username              text,
  cashapp_tag                 text,
  check_payable_to            text,
  contact_email               text,
  contact_phone               text,
  tax_rate                    numeric(5, 2) default 8.00,
  commission_rate             numeric(5, 2) default 5.00,
  sms_reminders_enabled       boolean default false,
  smart_scheduling_enabled    boolean default false,
  created_at                  timestamptz default now()
);

alter table public.businesses enable row level security;
create policy "Owner can manage their business"
  on public.businesses for all
  using (auth.uid() = owner_id);


-- ─── Clients ─────────────────────────────────────────────────────────────────
create type client_tag as enum ('residential', 'commercial', 'vip');

create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  email        text,
  phone        text,
  address      text,
  tag          client_tag default 'residential',
  notes        text,
  created_at   timestamptz default now()
);

alter table public.clients enable row level security;
create policy "Business members can manage clients"
  on public.clients for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = clients.business_id and b.owner_id = auth.uid()
    )
  );


-- ─── Services ────────────────────────────────────────────────────────────────
create type pricing_unit as enum ('flat', 'per_hour', 'per_sqft', 'per_item');

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  name             text not null,
  description      text,
  category         text,
  price            numeric(10, 2) not null default 0,
  unit             pricing_unit not null default 'flat',
  duration_mins    int default 60,
  image_url        text,
  is_active        boolean default true,
  created_at       timestamptz default now()
);

alter table public.services enable row level security;
create policy "Business members can manage services"
  on public.services for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = services.business_id and b.owner_id = auth.uid()
    )
  );


-- ─── Quotes ──────────────────────────────────────────────────────────────────
create type quote_status as enum ('draft', 'sent', 'accepted', 'declined');

create table public.quotes (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete restrict,
  status       quote_status not null default 'draft',
  total        numeric(10, 2) not null default 0,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table public.quote_line_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes (id) on delete cascade,
  service_id  uuid references public.services (id) on delete set null,
  description text not null,
  quantity    numeric(10, 2) not null default 1,
  unit_price  numeric(10, 2) not null default 0,
  total       numeric(10, 2) generated always as (quantity * unit_price) stored
);

alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;

create policy "Business members can manage quotes"
  on public.quotes for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = quotes.business_id and b.owner_id = auth.uid()
    )
  );

create policy "Business members can manage quote line items"
  on public.quote_line_items for all
  using (
    exists (
      select 1 from public.quotes q
      join public.businesses b on b.id = q.business_id
      where q.id = quote_line_items.quote_id and b.owner_id = auth.uid()
    )
  );


-- ─── Team Members ────────────────────────────────────────────────────────────
-- (moved ahead of Jobs: jobs.assigned_member_id references this table)
create type team_role as enum ('admin', 'member', 'sales');

create table public.team_members (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete set null,
  name             text not null,
  email            text,
  role             team_role not null default 'member',
  is_active        boolean default true,
  certifications   text[] default '{}',
  created_at       timestamptz default now(),
  unique (business_id, user_id)
);

alter table public.team_members enable row level security;
create policy "Business members can manage team"
  on public.team_members for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = team_members.business_id and b.owner_id = auth.uid()
    )
  );


-- ─── Jobs ────────────────────────────────────────────────────────────────────
create type job_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

create table public.jobs (
  id                          uuid primary key default gen_random_uuid(),
  business_id                 uuid not null references public.businesses (id) on delete cascade,
  client_id                   uuid not null references public.clients (id) on delete restrict,
  quote_id                    uuid references public.quotes (id) on delete set null,
  status                      job_status not null default 'scheduled',
  scheduled_at                timestamptz,
  completed_at                timestamptz,
  total                       numeric(10, 2) not null default 0,
  notes                       text,
  recurrence_frequency        text,
  recurrence_interval_days    int,
  before_photo_url            text,
  after_photo_url             text,
  assigned_member_id          uuid references public.team_members (id) on delete set null,
  created_at                  timestamptz default now()
);

create table public.job_line_items (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  service_id  uuid references public.services (id) on delete set null,
  description text not null,
  quantity    numeric(10, 2) not null default 1,
  unit_price  numeric(10, 2) not null default 0,
  total       numeric(10, 2) generated always as (quantity * unit_price) stored
);

alter table public.jobs enable row level security;
alter table public.job_line_items enable row level security;

create policy "Business members can manage jobs"
  on public.jobs for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = jobs.business_id and b.owner_id = auth.uid()
    )
  );

create policy "Business members can manage job line items"
  on public.job_line_items for all
  using (
    exists (
      select 1 from public.jobs j
      join public.businesses b on b.id = j.business_id
      where j.id = job_line_items.job_id and b.owner_id = auth.uid()
    )
  );


-- ─── Payments ────────────────────────────────────────────────────────────────
create type payment_status as enum ('pending', 'paid', 'refunded', 'failed');

create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  job_id               uuid not null references public.jobs (id) on delete restrict,
  business_id          uuid not null references public.businesses (id) on delete cascade,
  amount               numeric(10, 2) not null,
  status               payment_status not null default 'pending',
  stripe_payment_id    text,
  method               text,
  notes                text,
  paid_at              timestamptz,
  created_at           timestamptz default now()
);

alter table public.payments enable row level security;
create policy "Business members can manage payments"
  on public.payments for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = payments.business_id and b.owner_id = auth.uid()
    )
  );


-- ═══ source: employee_feature.sql (commit 2026-04-02) ═══════════════════════

-- ─── Employee Feature Migration ──────────────────────────────────────────────

-- ─── Schema Additions ─────────────────────────────────────────────────────────

-- Employee access code on businesses (6-char uppercase, e.g. "HB7X2K")
alter table public.businesses
  add column if not exists employee_access_code text;

-- Pending flag on team_members (true = joined via code, awaiting owner approval)
alter table public.team_members
  add column if not exists is_pending boolean default false;


-- ─── Time Entries ─────────────────────────────────────────────────────────────

drop table if exists public.time_entries cascade;

create table public.time_entries (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.team_members (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  business_id     uuid not null references public.businesses (id) on delete cascade,
  clocked_in_at   timestamptz not null default now(),
  clocked_out_at  timestamptz,
  created_at      timestamptz default now()
);

alter table public.time_entries enable row level security;

create policy "Owner can manage time entries"
  on public.time_entries for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = time_entries.business_id
        and b.owner_id = auth.uid()
    )
  );

create policy "Employees can manage their time entries"
  on public.time_entries for all
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.id = time_entries.employee_id
    )
  );


-- ─── Employee RLS Policies ────────────────────────────────────────────────────

-- Employees can read their own team_member row
create policy "Team members can view their own record"
  on public.team_members for select
  using (user_id = auth.uid());

-- NOTE: No direct businesses SELECT policy for team members.
-- The lookup_business_by_code and join_business_as_employee functions use
-- SECURITY DEFINER which bypasses RLS, so no policy is needed here.
-- Adding one causes infinite recursion with the team_members policy.

-- Employees can read jobs assigned to them
create policy "Employees can view assigned jobs"
  on public.jobs for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.id = jobs.assigned_member_id
        and tm.is_active = true
    )
  );

-- Employees can update status and photos on their assigned jobs
create policy "Employees can update assigned jobs"
  on public.jobs for update
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.id = jobs.assigned_member_id
        and tm.is_active = true
    )
  );

-- Employees can read line items for their assigned jobs
create policy "Employees can view job line items for assigned jobs"
  on public.job_line_items for select
  using (
    exists (
      select 1 from public.jobs j
      join public.team_members tm on tm.id = j.assigned_member_id
      where j.id = job_line_items.job_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- Employees can read client info for their assigned jobs
create policy "Employees can view clients for assigned jobs"
  on public.clients for select
  using (
    exists (
      select 1 from public.jobs j
      join public.team_members tm on tm.id = j.assigned_member_id
      where j.client_id = clients.id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- Employees can insert payments for their assigned jobs
create policy "Employees can record payments for assigned jobs"
  on public.payments for insert
  with check (
    exists (
      select 1 from public.jobs j
      join public.team_members tm on tm.id = j.assigned_member_id
      where j.id = payments.job_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );


-- ─── RPC Helper Functions ─────────────────────────────────────────────────────

-- Look up a business by access code — callable before signup to preview the business name.
create or replace function public.lookup_business_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select name into v_name
  from public.businesses
  where employee_access_code = upper(trim(p_code))
  limit 1;

  if v_name is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object('found', true, 'name', v_name);
end;
$$;

-- Create a pending team_member record after the employee has signed up.
-- Uses security definer to bypass RLS (the new employee cannot INSERT into team_members directly).
create or replace function public.join_business_as_employee(
  p_code text,
  p_name text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business_id   uuid;
  v_business_name text;
  v_user_id       uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  select id, name into v_business_id, v_business_name
  from public.businesses
  where employee_access_code = upper(trim(p_code))
  limit 1;

  if v_business_id is null then
    return jsonb_build_object('error', 'Invalid access code');
  end if;

  -- Prevent duplicate joins
  if exists (
    select 1 from public.team_members
    where business_id = v_business_id and user_id = v_user_id
  ) then
    return jsonb_build_object('error', 'You have already joined this business');
  end if;

  insert into public.team_members (business_id, user_id, name, is_active, is_pending, role)
  values (v_business_id, v_user_id, trim(p_name), false, true, 'member');

  return jsonb_build_object('success', true, 'business_name', v_business_name);
end;
$$;


-- ═══ source: route_optimization.sql (commit 2026-04-03) ═════════════════════

-- Nullable route_order on jobs — set by the owner when planning a route.
-- null = no route set (falls back to scheduled_at order on employee portal).
-- 1-indexed integer scoped implicitly by assigned_member_id + scheduled_at date.
alter table public.jobs
  add column if not exists route_order integer;

create index if not exists jobs_assigned_route_idx
  on public.jobs (assigned_member_id, scheduled_at, route_order);


-- ═══ source: canvassing.sql (commit 2026-04-08) ═════════════════════════════

-- Canvassing / Door-Knocking System

create table public.canvassing_properties (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  lat              decimal(10, 7) not null,
  lng              decimal(10, 7) not null,
  address          text,
  status           text not null default 'not_visited'
                     check (status in ('not_visited', 'no_answer', 'no', 'interested', 'booked')),
  last_visited_at  timestamptz,
  visited_by       uuid references public.team_members (id) on delete set null,
  notes            text,
  follow_up_needed boolean default false,
  follow_up_date   date,
  follow_up_notes  text,
  job_id           uuid references public.jobs (id) on delete set null,
  created_at       timestamptz default now()
);

alter table public.canvassing_properties enable row level security;

-- Owners can manage all properties for their business
create policy "Owner can manage canvassing properties"
  on public.canvassing_properties for all
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Active employees can read and write properties for their business
create policy "Employees can manage canvassing properties"
  on public.canvassing_properties for all
  using (
    business_id in (
      select business_id from public.team_members
      where user_id = auth.uid() and is_active = true
    )
  );

-- Index for fast lookups by business
create index on public.canvassing_properties (business_id, created_at desc);
create index on public.canvassing_properties (business_id, lat, lng);
create index on public.canvassing_properties (business_id, follow_up_date) where follow_up_needed = true;


-- ═══ source: google_calendar.sql (commit 2026-04-08) ════════════════════════

CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  expires_at    timestamptz NOT NULL,
  calendar_id   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(business_id)
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner can manage their google calendar tokens"
  ON public.google_calendar_tokens
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );


-- ═══ source: new_features.sql (commit 2026-04-08) ═══════════════════════════

-- ─── Feature 1: Expense Tracking ─────────────────────────────────────────────

create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  business_id   uuid not null references public.businesses(id) on delete cascade,
  description   text not null,
  amount        numeric(10,2) not null,
  category      text not null default 'other', -- materials | labor | fuel | subcontractor | other
  created_at    timestamptz default now()
);

alter table public.expenses enable row level security;

create policy "Owner manages expenses"
  on public.expenses for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = expenses.business_id
        and b.owner_id = auth.uid()
    )
  );

create policy "Employees can log expenses for assigned jobs"
  on public.expenses for insert
  with check (
    exists (
      select 1 from public.jobs j
      join public.team_members tm on tm.id = j.assigned_member_id
      where j.id = expenses.job_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

create policy "Employees can view expenses for assigned jobs"
  on public.expenses for select
  using (
    exists (
      select 1 from public.jobs j
      join public.team_members tm on tm.id = j.assigned_member_id
      where j.id = expenses.job_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- ─── Feature 2: GPS Check-in ─────────────────────────────────────────────────

alter table public.time_entries
  add column if not exists check_in_lat  double precision,
  add column if not exists check_in_lng  double precision;

-- ─── Feature 3: Digital Signature ────────────────────────────────────────────

alter table public.jobs
  add column if not exists signature_url text;

-- ─── Feature 4: Mileage Log ──────────────────────────────────────────────────

alter table public.time_entries
  add column if not exists odometer_start integer,
  add column if not exists odometer_end   integer;


-- ═══ source: booking_scheduling.sql (commit 2026-04-10) ═════════════════════
-- NOTE: the three "public read/insert USING (true)" policies here are later
-- tightened by rls_tenant_scoping.sql (included further down). Keep both —
-- that file drops and recreates what it needs to.

-- ─── Scheduling Settings ─────────────────────────────────────────────────────
-- Stores the business owner's available days and hours per day.
-- unavailable_days: array of ints 0-6 (0=Sun, 1=Mon, ..., 6=Sat)
-- day_hours: jsonb map like {"1": {"from": "08:00", "until": "17:00"}, "2": {...}}

CREATE TABLE IF NOT EXISTS public.scheduling_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  unavailable_days int[]  DEFAULT '{}',
  day_hours        jsonb  DEFAULT '{}',
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.scheduling_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage scheduling_settings"
  ON public.scheduling_settings FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Portal (public) needs to read settings to show correct available slots
CREATE POLICY "public read scheduling_settings"
  ON public.scheduling_settings FOR SELECT
  USING (true);


-- ─── Blocked Dates ───────────────────────────────────────────────────────────
-- Specific dates the business is unavailable (holidays, vacations, etc.)

CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  blocked_date  date NOT NULL,
  UNIQUE(business_id, blocked_date)
);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage blocked_dates"
  ON public.blocked_dates FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Portal needs to read blocked dates to grey them out on the calendar
CREATE POLICY "public read blocked_dates"
  ON public.blocked_dates FOR SELECT
  USING (true);


-- ─── Booking Requests ────────────────────────────────────────────────────────
-- Created when a client picks a time in the client portal.
-- Owner approves (creates a job) or declines (client can re-request).

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_date  date NOT NULL,
  requested_time  text NOT NULL,
  notes           text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage booking_requests"
  ON public.booking_requests FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Portal submits requests without auth
CREATE POLICY "public insert booking_requests"
  ON public.booking_requests FOR INSERT
  WITH CHECK (true);

-- Portal needs to read its own pending/declined requests to show status
CREATE POLICY "public read booking_requests"
  ON public.booking_requests FOR SELECT
  USING (true);


-- ═══ source: leads_table.sql (commit 2026-04-10) ════════════════════════════

CREATE TABLE IF NOT EXISTS public.leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name             text NOT NULL,
  email            text,
  phone            text,
  address          text,
  stage            text NOT NULL DEFAULT 'new'
                     CHECK (stage IN ('new', 'contacted', 'quoted', 'won', 'lost')),
  source           text,
  notes            text,
  estimated_value  numeric(10, 2),
  -- Extra fields populated by public quote-request form
  property_type    text,       -- 'residential' | 'commercial'
  services         text[],     -- e.g. ['Exterior Window Cleaning', 'Gutter Cleaning']
  frequency        text,       -- 'monthly' | 'quarterly' | 'biannual' | 'one-time'
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Business owners can read/update/delete their own leads
CREATE POLICY "Business owners manage leads"
  ON public.leads FOR ALL
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Anonymous users can insert (used by the public quote-request form via service role key in API)
-- Note: The API route uses the service role key, so no anonymous RLS policy is needed.


-- ═══ source: add_business_type.sql (commit 2026-04-13) ══════════════════════

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS business_type text;


-- ═══ source: onboarding_v2.sql (commit 2026-04-13) ══════════════════════════

-- profiles: add first_name, last_name, phone (keep full_name for backward compat)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text,
  ADD COLUMN IF NOT EXISTS phone      text;

-- businesses: add country, currency, plan, and Stripe subscription fields
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS country               text,
  ADD COLUMN IF NOT EXISTS currency              text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS plan                  text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status   text;


-- ═══ source: canvassing_visits.sql (commit 2026-04-15) ══════════════════════

create table public.canvassing_visits (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.canvassing_properties (id) on delete cascade,
  business_id    uuid not null references public.businesses (id) on delete cascade,
  employee_id    uuid references public.team_members (id) on delete set null,
  status         text not null
                   check (status in ('not_visited', 'no_answer', 'no', 'interested', 'booked')),
  notes          text,
  follow_up_date date,
  visited_at     timestamptz default now()
);

alter table public.canvassing_visits enable row level security;

create policy "Owner can manage canvassing visits"
  on public.canvassing_visits for all
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "Employees can manage canvassing visits"
  on public.canvassing_visits for all
  using (
    business_id in (
      select business_id from public.team_members
      where user_id = auth.uid() and is_active = true
    )
  );

create index on public.canvassing_visits (property_id, visited_at desc);
create index on public.canvassing_visits (business_id, visited_at desc);


-- ═══ source: canvassing_enhancements.sql (commit 2026-04-15) ════════════════
-- (RUN_ME_launch_migrations.sql repeats this block — that copy is skipped)
-- Reminder: create a storage bucket named "lead-photos" (public read) in the dashboard.

-- 1. Extend leads table with new columns
alter table public.leads
  add column if not exists phone_alt            text,
  add column if not exists rapport_notes        text,
  add column if not exists service_notes        text,
  add column if not exists preferred_date       date,
  add column if not exists preferred_time       text,
  add column if not exists custom_field_values  jsonb default '{}';

-- 2. Owner-configurable custom field definitions per business
create table if not exists public.canvassing_custom_fields (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  label       text not null,
  field_type  text not null check (field_type in ('text', 'number', 'boolean', 'select')),
  options     text[],           -- only used when field_type = 'select'
  required    boolean not null default false,
  position    int not null default 0,
  created_at  timestamptz default now()
);

alter table public.canvassing_custom_fields enable row level security;

create policy "Owner manages canvassing custom fields"
  on public.canvassing_custom_fields for all
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Employees can read field definitions so the booking form can render them
create policy "Employees can read canvassing custom fields"
  on public.canvassing_custom_fields for select
  using (
    business_id in (
      select business_id from public.team_members
      where user_id = auth.uid() and is_active = true
    )
  );

create index on public.canvassing_custom_fields (business_id, position);

-- 3. Lead photos
create table if not exists public.lead_photos (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  url         text not null,
  caption     text,
  created_at  timestamptz default now()
);

alter table public.lead_photos enable row level security;

create policy "Owner manages lead photos"
  on public.lead_photos for all
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "Employees manage lead photos"
  on public.lead_photos for all
  using (
    business_id in (
      select business_id from public.team_members
      where user_id = auth.uid() and is_active = true
    )
  );

create index on public.lead_photos (lead_id, created_at desc);


-- ═══ source: analytics_fields.sql (commit 2026-04-18) ═══════════════════════

-- Add service type to jobs (used for revenue-by-service donut chart)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS service_type text;

-- Add lead source to clients (used for revenue-by-lead-source donut chart)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lead_source text;


-- ═══ source: employee_availability.sql (commit 2026-04-18) ══════════════════

-- ─── Employee Availability ───────────────────────────────────────────────────
-- Each row = one employee's available hours on one day of the week.
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

CREATE TABLE IF NOT EXISTS public.employee_availability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week     int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  from_time       text NOT NULL,   -- e.g. "08:00"
  until_time      text NOT NULL,   -- e.g. "17:00"
  UNIQUE(team_member_id, day_of_week)
);

ALTER TABLE public.employee_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage employee_availability"
  ON public.employee_availability FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Employees can view their own availability
CREATE POLICY "employees view own availability"
  ON public.employee_availability FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Portal needs to read employee availability to compute slot capacity
CREATE POLICY "public read employee_availability"
  ON public.employee_availability FOR SELECT
  USING (true);


-- ─── Business Crew Settings ──────────────────────────────────────────────────
-- crew_size: how many employees are needed per job/booking.

CREATE TABLE IF NOT EXISTS public.business_crew_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  crew_size    int NOT NULL DEFAULT 1 CHECK (crew_size >= 1),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.business_crew_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage business_crew_settings"
  ON public.business_crew_settings FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Portal needs to read crew size to compute slot capacity
CREATE POLICY "public read business_crew_settings"
  ON public.business_crew_settings FOR SELECT
  USING (true);


-- ═══ source: stripe_connect.sql (commit 2026-04-18) ═════════════════════════
-- (RUN_ME_launch_migrations.sql repeats this block — that copy is skipped)

-- ─── Stripe Connect columns on businesses ────────────────────────────────────
-- stripe_connect_account_id: the connected Stripe account ID (acct_xxx)
-- stripe_connect_status: 'not_connected' | 'pending' | 'active'
-- stripe_connect_type: 'express' | 'standard'

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id  text,
  ADD COLUMN IF NOT EXISTS stripe_connect_status      text NOT NULL DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS stripe_connect_type        text;

-- ─── Client Recurring Billing Subscriptions ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_billing_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id               uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_subscription_id  text NOT NULL,          -- Stripe sub ID on connected account
  stripe_customer_id      text NOT NULL,          -- Stripe customer ID on connected account
  status                  text NOT NULL DEFAULT 'active',
  -- mirrors Stripe sub status: 'active' | 'past_due' | 'canceled' | 'incomplete'
  amount                  numeric(10, 2) NOT NULL, -- per-cycle amount in dollars
  currency                text NOT NULL DEFAULT 'usd',
  interval                text NOT NULL,           -- 'month' | 'week' | 'year'
  interval_count          int NOT NULL DEFAULT 1,
  description             text,                    -- e.g. "Monthly lawn care"
  next_billing_date       timestamptz,
  canceled_at             timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE(business_id, stripe_subscription_id)
);

ALTER TABLE public.client_billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages client billing subscriptions"
  ON public.client_billing_subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = client_billing_subscriptions.business_id
        AND b.owner_id = auth.uid()
    )
  );


-- ═══ source: employee_availability_self_edit.sql (commit 2026-04-28) ════════

-- Employees can now insert/update/delete their own availability rows
CREATE POLICY "employees manage own availability"
  ON public.employee_availability FOR ALL
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM public.team_members WHERE user_id = auth.uid()
    )
  );


-- ═══ source: employee_blocked_dates.sql (commit 2026-04-28) ═════════════════

CREATE TABLE IF NOT EXISTS public.employee_blocked_dates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  blocked_date    date NOT NULL,
  UNIQUE(team_member_id, blocked_date)
);

ALTER TABLE public.employee_blocked_dates ENABLE ROW LEVEL SECURITY;

-- Owners can manage blocked dates for all employees in their business
CREATE POLICY "owners manage employee_blocked_dates"
  ON public.employee_blocked_dates FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Employees can manage their own blocked dates
CREATE POLICY "employees manage own blocked_dates"
  ON public.employee_blocked_dates FOR ALL
  USING (
    team_member_id IN (SELECT id FROM public.team_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    team_member_id IN (SELECT id FROM public.team_members WHERE user_id = auth.uid())
  );

-- Portal reads blocked dates to grey out unavailable days
CREATE POLICY "public read employee_blocked_dates"
  ON public.employee_blocked_dates FOR SELECT
  USING (true);


-- ═══ source: job_crew_and_duration.sql (commit 2026-04-28) ══════════════════

-- Add per-job duration in minutes (nullable — not all jobs have a set duration)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS duration_mins int;

-- Job crew: many-to-many between jobs and team_members
CREATE TABLE IF NOT EXISTS public.job_crew (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  team_member_id  uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  UNIQUE(job_id, team_member_id)
);

ALTER TABLE public.job_crew ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage job_crew"
  ON public.job_crew FOR ALL
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.businesses b ON b.id = j.business_id
      WHERE b.owner_id = auth.uid()
    )
  );

CREATE POLICY "employees view own job_crew"
  ON public.job_crew FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members WHERE user_id = auth.uid()
    )
  );


-- ═══ source: per_job_crew_size.sql (commit 2026-04-28) ══════════════════════

-- Add per-job crew size. Defaults to 1 for existing jobs.
alter table public.jobs
  add column if not exists crew_size int not null default 1 check (crew_size >= 1);


-- ═══ source: smart_scheduling_default.sql (commit 2026-04-28) ═══════════════

ALTER TABLE businesses ALTER COLUMN smart_scheduling_enabled SET DEFAULT true;
UPDATE businesses SET smart_scheduling_enabled = true WHERE smart_scheduling_enabled = false OR smart_scheduling_enabled IS NULL;


-- ═══ source: bnpl_financing.sql (commit 2026-05-16) ═════════════════════════

-- Customer Financing (BNPL) — adds financing configuration to businesses
alter table public.businesses
  add column if not exists financing_enabled  boolean      not null default false,
  add column if not exists financing_partner  text,
  add column if not exists financing_url      text,
  add column if not exists financing_min_amount integer    not null default 500;


-- ═══ source: commission_leaderboard.sql (commit 2026-05-16) ═════════════════

-- Per-rep commission rate override on team_members.
-- NULL = use the business default (businesses.commission_rate).
alter table public.team_members
  add column if not exists commission_rate numeric(5, 2);


-- ═══ source: inventory.sql (commit 2026-05-16) ══════════════════════════════

CREATE TABLE inventory_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name                    text NOT NULL,
  category                text NOT NULL CHECK (category IN ('equipment', 'vehicle', 'part')),
  condition               text DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
  quantity                integer DEFAULT 1,
  min_quantity            integer DEFAULT 0,
  location                text,
  serial_number           text,
  purchase_date           date,
  purchase_cost           numeric(10,2),
  current_value           numeric(10,2),
  vehicle_year            integer,
  vehicle_make            text,
  vehicle_model           text,
  license_plate           text,
  insurance_expires_at    date,
  registration_expires_at date,
  notes                   text,
  is_active               boolean DEFAULT true,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE TABLE inventory_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         uuid REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  team_member_id  uuid REFERENCES team_members(id) ON DELETE SET NULL,
  assigned_at     timestamptz DEFAULT now() NOT NULL,
  returned_at     timestamptz,
  notes           text
);

CREATE TABLE inventory_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  job_id        uuid REFERENCES jobs(id) ON DELETE SET NULL,
  quantity_used numeric(10,2) DEFAULT 1,
  used_at       timestamptz DEFAULT now(),
  logged_by     uuid REFERENCES team_members(id) ON DELETE SET NULL,
  notes         text
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();

-- RLS
ALTER TABLE inventory_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_usage      ENABLE ROW LEVEL SECURITY;

-- Owner: full access to items
CREATE POLICY "owner_all_items" ON inventory_items
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- Team members: read items (needed to log usage)
CREATE POLICY "member_read_items" ON inventory_items
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Owner: full access to assignments
CREATE POLICY "owner_all_assignments" ON inventory_assignments
  FOR ALL USING (
    item_id IN (
      SELECT id FROM inventory_items WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  );

-- Team members: read their own assignments
CREATE POLICY "member_read_assignments" ON inventory_assignments
  FOR SELECT USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Owner: full access to usage logs
CREATE POLICY "owner_all_usage" ON inventory_usage
  FOR ALL USING (
    item_id IN (
      SELECT id FROM inventory_items WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  );

-- Team members: insert usage on their jobs
CREATE POLICY "member_insert_usage" ON inventory_usage
  FOR INSERT WITH CHECK (
    logged_by IN (
      SELECT id FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
    AND item_id IN (
      SELECT id FROM inventory_items WHERE business_id IN (
        SELECT business_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Team members: read usage they logged
CREATE POLICY "member_read_own_usage" ON inventory_usage
  FOR SELECT USING (
    logged_by IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );


-- ═══ source: job_profitability.sql (commit 2026-05-16) ══════════════════════

-- Add hourly_rate to team_members for labor cost calculations
alter table public.team_members
  add column if not exists hourly_rate numeric(8, 2) default 0;


-- ═══ source: lead_scoring.sql (commit 2026-05-16) ═══════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ai_score           integer,
  ADD COLUMN IF NOT EXISTS ai_score_label     text CHECK (ai_score_label IN ('hot','warm','cool','cold')),
  ADD COLUMN IF NOT EXISTS ai_score_reason    text,
  ADD COLUMN IF NOT EXISTS ai_score_actions   text[],
  ADD COLUMN IF NOT EXISTS ai_score_updated_at timestamptz;


-- ═══ source: mileage_tracking.sql (commit 2026-05-16) ═══════════════════════

-- 1. Employee home address (used as route origin)
alter table team_members
  add column if not exists home_address text;

-- 2. Owner-configurable mileage reimbursement rate ($/mile)
alter table businesses
  add column if not exists mileage_rate_per_mile numeric(6,4) not null default 0.70;

-- 3. Calculated daily mileage records
create table if not exists daily_mileage (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  employee_id     uuid not null references team_members(id) on delete cascade,
  date            date not null,
  total_miles     numeric(8,2) not null,
  rate_per_mile   numeric(6,4) not null,
  reimbursement   numeric(10,2) generated always as (total_miles * rate_per_mile) stored,
  route_snapshot  jsonb,
  calculated_at   timestamptz not null default now(),
  unique (employee_id, date)
);

alter table daily_mileage enable row level security;

-- Owner can see all mileage for their business
create policy "owner_read_mileage" on daily_mileage
  for select using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

-- Owner can insert/update mileage records
create policy "owner_write_mileage" on daily_mileage
  for all using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

-- Employee can read their own mileage
create policy "employee_read_own_mileage" on daily_mileage
  for select using (
    employee_id in (
      select id from team_members where user_id = auth.uid()
    )
  );


-- ═══ source: pipeline_velocity.sql (commit 2026-05-16) ══════════════════════

-- Configurable threshold: how many days a sent quote can sit before it's flagged as stalled.
alter table public.businesses
  add column if not exists stale_quote_days int not null default 7;


-- ═══ source: preset_crews.sql (commit 2026-05-16) ═══════════════════════════
-- (depends on inventory_assignments from inventory.sql above)

CREATE TABLE IF NOT EXISTS preset_crews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preset_crew_members (
  preset_crew_id uuid REFERENCES preset_crews(id) ON DELETE CASCADE NOT NULL,
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (preset_crew_id, team_member_id)
);

-- Links all assignment rows created in the same group checkout
ALTER TABLE inventory_assignments
  ADD COLUMN IF NOT EXISTS checkout_group_id uuid;

ALTER TABLE preset_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_crew_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_preset_crews" ON preset_crews
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "owner_all_preset_crew_members" ON preset_crew_members
  FOR ALL USING (
    preset_crew_id IN (
      SELECT pc.id FROM preset_crews pc
      JOIN businesses b ON b.id = pc.business_id
      WHERE b.owner_id = auth.uid()
    )
  );


-- ═══ source: sms_automation.sql (commit 2026-05-16) ═════════════════════════
-- (must precede quote_follow_ups.sql, which references sms_queue)

-- ─── New columns on businesses ───────────────────────────────────────────────
alter table public.businesses
  add column if not exists review_requests_enabled boolean default false,
  add column if not exists lead_notify_enabled      boolean default false,
  add column if not exists google_review_url        text;

-- ─── New column on jobs ───────────────────────────────────────────────────────
alter table public.jobs
  add column if not exists review_request_sent_at timestamptz;

-- ─── New column on leads ──────────────────────────────────────────────────────
alter table public.leads
  add column if not exists notified_at timestamptz;

-- ─── SMS Queue ────────────────────────────────────────────────────────────────
-- Status: pending → sent | failed | skipped
create table if not exists public.sms_queue (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  to_phone     text not null,
  body         text not null,
  status       text not null default 'pending',
  sent_at      timestamptz,
  error        text,
  metadata     jsonb,
  created_at   timestamptz default now()
);

alter table public.sms_queue enable row level security;

create policy "Business owner can read their sms_queue"
  on public.sms_queue for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = sms_queue.business_id and b.owner_id = auth.uid()
    )
  );


-- ═══ source: quote_follow_ups.sql (commit 2026-05-16) ═══════════════════════

-- ─── New column on businesses ─────────────────────────────────────────────────
alter table public.businesses
  add column if not exists follow_up_enabled boolean default false;

-- ─── sent_at on quotes ────────────────────────────────────────────────────────
alter table public.quotes
  add column if not exists sent_at timestamptz;

-- Trigger: auto-set sent_at the first time status becomes 'sent' (on UPDATE).
create or replace function public.set_quote_sent_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'sent' and (old.status is distinct from 'sent') and new.sent_at is null then
    new.sent_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists quote_sent_at_trigger on public.quotes;
create trigger quote_sent_at_trigger
  before update on public.quotes
  for each row execute function public.set_quote_sent_at();

-- Trigger: also set sent_at when a quote is created directly with status='sent'.
create or replace function public.set_quote_sent_at_on_insert()
returns trigger language plpgsql as $$
begin
  if new.status = 'sent' and new.sent_at is null then
    new.sent_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists quote_sent_at_insert_trigger on public.quotes;
create trigger quote_sent_at_insert_trigger
  before insert on public.quotes
  for each row execute function public.set_quote_sent_at_on_insert();

-- ─── Follow-up sends log ──────────────────────────────────────────────────────
-- step: 1 = 24h, 2 = 72h, 3 = 7 days
create table if not exists public.quote_follow_up_sends (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  step         int not null check (step in (1, 2, 3)),
  sent_at      timestamptz default now(),
  sms_queue_id uuid references public.sms_queue (id)
);

-- One send per quote per step — prevents duplicates even if the cron runs twice.
create unique index if not exists quote_follow_up_sends_quote_step
  on public.quote_follow_up_sends (quote_id, step);

alter table public.quote_follow_up_sends enable row level security;

create policy "Business owner can read their follow_up_sends"
  on public.quote_follow_up_sends for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = quote_follow_up_sends.business_id and b.owner_id = auth.uid()
    )
  );


-- ═══ source: rebooking_campaign.sql (commit 2026-05-16) ═════════════════════

-- Toggle and threshold on businesses
alter table public.businesses
  add column if not exists rebooking_enabled boolean not null default false;

alter table public.businesses
  add column if not exists rebooking_after_days int not null default 60;

-- Track when we last sent a rebooking SMS to each client
alter table public.clients
  add column if not exists last_rebooking_sent_at timestamptz;


-- ═══ source: sms_inbox.sql (commit 2026-05-16) ══════════════════════════════

-- Twilio number per business (the number customers reply to)
alter table public.businesses
  add column if not exists twilio_number text;

-- Central message log — outbound (via sendSMS) + inbound (via Twilio webhook)
create table if not exists public.sms_messages (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  direction    text not null check (direction in ('inbound', 'outbound')),
  from_phone   text not null,
  to_phone     text not null,
  body         text not null,
  read_at      timestamptz,       -- null for inbound = unread; set immediately for outbound
  twilio_sid   text,              -- Twilio message SID (inbound only)
  metadata     jsonb,
  created_at   timestamptz default now()
);

alter table public.sms_messages enable row level security;

create index if not exists sms_messages_thread_idx
  on public.sms_messages (business_id, client_id, created_at desc);

create index if not exists sms_messages_unread_idx
  on public.sms_messages (business_id, read_at)
  where direction = 'inbound';

-- Owner can read all messages for their business
create policy "owner_read_sms_messages" on public.sms_messages
  for select using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Owner can insert (for sending via UI)
create policy "owner_insert_sms_messages" on public.sms_messages
  for insert with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Owner can update (mark as read)
create policy "owner_update_sms_messages" on public.sms_messages
  for update using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );


-- ═══ source: territory_assignments.sql (commit 2026-05-16) ══════════════════

create table if not exists public.territory_assignments (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  team_member_id  uuid not null references public.team_members(id) on delete cascade,
  zip_code        text not null,
  created_at      timestamptz default now(),
  constraint territory_assignments_biz_zip_unique unique (business_id, zip_code)
);

create index if not exists territory_assignments_business_idx  on public.territory_assignments(business_id);
create index if not exists territory_assignments_member_idx    on public.territory_assignments(team_member_id);

alter table public.territory_assignments enable row level security;

create policy "owner_manage_territory_assignments"
  on public.territory_assignments for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = territory_assignments.business_id
        and b.owner_id = auth.uid()
    )
  );


-- ═══ source: company_profile.sql (commit 2026-05-24) ════════════════════════

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS address              text,
  ADD COLUMN IF NOT EXISTS website_url          text,
  ADD COLUMN IF NOT EXISTS invoice_message      text,
  ADD COLUMN IF NOT EXISTS terms_and_conditions text;


-- ═══ source: book_slug.sql (commit 2026-06-13) ══════════════════════════════
-- (RUN_ME_launch_migrations.sql repeats this block — that copy is skipped)

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS slug text UNIQUE;
CREATE INDEX IF NOT EXISTS businesses_slug_idx ON public.businesses (slug);


-- ═══ source: canvassing_booking_rpc.sql (commit 2026-06-20) ═════════════════

-- 1. Ensure extended lead columns exist
alter table public.leads
  add column if not exists phone_alt           text,
  add column if not exists rapport_notes       text,
  add column if not exists service_notes       text,
  add column if not exists preferred_date      date,
  add column if not exists preferred_time      text,
  add column if not exists custom_field_values jsonb default '{}';

-- 2. Lead photos table (stores URLs of photos taken during canvassing bookings)
create table if not exists public.lead_photos (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  url         text not null,
  caption     text,
  created_at  timestamptz default now()
);

alter table public.lead_photos enable row level security;

do $$ begin
  create policy "Owner manages lead photos"
    on public.lead_photos for all
    using (
      business_id in (
        select id from public.businesses where owner_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Employees can insert lead photos for their business"
    on public.lead_photos for insert
    with check (
      business_id in (
        select business_id from public.team_members
        where user_id = auth.uid()
          and is_active = true
          and is_pending = false
      )
    );
exception when duplicate_object then null;
end $$;

-- 3. The booking function (SECURITY DEFINER so employees can create clients/jobs/leads)
create or replace function public.create_canvassing_booking(
  p_business_id    uuid,
  p_name           text,
  p_phone          text        default null,
  p_phone_alt      text        default null,
  p_email          text        default null,
  p_address        text        default null,
  p_scheduled_at   timestamptz default null,
  p_service_notes  text        default null,
  p_rapport_notes  text        default null,
  p_source         text        default 'Canvassing',
  p_custom_fields  jsonb       default null,
  p_preferred_date text        default null,
  p_preferred_time text        default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_authorized  boolean := false;
  v_client_id      uuid;
  v_job_id         uuid;
  v_lead_id        uuid;
  v_stage          text;
  v_client_notes   text;
begin
  -- Allow active, approved team members
  select exists(
    select 1 from public.team_members
    where user_id = auth.uid()
      and business_id = p_business_id
      and is_active = true
      and is_pending = false
  ) into v_is_authorized;

  -- Also allow the business owner
  if not v_is_authorized then
    select exists(
      select 1 from public.businesses
      where id = p_business_id and owner_id = auth.uid()
    ) into v_is_authorized;
  end if;

  if not v_is_authorized then
    raise exception 'Not authorized to create a booking for this business';
  end if;

  -- Combined notes for the client record
  v_client_notes := nullif(trim(concat_ws(E'\n\n',
    nullif(trim(coalesce(p_rapport_notes, '')), ''),
    nullif(trim(coalesce(p_service_notes, '')), '')
  )), '');

  if p_scheduled_at is not null then
    insert into public.clients (business_id, name, phone, email, address, notes)
    values (p_business_id, p_name, p_phone, p_email, p_address, v_client_notes)
    returning id into v_client_id;

    insert into public.jobs (business_id, client_id, status, scheduled_at, notes)
    values (
      p_business_id, v_client_id, 'scheduled', p_scheduled_at,
      nullif(trim(coalesce(p_service_notes, '')), '')
    )
    returning id into v_job_id;

    v_stage := 'won';
  else
    v_stage := 'new';
  end if;

  insert into public.leads (
    business_id, name, phone, phone_alt, email, address,
    rapport_notes, service_notes, preferred_date, preferred_time,
    custom_field_values, stage, source
  )
  values (
    p_business_id,
    p_name,
    nullif(trim(coalesce(p_phone,         '')), ''),
    nullif(trim(coalesce(p_phone_alt,     '')), ''),
    nullif(trim(coalesce(p_email,         '')), ''),
    nullif(trim(coalesce(p_address,       '')), ''),
    nullif(trim(coalesce(p_rapport_notes, '')), ''),
    nullif(trim(coalesce(p_service_notes, '')), ''),
    case when p_preferred_date is not null and p_preferred_date <> ''
         then p_preferred_date::date else null end,
    nullif(trim(coalesce(p_preferred_time, '')), ''),
    coalesce(p_custom_fields, '{}'::jsonb),
    v_stage,
    p_source
  )
  returning id into v_lead_id;

  return jsonb_build_object(
    'lead_id',   v_lead_id,
    'client_id', v_client_id,
    'job_id',    v_job_id
  );
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- ═══ GAP-FILL (RECONSTRUCTED) — objects the app uses that no .sql file    ═══
-- ═══ in the repo ever created. Reconstructed 2026-07-19 from app code.    ═══
-- ═══ Must run BEFORE messaging_and_service_areas.sql, rls_tenant_scoping ═══
-- ═══ and customization.sql below, which ALTER / reference these objects.  ═══
-- ═══════════════════════════════════════════════════════════════════════════

-- ── businesses columns used by onboarding, settings, crons, SMS webhook ─────
-- (city also required by get_business_service_areas() in rls_tenant_scoping.sql)
alter table public.businesses
  add column if not exists city                      text,
  add column if not exists payment_reminders_enabled boolean not null default true,
  add column if not exists auto_invoice_enabled      boolean not null default true,
  add column if not exists morning_briefing_enabled  boolean not null default false,
  add column if not exists ai_sms_enabled            boolean not null default false;

-- ── team_messages: owner <-> employee 1:1 chat ──────────────────────────────
-- Base table for the columns/policies messaging_and_service_areas.sql adds.
create table if not exists public.team_messages (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  team_member_id  uuid not null references public.team_members(id) on delete cascade,
  sender_role     text not null check (sender_role in ('owner', 'employee')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists team_messages_thread_idx
  on public.team_messages (team_member_id, created_at);

alter table public.team_messages enable row level security;

create policy "Owners manage team messages"
  on public.team_messages for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = team_messages.business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = team_messages.business_id and b.owner_id = auth.uid()
    )
  );

create policy "Employees view own team messages"
  on public.team_messages for select
  using (
    team_member_id in (
      select id from public.team_members
      where user_id = auth.uid() and is_active = true
    )
  );

create policy "Employees send own team messages"
  on public.team_messages for insert
  with check (
    sender_role = 'employee'
    and team_member_id in (
      select id from public.team_members
      where user_id = auth.uid() and is_active = true
    )
  );

-- ── message_templates: per-service SMS/email template overrides ─────────────
-- Base table for the columns customization.sql adds (subject, channel).
-- Upserted on conflict (business_id, service_type, message_type).
create table if not exists public.message_templates (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  service_type  text not null,          -- service name, or '*' for automated messages
  message_type  text not null,          -- 'post_quote' | 'confirmation' | 'reminder' | automated keys
  body          text not null,
  created_at    timestamptz default now(),
  unique (business_id, service_type, message_type)
);

alter table public.message_templates enable row level security;

create policy "owner_all_message_templates" on public.message_templates
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- ── worker_availability: owner calendar day-of-week hours ───────────────────
-- DDL copied VERBATIM from the in-app setup helper
-- (src/app/(dashboard)/calendar/CalendarClient.tsx).
CREATE TABLE worker_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '17:00',
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_member_id, day_of_week)
);
ALTER TABLE worker_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_manage_availability" ON worker_availability
  FOR ALL USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

-- ── service_plans: recurring service plans (/plans page, analytics) ─────────
create table if not exists public.service_plans (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  client_id          uuid not null references public.clients(id) on delete cascade,
  name               text not null,
  frequency          text,              -- 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | ...
  price              numeric(10, 2) not null default 0,
  status             text not null default 'active',  -- 'active' | 'paused' | 'cancelled'
  next_service_date  date,
  notes              text,
  created_at         timestamptz default now()
);

alter table public.service_plans enable row level security;

create policy "owner_all_service_plans" on public.service_plans
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- ── competitor_intel: field intel logged by employees on jobs ───────────────
create table if not exists public.competitor_intel (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  job_id            uuid references public.jobs(id) on delete set null,
  team_member_id    uuid references public.team_members(id) on delete set null,
  competitor_name   text not null,
  observation_type  text not null,     -- 'truck_spotted' | 'price_info' | ...
  price_amount      numeric(10, 2),
  notes             text,
  created_at        timestamptz default now()
);

alter table public.competitor_intel enable row level security;

create policy "owner_all_competitor_intel" on public.competitor_intel
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

create policy "employees insert competitor_intel"
  on public.competitor_intel for insert
  with check (
    business_id in (
      select business_id from public.team_members
      where user_id = auth.uid() and is_active = true
    )
  );

-- ── payment_reminder_sends: log for the payment-reminder cron ───────────────
-- Written only via the service-role key (bypasses RLS); owner may read.
create table if not exists public.payment_reminder_sends (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  step         int not null,
  sms_queue_id uuid references public.sms_queue(id),
  sent_at      timestamptz default now()
);

create unique index if not exists payment_reminder_sends_job_step
  on public.payment_reminder_sends (job_id, step);

alter table public.payment_reminder_sends enable row level security;

create policy "Business owner can read their payment_reminder_sends"
  on public.payment_reminder_sends for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = payment_reminder_sends.business_id and b.owner_id = auth.uid()
    )
  );

-- ═══ END GAP-FILL ═══════════════════════════════════════════════════════════


-- ═══ source: messaging_and_service_areas.sql (commit 2026-07-05) ════════════

-- ── 1. businesses.service_areas ─────────────────────────────────────────────
alter table public.businesses
  add column if not exists service_areas text[] not null default '{}';

-- ── 2. team_messages: richer message columns ────────────────────────────────
alter table public.team_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists metadata     jsonb,
  add column if not exists media_url    text,
  add column if not exists is_read      boolean not null default false;

-- ── 3. team_messages: allow marking the other side's messages read ──────────
drop policy if exists "Owners can mark employee messages read" on public.team_messages;
create policy "Owners can mark employee messages read"
  on public.team_messages for update
  using (
    exists (
      select 1 from businesses b
      where b.id = team_messages.business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from businesses b
      where b.id = team_messages.business_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Employees can mark owner messages read" on public.team_messages;
create policy "Employees can mark owner messages read"
  on public.team_messages for update
  using (
    exists (
      select 1 from team_members tm
      where tm.id = team_messages.team_member_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  )
  with check (
    exists (
      select 1 from team_members tm
      where tm.id = team_messages.team_member_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- ── 4. Group messaging + broadcasts ─────────────────────────────────────────
create table if not exists public.team_groups (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  type        text not null default 'custom',
  created_at  timestamptz not null default now()
);

create table if not exists public.team_group_members (
  group_id       uuid not null references team_groups(id) on delete cascade,
  team_member_id uuid not null references team_members(id) on delete cascade,
  primary key (group_id, team_member_id)
);

create table if not exists public.team_group_messages (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references team_groups(id) on delete cascade,
  business_id      uuid not null references businesses(id) on delete cascade,
  sender_role      text not null check (sender_role in ('owner', 'employee')),
  sender_member_id uuid references team_members(id) on delete set null,
  content          text not null,
  message_type     text not null default 'text',
  media_url        text,
  created_at       timestamptz not null default now()
);

create table if not exists public.team_broadcasts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists team_group_messages_group_idx
  on public.team_group_messages (group_id, created_at);
create index if not exists team_broadcasts_business_idx
  on public.team_broadcasts (business_id, created_at desc);

alter table public.team_groups          enable row level security;
alter table public.team_group_members   enable row level security;
alter table public.team_group_messages  enable row level security;
alter table public.team_broadcasts      enable row level security;

-- Membership check as security definer to avoid recursive RLS on
-- team_group_members referencing itself.
create or replace function public.is_team_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from team_group_members tgm
    join team_members tm on tm.id = tgm.team_member_id
    where tgm.group_id = gid
      and tm.user_id = auth.uid()
      and tm.is_active = true
  );
$$;

-- team_groups
drop policy if exists "Owners manage groups" on public.team_groups;
create policy "Owners manage groups"
  on public.team_groups for all
  using (
    exists (select 1 from businesses b where b.id = team_groups.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from businesses b where b.id = team_groups.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "Members can view their groups" on public.team_groups;
create policy "Members can view their groups"
  on public.team_groups for select
  using (public.is_team_group_member(id));

-- team_group_members
drop policy if exists "Owners manage group members" on public.team_group_members;
create policy "Owners manage group members"
  on public.team_group_members for all
  using (
    exists (
      select 1 from team_groups g
      join businesses b on b.id = g.business_id
      where g.id = team_group_members.group_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from team_groups g
      join businesses b on b.id = g.business_id
      where g.id = team_group_members.group_id and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Members can view group rosters" on public.team_group_members;
create policy "Members can view group rosters"
  on public.team_group_members for select
  using (public.is_team_group_member(group_id));

-- team_group_messages
drop policy if exists "Owners manage group messages" on public.team_group_messages;
create policy "Owners manage group messages"
  on public.team_group_messages for all
  using (
    exists (select 1 from businesses b where b.id = team_group_messages.business_id and b.owner_id = auth.uid())
  )
  with check (
    sender_role = 'owner'
    and exists (select 1 from businesses b where b.id = team_group_messages.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "Members can view group messages" on public.team_group_messages;
create policy "Members can view group messages"
  on public.team_group_messages for select
  using (public.is_team_group_member(group_id));

drop policy if exists "Members can send group messages" on public.team_group_messages;
create policy "Members can send group messages"
  on public.team_group_messages for insert
  with check (
    sender_role = 'employee'
    and public.is_team_group_member(group_id)
    and exists (
      select 1 from team_members tm
      where tm.id = team_group_messages.sender_member_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- team_broadcasts
drop policy if exists "Owners manage broadcasts" on public.team_broadcasts;
create policy "Owners manage broadcasts"
  on public.team_broadcasts for all
  using (
    exists (select 1 from businesses b where b.id = team_broadcasts.business_id and b.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from businesses b where b.id = team_broadcasts.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "Employees can view broadcasts" on public.team_broadcasts;
create policy "Employees can view broadcasts"
  on public.team_broadcasts for select
  using (
    exists (
      select 1 from team_members tm
      where tm.business_id = team_broadcasts.business_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
    )
  );

-- ── Realtime for the chat tables (ignore if already added) ──────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.team_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.team_group_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.team_broadcasts;
  exception when duplicate_object then null;
  end;
end $$;


-- ═══ source: rls_tenant_scoping.sql (commit 2026-07-05) ═════════════════════
-- (RUN_ME_launch_migrations.sql repeats this block — that copy is skipped)
-- Tightens the "FOR SELECT USING (true)" policies created by earlier files.

-- ─── booking_requests: remove cross-tenant read entirely ─────────────────────
DROP POLICY IF EXISTS "public read booking_requests" ON public.booking_requests;

-- ─── business_crew_settings: owner-only ──────────────────────────────────────
DROP POLICY IF EXISTS "public read business_crew_settings" ON public.business_crew_settings;

-- ─── employee_availability: owner + own-employee only ────────────────────────
DROP POLICY IF EXISTS "public read employee_availability" ON public.employee_availability;

-- Tighten the employee self-read to active members and recreate it explicitly
DROP POLICY IF EXISTS "employees view own availability" ON public.employee_availability;
CREATE POLICY "employees view own availability"
  ON public.employee_availability FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- ─── employee_blocked_dates: owner + own-employee only ───────────────────────
DROP POLICY IF EXISTS "public read employee_blocked_dates" ON public.employee_blocked_dates;

-- ─── scheduling_settings: intentionally public-readable (non-sensitive) ──────
DROP POLICY IF EXISTS "public read scheduling_settings" ON public.scheduling_settings;
CREATE POLICY "public read scheduling_settings"
  ON public.scheduling_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- ─── blocked_dates: intentionally public-readable (non-sensitive) ────────────
DROP POLICY IF EXISTS "public read blocked_dates" ON public.blocked_dates;
CREATE POLICY "public read blocked_dates"
  ON public.blocked_dates FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── Employee-safe business info ─────────────────────────────────────────────
-- Security-definer RPC returning only the two columns the employee home
-- screen needs for weather alerts. (Requires businesses.service_areas from
-- messaging_and_service_areas.sql and businesses.city from the gap-fill.)
create or replace function public.get_business_service_areas()
returns table (service_areas text[], city text)
language sql
security definer
set search_path = public
as $$
  select b.service_areas, b.city
  from businesses b
  where b.owner_id = auth.uid()
     or exists (
       select 1 from team_members tm
       where tm.business_id = b.id
         and tm.user_id = auth.uid()
         and tm.is_active = true
     )
  limit 1;
$$;


-- ═══ source: customization.sql (commit 2026-07-12) ══════════════════════════

-- ============================================================================
-- CUSTOMIZATION FRAMEWORK
-- Powers: theme engine, modular nav, dashboard workspaces, custom statuses &
-- fields, template overrides, automation builder, AI personality,
-- quick actions, email branding, industry templates, import/export.
-- ============================================================================

-- 1. Per-business customization document (1:1 with businesses)
create table if not exists public.business_customization (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade unique,
  theme jsonb not null default '{}'::jsonb,
  modules jsonb not null default '{}'::jsonb,
  ai_personality jsonb not null default '{}'::jsonb,
  quick_actions jsonb not null default '[]'::jsonb,
  email_branding jsonb not null default '{}'::jsonb,
  industry_template text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.business_customization enable row level security;

create policy "owner_all_business_customization" on public.business_customization
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- Employees need theme + modules to render their shell
create policy "employee_select_business_customization" on public.business_customization
  for select using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.business_id = business_customization.business_id
        and tm.is_active = true
        and tm.is_pending = false
    )
  );

-- 2. Dashboards — multiple named, per-user workspaces with widget layouts
create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Dashboard',
  role_preset text,
  is_default boolean not null default false,
  layout jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists dashboards_user_idx on public.dashboards (user_id, business_id);

alter table public.dashboards enable row level security;

-- Any authenticated member of the business manages their own dashboards
create policy "own_dashboards" on public.dashboards
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      business_id in (select id from public.businesses where owner_id = auth.uid())
      or exists (
        select 1 from public.team_members tm
        where tm.user_id = auth.uid()
          and tm.business_id = dashboards.business_id
          and tm.is_active = true
          and tm.is_pending = false
      )
    )
  );

-- 3. Custom statuses / stages / tags / priorities per entity
create table if not exists public.custom_statuses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entity text not null,
  key text not null,
  label text not null,
  color text not null default '#2E6A8E',
  sort_order int not null default 0,
  is_system boolean not null default false,  -- true = maps to a built-in status key; cannot be deleted
  created_at timestamptz default now(),
  unique (business_id, entity, key)
);

alter table public.custom_statuses enable row level security;

create policy "owner_all_custom_statuses" on public.custom_statuses
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

create policy "employee_select_custom_statuses" on public.custom_statuses
  for select using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.business_id = custom_statuses.business_id
        and tm.is_active = true
        and tm.is_pending = false
    )
  );

-- 4. Custom fields (unlimited, typed) + values
create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entity text not null,
  key text not null,
  label text not null,
  field_type text not null default 'text',
  options jsonb not null default '{}'::jsonb,
  required boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  unique (business_id, entity, key)
);

create table if not exists public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  field_id uuid not null references public.custom_fields(id) on delete cascade,
  entity_id uuid not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (field_id, entity_id)
);

create index if not exists custom_field_values_entity_idx
  on public.custom_field_values (business_id, entity_id);

alter table public.custom_fields enable row level security;
alter table public.custom_field_values enable row level security;

create policy "owner_all_custom_fields" on public.custom_fields
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

create policy "employee_select_custom_fields" on public.custom_fields
  for select using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.business_id = custom_fields.business_id
        and tm.is_active = true
        and tm.is_pending = false
    )
  );

create policy "owner_all_custom_field_values" on public.custom_field_values
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- Field techs fill in gate codes, pet notes, etc. from the job site
create policy "employee_all_custom_field_values" on public.custom_field_values
  for all using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.business_id = custom_field_values.business_id
        and tm.is_active = true
        and tm.is_pending = false
    )
  );

-- 5. Automations — visual sequence builder
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  trigger text not null,
  enabled boolean not null default true,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.automations enable row level security;

create policy "owner_all_automations" on public.automations
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- 6. Extend existing message_templates for the full template editor
--    (base table created in the GAP-FILL section above)
alter table public.message_templates
  add column if not exists subject text,
  add column if not exists channel text not null default 'sms';

alter table public.message_templates
  drop constraint if exists message_templates_message_type_check;

-- Version history for templates
create table if not exists public.message_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.message_templates(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  subject text,
  body text not null,
  saved_at timestamptz default now()
);

alter table public.message_template_versions enable row level security;

create policy "owner_all_template_versions" on public.message_template_versions
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- 7. Custom lead stages: relax the built-in check so businesses can define
--    their own pipeline vocabulary (custom_statuses entity='lead').
alter table public.leads drop constraint if exists leads_stage_check;

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists business_customization_touch on public.business_customization;
create trigger business_customization_touch
  before update on public.business_customization
  for each row execute function public.touch_updated_at();

drop trigger if exists dashboards_touch on public.dashboards;
create trigger dashboards_touch
  before update on public.dashboards
  for each row execute function public.touch_updated_at();

drop trigger if exists automations_touch on public.automations;
create trigger automations_touch
  before update on public.automations
  for each row execute function public.touch_updated_at();


-- ═══ source: onboarding_v3.sql (commit 2026-07-12) ══════════════════════════

ALTER TABLE public.businesses
  -- progress / resume
  ADD COLUMN IF NOT EXISTS onboarding_step         text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  -- business profile (segmented answers, stored as stable keys)
  ADD COLUMN IF NOT EXISTS team_size               text,  -- solo | 2_5 | 6_15 | 16_plus
  ADD COLUMN IF NOT EXISTS business_stage          text,  -- new | growing | established | veteran
  ADD COLUMN IF NOT EXISTS avg_job_value_range     text,  -- under_150 | 150_500 | 500_2000 | over_2000
  -- goals (DB-backed; analytics previously used localStorage only)
  ADD COLUMN IF NOT EXISTS monthly_revenue_goal    numeric(12,2),
  -- AI personalization
  ADD COLUMN IF NOT EXISTS growth_priorities       text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS biggest_challenge       text,
  -- money setup
  ADD COLUMN IF NOT EXISTS payment_methods         text[] DEFAULT '{}';

-- Existing businesses predate the guided setup — mark them complete so the
-- dashboard gate never locks out a live user. (No-op on a fresh database.)
UPDATE public.businesses
SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at, now())
WHERE onboarding_completed_at IS NULL;


-- ═══ source: RUN_ME_launch_migrations.sql (commit 2026-07-05) ═══════════════
-- Everything in that bundle duplicates stripe_connect.sql, rls_tenant_scoping.sql,
-- book_slug.sql and canvassing_enhancements.sql (all included above) EXCEPT
-- this one unique statement:

-- Close the concurrent-insert race in stripe payment recording (launch-plan 5.1 follow-up)
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_payment_id_uidx ON public.payments (stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;


-- ═══ VERIFICATION ═══════════════════════════════════════════════════════════
-- Expected: 53 tables in the public schema.

select count(*) as public_table_count
from pg_tables
where schemaname = 'public';

select tablename from pg_tables where schemaname = 'public' order by 1;
