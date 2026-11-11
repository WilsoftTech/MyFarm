-- Phase 10 farm intelligence (D-P10-001 to D-P10-006). Apply after the production runtime files and before browser lockdown.
-- The server raises insights from the farm's own records; the app may only add them, acknowledge them as an active
-- farmer member of the farm, or clear them. The rule, its version and the evidence an insight was raised on never change.
BEGIN;
REVOKE ALL ON TABLE "FarmInsight" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "FarmInsight" TO myfarm_runtime;
GRANT UPDATE (status, "liveKey", "acknowledgedAt", "acknowledgedBy", "clearedOn", version, "updatedAt") ON "FarmInsight" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "FarmInsight";
CREATE POLICY myfarm_server_read ON "FarmInsight" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "FarmInsight";
CREATE POLICY myfarm_server_create ON "FarmInsight" FOR INSERT TO myfarm_runtime WITH CHECK (
 status = 'OPEN' AND version = 1 AND "acknowledgedAt" IS NULL AND "acknowledgedBy" IS NULL AND "clearedOn" IS NULL
 AND EXISTS (SELECT 1 FROM "PoultryBatch" b WHERE b.id = "FarmInsight"."batchId" AND b."farmId" = "FarmInsight"."farmId" AND b."tenantId" = "FarmInsight"."tenantId" AND b.status = 'ACTIVE')
);
-- A cleared insight leaves USING, so it can never be reopened or acknowledged.
DROP POLICY IF EXISTS myfarm_server_update ON "FarmInsight";
CREATE POLICY myfarm_server_update ON "FarmInsight" FOR UPDATE TO myfarm_runtime USING (status <> 'CLEARED') WITH CHECK (
 status = 'CLEARED'
 OR (status = 'ACKNOWLEDGED' AND EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId" JOIN "User" u ON u.id = fm."userId"
   WHERE fm."farmId" = "FarmInsight"."farmId" AND fm."tenantId" = "FarmInsight"."tenantId" AND fm."userId" = "FarmInsight"."acknowledgedBy" AND fm.status = 'ACTIVE' AND m.status = 'ACTIVE' AND m.role = 'FARMER' AND u.status = 'ACTIVE'))
);
COMMIT;
