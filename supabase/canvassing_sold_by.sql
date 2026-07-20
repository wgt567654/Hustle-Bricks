-- Sprint 2.2: canvassing → job sold-by attribution.
-- Re-creates create_canvassing_booking (same signature, same behavior) so the
-- job it creates carries lead_source = 'self_generated' and
-- sold_by_member_id = the canvassing rep.
--
-- The existing RPC has no rep parameter — the rep IS the authenticated caller
-- (the same auth.uid() the authorization check already uses), so we resolve
-- their team_members row here. When the caller is the owner (no team_members
-- row), the job is flagged sold_by_owner instead.
-- Run in the Supabase SQL editor; ends with a PostgREST schema reload.

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
  v_member_id      uuid;
  v_client_id      uuid;
  v_job_id         uuid;
  v_lead_id        uuid;
  v_stage          text;
  v_client_notes   text;
begin
  -- Allow active, approved team members (and remember who the rep is —
  -- they become the job's sold_by_member_id)
  select tm.id into v_member_id
  from public.team_members tm
  where tm.user_id = auth.uid()
    and tm.business_id = p_business_id
    and tm.is_active = true
    and tm.is_pending = false
  limit 1;

  v_is_authorized := v_member_id is not null;

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

    insert into public.jobs (
      business_id, client_id, status, scheduled_at, notes,
      lead_source, sold_by_member_id, sold_by_owner
    )
    values (
      p_business_id, v_client_id, 'scheduled', p_scheduled_at,
      nullif(trim(coalesce(p_service_notes, '')), ''),
      'self_generated', v_member_id, v_member_id is null
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

notify pgrst, 'reload schema';
