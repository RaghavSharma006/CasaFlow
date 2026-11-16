-- CasaFlow: role-separated operational access, one common chat and recipient-scoped private inboxes.
-- Safe additive migration for existing CasaFlow tenant data. No existing rows are deleted.

create table if not exists public.private_messages (
 id bigint generated always as identity primary key,
 hotel_id uuid not null references public.hotels(id) on delete cascade,
 recipient_kind text not null check(recipient_kind in ('owner','frontdesk')),
 thread_user_id uuid not null references auth.users(id) on delete cascade,
 sender_id uuid not null references auth.users(id),
 body text not null check(char_length(trim(body)) between 1 and 1500),
 created_at timestamptz not null default now()
);
create index if not exists private_messages_thread_idx on public.private_messages(hotel_id,recipient_kind,thread_user_id,id desc);
create index if not exists task_assignee_room_idx on public.tasks(hotel_id,assigned_to,room_id) where assigned_to is not null;
create index if not exists task_creator_room_idx on public.tasks(hotel_id,created_by,room_id) where created_by is not null;
alter table public.private_messages enable row level security;
revoke all on public.private_messages from public,anon,authenticated;
grant select on public.private_messages to authenticated;

drop policy if exists private_messages_read on public.private_messages;
create policy private_messages_read on public.private_messages for select to authenticated using (
 app_private.can_access(hotel_id)
 and (
   thread_user_id = (select auth.uid())
   or (recipient_kind='owner' and app_private.can_role(hotel_id,array['owner']::public.staff_role[]))
   or (recipient_kind='frontdesk' and app_private.can_role(hotel_id,array['frontdesk']::public.staff_role[]))
 )
);

-- The receiver identity and thread owner are validated inside the RPC, never trusted from the browser.
create or replace function public.send_private_message(
 p_hotel uuid, p_recipient text, p_body text, p_thread_user uuid default null
) returns bigint language plpgsql security definer set search_path='' as $$
declare v_sender uuid:=auth.uid(); v_target uuid:=coalesce(p_thread_user,auth.uid()); v_id bigint; v_staff_role public.staff_role;
begin
 if v_sender is null or not app_private.can_access(p_hotel) then
   raise exception 'Forbidden' using errcode='42501';
 end if;
 if p_recipient not in ('owner','frontdesk') or p_recipient is null then
   raise exception 'Invalid private inbox';
 end if;
 if char_length(trim(coalesce(p_body,''))) not between 1 and 1500 then
   raise exception 'Message must be 1–1500 characters';
 end if;
 select role into v_staff_role from public.memberships where hotel_id=p_hotel and user_id=v_sender and active;
 if v_target <> v_sender and not (
      (p_recipient='owner' and v_staff_role='owner')
   or (p_recipient='frontdesk' and v_staff_role='frontdesk')
 ) then
   raise exception 'Private thread forbidden' using errcode='42501';
 end if;
 if not exists(select 1 from public.memberships where hotel_id=p_hotel and user_id=v_target and active) then
   raise exception 'Recipient is not an active hotel employee' using errcode='42501';
 end if;
 insert into public.private_messages(hotel_id,recipient_kind,thread_user_id,sender_id,body)
 values (p_hotel,p_recipient,v_target,v_sender,trim(p_body)) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.send_private_message(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.send_private_message(uuid,text,text,uuid) to authenticated;

-- Role access is enforced by Postgres RLS, not by hiding React sidebar links.
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using (
 app_private.can_access(hotel_id) and (
   app_private.can_role(hotel_id,array['owner','manager','frontdesk','supervisor']::public.staff_role[])
   or (assigned_to=(select auth.uid()) and (
     (kind in ('cleaning','supply','damage') and app_private.can_role(hotel_id,array['housekeeping']::public.staff_role[]))
     or (kind in ('maintenance','damage') and app_private.can_role(hotel_id,array['maintenance']::public.staff_role[]))
   ))
   or created_by=(select auth.uid())
 )
);
drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select to authenticated using (
 app_private.can_access(hotel_id) and (
   app_private.can_role(hotel_id,array['owner','manager','frontdesk','supervisor']::public.staff_role[])
   or exists(
    select 1 from public.tasks t where t.hotel_id=rooms.hotel_id and t.room_id=rooms.id
     and (t.assigned_to=(select auth.uid()) or t.created_by=(select auth.uid()))
     and (
      (t.kind in ('cleaning','supply','damage') and app_private.can_role(rooms.hotel_id,array['housekeeping']::public.staff_role[]))
      or (t.kind in ('maintenance','damage') and app_private.can_role(rooms.hotel_id,array['maintenance']::public.staff_role[]))
     )
   )
 )
);
drop policy if exists activity_read on public.activity;
create policy activity_read on public.activity for select to authenticated using (
 app_private.can_role(hotel_id,array['owner','manager','frontdesk','supervisor']::public.staff_role[])
);
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (
 room_id is null and app_private.can_access(hotel_id)
);

-- One hotel-wide chat. Private conversations never go through this table.
create or replace function public.send_message(p_hotel uuid,p_body text,p_room uuid default null) returns bigint
 language plpgsql security definer set search_path='' as $$
declare v_id bigint;
begin
 if not app_private.can_access(p_hotel) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_room is not null then raise exception 'Room chat has been replaced by the hotel-wide channel'; end if;
 if char_length(trim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'Message length invalid'; end if;
 insert into public.messages(hotel_id,room_id,sender_id,body)
 values(p_hotel,null,auth.uid(),trim(p_body)) returning id into v_id;
 return v_id;
end $$;

-- Prevent workers taking another worker's tasks or injecting an assignee into a task transition.
create or replace function public.advance_task(p_hotel uuid,p_task uuid,p_expected_version bigint,p_assignee uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; t public.tasks%rowtype; v_role public.staff_role; next_state public.work_state;
begin
 select m.role into v_role from public.memberships m where m.hotel_id=p_hotel and m.user_id=auth.uid() and m.active;
 if v_role is null then raise exception 'Forbidden' using errcode='42501'; end if;
 select room_id into r.id from public.tasks where hotel_id=p_hotel and id=p_task;
 if r.id is null then raise exception 'Task not found'; end if;
 select * into r from public.rooms where hotel_id=p_hotel and id=r.id for update;
 select * into t from public.tasks where hotel_id=p_hotel and id=p_task for update;
 if t.version<>p_expected_version then raise exception 'Version conflict: refresh task' using errcode='40001'; end if;
 if t.status in ('done','cancelled') then raise exception 'Already closed'; end if;
 if v_role in ('housekeeping','maintenance') then
   if t.assigned_to is distinct from auth.uid() then raise exception 'Not your assigned task' using errcode='42501'; end if;
   if v_role='housekeeping' and t.kind not in ('cleaning','supply','damage') then raise exception 'Wrong department' using errcode='42501'; end if;
   if v_role='maintenance' and t.kind not in ('maintenance','damage') then raise exception 'Wrong department' using errcode='42501'; end if;
 end if;
 if p_assignee is not null then
   if v_role not in('owner','manager','frontdesk','supervisor') then raise exception 'Assignment forbidden' using errcode='42501'; end if;
   if not exists(select 1 from public.memberships where hotel_id=p_hotel and user_id=p_assignee and active) then raise exception 'Invalid assignee'; end if;
 end if;
 if t.kind='cleaning' then
   if t.status='open' and v_role not in('owner','manager','supervisor','housekeeping') then raise exception 'Forbidden'; end if;
   if t.status='doing' and v_role not in('owner','manager','supervisor','housekeeping') then raise exception 'Forbidden'; end if;
   if t.status='inspection' and v_role not in('owner','manager','supervisor') then raise exception 'Supervisor approval required'; end if;
   next_state:=case t.status when 'open' then 'doing'::public.work_state when 'doing' then 'inspection'::public.work_state else 'done'::public.work_state end;
   if next_state='done' and r.status<>'inspection' then raise exception 'Room must be in inspection'; end if;
   if next_state='doing' and r.status not in('dirty','cleaning') then raise exception 'Room not ready for cleaning'; end if;
   if next_state='inspection' and r.status<>'cleaning' then raise exception 'Cleaning not started'; end if;
   update public.rooms set status=case next_state when 'doing' then 'cleaning'::public.room_state when 'inspection' then 'inspection'::public.room_state else 'ready'::public.room_state end,
    version=version+1,updated_at=now() where id=r.id;
 else
   if v_role not in ('owner','manager','frontdesk','supervisor') and t.assigned_to is distinct from auth.uid() then raise exception 'Not assigned' using errcode='42501'; end if;
   next_state:=case when t.status='open' then 'doing'::public.work_state else 'done'::public.work_state end;
 end if;
 update public.tasks set status=next_state,assigned_to=coalesce(p_assignee,t.assigned_to),
  version=version+1,updated_at=now(),completed_at=case when next_state='done' then now() else null end where id=t.id;
 insert into public.activity(hotel_id,room_id,task_id,actor_id,message) values(p_hotel,r.id,t.id,auth.uid(),'Task moved to '||next_state::text);
end $$;

-- Only team leads may explicitly assign a colleague during task creation.
create or replace function public.create_task(p_hotel uuid,p_room uuid,p_kind public.work_kind,p_title text,p_detail text default '',p_priority text default 'normal',p_assignee uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; tid uuid; v_role public.staff_role;
begin
 select role into v_role from public.memberships where hotel_id=p_hotel and user_id=auth.uid() and active;
 if v_role is null then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_kind='cleaning' and v_role not in ('owner','manager','frontdesk','supervisor') then raise exception 'Cleaning assignment forbidden'; end if;
 if p_kind='guest' and v_role not in ('owner','manager','frontdesk') then raise exception 'Guest task forbidden'; end if;
 if p_kind in ('maintenance','damage','supply') and v_role not in ('owner','manager','frontdesk','supervisor','housekeeping','maintenance') then raise exception 'Forbidden'; end if;
 if v_role='housekeeping' and p_kind not in ('damage','supply') then raise exception 'Housekeepers can only report damage or shortages'; end if;
 if v_role='maintenance' and p_kind not in ('maintenance','damage') then raise exception 'Maintenance can only report repairs or damage'; end if;
 if p_assignee is not null and v_role not in('owner','manager','frontdesk','supervisor') then raise exception 'Assignment forbidden' using errcode='42501'; end if;
 select * into r from public.rooms where hotel_id=p_hotel and id=p_room for update;
 if not found then raise exception 'Room not found'; end if;
 if length(trim(coalesce(p_title,''))) not between 2 and 140 then raise exception 'Invalid task title'; end if;
 if p_priority not in('normal','high','urgent') then raise exception 'Invalid priority'; end if;
 if p_assignee is not null then
   if not exists(select 1 from public.memberships m where m.hotel_id=p_hotel and m.user_id=p_assignee and m.active and (
    (p_kind in('cleaning','supply') and m.role='housekeeping') or
    (p_kind in('maintenance','damage') and m.role='maintenance') or
    (p_kind='guest' and m.role='frontdesk')
   )) then raise exception 'Assignee is not qualified for this task'; end if;
 end if;
 insert into public.tasks(hotel_id,room_id,kind,title,detail,priority,assigned_to,created_by)
 values(p_hotel,r.id,p_kind,trim(p_title),left(trim(coalesce(p_detail,'')),1200),p_priority,p_assignee,auth.uid()) returning id into tid;
 insert into public.activity(hotel_id,room_id,task_id,actor_id,message) values(p_hotel,r.id,tid,auth.uid(),'New '||p_kind::text||' task created');
 return tid;
end $$;

-- Realtime notifications respect SELECT RLS; clients fetch canonical rows after changes.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='private_messages') then
  alter publication supabase_realtime add table public.private_messages;
 end if;
end $$;

-- Manual staff assignment, separate from task advancement and safe under concurrency.
create or replace function public.assign_task(p_hotel uuid,p_task uuid,p_assignee uuid,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; t public.tasks%rowtype; v_role public.staff_role;
begin
 select role into v_role from public.memberships where hotel_id=p_hotel and user_id=auth.uid() and active;
 if v_role is null or v_role not in('owner','manager','frontdesk','supervisor') then raise exception 'Forbidden' using errcode='42501'; end if;
 select room_id into r.id from public.tasks where id=p_task and hotel_id=p_hotel;
 if not found then raise exception 'Task not found'; end if;
 select * into r from public.rooms where hotel_id=p_hotel and id=r.id for update;
 select * into t from public.tasks where hotel_id=p_hotel and id=p_task for update;
 if t.version<>p_expected_version then raise exception 'Version conflict: refresh task' using errcode='40001'; end if;
 if t.status in ('done','cancelled') then raise exception 'Cannot reassign closed task'; end if;
 if v_role='supervisor' and t.kind not in ('cleaning','supply','damage') then raise exception 'Outside supervisor department' using errcode='42501'; end if;
 if p_assignee is not null and not exists(
  select 1 from public.memberships m where m.hotel_id=p_hotel and m.user_id=p_assignee and m.active and (
   (t.kind in ('cleaning','supply') and m.role='housekeeping') or
   (t.kind in ('maintenance','damage') and m.role='maintenance') or
   (t.kind='guest' and m.role='frontdesk')
  )
 ) then raise exception 'Assignee is not qualified for this task'; end if;
 update public.tasks set assigned_to=p_assignee,version=version+1,updated_at=now() where id=t.id;
 insert into public.activity(hotel_id,room_id,task_id,actor_id,message) values(p_hotel,r.id,t.id,auth.uid(),
   case when p_assignee is null then 'Task unassigned' else 'Task reassigned' end);
end $$;
revoke all on function public.assign_task(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.assign_task(uuid,uuid,uuid,bigint) to authenticated;
