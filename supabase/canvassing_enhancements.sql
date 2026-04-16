-- Canvassing Enhancements — Strategic Follow-Ups & Lead Capture
-- Run in the Supabase SQL editor after canvassing.sql and canvassing_visits.sql
-- Also create a storage bucket named "lead-photos" (public read) in the Supabase dashboard.

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
