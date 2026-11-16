-- Authenticated owner/manager bulk import. One atomic statement, no row-by-row client calls.
-- Validates size, skips duplicates, and does not reveal or modify another tenant.
create or replace function public.bulk_add_rooms(
  p_hotel uuid,
  p_start integer,
  p_end integer,
  p_floor text default null,
  p_kind text default 'Standard',
  p_pad integer default 0
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare inserted_count integer;
begin
 if auth.uid() is null or not app_private.can_role(p_hotel,array['owner','manager']::public.staff_role[])
 then raise exception 'Only hotel management can add rooms' using errcode='42501'; end if;
 if p_start is null or p_end is null or p_start < 1 or p_end < p_start or p_end > 999999
    or (p_end::bigint - p_start::bigint + 1) > 2000
 then raise exception 'Choose a room range of 1 to 2000 numbers' using errcode='22023'; end if;
 if p_pad is null or p_pad < 0 or p_pad > 6 then
    raise exception 'Room padding must be between 0 and 6' using errcode='22023'; end if;
 if p_kind is null or length(trim(p_kind)) < 1 or length(trim(p_kind)) > 60
 then raise exception 'Room type must be between 1 and 60 characters' using errcode='22023'; end if;
 if p_floor is not null and length(trim(p_floor)) > 30
 then raise exception 'Floor label too long' using errcode='22023'; end if;
 insert into public.rooms(hotel_id,number,floor,kind,status)
 select p_hotel,
   lpad(s.n::text, greatest(p_pad,length(s.n::text)), '0'),
   case when nullif(trim(coalesce(p_floor,'')),'') is null
     then case when s.n >= 100 then (s.n/100)::text else '1' end
     else trim(p_floor) end,
   trim(p_kind), 'ready'::public.room_state
 from pg_catalog.generate_series(p_start,p_end) as s(n)
 on conflict(hotel_id,number) do nothing;
 get diagnostics inserted_count = row_count;
 insert into public.activity(hotel_id,actor_id,message)
 values(p_hotel,auth.uid(),inserted_count::text||' rooms bulk-created');
 return jsonb_build_object('requested',p_end-p_start+1,'added',inserted_count,
    'skipped',p_end-p_start+1-inserted_count);
end $$;
revoke all on function public.bulk_add_rooms(uuid,integer,integer,text,text,integer) from public,anon,authenticated;
grant execute on function public.bulk_add_rooms(uuid,integer,integer,text,text,integer) to authenticated;
