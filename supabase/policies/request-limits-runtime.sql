-- D-P09-014 request limits. Apply after runtime-role.sql (it creates myfarm_private) and before browser lockdown.
-- The app's role may read and add counts, and delete only counts older than a day; it never changes one.
BEGIN;
REVOKE ALL ON TABLE "RequestCount" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE "RequestCount" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "RequestCount";
CREATE POLICY myfarm_server_read ON "RequestCount" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "RequestCount";
CREATE POLICY myfarm_server_create ON "RequestCount" FOR INSERT TO myfarm_runtime WITH CHECK ("occurredAt" > now() - interval '1 minute');
DROP POLICY IF EXISTS myfarm_server_expire ON "RequestCount";
CREATE POLICY myfarm_server_expire ON "RequestCount" FOR DELETE TO myfarm_runtime USING ("occurredAt" < now() - interval '1 day');

-- One call per request, on the database clock, serialized per person and action. With record_it, the request is
-- counted when every window has room; a retry carrying a key already counted is let through free. Without record_it
-- it only checks, and a known key earns nothing, so reusing one request ID cannot get round a limit.
CREATE OR REPLACE FUNCTION myfarm_private.myfarm_take_request(who uuid, act text, request_key text, maxima integer[], windows integer[], record_it boolean)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  i integer;
  used bigint;
BEGIN
  IF who IS NULL OR act IS NULL OR maxima IS NULL OR windows IS NULL OR cardinality(maxima) = 0 OR cardinality(maxima) <> cardinality(windows) THEN
    RAISE EXCEPTION 'invalid request limit' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('request-limit:' || who::text || ':' || act, 0));
  IF record_it AND request_key IS NOT NULL AND EXISTS (SELECT 1 FROM "RequestCount" WHERE subject = who AND action = act AND "requestKey" = request_key) THEN
    RETURN true;
  END IF;
  FOR i IN 1 .. cardinality(maxima) LOOP
    SELECT count(*) INTO used FROM "RequestCount" WHERE subject = who AND action = act AND "occurredAt" > clock_timestamp() - make_interval(secs => windows[i]);
    IF used >= maxima[i] THEN RETURN false; END IF;
  END LOOP;
  IF record_it THEN
    INSERT INTO "RequestCount" (id, subject, action, "requestKey", "occurredAt") VALUES (gen_random_uuid(), who, act, request_key, clock_timestamp());
  END IF;
  DELETE FROM "RequestCount" WHERE id IN (SELECT id FROM "RequestCount" WHERE "occurredAt" < now() - interval '1 day' ORDER BY "occurredAt" LIMIT 100);
  RETURN true;
END
$$;
REVOKE ALL ON FUNCTION myfarm_private.myfarm_take_request(uuid, text, text, integer[], integer[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION myfarm_private.myfarm_take_request(uuid, text, text, integer[], integer[], boolean) TO myfarm_runtime;

-- Counts a request after the fact, such as a refused pilot code. The same key is counted once.
CREATE OR REPLACE FUNCTION myfarm_private.myfarm_note_request(who uuid, act text, request_key text)
RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public AS $$
  INSERT INTO "RequestCount" (id, subject, action, "requestKey", "occurredAt") VALUES (gen_random_uuid(), who, act, request_key, clock_timestamp())
  ON CONFLICT (subject, action, "requestKey") DO NOTHING
$$;
REVOKE ALL ON FUNCTION myfarm_private.myfarm_note_request(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION myfarm_private.myfarm_note_request(uuid, text, text) TO myfarm_runtime;
COMMIT;
