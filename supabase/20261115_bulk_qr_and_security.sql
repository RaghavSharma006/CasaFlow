-- Print-ready batch of physical room QR labels. Existing QR codes are never overwritten.
create or replace function public.issue_room_qrs_bulk(p_hotel uuid,p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; v_token text; v_out jsonb:='[]'::jsonb;
begin
 if not app_private.can_role(p_hotel,array['owner','manager','frontdesk']::public.staff_role[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_limit<1 or p_limit>60 then raise exception 'Print between 1 and 60 labels per batch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_hotel::text||':casaflow_bulk_qr',0));
 for r in select x.id,x.number from public.rooms x left join public.room_qr_codes c on c.room_id=x.id
  where x.hotel_id=p_hotel and c.room_id is null order by x.number limit p_limit loop
  v_token:=public.issue_room_qr(p_hotel,r.id,false);
  v_out:=v_out||jsonb_build_array(jsonb_build_object('room',r.number,'room_id',r.id,'token',v_token));
 end loop;
 return v_out;
end $$;
revoke all on function public.issue_room_qrs_bulk(uuid,integer) from public,anon,authenticated;
grant execute on function public.issue_room_qrs_bulk(uuid,integer) to authenticated;

-- Reception may close only alerts specifically addressed to reception.
create or replace function public.ack_guest_alert(p_hotel uuid,p_alert bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not app_private.can_role(p_hotel,array['owner','manager','frontdesk']::public.staff_role[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 update public.ops_alerts a set acknowledged_at=now()
 where a.hotel_id=p_hotel and a.id=p_alert
 and (app_private.can_role(p_hotel,array['owner','manager']::public.staff_role[]) or a.target in('frontdesk','both'));
end $$;
