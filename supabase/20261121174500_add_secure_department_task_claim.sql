create or replace function public.claim_department_task(
  p_hotel uuid, p_task uuid, p_expected_version bigint
) returns void
language plpgsql security definer set search_path = ''
as $function$
declare
  v_task public.tasks%rowtype;
  v_meta public.guest_request_meta%rowtype;
  v_role text;
  v_skill text;
  v_capacity integer;
  v_workload integer;
begin
  if auth.uid() is null or not app_private.can_access(p_hotel) then
    raise exception 'Hotel membership required' using errcode='42501';
  end if;
  if not app_private.active_work_shift(p_hotel, auth.uid()) then
    raise exception 'Start your work shift before claiming tasks' using errcode='42501';
  end if;
  select m.role::text into v_role from public.memberships m
  where m.hotel_id=p_hotel and m.user_id=auth.uid() and m.active;
  if v_role not in ('housekeeping','maintenance') then
    raise exception 'Only department staff can claim tasks' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('casaflow:dispatch:'||p_hotel::text,0));
  select * into v_task from public.tasks t
  where t.hotel_id=p_hotel and t.id=p_task for update;
  if not found then raise exception 'Task not found'; end if;
  if v_task.version<>p_expected_version then
    raise exception 'Task changed. Refresh and try again.' using errcode='40001';
  end if;
  if v_task.status<>'open' then raise exception 'Only open tasks can be claimed'; end if;
  if v_task.assigned_to is not null then raise exception 'This task has already been claimed'; end if;
  if v_task.kind='guest' then
    select * into v_meta from public.guest_request_meta g
    where g.hotel_id=p_hotel and g.task_id=p_task for update;
    if not found or v_meta.department<>v_role then
      raise exception 'This request belongs to another department' using errcode='42501';
    end if;
    v_skill:=case v_meta.category when 'broken_ac' then 'ac' when 'plumbing' then 'plumbing' else null end;
  else
    if v_role='housekeeping' and v_task.kind not in ('cleaning','supply','damage') then
      raise exception 'This task is not in housekeeping' using errcode='42501';
    elsif v_role='maintenance' and v_task.kind not in ('maintenance','damage') then
      raise exception 'This task is not in maintenance' using errcode='42501';
    end if;
    v_skill:=null;
  end if;
  select s.max_open_tasks into v_capacity from public.staff_dispatch s
  where s.hotel_id=p_hotel and s.user_id=auth.uid()
    and s.on_shift and s.shift_ends_at>now()
    and (v_skill is null or v_skill=any(s.verified_skills)) for update;
  if not found then raise exception 'Your shift or required skill is not active' using errcode='42501'; end if;
  select count(*) into v_workload from public.tasks t
  where t.hotel_id=p_hotel and t.assigned_to=auth.uid()
    and t.status in ('open','doing','inspection');
  if v_workload>=v_capacity then
    raise exception 'You have reached your active task limit. Complete a task first.';
  end if;
  update public.tasks set assigned_to=auth.uid(),version=version+1,updated_at=now()
  where id=p_task and hotel_id=p_hotel;
  if v_task.kind='guest' then
    update public.guest_request_meta set assigned_at=now(),accepted_at=null,
      ack_deadline=now()+case when urgent then interval '2 minutes' else interval '5 minutes' end,
      escalated_at=null where hotel_id=p_hotel and task_id=p_task;
  end if;
  update public.ops_alerts set acknowledged_at=now()
  where task_id=p_task and reason='no_worker' and acknowledged_at is null;
  insert into public.activity(hotel_id,room_id,task_id,actor_id,message)
  values(p_hotel,v_task.room_id,p_task,auth.uid(),'Employee claimed department task');
end;
$function$;
revoke all on function public.claim_department_task(uuid,uuid,bigint) from public, anon;
grant execute on function public.claim_department_task(uuid,uuid,bigint) to authenticated;
