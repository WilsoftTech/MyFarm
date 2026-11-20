-- D-P12-002: browser roles never access drafts; the server also scopes every lookup to actor and farm.
BEGIN;
REVOKE ALL ON TABLE "VoiceExpenseDraft" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "VoiceExpenseDraft" TO myfarm_runtime;
GRANT UPDATE ("review", "payloadHash", "version", "confirmedAt", "accountingRecordId") ON "VoiceExpenseDraft" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "VoiceExpenseDraft";
CREATE POLICY myfarm_server_read ON "VoiceExpenseDraft" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "VoiceExpenseDraft";
CREATE POLICY myfarm_server_create ON "VoiceExpenseDraft" FOR INSERT TO myfarm_runtime WITH CHECK (
  "createdAt" > now() - interval '1 minute' AND "createdAt" <= now() + interval '1 minute'
  AND "version" = 1 AND "confirmedAt" IS NULL AND "accountingRecordId" IS NULL
  AND EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId"
    JOIN "User" u ON u.id = fm."userId"
    WHERE fm."farmId" = "VoiceExpenseDraft"."farmId" AND fm."tenantId" = "VoiceExpenseDraft"."tenantId" AND fm."userId" = "VoiceExpenseDraft"."actorId"
    AND fm.status = 'ACTIVE' AND m.status = 'ACTIVE' AND m.role = 'FARMER' AND u.status = 'ACTIVE')
);
DROP POLICY IF EXISTS myfarm_server_update ON "VoiceExpenseDraft";
CREATE POLICY myfarm_server_update ON "VoiceExpenseDraft" FOR UPDATE TO myfarm_runtime
-- SELECT FOR UPDATE must also see completed/expired rows for safe receipt replay.
-- The immutable-state trigger refuses every actual update to those rows.
USING (true)
WITH CHECK (EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId"
  JOIN "User" u ON u.id = fm."userId"
  WHERE fm."farmId" = "VoiceExpenseDraft"."farmId" AND fm."tenantId" = "VoiceExpenseDraft"."tenantId" AND fm."userId" = "VoiceExpenseDraft"."actorId"
  AND fm.status = 'ACTIVE' AND m.status = 'ACTIVE' AND m.role = 'FARMER' AND u.status = 'ACTIVE'));
COMMIT;
