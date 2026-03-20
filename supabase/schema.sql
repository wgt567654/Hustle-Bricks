-- HustleBricks Database Schema
-- Run this in the Supabase SQL editor after creating your project.

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


-- ─── Team Members ────────────────────────────────────────────────────────────
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
