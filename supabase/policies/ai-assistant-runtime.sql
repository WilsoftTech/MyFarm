-- Phase 11 farm assistant (D-P11-001 to D-P11-006). Apply after the production runtime files and before browser lockdown.
-- The app may add a question only for an active farmer member of the farm, asked just now, kept exactly 90 days; it may
-- read and delete questions (the server limits both to the person who asked) and never change one. Usage rows are only
-- added: a deleted question leaves its cost behind, with no text.
BEGIN;
REVOKE ALL ON TABLE "AssistantQuestion" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE "AssistantQuestion" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "AssistantQuestion";
CREATE POLICY myfarm_server_read ON "AssistantQuestion" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "AssistantQuestion";
CREATE POLICY myfarm_server_create ON "AssistantQuestion" FOR INSERT TO myfarm_runtime WITH CHECK (
 "createdAt" > now() - interval '1 minute' AND "createdAt" <= now() + interval '1 minute'
 AND EXISTS (SELECT 1 FROM "FarmMember" fm JOIN "Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId" JOIN "User" u ON u.id = fm."userId"
   WHERE fm."farmId" = "AssistantQuestion"."farmId" AND fm."tenantId" = "AssistantQuestion"."tenantId" AND fm."userId" = "AssistantQuestion"."actorId"
     AND fm.status = 'ACTIVE' AND m.status = 'ACTIVE' AND m.role = 'FARMER' AND u.status = 'ACTIVE')
);
DROP POLICY IF EXISTS myfarm_server_delete ON "AssistantQuestion";
CREATE POLICY myfarm_server_delete ON "AssistantQuestion" FOR DELETE TO myfarm_runtime USING (true);

REVOKE ALL ON TABLE "AssistantUsage" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "AssistantUsage" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "AssistantUsage";
CREATE POLICY myfarm_server_read ON "AssistantUsage" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "AssistantUsage";
CREATE POLICY myfarm_server_create ON "AssistantUsage" FOR INSERT TO myfarm_runtime WITH CHECK ("createdAt" > now() - interval '1 minute' AND "createdAt" <= now() + interval '1 minute');
COMMIT;
