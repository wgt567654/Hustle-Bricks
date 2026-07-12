-- ============================================================================
-- CUSTOMIZATION FRAMEWORK — run in Supabase SQL editor
-- Powers: theme engine, modular nav, dashboard workspaces, custom statuses &
-- fields, template overrides, automation builder, AI personality,
-- quick actions, email branding, industry templates, import/export.
-- Extends (does NOT replace) existing message_templates + VA automation flags.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Per-business customization document (1:1 with businesses)
--    theme:          {"accentH":229,"accentC":0.082,"radiusScale":1,"density":1,"glass":true,"mode":"system"}
--    modules:        {"order":["home","jobs","clients",...],"disabled":["intel"],"pinned":["jobs"]}
--    ai_personality: {"tone":"professional","instructions":"We never pressure customers."}
--    quick_actions:  ["create_quote","book_job","collect_payment"]
--    email_branding: {"accentColor":"#2E6A8E","footerText":"...","signature":"...","social":{...},"disclaimer":"..."}
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. Dashboards — multiple named, per-user workspaces with widget layouts
--    layout: [{"i":"w1","widget":"revenue","x":0,"y":0,"w":6,"h":2,"settings":{}}]
--    role_preset: 'owner' | 'technician' | 'sales' | 'office' | 'finance' | null
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Custom statuses / stages / tags / priorities per entity
--    entity: 'lead' | 'job' | 'quote' | 'invoice' | 'appointment'
--          | 'client_tag' | 'priority' | 'label'
--    key is the stored value; label + color are presentation.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4. Custom fields (unlimited, typed) + values
--    entity: 'client' | 'job' | 'quote' | 'lead'
--    field_type: 'text','number','checkbox','select','multiselect','phone',
--                'email','url','date','location','file'
--    options: {"choices":["North","South"]} for select/multiselect
--    value examples: {"v":"1234"} {"v":42} {"v":true} {"v":["a","b"]}
--                    {"v":"2026-07-05"} (dates ISO yyyy-mm-dd)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5. Automations — visual sequence builder
--    trigger: 'quote_sent' | 'job_completed' | 'booking_created'
--           | 'lead_created' | 'invoice_unpaid'
--    steps: [{"type":"wait","days":2},
--            {"type":"send_sms","templateKey":"reminder"},
--            {"type":"send_email","templateKey":"review_request"},
--            {"type":"condition","if":"no_review","thenWaitDays":5}]
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 6. Extend existing message_templates for the full template editor:
--    email subject, channel, and unrestricted message types
--    (existing rows keep working; check constraint is widened).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 7. Custom lead stages: relax the built-in check so businesses can define
--    their own pipeline vocabulary (custom_statuses entity='lead').
--    Job/quote statuses intentionally keep their constraints — their values
--    drive payments, crons, and automations; they are relabel/recolor-only.
-- ---------------------------------------------------------------------------
alter table public.leads drop constraint if exists leads_stage_check;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
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
