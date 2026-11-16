-- Correct legacy CasaFlow pgcrypto schema references. Idempotent.
DO $fix$
DECLARE fn regprocedure; before_sql text; after_sql text; n int:=0;
BEGIN
 IF to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL OR to_regprocedure('extensions.digest(text,text)') IS NULL THEN RAISE EXCEPTION 'pgcrypto missing'; END IF;
 FOREACH fn IN ARRAY ARRAY['public.create_staff_invite(uuid,public.staff_role)'::regprocedure,'public.accept_staff_invite(text,text)'::regprocedure,'public.create_guest_pass(uuid,uuid)'::regprocedure,'public.guest_request(text,text,text)'::regprocedure]
 LOOP
  before_sql:=pg_get_functiondef(fn::oid);
  after_sql:=replace(replace(before_sql,'encode(gen_random_bytes(','encode(extensions.gen_random_bytes('),'encode(digest(','encode(extensions.digest(');
  IF before_sql<>after_sql THEN EXECUTE after_sql;n:=n+1;END IF;
 END LOOP;
END $fix$;
