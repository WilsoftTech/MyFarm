-- Phase 6 farm activities. Apply after the production and accounting runtime files and before browser lockdown.
-- Optional parents use single-column keys, so this policy also binds them to the activity's farm.
BEGIN;
REVOKE ALL ON TABLE "ProductionActivity" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "ProductionActivity" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "ProductionActivity";
CREATE POLICY myfarm_server_read ON "ProductionActivity" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "ProductionActivity";
CREATE POLICY myfarm_server_create ON "ProductionActivity" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="ProductionActivity"."farmId" AND fm."tenantId"="ProductionActivity"."tenantId" AND fm."userId"="ProductionActivity"."createdBy" AND fm.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
 AND ("enterpriseId" IS NULL OR EXISTS (SELECT 1 FROM "Enterprise" e WHERE e.id="ProductionActivity"."enterpriseId" AND e."farmId"="ProductionActivity"."farmId" AND e."tenantId"="ProductionActivity"."tenantId"))
 AND ("plotId" IS NULL OR EXISTS (SELECT 1 FROM "Plot" p WHERE p.id="ProductionActivity"."plotId" AND p."farmId"="ProductionActivity"."farmId" AND p."tenantId"="ProductionActivity"."tenantId"))
);
COMMIT;
