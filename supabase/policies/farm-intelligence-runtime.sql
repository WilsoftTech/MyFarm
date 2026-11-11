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
 AND (EXISTS (SELECT 1 FROM "PoultryBatch" b WHERE b.id = "FarmInsight"."batchId" AND b."farmId" = "FarmInsight"."farmId" AND b."tenantId" = "FarmInsight"."tenantId" AND b.status = 'ACTIVE')
   OR EXISTS (SELECT 1 FROM "CropCycle" c WHERE c.id = "FarmInsight"."cropCycleId" AND c."farmId" = "FarmInsight"."farmId" AND c."tenantId" = "FarmInsight"."tenantId" AND c.status = 'ACTIVE'))
);
-- A cleared insight leaves USING, so it can never be reopened or acknowledged.
DROP POLICY IF EXISTS myfarm_server_update ON "FarmInsight";
CREATE POLICY myfarm_server_update ON "FarmInsight" FOR UPDATE TO myfarm_runtime USING (status <> 'CLEARED') WITH CHECK (
 status = 'CLEARED'
 OR (status = 'ACKNOWLEDGED' AND EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId" JOIN "User" u ON u.id = fm."userId"
   WHERE fm."farmId" = "FarmInsight"."farmId" AND fm."tenantId" = "FarmInsight"."tenantId" AND fm."userId" = "FarmInsight"."acknowledgedBy" AND fm.status = 'ACTIVE' AND m.status = 'ACTIVE' AND m.role = 'FARMER' AND u.status = 'ACTIVE'))
);
-- The feed item of a batch (D-P10-007): an active farmer member of the farm links an active batch to a supply item of the
-- same farm. Changing it later is allowed; the link never moves stock.
REVOKE ALL ON TABLE "BatchFeedItem" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "BatchFeedItem" TO myfarm_runtime;
GRANT UPDATE ("itemId", version, "changedBy", "updatedAt") ON "BatchFeedItem" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "BatchFeedItem";
CREATE POLICY myfarm_server_read ON "BatchFeedItem" FOR SELECT TO myfarm_runtime USING (true);
CREATE OR REPLACE FUNCTION myfarm_private.myfarm_feed_link_allowed(link "BatchFeedItem")
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "PoultryBatch" b WHERE b.id = link."batchId" AND b."farmId" = link."farmId" AND b."tenantId" = link."tenantId" AND b.status = 'ACTIVE')
    AND EXISTS (SELECT 1 FROM "InventoryItem" i WHERE i.id = link."itemId" AND i."farmId" = link."farmId" AND i."tenantId" = link."tenantId" AND i.kind = 'SUPPLY')
    AND EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId" JOIN "User" u ON u.id = fm."userId"
      WHERE fm."farmId" = link."farmId" AND fm."tenantId" = link."tenantId" AND fm."userId" = link."changedBy" AND fm.status = 'ACTIVE' AND m.status = 'ACTIVE' AND m.role = 'FARMER' AND u.status = 'ACTIVE')
$$;
REVOKE ALL ON FUNCTION myfarm_private.myfarm_feed_link_allowed("BatchFeedItem") FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION myfarm_private.myfarm_feed_link_allowed("BatchFeedItem") TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_create ON "BatchFeedItem";
CREATE POLICY myfarm_server_create ON "BatchFeedItem" FOR INSERT TO myfarm_runtime WITH CHECK (version = 1 AND myfarm_private.myfarm_feed_link_allowed("BatchFeedItem"));
DROP POLICY IF EXISTS myfarm_server_update ON "BatchFeedItem";
CREATE POLICY myfarm_server_update ON "BatchFeedItem" FOR UPDATE TO myfarm_runtime USING (true) WITH CHECK (myfarm_private.myfarm_feed_link_allowed("BatchFeedItem"));
COMMIT;
