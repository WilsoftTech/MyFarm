-- Phase 14 T002: current explicit assignments, separate from owner-only FarmMember.
-- Runtime is server-only. Browser roles get no table or function access.
BEGIN;
REVOKE ALL ON "OfficerAssignment", "OfficerVisit", "OfficerFollowUp", "OfficerProblem" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT ON "OfficerAssignment", "OfficerVisit", "OfficerFollowUp", "OfficerProblem" TO myfarm_runtime;
GRANT INSERT ON "OfficerAssignment" TO myfarm_runtime;
GRANT UPDATE ("revokedAt",version,"updatedAt") ON "OfficerAssignment" TO myfarm_runtime;

CREATE OR REPLACE FUNCTION myfarm_private.officer_owner_active(owner_id uuid, farm_id uuid, tenant_id uuid, farmer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public."Farm" f JOIN public."Farmer" fr ON fr.id=f."ownerFarmerId" AND fr."tenantId"=f."tenantId"
 JOIN public."User" u ON u.id=fr."userId" JOIN public."Membership" m ON m."userId"=u.id AND m."organizationId"=f."tenantId"
 JOIN public."FarmMember" fm ON fm."userId"=u.id AND fm."farmId"=f.id AND fm."tenantId"=f."tenantId"
 WHERE f.id=farm_id AND f."tenantId"=tenant_id AND fr.id=farmer_id AND u.id=owner_id
 AND u.status='ACTIVE' AND m.status='ACTIVE' AND m.role='FARMER' AND fm.status='ACTIVE' AND fm.role='OWNER');
$$;
REVOKE ALL ON FUNCTION myfarm_private.officer_owner_active(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION myfarm_private.officer_owner_active(uuid,uuid,uuid,uuid) TO myfarm_runtime;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['OfficerAssignment','OfficerVisit','OfficerFollowUp','OfficerProblem'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS myfarm_server_read ON %I',tab);
  EXECUTE format('CREATE POLICY myfarm_server_read ON %I FOR SELECT TO myfarm_runtime USING (true)',tab);
 END LOOP;
END $$;
DROP POLICY IF EXISTS myfarm_server_create ON "OfficerAssignment";
CREATE POLICY myfarm_server_create ON "OfficerAssignment" FOR INSERT TO myfarm_runtime WITH CHECK (
 myfarm_private.officer_owner_active("grantedByOwnerId","farmId","tenantId","farmerId")
 AND "revokedAt" IS NULL AND version=1 AND "validFrom"<=clock_timestamp()
 AND EXISTS (SELECT 1 FROM "User" u JOIN "Membership" m ON m."userId"=u.id WHERE u.id="OfficerAssignment"."officerId" AND u.status='ACTIVE' AND m.status='ACTIVE' AND m.role='AGENT')
);
DROP POLICY IF EXISTS myfarm_server_revoke ON "OfficerAssignment";
CREATE POLICY myfarm_server_revoke ON "OfficerAssignment" FOR UPDATE TO myfarm_runtime USING (
 "revokedAt" IS NULL AND myfarm_private.officer_owner_active("grantedByOwnerId","farmId","tenantId","farmerId")
) WITH CHECK ("revokedAt" IS NOT NULL AND myfarm_private.officer_owner_active("grantedByOwnerId","farmId","tenantId","farmerId"));
CREATE OR REPLACE FUNCTION myfarm_private.officer_revoke_only() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Invalid assignment transition' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION myfarm_private.officer_revoke_only() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS officer_revoke_only ON "OfficerAssignment";
CREATE TRIGGER officer_revoke_only BEFORE UPDATE ON "OfficerAssignment" FOR EACH ROW EXECUTE FUNCTION myfarm_private.officer_revoke_only();
-- T004-T006 have not yet authorized visit/photo mutation policies.
COMMIT;
