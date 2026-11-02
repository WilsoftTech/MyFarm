-- Phase 7 record photos (D-P07-004). Apply after the activity and accounting runtime files and before browser lockdown.
-- Photos are append-only: the runtime role has no UPDATE or DELETE, so a photo lasts as long as its record.
BEGIN;
REVOKE ALL ON TABLE "RecordPhoto" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "RecordPhoto" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "RecordPhoto";
CREATE POLICY myfarm_server_read ON "RecordPhoto" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "RecordPhoto";
CREATE POLICY myfarm_server_create ON "RecordPhoto" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId"=fm."userId" AND m."organizationId"=fm."tenantId" JOIN "User" u ON u.id=fm."userId"
 WHERE fm."farmId"="RecordPhoto"."farmId" AND fm."tenantId"="RecordPhoto"."tenantId" AND fm."userId"="RecordPhoto"."createdBy" AND fm.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND u.status='ACTIVE')
 AND ("activityId" IS NULL OR EXISTS (SELECT 1 FROM "ProductionActivity" a WHERE a.id="RecordPhoto"."activityId" AND a."farmId"="RecordPhoto"."farmId" AND a."tenantId"="RecordPhoto"."tenantId"))
 AND ("accountingRecordId" IS NULL OR EXISTS (SELECT 1 FROM "AccountingRecord" r WHERE r.id="RecordPhoto"."accountingRecordId" AND r."farmId"="RecordPhoto"."farmId" AND r."tenantId"="RecordPhoto"."tenantId"))
);
-- A member may add objects under their own tenant's prefix, using their session, and nowhere else. No update or delete grant.
DROP POLICY IF EXISTS myfarm_scoped_private_insert ON storage.objects;
CREATE POLICY myfarm_scoped_private_insert ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'myfarm-private' AND myfarm_private.myfarm_can_read_storage(name));
COMMIT;
