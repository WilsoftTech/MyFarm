-- Phase3 final closure only. Apply after production/crop runtime files and before browser lockdown.
-- Actor authorization is enforced by the application, as for existing shared-runtime policies.
BEGIN;
GRANT UPDATE (status, version, "updatedAt") ON public."Season", public."CropCycle" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_season_close ON public."Season";
CREATE POLICY myfarm_server_season_close ON public."Season" FOR UPDATE TO myfarm_runtime
USING (status = 'ACTIVE') WITH CHECK (status = 'CLOSED' AND NOT EXISTS (
  SELECT 1 FROM public."CropCycle" c WHERE c."seasonId" = "Season".id AND c.status = 'ACTIVE'
));
DROP POLICY IF EXISTS myfarm_server_crop_cycle_close ON public."CropCycle";
CREATE POLICY myfarm_server_crop_cycle_close ON public."CropCycle" FOR UPDATE TO myfarm_runtime
USING (status = 'ACTIVE') WITH CHECK (status = 'CLOSED');
-- No reopening, record-field updates, table-wide UPDATE or DELETE grants.
COMMIT;
