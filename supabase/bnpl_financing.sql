-- Customer Financing (BNPL) — adds financing configuration to businesses
alter table public.businesses
  add column if not exists financing_enabled  boolean      not null default false,
  add column if not exists financing_partner  text,
  add column if not exists financing_url      text,
  add column if not exists financing_min_amount integer    not null default 500;
