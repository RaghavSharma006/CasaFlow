-- Preserve departmental task visibility while workers are offline.
-- This changes SELECT visibility only; existing shift and RPC write guards remain.

drop policy if exists guest_request_meta_read on public.guest_request_meta;
create policy guest_request_meta_read on public.guest_request_meta
for select to authenticated
using (app_private.can_access(hotel_id));

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
for select to authenticated
using (
  app_private.can_access(hotel_id)
  and (
    app_private.can_role(hotel_id, array['owner','manager']::public.staff_role[])
    or (
      app_private.can_role(hotel_id, array['frontdesk']::public.staff_role[])
      and kind = 'guest'
    )
    or (
      app_private.can_role(hotel_id, array['supervisor']::public.staff_role[])
      and kind = any(array['cleaning','supply','damage']::public.work_kind[])
    )
    or assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
    or (
      assigned_to is null
      and status in ('open','doing')
      and (
        (
          kind = any(array['cleaning','supply','damage']::public.work_kind[])
          and app_private.can_role(hotel_id, array['housekeeping']::public.staff_role[])
        )
        or (
          kind = any(array['maintenance','damage']::public.work_kind[])
          and app_private.can_role(hotel_id, array['maintenance']::public.staff_role[])
        )
        or (
          kind = 'guest'
          and exists (
            select 1 from public.guest_request_meta gm
            where gm.hotel_id = tasks.hotel_id and gm.task_id = tasks.id
              and (
                (gm.department = 'housekeeping'
                  and app_private.can_role(hotel_id, array['housekeeping']::public.staff_role[]))
                or
                (gm.department = 'maintenance'
                  and app_private.can_role(hotel_id, array['maintenance']::public.staff_role[])
                  and exists (
                    select 1 from public.staff_dispatch sd
                    where sd.hotel_id = tasks.hotel_id
                      and sd.user_id = (select auth.uid())
                      and (
                        (gm.category = 'broken_ac' and 'ac' = any(sd.verified_skills))
                        or (gm.category = 'plumbing' and 'plumbing' = any(sd.verified_skills))
                      )
                  )
                )
              )
          )
        )
      )
    )
  )
);

drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms
for select to authenticated
using (
  app_private.can_access(hotel_id)
  and (
    app_private.can_role(hotel_id, array['owner','manager','frontdesk','supervisor']::public.staff_role[])
    or exists (
      select 1 from public.tasks t
      where t.hotel_id = rooms.hotel_id and t.room_id = rooms.id
    )
  )
);
