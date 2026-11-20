-- Phase 13: a confirmed one-off activity date move, authorized and audited by the server.
BEGIN;
CREATE OR REPLACE FUNCTION public.myfarm_guard_weather_move() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user = 'myfarm_runtime' THEN
  IF NEW."dueOn" IS DISTINCT FROM OLD."dueOn" AND (OLD.status <> 'SCHEDULED' OR NEW.status <> 'SCHEDULED') THEN
   RAISE EXCEPTION 'Date changes require a scheduled activity' USING ERRCODE='23514';
  END IF;
  IF OLD.status='SCHEDULED' AND NEW.status='SCHEDULED' THEN
   IF OLD.type <> 'SPRAYING' OR OLD."recurrenceId" IS NOT NULL OR NEW."dueOn" = OLD."dueOn" OR NEW.version <> OLD.version+1
    OR (to_jsonb(NEW)-ARRAY['dueOn','version','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['dueOn','version','updatedAt']) THEN
    RAISE EXCEPTION 'A date move cannot edit other activity details' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.myfarm_guard_weather_move() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS myfarm_guard_weather_move ON "ProductionActivity";
CREATE TRIGGER myfarm_guard_weather_move BEFORE UPDATE ON "ProductionActivity" FOR EACH ROW EXECUTE FUNCTION public.myfarm_guard_weather_move();
GRANT UPDATE ("dueOn") ON "ProductionActivity" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_reschedule ON "ProductionActivity";
CREATE POLICY myfarm_server_reschedule ON "ProductionActivity" FOR UPDATE TO myfarm_runtime
USING (status='SCHEDULED' AND "recurrenceId" IS NULL AND type='SPRAYING')
WITH CHECK (status='SCHEDULED' AND "recurrenceId" IS NULL AND type='SPRAYING' AND "completedAt" IS NULL AND "cancelledAt" IS NULL
 AND ("costRecordId" IS NULL OR EXISTS (SELECT 1 FROM "AccountingRecord" r WHERE r.id="ProductionActivity"."costRecordId" AND r."farmId"="ProductionActivity"."farmId" AND r."tenantId"="ProductionActivity"."tenantId")));
COMMIT;
