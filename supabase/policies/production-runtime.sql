-- Phase3 T002, after the Enterprise/Season migration and runtime-role.sql; before browser lockdown.
-- The application is the actor/tenant authorization boundary, as with the registry.
-- These shared-role policies verify actor/scope consistency, not the authenticated caller's identity.
BEGIN;

REVOKE ALL ON TABLE public."Enterprise", public."Season" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public."Enterprise", public."Season" FROM myfarm_runtime;
GRANT SELECT, INSERT ON TABLE public."Enterprise", public."Season" TO myfarm_runtime;

DROP POLICY IF EXISTS myfarm_server_enterprise_read ON public."Enterprise";
CREATE POLICY myfarm_server_enterprise_read ON public."Enterprise" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_enterprise_create ON public."Enterprise";
CREATE POLICY myfarm_server_enterprise_create ON public."Enterprise" FOR INSERT TO myfarm_runtime
WITH CHECK (
  status = 'ACTIVE' AND version = 1 AND EXISTS (
    SELECT 1 FROM public."FarmMember" fm
    JOIN public."Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId"
    JOIN public."User" u ON u.id = fm."userId"
    WHERE fm."farmId" = "Enterprise"."farmId" AND fm."tenantId" = "Enterprise"."tenantId"
      AND fm."userId" = "Enterprise"."createdBy" AND fm.status = 'ACTIVE'
      AND m.role = 'FARMER' AND m.status = 'ACTIVE' AND u.status = 'ACTIVE'
  )
);

DROP POLICY IF EXISTS myfarm_server_season_read ON public."Season";
CREATE POLICY myfarm_server_season_read ON public."Season" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_season_create ON public."Season";
CREATE POLICY myfarm_server_season_create ON public."Season" FOR INSERT TO myfarm_runtime
WITH CHECK (
  status = 'ACTIVE' AND version = 1 AND EXISTS (
    SELECT 1 FROM public."FarmMember" fm
    JOIN public."Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId"
    JOIN public."User" u ON u.id = fm."userId"
    WHERE fm."farmId" = "Season"."farmId" AND fm."tenantId" = "Season"."tenantId"
      AND fm."userId" = "Season"."createdBy" AND fm.status = 'ACTIVE'
      AND m.role = 'FARMER' AND m.status = 'ACTIVE' AND u.status = 'ACTIVE'
  )
);

-- No update/delete/DDL grants. Closure or correction requires its own reviewed command.
COMMIT;
