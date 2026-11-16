-- CasaFlow Guest QR: durable printed QR, skill/shift-based dispatch, acknowledgement and escalation.
-- Existing legacy 72-hour QR passes remain supported until expiry.

create table if not exists public.room_qr_codes (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  last_request_at timestamptz,
  day_bucket date not null default (now() at time zone 'utc')::date,
  daily_requests integer not null default 0,
  revoked_at timestamptz,
  foreign key (hotel_id,room_id) references public.rooms(hotel_id,id)
);
create index if not exists room_qr_hotel_idx on public.room_qr_codes(hotel_id,room_id);
alter table public.room_qr_codes enable row level security;
revoke all on public.room_qr_codes from public, anon, authenticated;

create table if not exists public.staff_dispatch (
  hotel_id uuid not null,
  user_id uuid not null,
  on_shift boolean not null default false,
  max_open_tasks integer not null default 5 check(max_open_tasks between 1 and 30),
  verified_skills text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key(hotel_id,user_id),
  foreign key(hotel_id,user_id) references public.memberships(hotel_id,user_id) on delete cascade,
  check(verified_skills <@ array['ac','plumbing','electrical','general_repair']::text[])
);
alter table public.staff_dispatch enable row level security;
revoke all on public.staff_dispatch from public, anon, authenticated;
grant select on public.staff_dispatch to authenticated;
create policy staff_dispatch_read on public.staff_dispatch for select to authenticated
using(app_private.can_access(hotel_id));

create table if not exists public.guest_request_meta (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  category text not null check(category in ('extra_towels','broken_ac','plumbing','missing_supplies','other')),
  department text not null check(department in ('housekeeping','maintenance','frontdesk')),
  urgent boolean not null default false,
  assigned_at timestamptz,
  ack_deadline timestamptz,
  accepted_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(hotel_id,task_id) references public.tasks(hotel_id,id)
);
create index if not exists guest_requests_ack_idx on public.guest_request_meta(ack_deadline) where accepted_at is null and escalated_at is null;
alter table public.guest_request_meta enable row level security;
revoke all on public.guest_request_meta from public, anon, authenticated;
grant select on public.guest_request_meta to authenticated;
create policy guest_request_meta_read on public.guest_request_meta for select to authenticated using (
 app_private.can_access(hotel_id) and exists(select 1 from public.tasks t where t.hotel_id=guest_request_meta.hotel_id and t.id=guest_request_meta.task_id)
);

create table if not exists public.ops_alerts (
 id bigint generated always as identity primary key,
 hotel_id uuid not null references public.hotels(id) on delete cascade,
 task_id uuid not null references public.tasks(id) on delete cascade,
 reason text not null check(reason in('urgent','no_worker','unaccepted')),
 target text not null check(target in('management','frontdesk','both')),
 body text not null,
 created_at timestamptz not null default now(),
 acknowledged_at timestamptz,
 unique(task_id,reason)
);
create index if not exists ops_alerts_active_idx on public.ops_alerts(hotel_id,created_at desc) where acknowledged_at is null;
alter table public.ops_alerts enable row level security;
revoke all on public.ops_alerts from public, anon, authenticated;
grant select on public.ops_alerts to authenticated;
create policy ops_alerts_read on public.ops_alerts for select to authenticated using(
 app_private.can_access(hotel_id) and (
   app_private.can_role(hotel_id,array['owner','manager']::public.staff_role[])
   or (target in('frontdesk','both') and app_private.can_role(hotel_id,array['frontdesk']::public.staff_role[]))
 )
);

-- Department lead approves skills; only hotel managers can mark an employee "certified".
create or replace function public.set_staff_dispatch(p_hotel uuid,p_user uuid,p_shift boolean,p_capacity integer,p_skills text[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if not app_private.can_role(p_hotel,array['owner','manager']::public.staff_role[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_capacity not between 1 and 30 or p_skills is null or not(p_skills <@ array['ac','plumbing','electrical','general_repair']::text[]) then raise exception 'Invalid staff capabilities'; end if;
 if not exists(select 1 from public.memberships where hotel_id=p_hotel and user_id=p_user and active and role in ('housekeeping','maintenance','frontdesk')) then raise exception 'Inactive or ineligible employee'; end if;
 insert into public.staff_dispatch(hotel_id,user_id,on_shift,max_open_tasks,verified_skills)
 values(p_hotel,p_user,p_shift,p_capacity,p_skills)
 on conflict(hotel_id,user_id) do update set on_shift=excluded.on_shift,max_open_tasks=excluded.max_open_tasks,verified_skills=excluded.verified_skills,updated_at=now();
end $$;
revoke all on function public.set_staff_dispatch(uuid,uuid,boolean,integer,text[]) from public,anon,authenticated;
grant execute on function public.set_staff_dispatch(uuid,uuid,boolean,integer,text[]) to authenticated;

-- Staff can clock in/out, but cannot certify their own skills or raise their capacity.
create or replace function public.set_my_shift(p_hotel uuid,p_shift boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.memberships where hotel_id=p_hotel and user_id=auth.uid() and active and role in('housekeeping','maintenance','frontdesk')) then raise exception 'Forbidden' using errcode='42501'; end if;
 insert into public.staff_dispatch(hotel_id,user_id,on_shift) values(p_hotel,auth.uid(),p_shift)
 on conflict(hotel_id,user_id) do update set on_shift=excluded.on_shift,updated_at=now();
end $$;
revoke all on function public.set_my_shift(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_my_shift(uuid,boolean) to authenticated;

-- One permanent physical QR per room, rotated only deliberately by authorized staff.
create or replace function public.issue_room_qr(p_hotel uuid,p_room uuid,p_rotate boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare v_token text;
begin
 if not app_private.can_role(p_hotel,array['owner','manager','frontdesk']::public.staff_role[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.rooms where hotel_id=p_hotel and id=p_room) then raise exception 'Room not found'; end if;
 if exists(select 1 from public.room_qr_codes where hotel_id=p_hotel and room_id=p_room) and not p_rotate then
   raise exception 'QR already issued. Rotate to invalidate old print and generate replacement.';
 end if;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.room_qr_codes(room_id,hotel_id,token_hash,issued_at,revoked_at,last_request_at,daily_requests)
 values(p_room,p_hotel,encode(extensions.digest(v_token,'sha256'),'hex'),now(),null,null,0)
 on conflict(room_id) do update set token_hash=excluded.token_hash,issued_at=now(),revoked_at=null,last_request_at=null,daily_requests=0;
 insert into public.activity(hotel_id,room_id,actor_id,message) values(p_hotel,p_room,auth.uid(),'Printed room QR issued or rotated');
 return v_token;
end $$;
revoke all on function public.issue_room_qr(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.issue_room_qr(uuid,uuid,boolean) to authenticated;

-- Token look-up exposes only the room number and hotel name, not employee records.
create or replace function public.guest_room_info(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hotel uuid;v_room uuid;v_room_number text;v_hotel_name text;v_pass public.guest_passes%rowtype;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid QR code'; end if;
 select c.hotel_id,c.room_id into v_hotel,v_room from public.room_qr_codes c where c.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and c.revoked_at is null;
 if v_room is null then
  select * into v_pass from public.guest_passes where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and revoked_at is null and expires_at>now();
  if not found then raise exception 'QR unavailable. Ask the front desk for a new code.'; end if;
  v_hotel:=v_pass.hotel_id;v_room:=v_pass.room_id;
 end if;
 select r.number,h.name into v_room_number,v_hotel_name from public.rooms r join public.hotels h on h.id=r.hotel_id
  where r.id=v_room and r.hotel_id=v_hotel;
 if v_room_number is null then raise exception 'Room unavailable'; end if;
 return jsonb_build_object('room',v_room_number,'hotel',v_hotel_name);
end $$;
revoke all on function public.guest_room_info(text) from public,anon,authenticated;
grant execute on function public.guest_room_info(text) to anon,authenticated;

-- Serialization by hotel/guest queue makes least-work assignment deterministic under bursts.
-- Every call uses an identical lock order (advisory lock -> room QR -> task creation).
create or replace function public.submit_guest_request(p_token text,p_category text,p_detail text default '',p_urgent boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_room uuid;v_hotel uuid;v_room_number text;v_status public.room_state;
 v_qr public.room_qr_codes%rowtype;v_legacy public.guest_passes%rowtype;
 v_dept text;v_skill text;v_title text;v_assignee uuid;v_task uuid;
 v_bucket date:=(now() at time zone 'utc')::date;
 v_limit integer;v_delay interval;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid QR code'; end if;
 if p_category not in ('extra_towels','broken_ac','plumbing','missing_supplies','other') or p_category is null then raise exception 'Choose a valid request category'; end if;
 if length(coalesce(p_detail,''))>1200 then raise exception 'Request too long'; end if;
 if p_urgent and p_category in('extra_towels','missing_supplies') then raise exception 'Use urgent only for safety or serious disruptions'; end if;
 v_dept:=case when p_category in('extra_towels','missing_supplies') then 'housekeeping' when p_category in('broken_ac','plumbing') then 'maintenance' else 'frontdesk' end;
 v_skill:=case p_category when 'broken_ac' then 'ac' when 'plumbing' then 'plumbing' else null end;
 v_title:=case p_category when 'extra_towels' then 'Extra towels' when 'missing_supplies' then 'Missing supplies' when 'broken_ac' then 'Broken AC' when 'plumbing' then 'Plumbing issue' else 'Guest assistance' end;
 select c.hotel_id,c.room_id into v_hotel,v_room from public.room_qr_codes c where c.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and c.revoked_at is null;
 if v_hotel is null then
  select * into v_legacy from public.guest_passes where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
  if not found or v_legacy.revoked_at is not null or v_legacy.expires_at<now() then raise exception 'Guest QR expired'; end if;
  v_hotel:=v_legacy.hotel_id;v_room:=v_legacy.room_id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_hotel::text||':casaflow_guest_dispatch',0));
 -- Lock the QR/pass for duplicate submission throttling.
 if v_legacy.id is null then
  select * into v_qr from public.room_qr_codes where room_id=v_room and hotel_id=v_hotel and token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and revoked_at is null for update;
  if not found then raise exception 'Guest QR rotated'; end if;
  if v_qr.last_request_at>now()-interval '30 seconds' then raise exception 'Please wait before submitting another request'; end if;
  if v_qr.day_bucket=v_bucket and v_qr.daily_requests>=40 then raise exception 'Daily request limit reached'; end if;
 else
  select * into v_legacy from public.guest_passes where id=v_legacy.id for update;
  if v_legacy.revoked_at is not null or v_legacy.expires_at<now() then raise exception 'Guest QR expired'; end if;
  if v_legacy.last_request_at>now()-interval '30 seconds' or v_legacy.total_requests>=25 then raise exception 'Request limit reached'; end if;
 end if;
 select r.number,r.status into v_room_number,v_status from public.rooms r where r.id=v_room and r.hotel_id=v_hotel;
 if v_room_number is null then raise exception 'Room not found'; end if;
 -- Physical QR can be scanned outside a room. Accept only while occupied.
 if v_status<>'occupied' then raise exception 'Requests are available only while the room is occupied'; end if;
 select s.user_id into v_assignee
 from public.staff_dispatch s join public.memberships m on m.hotel_id=s.hotel_id and m.user_id=s.user_id and m.active
 where s.hotel_id=v_hotel and s.on_shift and m.role::text=v_dept and (v_skill is null or v_skill=any(s.verified_skills))
 and (select count(*) from public.tasks t where t.hotel_id=v_hotel and t.assigned_to=s.user_id and t.status in('open','doing','inspection'))<s.max_open_tasks
 order by (select count(*) from public.tasks t where t.hotel_id=v_hotel and t.assigned_to=s.user_id and t.status in('open','doing','inspection')),s.updated_at,s.user_id limit 1;
 v_delay:=case when p_urgent then interval '2 minutes' else interval '5 minutes' end;
 insert into public.tasks(hotel_id,room_id,kind,title,detail,priority,assigned_to,created_by)
 values(v_hotel,v_room,'guest',v_title,trim(coalesce(p_detail,'')),case when p_urgent then 'urgent' else 'normal' end,v_assignee,null)
 returning id into v_task;
 insert into public.guest_request_meta(task_id,hotel_id,category,department,urgent,assigned_at,ack_deadline,escalated_at)
 values(v_task,v_hotel,p_category,v_dept,p_urgent,case when v_assignee is null then null else now() end,
  case when v_assignee is null then null else now()+v_delay end,
  case when v_assignee is null then now() else null end);
 if v_legacy.id is null then
  update public.room_qr_codes set last_request_at=now(),daily_requests=case when day_bucket=v_bucket then daily_requests+1 else 1 end,day_bucket=v_bucket where room_id=v_room;
 else
  update public.guest_passes set last_request_at=now(),total_requests=total_requests+1 where id=v_legacy.id;
 end if;
 if p_urgent then
  insert into public.ops_alerts(hotel_id,task_id,reason,target,body)
  values(v_hotel,v_task,'urgent','both','URGENT guest issue in room '||v_room_number||': '||v_title);
 end if;
 if v_assignee is null then
  insert into public.ops_alerts(hotel_id,task_id,reason,target,body)
  values(v_hotel,v_task,'no_worker','management','No available qualified '||v_dept||' employee for Room '||v_room_number);
 end if;
 insert into public.activity(hotel_id,room_id,task_id,message)
 values(v_hotel,v_room,v_task,'Guest requested '||v_title||case when v_assignee is null then ' — needs management assignment' else ' — auto-assigned' end);
 return v_task;
end $$;
revoke all on function public.submit_guest_request(text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.submit_guest_request(text,text,text,boolean) to anon,authenticated;

-- Guest acknowledgement is a separate explicit action (status open -> doing).
-- Lock task first, then metadata; the escalator uses the same lock order.
create or replace function public.accept_guest_request(p_hotel uuid,p_task uuid,p_expected_version bigint)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks%rowtype;v_meta public.guest_request_meta%rowtype;
begin
 if not app_private.can_access(p_hotel) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into v_task from public.tasks where id=p_task and hotel_id=p_hotel for update;
 if not found or v_task.kind<>'guest' then raise exception 'Guest task not found'; end if;
 if v_task.version<>p_expected_version then raise exception 'Version conflict' using errcode='40001'; end if;
 if v_task.assigned_to is distinct from auth.uid() then raise exception 'Not assigned to you' using errcode='42501'; end if;
 select * into v_meta from public.guest_request_meta where task_id=v_task.id for update;
 if not found or v_meta.accepted_at is not null or v_task.status<>'open' then raise exception 'Already accepted or closed'; end if;
 update public.guest_request_meta set accepted_at=now() where task_id=v_task.id;
 update public.tasks set status='doing',version=version+1,updated_at=now() where id=v_task.id;
 insert into public.activity(hotel_id,room_id,task_id,actor_id,message) values(p_hotel,v_task.room_id,v_task.id,auth.uid(),'Guest request accepted');
end $$;
revoke all on function public.accept_guest_request(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.accept_guest_request(uuid,uuid,bigint) to authenticated;

create or replace function public.complete_guest_request(p_hotel uuid,p_task uuid,p_expected_version bigint)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks%rowtype;
begin
 if not app_private.can_access(p_hotel) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into v_task from public.tasks where id=p_task and hotel_id=p_hotel for update;
 if not found or v_task.kind<>'guest' then raise exception 'Guest task not found'; end if;
 if v_task.version<>p_expected_version then raise exception 'Version conflict' using errcode='40001'; end if;
 if v_task.assigned_to is distinct from auth.uid() and not app_private.can_role(p_hotel,array['owner','manager']::public.staff_role[]) then raise exception 'Not assigned' using errcode='42501'; end if;
 if v_task.status<>'doing' then raise exception 'Accept request before completing'; end if;
 update public.tasks set status='done',completed_at=now(),version=version+1,updated_at=now() where id=v_task.id;
 insert into public.activity(hotel_id,room_id,task_id,actor_id,message) values(p_hotel,v_task.room_id,v_task.id,auth.uid(),'Guest request completed');
end $$;
revoke all on function public.complete_guest_request(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.complete_guest_request(uuid,uuid,bigint) to authenticated;

-- Manager fallback. Verification of skills is mandatory for maintenance categories.
create or replace function public.assign_task(p_hotel uuid,p_task uuid,p_assignee uuid,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype;t public.tasks%rowtype;v_role public.staff_role; v_dept text;v_category text;v_skill text;
begin
 select role into v_role from public.memberships where hotel_id=p_hotel and user_id=auth.uid() and active;
 if v_role is null or v_role not in('owner','manager','frontdesk','supervisor') then raise exception 'Forbidden' using errcode='42501'; end if;
 select room_id into r.id from public.tasks where id=p_task and hotel_id=p_hotel;
 if not found then raise exception 'Task not found'; end if;
 select * into r from public.rooms where hotel_id=p_hotel and id=r.id for update;
 select * into t from public.tasks where hotel_id=p_hotel and id=p_task for update;
 if t.version<>p_expected_version then raise exception 'Version conflict: refresh task' using errcode='40001'; end if;
 if t.status in ('done','cancelled') then raise exception 'Cannot reassign closed task'; end if;
 if v_role='supervisor' and t.kind not in('cleaning','supply','damage') then raise exception 'Outside supervisor department' using errcode='42501'; end if;
 if t.kind='guest' then
  select g.department,g.category into v_dept,v_category from public.guest_request_meta g where g.task_id=t.id;
  v_dept:=coalesce(v_dept,'frontdesk');
  v_skill:=case v_category when 'broken_ac' then 'ac' when 'plumbing' then 'plumbing' else null end;
  if p_assignee is not null and not exists(
   select 1 from public.memberships m left join public.staff_dispatch s on s.hotel_id=m.hotel_id and s.user_id=m.user_id
   where m.hotel_id=p_hotel and m.user_id=p_assignee and m.active and m.role::text=v_dept and (v_skill is null or v_skill=any(s.verified_skills))
  ) then raise exception 'Assignee not qualified for this guest request' using errcode='42501'; end if;
 else
  if p_assignee is not null and not exists(
   select 1 from public.memberships m where m.hotel_id=p_hotel and m.user_id=p_assignee and m.active and (
    (t.kind in('cleaning','supply') and m.role='housekeeping') or
    (t.kind in('maintenance','damage') and m.role='maintenance') or
    (t.kind='guest' and m.role='frontdesk')
   )
  ) then raise exception 'Assignee is not qualified for this task'; end if;
 end if;
 update public.tasks set assigned_to=p_assignee,status=case when t.kind='guest' and p_assignee is not null and t.status='doing' then 'open'::public.work_state else t.status end,version=version+1,updated_at=now() where id=t.id;
 if t.kind='guest' then
  update public.guest_request_meta set assigned_at=case when p_assignee is null then null else now() end,
   accepted_at=null,ack_deadline=case when p_assignee is null then null else now()+case when urgent then interval '2 minutes' else interval '5 minutes' end end,
   escalated_at=case when p_assignee is null then now() else null end where task_id=t.id;
 end if;
 insert into public.activity(hotel_id,room_id,task_id,actor_id,message)
 values(p_hotel,r.id,t.id,auth.uid(),case when p_assignee is null then 'Task unassigned' else 'Task manually assigned' end);
end $$;

-- Existing guest tasks were visible only to front desk. Enforce assignee-only for workers.
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using(
 app_private.can_access(hotel_id) and (
  app_private.can_role(hotel_id,array['owner','manager','frontdesk','supervisor']::public.staff_role[])
  or assigned_to=(select auth.uid())
  or created_by=(select auth.uid())
 )
);
drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select to authenticated using(
 app_private.can_access(hotel_id) and (
  app_private.can_role(hotel_id,array['owner','manager','frontdesk','supervisor']::public.staff_role[])
  or exists(select 1 from public.tasks t where t.hotel_id=rooms.hotel_id and t.room_id=rooms.id and (t.assigned_to=(select auth.uid()) or t.created_by=(select auth.uid())))
 )
);

-- Run as postgres via pg_cron; never grant this to browser users.
create or replace function public.escalate_guest_requests()
returns integer language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_task public.tasks%rowtype;v_meta public.guest_request_meta%rowtype;v_count int:=0;v_room text;
begin
 if session_user<>'postgres' then raise exception 'Forbidden' using errcode='42501'; end if;
 for v_id in select g.task_id from public.guest_request_meta g join public.tasks t on t.id=g.task_id
  where g.accepted_at is null and g.escalated_at is null and g.ack_deadline<=now() and t.status='open' order by g.ack_deadline limit 500
 loop
  select * into v_task from public.tasks where id=v_id for update skip locked;
  if not found then continue; end if;
  select * into v_meta from public.guest_request_meta where task_id=v_id for update;
  if not found or v_meta.accepted_at is not null or v_meta.escalated_at is not null or v_meta.ack_deadline>now() or v_task.status<>'open' then continue; end if;
  select number into v_room from public.rooms where id=v_task.room_id;
  update public.guest_request_meta set escalated_at=now() where task_id=v_id;
  insert into public.ops_alerts(hotel_id,task_id,reason,target,body)
  values(v_task.hotel_id,v_id,'unaccepted','management','Unaccepted request in Room '||coalesce(v_room,'?')||': '||v_task.title)
  on conflict(task_id,reason) do nothing;
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function public.escalate_guest_requests() from public,anon,authenticated;

create or replace function public.ack_guest_alert(p_hotel uuid,p_alert bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not app_private.can_role(p_hotel,array['owner','manager','frontdesk']::public.staff_role[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 update public.ops_alerts set acknowledged_at=now() where hotel_id=p_hotel and id=p_alert;
end $$;
revoke all on function public.ack_guest_alert(uuid,bigint) from public,anon,authenticated;
grant execute on function public.ack_guest_alert(uuid,bigint) to authenticated;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ops_alerts') then
  alter publication supabase_realtime add table public.ops_alerts;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='guest_request_meta') then
  alter publication supabase_realtime add table public.guest_request_meta;
 end if;
end $$;

-- Old unstructured guest submission is disabled to prevent bypassing department routing.
revoke execute on function public.guest_request(text,text,text) from public,anon,authenticated;
