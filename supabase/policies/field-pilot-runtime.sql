-- Phase 9 field pilot (D-P09-001 to D-P09-009). Apply after runtime-role.sql (it creates myfarm_private) and the other
-- runtime files, and before browser lockdown.
-- Staff are ACTIVE ADMIN members of the ORGANIZATION running a cohort. A farmer joins under consent and may only withdraw;
-- a withdrawn participation leaves every update policy, so it can never be re-enrolled. Logs are append-only.
BEGIN;
-- True when the user may run cohorts for the organization: an active staff member of a real organization.
CREATE OR REPLACE FUNCTION myfarm_private.myfarm_is_pilot_staff(user_id uuid, organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "Membership" m JOIN "User" u ON u.id = m."userId" JOIN "Organization" o ON o.id = m."organizationId"
    WHERE m."userId" = user_id AND m."organizationId" = organization_id AND m.role = 'ADMIN' AND m.status = 'ACTIVE' AND u.status = 'ACTIVE' AND o.kind = 'ORGANIZATION')
$$;
REVOKE ALL ON FUNCTION myfarm_private.myfarm_is_pilot_staff(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION myfarm_private.myfarm_is_pilot_staff(uuid, uuid) TO myfarm_runtime;

REVOKE ALL ON TABLE "PilotCohort" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "PilotCohort" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "PilotCohort";
CREATE POLICY myfarm_server_read ON "PilotCohort" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "PilotCohort";
CREATE POLICY myfarm_server_create ON "PilotCohort" FOR INSERT TO myfarm_runtime WITH CHECK (
 status = 'ACTIVE' AND myfarm_private.myfarm_is_pilot_staff("createdBy", "tenantId")
);

REVOKE ALL ON TABLE "PilotParticipation" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "PilotParticipation" TO myfarm_runtime;
GRANT UPDATE (status, "withdrawnAt", "paperConsentRef", "paperConsentBy", version, "updatedAt") ON "PilotParticipation" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "PilotParticipation";
CREATE POLICY myfarm_server_read ON "PilotParticipation" FOR SELECT TO myfarm_runtime USING (true);
-- Only an active farmer joins, only an active cohort, and only under the cohort's current consent text.
DROP POLICY IF EXISTS myfarm_server_join ON "PilotParticipation";
CREATE POLICY myfarm_server_join ON "PilotParticipation" FOR INSERT TO myfarm_runtime WITH CHECK (
 status = 'ENROLLED' AND "withdrawnAt" IS NULL AND "paperConsentRef" IS NULL AND "paperConsentBy" IS NULL
 AND EXISTS (SELECT 1 FROM "PilotCohort" c WHERE c.id = "PilotParticipation"."cohortId" AND c."tenantId" = "PilotParticipation"."tenantId" AND c.status = 'ACTIVE' AND c."consentVersion" = "PilotParticipation"."consentVersion")
 AND EXISTS (SELECT 1 FROM "Membership" m JOIN "User" u ON u.id = m."userId" WHERE m."userId" = "PilotParticipation"."userId" AND m.role = 'FARMER' AND m.status = 'ACTIVE' AND u.status = 'ACTIVE')
);
-- Withdrawal is one-way: the row then leaves both update policies (D-P09-009).
DROP POLICY IF EXISTS myfarm_server_withdraw ON "PilotParticipation";
CREATE POLICY myfarm_server_withdraw ON "PilotParticipation" FOR UPDATE TO myfarm_runtime USING (status = 'ENROLLED') WITH CHECK (
 status = 'WITHDRAWN' AND "withdrawnAt" IS NOT NULL
);
DROP POLICY IF EXISTS myfarm_server_paper_consent ON "PilotParticipation";
CREATE POLICY myfarm_server_paper_consent ON "PilotParticipation" FOR UPDATE TO myfarm_runtime USING (status = 'ENROLLED') WITH CHECK (
 status = 'ENROLLED' AND "paperConsentBy" IS NOT NULL AND myfarm_private.myfarm_is_pilot_staff("paperConsentBy", "tenantId")
);

REVOKE ALL ON TABLE "PilotUsageEvent" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "PilotUsageEvent" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "PilotUsageEvent";
CREATE POLICY myfarm_server_read ON "PilotUsageEvent" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "PilotUsageEvent";
CREATE POLICY myfarm_server_create ON "PilotUsageEvent" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "Membership" m JOIN "User" u ON u.id = m."userId" WHERE m."userId" = "PilotUsageEvent"."actorId" AND m."organizationId" = "PilotUsageEvent"."tenantId" AND m.status = 'ACTIVE' AND u.status = 'ACTIVE')
);

REVOKE ALL ON TABLE "PilotPrompt" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "PilotPrompt" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "PilotPrompt";
CREATE POLICY myfarm_server_read ON "PilotPrompt" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "PilotPrompt";
CREATE POLICY myfarm_server_create ON "PilotPrompt" FOR INSERT TO myfarm_runtime WITH CHECK (
 myfarm_private.myfarm_is_pilot_staff("createdBy", "tenantId")
 AND EXISTS (SELECT 1 FROM "PilotParticipation" p WHERE p.id = "PilotPrompt"."participationId" AND p."tenantId" = "PilotPrompt"."tenantId" AND p."cohortId" = "PilotPrompt"."cohortId" AND p.status = 'ENROLLED')
);

REVOKE ALL ON TABLE "SupportIncident" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "SupportIncident" TO myfarm_runtime;
GRANT UPDATE (status, "resolvedOn", version, "updatedAt") ON "SupportIncident" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "SupportIncident";
CREATE POLICY myfarm_server_read ON "SupportIncident" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "SupportIncident";
CREATE POLICY myfarm_server_create ON "SupportIncident" FOR INSERT TO myfarm_runtime WITH CHECK (
 status = 'OPEN' AND myfarm_private.myfarm_is_pilot_staff("createdBy", "tenantId")
 AND ("participationId" IS NULL OR EXISTS (SELECT 1 FROM "PilotParticipation" p WHERE p.id = "SupportIncident"."participationId" AND p."tenantId" = "SupportIncident"."tenantId" AND p."cohortId" = "SupportIncident"."cohortId"))
);
-- Resolving is one-way, like finishing an activity.
DROP POLICY IF EXISTS myfarm_server_resolve ON "SupportIncident";
CREATE POLICY myfarm_server_resolve ON "SupportIncident" FOR UPDATE TO myfarm_runtime USING (status = 'OPEN') WITH CHECK (status = 'RESOLVED');

-- R002: observations, findings that must cite them, and append-only reviews. Staff only, same cohort throughout.
REVOKE ALL ON TABLE "PilotObservation" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "PilotObservation" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "PilotObservation";
CREATE POLICY myfarm_server_read ON "PilotObservation" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "PilotObservation";
CREATE POLICY myfarm_server_create ON "PilotObservation" FOR INSERT TO myfarm_runtime WITH CHECK (
 myfarm_private.myfarm_is_pilot_staff("createdBy", "tenantId")
 AND ("participationId" IS NULL OR EXISTS (SELECT 1 FROM "PilotParticipation" p WHERE p.id = "PilotObservation"."participationId" AND p."tenantId" = "PilotObservation"."tenantId" AND p."cohortId" = "PilotObservation"."cohortId" AND p.status = 'ENROLLED'))
);

REVOKE ALL ON TABLE "PilotFinding" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "PilotFinding" TO myfarm_runtime;
GRANT UPDATE (status, version, "updatedAt") ON "PilotFinding" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "PilotFinding";
CREATE POLICY myfarm_server_read ON "PilotFinding" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "PilotFinding";
CREATE POLICY myfarm_server_create ON "PilotFinding" FOR INSERT TO myfarm_runtime WITH CHECK (status = 'OPEN' AND myfarm_private.myfarm_is_pilot_staff("createdBy", "tenantId"));
-- Closing a finding is one-way.
DROP POLICY IF EXISTS myfarm_server_close ON "PilotFinding";
CREATE POLICY myfarm_server_close ON "PilotFinding" FOR UPDATE TO myfarm_runtime USING (status = 'OPEN') WITH CHECK (status IN ('ACTIONED', 'DISMISSED'));

REVOKE ALL ON TABLE "PilotFindingEvidence" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "PilotFindingEvidence" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "PilotFindingEvidence";
CREATE POLICY myfarm_server_read ON "PilotFindingEvidence" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "PilotFindingEvidence";
CREATE POLICY myfarm_server_create ON "PilotFindingEvidence" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS (SELECT 1 FROM "PilotFinding" f JOIN "PilotObservation" o ON o."cohortId" = f."cohortId" AND o."tenantId" = f."tenantId"
  WHERE f.id = "PilotFindingEvidence"."findingId" AND o.id = "PilotFindingEvidence"."observationId" AND f."tenantId" = "PilotFindingEvidence"."tenantId" AND f.status = 'OPEN')
);

REVOKE ALL ON TABLE "PilotReview" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON TABLE "PilotReview" TO myfarm_runtime;
DROP POLICY IF EXISTS myfarm_server_read ON "PilotReview";
CREATE POLICY myfarm_server_read ON "PilotReview" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_create ON "PilotReview";
CREATE POLICY myfarm_server_create ON "PilotReview" FOR INSERT TO myfarm_runtime WITH CHECK (myfarm_private.myfarm_is_pilot_staff("createdBy", "tenantId"));
COMMIT;
