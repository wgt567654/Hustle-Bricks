-- Run this in the Supabase SQL editor.
-- Self-contained: creates all tables/columns/policies needed for canvassing bookings.

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
