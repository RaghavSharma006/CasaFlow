-- Temporary, isolated public demo workspaces; these tables are not browser-readable.
create table if not exists public.demo_sessions (
 id uuid primary key,
 cookie_hash text not null unique,
 hotel_id uuid references public.hotels(id) on delete set null,
 ip_hash text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check(expires_at>created_at)
);
create table if not exists public.demo_session_users (
 session_id uuid not null references public.demo_sessions(id) on delete cascade,
 role_key text not null check(role_key in('owner','manager','reception','supervisor','cleaner1','cleaner2','ac','plumbing')),
 staff_role public.staff_role not null,
 user_id uuid not null unique references auth.users(id) on delete cascade,
 display_name text not null,
 primary key(session_id,role_key)
);
create table if not exists public.demo_rate_limits (
 key_hash text primary key,
 window_started_at timestamptz not null,
 hits integer not null default 0 check(hits>=0)
);
alter table public.demo_sessions enable row level security;
alter table public.demo_session_users enable row level security;
alter table public.demo_rate_limits enable row level security;
revoke all on public.demo_sessions,public.demo_session_users,public.demo_rate_limits from public,anon,authenticated;
grant all on public.demo_sessions,public.demo_session_users,public.demo_rate_limits to service_role;

create or replace function public.demo_rate_limit_allow(p_key text,p_limit integer default 5,p_window_seconds integer default 900)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_hits integer;v_now timestamptz:=now();
begin
 if p_key is null or length(p_key)<>64 or p_limit<1 or p_window_seconds<1 then raise exception 'Invalid rate-limit parameters'; end if;
 insert into public.demo_rate_limits(key_hash,window_started_at,hits) values(p_key,v_now,1)
 on conflict(key_hash) do update set
  window_started_at=case when public.demo_rate_limits.window_started_at<=v_now-make_interval(secs=>p_window_seconds) then v_now else public.demo_rate_limits.window_started_at end,
  hits=case when public.demo_rate_limits.window_started_at<=v_now-make_interval(secs=>p_window_seconds) then 1 else public.demo_rate_limits.hits+1 end
 returning hits into v_hits;
 return v_hits<=p_limit;
end;
$$;
revoke all on function public.demo_rate_limit_allow(text,integer,integer) from public,anon,authenticated;
grant execute on function public.demo_rate_limit_allow(text,integer,integer) to service_role;

create or replace function public.provision_demo_workspace(p_session_id uuid,p_users jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hotel uuid;v_user_count integer;v_token text;v_room uuid;
begin
 if not exists(select 1 from public.demo_sessions s where s.id=p_session_id and s.revoked_at is null and s.expires_at>now() and s.hotel_id is null) then
  raise exception 'Demo session invalid or already provisioned';
 end if;
 if jsonb_typeof(p_users)<>'array' or jsonb_array_length(p_users)<>8 then raise exception 'Exactly eight demo users are required'; end if;
 select count(distinct x->>'role_key') into v_user_count from jsonb_array_elements(p_users) x;
 if v_user_count<>8 then raise exception 'Demo roles must be unique'; end if;
 if exists(select 1 from jsonb_array_elements(p_users) x where (x->>'role_key') not in('owner','manager','reception','supervisor','cleaner1','cleaner2','ac','plumbing') or nullif(x->>'user_id','') is null or nullif(x->>'display_name','') is null or (x->>'staff_role') not in('owner','manager','frontdesk','supervisor','housekeeping','maintenance')) then
  raise exception 'Invalid demo user definition';
 end if;

 insert into public.hotels(name,city) values('CasaFlow Interactive Demo','Demo Environment') returning id into v_hotel;
 update public.demo_sessions set hotel_id=v_hotel where id=p_session_id;
 insert into public.demo_session_users(session_id,role_key,staff_role,user_id,display_name)
 select p_session_id,x->>'role_key',(x->>'staff_role')::public.staff_role,(x->>'user_id')::uuid,left(x->>'display_name',100) from jsonb_array_elements(p_users) x;
 insert into public.memberships(hotel_id,user_id,display_name,role,active)
 select v_hotel,(x->>'user_id')::uuid,left(x->>'display_name',100),(x->>'staff_role')::public.staff_role,true from jsonb_array_elements(p_users) x;

 insert into public.rooms(hotel_id,number,floor,kind,status) values
  (v_hotel,'101','1','Deluxe','occupied'),(v_hotel,'102','1','Standard','occupied'),
  (v_hotel,'103','1','Standard','ready'),(v_hotel,'201','2','Suite','occupied'),
  (v_hotel,'202','2','Standard','ready');

 insert into public.staff_dispatch(hotel_id,user_id,on_shift,max_open_tasks,verified_skills,shift_started_at,shift_ends_at,shift_duration_minutes,updated_at)
 select v_hotel,m.user_id,true,5,
  case when m.display_name='AC Technician' then array['ac']::text[] when m.display_name='Plumbing Technician' then array['plumbing']::text[] else '{}'::text[] end,
  now(),now()+interval '45 minutes',45,now()
 from public.memberships m where m.hotel_id=v_hotel and m.role in('frontdesk','housekeeping','maintenance');

 select id into v_room from public.rooms where hotel_id=v_hotel and number='101';
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.room_qr_codes(room_id,hotel_id,token_hash,issued_at,revoked_at,last_request_at,daily_requests)
 values(v_room,v_hotel,encode(extensions.digest(v_token,'sha256'),'hex'),now(),null,null,0);
 return jsonb_build_object('hotel_id',v_hotel,'sample_guest_token',v_token,'sample_room','101');
end;
$$;
revoke all on function public.provision_demo_workspace(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.provision_demo_workspace(uuid,jsonb) to service_role;

create or replace function app_private.demo_session_is_active()
returns boolean language sql stable security definer set search_path='' as $$
 select case
  when auth.uid() is null then false
  when coalesce(auth.jwt()->'app_metadata'->>'casaflow_demo','false')<>'true' then true
  else exists(
   select 1 from public.demo_session_users u join public.demo_sessions s on s.id=u.session_id
   where u.user_id=auth.uid()
    and s.id::text=auth.jwt()->'app_metadata'->>'casaflow_demo_session_id'
    and s.revoked_at is null and s.expires_at>now()
  )
 end;
$$;
revoke all on function app_private.demo_session_is_active() from public,anon,authenticated;

create or replace function app_private.can_access(h uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and app_private.demo_session_is_active()
  and exists(select 1 from public.memberships m where m.hotel_id=h and m.user_id=auth.uid() and m.active);
$$;
create or replace function app_private.can_role(h uuid,roles public.staff_role[])
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and app_private.demo_session_is_active()
  and exists(select 1 from public.memberships m where m.hotel_id=h and m.user_id=auth.uid() and m.active and m.role=any(roles));
$$;
create or replace function app_private.active_work_shift(p_hotel uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select app_private.demo_session_is_active() and exists(
  select 1 from public.memberships m left join public.staff_dispatch s on s.hotel_id=m.hotel_id and s.user_id=m.user_id
  where m.hotel_id=p_hotel and m.user_id=p_user and m.active
   and (m.role in('owner'::public.staff_role,'manager'::public.staff_role) or (s.on_shift and s.shift_ends_at>now()))
 );
$$;
comment on table public.demo_sessions is 'Temporary public demo sessions; service-role access only.';
comment on table public.demo_session_users is 'Role identities for temporary public demo sessions; service-role access only.';
