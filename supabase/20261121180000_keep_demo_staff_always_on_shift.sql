-- Demo-only staff remain available for an uninterrupted product walkthrough.
-- Live hotel staff continue to use normal scheduled shifts and capacity limits.
DO $$
DECLARE v_hotel uuid;
BEGIN
  FOR v_hotel IN
    SELECT DISTINCT hotel_id FROM public.memberships
    WHERE active AND display_name IN (
      'Demo AC Technician','Demo Plumbing Technician','Demo Cleaner 1','Demo Cleaner 2'
    )
  LOOP
    UPDATE public.staff_dispatch s
    SET on_shift=true,
        shift_started_at=coalesce(s.shift_started_at,now()),
        shift_ends_at='infinity'::timestamptz,
        shift_duration_minutes=720,
        max_open_tasks=10,
        updated_at=now()
    FROM public.memberships m
    WHERE m.hotel_id=v_hotel AND m.user_id=s.user_id
      AND s.hotel_id=v_hotel AND m.active
      AND m.display_name IN (
        'Demo AC Technician','Demo Plumbing Technician','Demo Cleaner 1','Demo Cleaner 2'
      );
    PERFORM app_private.rebalance_work(v_hotel);
  END LOOP;
END
$$;
