-- CasaFlow v2: isolated tenant-aware database. Apply ONLY to a new dedicated Supabase project.
-- All state changes are handled by transactional RPCs; exposed tables have read-only RLS.
create extension if not exists pgcrypto;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

do $$ begin
  create type public.staff_role as enum ('owner','manager','frontdesk','supervisor','housekeeping','maintenance');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.room_state as enum ('occupied','dirty','cleaning','inspection','ready','blocked');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.work_state as enum ('open','doing','inspection','done','cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.work_kind as enum ('cleaning','maintenance','guest','supply','damage');
exception when duplicate_object then null; end $$;

create table public.hotels (
 id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 2 and 120),
 city text not null default '', preferred_language text not null default 'en' check(preferred_language in('en','es')),
 created_at timestamptz not null default now()
);
create table public.memberships (
 hotel_id uuid not null references public.hotels(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 2 and 100),
 role public.staff_role not null, active boolean not null default true,
 created_at timestamptz not null default now(), primary key (hotel_id,user_id)
);
create index memberships_user_idx on public.memberships(user_id,hotel_id) where active;
create table public.rooms (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
 number text not null check(length(number) between 1 and 12), floor text not null default '1',
 kind text not null default 'Standard', status public.room_state not null default 'ready',
 version bigint not null default 0, updated_at timestamptz not null default now(),
 unique (hotel_id,number), unique(hotel_id,id)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
 room_id uuid not null, kind public.work_kind not null, title text not null check(length(title) between 2 and 140),
 detail text not null default '' check(length(detail)<=1200), priority text not null default 'normal' check(priority in('normal','high','urgent')),
 status public.work_state not null default 'open', assigned_to uuid references auth.users(id) on delete set null,
 created_by uuid references auth.users(id) on delete set null, version bigint not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
 foreign key(hotel_id,room_id) references public.rooms(hotel_id,id), unique(hotel_id,id)
);
create index tasks_hotel_status_idx on public.tasks(hotel_id,status,created_at desc);
create table public.activity (
 id bigint generated always as identity primary key, hotel_id uuid not null references public.hotels(id) on delete cascade,
 room_id uuid references public.rooms(id), task_id uuid references public.tasks(id) on delete set null,
 actor_id uuid references auth.users(id) on delete set null,
 message text not null, at timestamptz not null default now()
);
create index activity_hotel_at_idx on public.activity(hotel_id,at desc);
create table public.messages (
 id bigint generated always as identity primary key, hotel_id uuid not null references public.hotels(id) on delete cascade,
 room_id uuid, sender_id uuid references auth.users(id) on delete set null,
 body text not null check(length(body) between 1 and 1000), created_at timestamptz not null default now(),
 foreign key(hotel_id,room_id) references public.rooms(hotel_id,id)
);
create index messages_recent_idx on public.messages(hotel_id,created_at desc);
create table public.staff_invites (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
 token_hash text not null unique, role public.staff_role not null, expires_at timestamptz not null,
 used_at timestamptz, issued_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.guest_passes (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id) on delete cascade,
 room_id uuid not null, token_hash text not null unique, expires_at timestamptz not null, revoked_at timestamptz,
 last_request_at timestamptz, total_requests int not null default 0,
 foreign key(hotel_id,room_id) references public.rooms(hotel_id,id)
);

create or replace function app_private.can_access(h uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.memberships m where m.hotel_id=h and m.user_id=auth.uid() and m.active);
$$;
create or replace function app_private.can_role(h uuid, roles public.staff_role[])
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.memberships m where m.hotel_id=h and m.user_id=auth.uid() and m.active and m.role=any(roles));
$$;
revoke all on function app_private.can_access(uuid), app_private.can_role(uuid,public.staff_role[]) from public,anon,authenticated;
-- Authenticated users must be able to execute functions referenced by RLS policies.
-- The schema is not exposed through Supabase Data API.
grant usage on schema app_private to authenticated;
grant execute on function app_private.can_access(uuid),app_private.can_role(uuid,public.staff_role[]) to authenticated;

-- All exposed data tables deny untrusted writes, including role escalation.
do $$ declare t text; begin
 foreach t in array array['hotels','memberships','rooms','tasks','activity','messages','staff_invites','guest_passes'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.hotels,public.memberships,public.rooms,public.tasks,public.activity,public.messages to authenticated;
create policy hotels_read on public.hotels for select to authenticated using(app_private.can_access(id));
create policy memberships_read on public.memberships for select to authenticated using(app_private.can_access(hotel_id));
create policy rooms_read on public.rooms for select to authenticated using(app_private.can_access(hotel_id));
create policy tasks_read on public.tasks for select to authenticated using(app_private.can_access(hotel_id));
create policy activity_read on public.activity for select to authenticated using(app_private.can_access(hotel_id));
create policy messages_read on public.messages for select to authenticated using(app_private.can_access(hotel_id));

-- Bootstrap for first hotel; initial owner is the currently authenticated user.
create or replace function public.create_hotel(p_name text,p_city text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='28000'; end if;
 if length(trim(p_name)) not between 2 and 120 then raise exception 'Invalid hotel name'; end if;
 insert into public.hotels(name,city) values(trim(p_name),left(trim(coalesce(p_city,'')),150)) returning id into h;
 insert into public.memberships(hotel_id,user_id,display_name,role)
 values(h,auth.uid(),coalesce(nullif(left(trim(auth.jwt()->>'email'),100),''),'Owner'),'owner');
 insert into public.activity(hotel_id,actor_id,message) values(h,auth.uid(),'Hotel created');
 return h;
end $$;

create or replace function public.add_room(p_hotel uuid,p_number text,p_floor text default '1',p_kind text default 'Standard') returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if not app_private.can_role(p_hotel,array['owner','manager']::public.staff_role[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 insert into public.rooms(hotel_id,number,floor,kind) values(p_hotel,left(trim(p_number),12),left(trim(p_floor),30),left(trim(p_kind),60)) returning id into rid;
 return rid;
end $$;

-- Lock order is ALWAYS rooms first, then task. Compare expected versions while holding locks.
-- Atomic write + version increments; stale clients receive a conflict rather than clobbering updates.
create or replace function public.checkout_room(p_hotel uuid,p_room uuid,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; t uuid;
begin
 if not app_private.can_role(p_hotel,array['owner','manager','frontdesk']::public.staff_role[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into r from public.rooms where hotel_id=p_hotel and id=p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.version<>p_expected_version then raise exception 'Version conflict: refresh room' using errcode='40001'; end if;
 if r.status<>'occupied' then raise exception 'Room must be occupied to check out'; end if;
 update public.rooms set status='dirty',version=version+1,updated_at=now() where id=r.id;
 insert into public.tasks(hotel_id,room_id,kind,title,detail,created_by)
 values(p_hotel,r.id,'cleaning','Checkout cleaning','Linen, bathroom, amenities and damage check',auth.uid()) returning id into t;
 update public.guest_passes set revoked_at=now() where room_id=r.id and hotel_id=p_hotel and revoked_at is null;
 insert into public.activity(hotel_id,room_id,task_id,actor_id,message) values(p_hotel,r.id,t,auth.uid(),'Checkout recorded; cleaning created');
end $$;

-- Front desk can mark an inspected/ready room as occupied, with a version precondition.
create or replace function public.checkin_room(p_hotel uuid,p_room uuid,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype;
begin
 if not app_private.can_role(p_hotel,array['owner','manager','frontdesk']::public.staff_role[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into r from public.rooms where hotel_id=p_hotel and id=p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if r.version<>p_expected_version then raise exception 'Version conflict: refresh room' using errcode='40001'; end if;
 if r.status<>'ready' then raise exception 'Room must be ready'; end if;
 update public.rooms set status='occupied',version=version+1,updated_at=now() where id=r.id;
 insert into public.activity(hotel_id,room_id,actor_id,message) values(p_hotel,r.id,auth.uid(),'Room checked in');
end $$;

create or replace function public.create_task(p_hotel uuid,p_room uuid,p_kind public.work_kind,p_title text,p_detail text default '',p_priority text default 'normal',p_assignee uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; tid uuid;
begin
 if not app_private.can_access(p_hotel) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_kind='cleaning' and not app_private.can_role(p_hotel,array['owner','manager','frontdesk','supervisor']::public.staff_role[]) then raise exception 'Forbidden'; end if;
 if p_kind='guest' and not app_private.can_role(p_hotel,array['owner','manager','frontdesk']::public.staff_role[]) then raise exception 'Forbidden'; end if;
 if p_kind in ('maintenance','damage','supply') and not app_private.can_role(p_hotel,array['owner','manager','frontdesk','supervisor','housekeeping','maintenance']::public.staff_role[]) then raise exception 'Forbidden'; end if;
 select * into r from public.rooms where id=p_room and hotel_id=p_hotel for update;
 if not found then raise exception 'Room not found'; end if;
 if p_priority not in('normal','high','urgent') then raise exception 'Invalid priority'; end if;
 if p_assignee is not null and not exists(select 1 from public.memberships where hotel_id=p_hotel and user_id=p_assignee and active) then raise exception 'Invalid assignee'; end if;
 insert into public.tasks(hotel_id,room_id,kind,title,detail,priority,assigned_to,created_by)
 values(p_hotel,r.id,p_kind,left(trim(p_title),140),left(coalesce(p_detail,''),1200),p_priority,p_assignee,auth.uid()) returning id into tid;
 if p_kind='maintenance' and p_priority='urgent' and r.status<>'blocked' then
   update public.rooms set status='blocked',version=version+1,updated_at=now() where id=r.id;
 end if;
 insert into public.activity(hotel_id,room_id,task_id,actor_id,message) values(p_hotel,r.id,tid,auth.uid(),'Task created');
 return tid;
end $$;

create or replace function public.advance_task(p_hotel uuid,p_task uuid,p_expected_version bigint,p_assignee uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; t public.tasks%rowtype; role public.staff_role; next_state public.work_state;
begin
 select m.role into role from public.memberships m where m.hotel_id=p_hotel and m.user_id=auth.uid() and m.active;
 if role is null then raise exception 'Forbidden' using errcode='42501'; end if;
 -- Get room ID without locking; immutable room_id, then acquire canonical room -> task locks.
 select room_id into r.id from public.tasks where hotel_id=p_hotel and id=p_task;
 if r.id is null then raise exception 'Task not found'; end if;
 select * into r from public.rooms where hotel_id=p_hotel and id=r.id for update;
 select * into t from public.tasks where hotel_id=p_hotel and id=p_task for update;
 if t.version<>p_expected_version then raise exception 'Version conflict: refresh task' using errcode='40001'; end if;
 if t.status in ('done','cancelled') then raise exception 'Already closed'; end if;
 if p_assignee is not null and not exists(select 1 from public.memberships where hotel_id=p_hotel and user_id=p_assignee and active) then raise exception 'Invalid assignee'; end if;
 if t.kind='cleaning' then
   if t.status='open' and role not in('owner','manager','supervisor','housekeeping') then raise exception 'Forbidden'; end if;
   if t.status='doing' and role not in('owner','manager','supervisor','housekeeping') then raise exception 'Forbidden'; end if;
   if t.status='inspection' and role not in('owner','manager','supervisor') then raise exception 'Supervisor approval required'; end if;
   next_state:=case t.status when 'open' then 'doing'::public.work_state when 'doing' then 'inspection'::public.work_state else 'done'::public.work_state end;
   if next_state='done' and r.status<>'inspection' then raise exception 'Room must be in inspection'; end if;
   if next_state='doing' and r.status not in('dirty','cleaning') then raise exception 'Room not ready for cleaning'; end if;
   if next_state='inspection' and r.status<>'cleaning' then raise exception 'Cleaning not started'; end if;
   update public.rooms set status=case next_state when 'doing' then 'cleaning'::public.room_state when 'inspection' then 'inspection'::public.room_state else 'ready'::public.room_state end,
    version=version+1,updated_at=now() where id=r.id;
 else
   if role not in('owner','manager','frontdesk','supervisor') and not (t.assigned_to=auth.uid() or t.assigned_to is null and ((t.kind in('maintenance','damage') and role='maintenance') or (t.kind='supply' and role='housekeeping'))) then raise exception 'Not assigned'; end if;
   next_state:=case when t.status='open' then 'doing'::public.work_state else 'done'::public.work_state end;
 end if;
 update public.tasks set status=next_state,assigned_to=coalesce(p_assignee,assigned_to,case when t.status='open' then auth.uid() else null end),
  version=version+1,updated_at=now(),completed_at=case when next_state='done' then now() else null end where id=t.id;
 insert into public.activity(hotel_id,room_id,task_id,actor_id,message) values(p_hotel,r.id,t.id,auth.uid(),'Task moved to '||next_state::text);
end $$;

create or replace function public.send_message(p_hotel uuid,p_body text,p_room uuid default null) returns bigint
language plpgsql security definer set search_path='' as $$
declare mid bigint;
begin
 if not app_private.can_access(p_hotel) then raise exception 'Forbidden' using errcode='42501'; end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'Message length invalid'; end if;
 if p_room is not null and not exists(select 1 from public.rooms where hotel_id=p_hotel and id=p_room) then raise exception 'Invalid room'; end if;
 insert into public.messages(hotel_id,room_id,sender_id,body) values(p_hotel,p_room,auth.uid(),trim(p_body)) returning id into mid;
 return mid;
end $$;

create or replace function public.create_staff_invite(p_hotel uuid,p_role public.staff_role) returns text
language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if not app_private.can_role(p_hotel,array['owner','manager']::public.staff_role[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_role='owner' then raise exception 'Owner transfer requires separate verified workflow'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.staff_invites(hotel_id,token_hash,role,expires_at,issued_by)
 values(p_hotel,encode(extensions.digest(token,'sha256'),'hex'),p_role,now()+interval '48 hours',auth.uid());
 return token;
end $$;
create or replace function public.accept_staff_invite(p_token text,p_display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare inv public.staff_invites%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if length(trim(coalesce(p_display_name,''))) not between 2 and 100 then raise exception 'Invalid name'; end if;
 select * into inv from public.staff_invites where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or inv.used_at is not null or inv.expires_at<now() then raise exception 'Invalid or expired invitation'; end if;
 insert into public.memberships(hotel_id,user_id,display_name,role) values(inv.hotel_id,auth.uid(),trim(p_display_name),inv.role)
 on conflict(hotel_id,user_id) do update set display_name=excluded.display_name,role=excluded.role,active=true;
 update public.staff_invites set used_at=now() where id=inv.id;
 insert into public.activity(hotel_id,actor_id,message) values(inv.hotel_id,auth.uid(),'Staff member joined');
 return inv.hotel_id;
end $$;

-- Generate short-lived guest access. Token is revealed once, never stored plaintext.
create or replace function public.create_guest_pass(p_hotel uuid,p_room uuid) returns text
language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if not app_private.can_role(p_hotel,array['owner','manager','frontdesk']::public.staff_role[]) then raise exception 'Forbidden'; end if;
 if not exists(select 1 from public.rooms where hotel_id=p_hotel and id=p_room) then raise exception 'Room not found'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.guest_passes(hotel_id,room_id,token_hash,expires_at)
 values(p_hotel,p_room,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '72 hours');
 return token;
end $$;
create or replace function public.guest_request(p_token text,p_title text,p_detail text) returns uuid
language plpgsql security definer set search_path='' as $$
declare g public.guest_passes%rowtype; r public.rooms%rowtype; t uuid;
begin
 if p_token is null or length(p_token)<>64 or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid QR code'; end if;
 -- First read token without locking; lock the room before the pass so that
 -- guest submissions and checkout use the same room -> pass lock order.
 select * into g from public.guest_passes where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if not found then raise exception 'Guest access expired'; end if;
 select * into r from public.rooms where id=g.room_id and hotel_id=g.hotel_id for update;
 select * into g from public.guest_passes where id=g.id for update;
 if not found or g.revoked_at is not null or g.expires_at<now() then raise exception 'Guest access expired'; end if;
 if g.last_request_at>now()-interval '30 seconds' or g.total_requests>=25 then raise exception 'Request limit reached'; end if;
 insert into public.tasks(hotel_id,room_id,kind,title,detail) values(g.hotel_id,g.room_id,'guest',left(trim(p_title),140),left(trim(coalesce(p_detail,'')),1200)) returning id into t;
 update public.guest_passes set last_request_at=now(),total_requests=total_requests+1 where id=g.id;
 insert into public.activity(hotel_id,room_id,task_id,message) values(g.hotel_id,g.room_id,t,'Guest request received');
 return t;
end $$;

revoke all on function public.create_hotel(text,text),public.add_room(uuid,text,text,text),public.checkout_room(uuid,uuid,bigint),public.checkin_room(uuid,uuid,bigint),public.create_task(uuid,uuid,public.work_kind,text,text,text,uuid),public.advance_task(uuid,uuid,bigint,uuid),public.send_message(uuid,text,uuid),public.create_staff_invite(uuid,public.staff_role),public.accept_staff_invite(text,text),public.create_guest_pass(uuid,uuid),public.guest_request(text,text,text) from public,anon,authenticated;
grant execute on function public.create_hotel(text,text),public.add_room(uuid,text,text,text),public.checkout_room(uuid,uuid,bigint),public.checkin_room(uuid,uuid,bigint),public.create_task(uuid,uuid,public.work_kind,text,text,text,uuid),public.advance_task(uuid,uuid,bigint,uuid),public.send_message(uuid,text,uuid),public.create_staff_invite(uuid,public.staff_role),public.accept_staff_invite(text,text),public.create_guest_pass(uuid,uuid) to authenticated;
grant execute on function public.guest_request(text,text,text) to anon,authenticated;
-- Realtime: RLS controls who can see table changes. The client resyncs on events and reconnection.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rooms') then alter publication supabase_realtime add table public.rooms; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tasks') then alter publication supabase_realtime add table public.tasks; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then alter publication supabase_realtime add table public.messages; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='activity') then alter publication supabase_realtime add table public.activity; end if;
end $$;
