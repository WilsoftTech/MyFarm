-- T008 consistency backstop. HTTP identity and read isolation remain application responsibilities.
BEGIN;
REVOKE ALL ON TABLE public."LivestockBatch" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE public."LivestockBatch" TO myfarm_runtime;

DROP POLICY IF EXISTS myfarm_server_livestock_batch_read ON public."LivestockBatch";
CREATE POLICY myfarm_server_livestock_batch_read ON public."LivestockBatch" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_livestock_batch_create ON public."LivestockBatch";
CREATE POLICY myfarm_server_livestock_batch_create ON public."LivestockBatch" FOR INSERT TO myfarm_runtime WITH CHECK (
  status = 'ACTIVE' AND version = 1
  AND EXISTS (
    SELECT 1 FROM public."FarmMember" fm
    JOIN public."Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId"
    JOIN public."User" u ON u.id = fm."userId"
    WHERE fm."farmId" = "LivestockBatch"."farmId" AND fm."tenantId" = "LivestockBatch"."tenantId"
      AND fm."userId" = "LivestockBatch"."createdBy" AND fm.status = 'ACTIVE'
      AND m.role = 'FARMER' AND m.status = 'ACTIVE' AND u.status = 'ACTIVE'
  )
  AND EXISTS (SELECT 1 FROM public."Enterprise" e WHERE e.id = "LivestockBatch"."enterpriseId" AND e."farmId" = "LivestockBatch"."farmId" AND e."tenantId" = "LivestockBatch"."tenantId" AND e.type = 'POULTRY' AND e.status = 'ACTIVE')
);
-- No UPDATE/DELETE privileges or security-definer functions; movements and closure are later scope.
COMMIT;
