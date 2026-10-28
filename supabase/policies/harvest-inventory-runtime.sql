BEGIN;
REVOKE ALL ON TABLE "StorageLocation" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "StorageLocation" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "StorageLocation";
CREATE POLICY myfarm_server_read ON "StorageLocation" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "StorageLocation";
CREATE POLICY myfarm_server_create ON "StorageLocation" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="StorageLocation"."farmId" AND fm."tenantId"="StorageLocation"."tenantId" AND fm."userId"="StorageLocation"."createdBy" AND fm.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
);
REVOKE ALL ON TABLE "InventoryItem" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "InventoryItem" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "InventoryItem";
CREATE POLICY myfarm_server_read ON "InventoryItem" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "InventoryItem";
CREATE POLICY myfarm_server_create ON "InventoryItem" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="InventoryItem"."farmId" AND fm."tenantId"="InventoryItem"."tenantId" AND fm."userId"="InventoryItem"."createdBy" AND fm.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
);
REVOKE ALL ON TABLE "Harvest" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "Harvest" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "Harvest";
CREATE POLICY myfarm_server_read ON "Harvest" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "Harvest";
CREATE POLICY myfarm_server_create ON "Harvest" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="Harvest"."farmId" AND fm."tenantId"="Harvest"."tenantId" AND fm."userId"="Harvest"."createdBy" AND fm.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
);
REVOKE ALL ON TABLE "StockMovement" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "StockMovement" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "StockMovement";
CREATE POLICY myfarm_server_read ON "StockMovement" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "StockMovement";
CREATE POLICY myfarm_server_create ON "StockMovement" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="StockMovement"."farmId" AND fm."tenantId"="StockMovement"."tenantId" AND fm."userId"="StockMovement"."createdBy" AND fm.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
);
REVOKE ALL ON TABLE "ProductionEvent" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "ProductionEvent" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "ProductionEvent";
CREATE POLICY myfarm_server_read ON "ProductionEvent" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "ProductionEvent";
CREATE POLICY myfarm_server_create ON "ProductionEvent" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="ProductionEvent"."farmId" AND fm."tenantId"="ProductionEvent"."tenantId" AND fm."userId"="ProductionEvent"."createdBy" AND fm.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
);
REVOKE ALL ON TABLE "StockOperation" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "StockOperation" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "StockOperation";
CREATE POLICY myfarm_server_read ON "StockOperation" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "StockOperation";
CREATE POLICY myfarm_server_create ON "StockOperation" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="StockOperation"."farmId" AND fm."tenantId"="StockOperation"."tenantId" AND fm."userId"="StockOperation"."createdBy" AND fm.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
);
REVOKE ALL ON TABLE "StockAdjustment" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "StockAdjustment" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "StockAdjustment";
CREATE POLICY myfarm_server_read ON "StockAdjustment" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "StockAdjustment";
CREATE POLICY myfarm_server_create ON "StockAdjustment" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="StockAdjustment"."farmId" AND fm."tenantId"="StockAdjustment"."tenantId" AND fm."userId"="StockAdjustment"."createdBy" AND fm.status='ACTIVE' AND fm.role='OWNER' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
);
COMMIT;
