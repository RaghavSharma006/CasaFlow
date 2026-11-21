CREATE OR REPLACE FUNCTION public.begin_work_shift(p_hotel uuid)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_end timestamptz;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to start a work shift' USING ERRCODE='42501';
  END IF;
  SELECT m.role::text INTO v_role
  FROM public.memberships m
  WHERE m.hotel_id=p_hotel AND m.user_id=auth.uid() AND m.active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active hotel membership required' USING ERRCODE='42501';
  END IF;
  IF v_role IN ('owner','manager') THEN RETURN NULL; END IF;
  SELECT s.shift_ends_at INTO v_end FROM public.staff_dispatch s
  WHERE s.hotel_id=p_hotel AND s.user_id=auth.uid() FOR UPDATE;
  IF FOUND AND v_end>now() AND EXISTS (
    SELECT 1 FROM public.staff_dispatch s
    WHERE s.hotel_id=p_hotel AND s.user_id=auth.uid() AND s.on_shift
  ) THEN RETURN v_end; END IF;
  INSERT INTO public.staff_dispatch(hotel_id,user_id,on_shift,shift_started_at,shift_ends_at)
  VALUES(p_hotel,auth.uid(),true,now(),now()+interval '8 hours')
  ON CONFLICT(hotel_id,user_id) DO UPDATE
  SET on_shift=true,shift_started_at=now(),
      shift_ends_at=now()+(public.staff_dispatch.shift_duration_minutes * interval '1 minute'),
      updated_at=now()
  RETURNING shift_ends_at INTO v_end;
  INSERT INTO public.activity(hotel_id,actor_id,message)
  VALUES(p_hotel,auth.uid(),'Employee started a work shift');
  PERFORM app_private.rebalance_work(p_hotel);
  RETURN v_end;
END
$function$;
REVOKE ALL ON FUNCTION public.begin_work_shift(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_work_shift(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_department_task(
  p_hotel uuid,p_task uuid,p_expected_version bigint
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_role text; v_task public.tasks%rowtype; v_meta public.guest_request_meta%rowtype;
  v_required_skill text; v_capacity integer; v_open_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to take a task' USING ERRCODE='42501'; END IF;
  SELECT m.role::text INTO v_role FROM public.memberships m
  WHERE m.hotel_id=p_hotel AND m.user_id=auth.uid() AND m.active;
  IF v_role IS NULL OR v_role NOT IN ('housekeeping','maintenance','frontdesk') THEN
    RAISE EXCEPTION 'Only active department staff can take tasks' USING ERRCODE='42501';
  END IF;
  IF NOT app_private.active_work_shift(p_hotel,auth.uid()) THEN
    RAISE EXCEPTION 'Start your work shift before taking a task' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_task FROM public.tasks t
  WHERE t.hotel_id=p_hotel AND t.id=p_task FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF v_task.version<>p_expected_version THEN
    RAISE EXCEPTION 'Task changed. Refresh and try again.' USING ERRCODE='40001';
  END IF;
  IF v_task.status<>'open' OR v_task.assigned_to IS NOT NULL THEN
    RAISE EXCEPTION 'This task is no longer available. Refresh the queue.' USING ERRCODE='40001';
  END IF;
  IF v_task.kind='guest' THEN
    SELECT * INTO v_meta FROM public.guest_request_meta g
    WHERE g.task_id=v_task.id AND g.hotel_id=p_hotel;
    IF NOT FOUND OR v_meta.department IS DISTINCT FROM v_role THEN
      RAISE EXCEPTION 'This request belongs to another department' USING ERRCODE='42501';
    END IF;
    v_required_skill:=CASE v_meta.category WHEN 'broken_ac' THEN 'ac' WHEN 'plumbing' THEN 'plumbing' ELSE NULL END;
    IF v_role='maintenance' AND v_required_skill IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.staff_dispatch s WHERE s.hotel_id=p_hotel AND s.user_id=auth.uid()
      AND v_required_skill=ANY(s.verified_skills)
    ) THEN RAISE EXCEPTION 'Your verified skills do not cover this request' USING ERRCODE='42501'; END IF;
  ELSIF NOT (
    (v_role='housekeeping' AND v_task.kind IN ('cleaning','supply','damage')) OR
    (v_role='maintenance' AND v_task.kind IN ('maintenance','damage'))
  ) THEN RAISE EXCEPTION 'This task belongs to another department' USING ERRCODE='42501';
  END IF;
  SELECT s.max_open_tasks INTO v_capacity FROM public.staff_dispatch s
  WHERE s.hotel_id=p_hotel AND s.user_id=auth.uid() AND s.on_shift AND s.shift_ends_at>now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Start your work shift before taking a task' USING ERRCODE='42501'; END IF;
  SELECT count(*) INTO v_open_count FROM public.tasks t
  WHERE t.hotel_id=p_hotel AND t.assigned_to=auth.uid() AND t.status IN ('open','doing','inspection');
  IF v_open_count>=v_capacity THEN
    RAISE EXCEPTION 'Your active task limit is reached. Complete a task or ask management to increase your capacity.';
  END IF;
  UPDATE public.tasks SET assigned_to=auth.uid(),version=version+1,updated_at=now() WHERE id=v_task.id;
  IF v_task.kind='guest' THEN
    UPDATE public.guest_request_meta SET assigned_at=now(),accepted_at=NULL,
      ack_deadline=now()+CASE WHEN urgent THEN interval '2 minutes' ELSE interval '5 minutes' END,
      escalated_at=NULL WHERE task_id=v_task.id;
  END IF;
  INSERT INTO public.activity(hotel_id,room_id,task_id,actor_id,message)
  VALUES(p_hotel,v_task.room_id,v_task.id,auth.uid(),'Employee claimed an available department task');
END
$function$;
REVOKE ALL ON FUNCTION public.claim_department_task(uuid,uuid,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_department_task(uuid,uuid,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.rebalance_after_task_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF (
    (OLD.status IN ('open','doing','inspection') AND NEW.status IN ('done','cancelled'))
    OR (OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL)
  ) THEN PERFORM app_private.rebalance_work(NEW.hotel_id); END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS casaflow_rebalance_released_work ON public.tasks;
CREATE TRIGGER casaflow_rebalance_released_work
AFTER UPDATE OF status,assigned_to ON public.tasks
FOR EACH ROW EXECUTE FUNCTION app_private.rebalance_after_task_release();
