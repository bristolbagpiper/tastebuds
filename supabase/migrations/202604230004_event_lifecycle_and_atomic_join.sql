create or replace function public.join_event_signup_safe(
  p_event_id bigint,
  p_user_id uuid
)
returns table (
  ok boolean,
  status text,
  error text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_capacity integer;
  v_event_status text;
  v_existing_status text;
  v_attendee_count integer;
begin
  select capacity, status
  into v_event_capacity, v_event_status
  from public.events
  where id = p_event_id
  for update;

  if not found then
    return query select false, 'not_found', 'Event not found.';
    return;
  end if;

  if v_event_status <> 'open' then
    return query select false, 'closed', 'This event is not open for signups.';
    return;
  end if;

  select status
  into v_existing_status
  from public.event_signups
  where event_id = p_event_id
    and user_id = p_user_id
  for update;

  if coalesce(v_existing_status, '') = 'going' then
    return query select true, 'going', null::text;
    return;
  end if;

  select count(*)
  into v_attendee_count
  from public.event_signups
  where event_id = p_event_id
    and status = 'going';

  if v_attendee_count >= v_event_capacity then
    return query select false, 'full', 'This event is already full.';
    return;
  end if;

  insert into public.event_signups (
    event_id,
    status,
    updated_at,
    user_id
  )
  values (
    p_event_id,
    'going',
    timezone('utc', now()),
    p_user_id
  )
  on conflict (event_id, user_id)
  do update set
    status = 'going',
    updated_at = excluded.updated_at;

  return query select true, 'going', null::text;
end;
$$;

grant execute on function public.join_event_signup_safe(bigint, uuid)
to authenticated, service_role;
