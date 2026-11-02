-- Phase 6 farm activities. Apply after the production and accounting runtime files and before browser lockdown.
-- Optional parents use single-column keys, so these policies also bind them to the activity's farm.
BEGIN;
REVOKE ALL ON TABLE "ProductionActivity" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "ProductionActivity" TO myfarm_runtime;
GRANT UPDATE (status, "workerName", notes, "costRecordId", "completedAt", "completedBy", "cancelledAt", "cancelledBy", "cancelReason", version, "updatedAt") ON "ProductionActivity" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "ProductionActivity";
CREATE POLICY myfarm_server_read ON "ProductionActivity" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "ProductionActivity";
CREATE POLICY myfarm_server_create ON "ProductionActivity" FOR INSERT TO myfarm_runtime WITH CHECK (
 status='SCHEDULED'
 AND EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="ProductionActivity"."farmId" AND fm."tenantId"="ProductionActivity"."tenantId" AND fm."userId"="ProductionActivity"."createdBy" AND fm.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
 AND ("enterpriseId" IS NULL OR EXISTS (SELECT 1 FROM "Enterprise" e WHERE e.id="ProductionActivity"."enterpriseId" AND e."farmId"="ProductionActivity"."farmId" AND e."tenantId"="ProductionActivity"."tenantId"))
 AND ("plotId" IS NULL OR EXISTS (SELECT 1 FROM "Plot" p WHERE p.id="ProductionActivity"."plotId" AND p."farmId"="ProductionActivity"."farmId" AND p."tenantId"="ProductionActivity"."tenantId"))
 AND ("costRecordId" IS NULL OR EXISTS (SELECT 1 FROM "AccountingRecord" r WHERE r.id="ProductionActivity"."costRecordId" AND r."farmId"="ProductionActivity"."farmId" AND r."tenantId"="ProductionActivity"."tenantId" AND r.kind IN ('EXPENSE','PURCHASE')))
);
-- Finishing is one-way: a completed or cancelled record leaves USING, so it cannot be reopened or rewritten.
DROP POLICY IF EXISTS myfarm_server_finish ON "ProductionActivity";
CREATE POLICY myfarm_server_finish ON "ProductionActivity" FOR UPDATE TO myfarm_runtime USING (status='SCHEDULED') WITH CHECK (
 status IN ('COMPLETED','CANCELLED')
 AND EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="ProductionActivity"."farmId" AND fm."tenantId"="ProductionActivity"."tenantId" AND fm."userId"=COALESCE("ProductionActivity"."completedBy","ProductionActivity"."cancelledBy") AND fm.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
 AND ("costRecordId" IS NULL OR EXISTS (SELECT 1 FROM "AccountingRecord" r WHERE r.id="ProductionActivity"."costRecordId" AND r."farmId"="ProductionActivity"."farmId" AND r."tenantId"="ProductionActivity"."tenantId" AND r.kind IN ('EXPENSE','PURCHASE')))
);
COMMIT;
