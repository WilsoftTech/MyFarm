-- Phase 14: shared server role; application services bind the verified actor.
BEGIN;
REVOKE ALL ON "OfficerRegistrationDraft", "OfficerVisitPhoto" FROM PUBLIC,anon,authenticated,myfarm_runtime;
GRANT SELECT,INSERT ON "OfficerRegistrationDraft", "OfficerVisitPhoto" TO myfarm_runtime;
GRANT DELETE ON "OfficerRegistrationDraft" TO myfarm_runtime;
GRANT UPDATE ("farmId","tenantId","acceptedAt",review,version) ON "OfficerRegistrationDraft" TO myfarm_runtime;
GRANT UPDATE ("uploadedAt") ON "OfficerVisitPhoto" TO myfarm_runtime;
GRANT INSERT ON "OfficerVisit","OfficerFollowUp","OfficerProblem" TO myfarm_runtime;
GRANT UPDATE (status,version,"updatedAt") ON "OfficerFollowUp" TO myfarm_runtime;
GRANT UPDATE (resolved,version,"updatedAt") ON "OfficerProblem" TO myfarm_runtime;
CREATE OR REPLACE FUNCTION myfarm_private.officer_assigned(assignment_id uuid, officer_id uuid, farm_id uuid, tenant_id uuid, capability text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public."OfficerAssignment" a
 WHERE a.id=assignment_id AND a."officerId"=officer_id AND a."farmId"=farm_id AND a."tenantId"=tenant_id
 AND a."revokedAt" IS NULL AND a."validFrom"<=clock_timestamp() AND (a."expiresAt" IS NULL OR a."expiresAt">clock_timestamp())
 AND a.permissions @> ARRAY['DASHBOARD',capability]::text[]
 AND myfarm_private.officer_owner_active(a."grantedByOwnerId",a."farmId",a."tenantId",a."farmerId")
 AND EXISTS(SELECT 1 FROM public."User" u JOIN public."Membership" m ON m."userId"=u.id WHERE u.id=officer_id AND u.status='ACTIVE' AND m.status='ACTIVE' AND m.role='AGENT'));
$$;
REVOKE ALL ON FUNCTION myfarm_private.officer_assigned(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION myfarm_private.officer_assigned(uuid,uuid,uuid,uuid,text) TO myfarm_runtime;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['OfficerRegistrationDraft','OfficerVisitPhoto'] LOOP
 EXECUTE format('DROP POLICY IF EXISTS myfarm_server_read ON %I',tab);
 EXECUTE format('CREATE POLICY myfarm_server_read ON %I FOR SELECT TO myfarm_runtime USING(true)',tab);
 END LOOP;
END $$;
DROP POLICY IF EXISTS myfarm_server_create ON "OfficerVisit";
CREATE POLICY myfarm_server_create ON "OfficerVisit" FOR INSERT TO myfarm_runtime WITH CHECK(myfarm_private.officer_assigned("assignmentId","officerId","farmId","tenantId",'VISITS'));
DO $$ DECLARE tab text; cap text; BEGIN
 FOREACH tab IN ARRAY ARRAY['OfficerFollowUp','OfficerProblem','OfficerVisitPhoto'] LOOP
 cap:=CASE WHEN tab='OfficerFollowUp' THEN 'FOLLOW_UPS' ELSE 'VISITS' END;
 EXECUTE format('DROP POLICY IF EXISTS myfarm_server_create ON %I',tab);
 EXECUTE format('CREATE POLICY myfarm_server_create ON %I FOR INSERT TO myfarm_runtime WITH CHECK(EXISTS(SELECT 1 FROM public."OfficerVisit" v WHERE v.id=%I."visitId" AND v."farmId"=%I."farmId" AND v."tenantId"=%I."tenantId" AND v."officerId"=%I."officerId" AND myfarm_private.officer_assigned(v."assignmentId",v."officerId",v."farmId",v."tenantId",%L)))',tab,tab,tab,tab,tab,cap);
 EXECUTE format('DROP POLICY IF EXISTS myfarm_server_finish ON %I',tab);
 EXECUTE format('CREATE POLICY myfarm_server_finish ON %I FOR UPDATE TO myfarm_runtime USING(EXISTS(SELECT 1 FROM public."OfficerVisit" v WHERE v.id=%I."visitId" AND myfarm_private.officer_assigned(v."assignmentId",v."officerId",v."farmId",v."tenantId",%L))) WITH CHECK(EXISTS(SELECT 1 FROM public."OfficerVisit" v WHERE v.id=%I."visitId" AND myfarm_private.officer_assigned(v."assignmentId",v."officerId",v."farmId",v."tenantId",%L)))',tab,tab,cap,tab,cap);
 END LOOP;
END $$;
DROP POLICY IF EXISTS myfarm_server_create ON "OfficerRegistrationDraft";
CREATE POLICY myfarm_server_create ON "OfficerRegistrationDraft" FOR INSERT TO myfarm_runtime WITH CHECK("farmId" IS NULL AND version=1 AND EXISTS(SELECT 1 FROM "Membership" m JOIN "User" u ON u.id=m."userId" WHERE u.id="officerId" AND u.status='ACTIVE' AND m."organizationId"="OfficerRegistrationDraft"."organizationId" AND m.status='ACTIVE' AND m.role='AGENT'));
DROP POLICY IF EXISTS myfarm_server_accept ON "OfficerRegistrationDraft";
CREATE POLICY myfarm_server_accept ON "OfficerRegistrationDraft" FOR UPDATE TO myfarm_runtime USING("farmId" IS NULL) WITH CHECK("farmId" IS NOT NULL AND EXISTS(SELECT 1 FROM "Farmer" f WHERE f."userId"="targetUserId" AND myfarm_private.officer_owner_active(f."userId","OfficerRegistrationDraft"."farmId","OfficerRegistrationDraft"."tenantId",f.id)));
DROP POLICY IF EXISTS myfarm_server_discard ON "OfficerRegistrationDraft";
CREATE POLICY myfarm_server_discard ON "OfficerRegistrationDraft" FOR DELETE TO myfarm_runtime USING("farmId" IS NULL);
CREATE OR REPLACE FUNCTION myfarm_private.officer_work_transition() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='OfficerFollowUp' THEN
 IF OLD.status<>'OPEN' OR NEW.status<>'COMPLETED' OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Invalid follow-up transition' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='OfficerProblem' THEN
 IF OLD.resolved OR NOT NEW.resolved OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Invalid problem transition' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='OfficerVisitPhoto' THEN
 IF OLD."uploadedAt" IS NOT NULL OR NEW."uploadedAt" IS NULL THEN RAISE EXCEPTION 'Invalid photo transition' USING ERRCODE='23514'; END IF;
 ELSE
 IF OLD."farmId" IS NOT NULL OR NEW."farmId" IS NULL OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Invalid consent transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION myfarm_private.officer_work_transition() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['OfficerFollowUp','OfficerProblem','OfficerVisitPhoto','OfficerRegistrationDraft'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS officer_work_transition ON %I',tab);
 EXECUTE format('CREATE TRIGGER officer_work_transition BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION myfarm_private.officer_work_transition()',tab);
 END LOOP;
END $$;
-- A dedicated namespace prevents collision with financial record photos.
CREATE OR REPLACE FUNCTION myfarm_private.officer_storage_access(object_name text, write_only boolean)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT object_name ~ '^[0-9a-f-]{36}/officer-visits/[0-9a-f-]{36}$'
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id::text=auth.jwt()->>'session_id' AND s.user_id=auth.uid() AND (s.not_after IS NULL OR s.not_after>now()))
 AND EXISTS(SELECT 1 FROM public."OfficerVisitPhoto" p JOIN public."OfficerVisit" v ON v.id=p."visitId"
 JOIN public."User" u ON u."authSubject"=auth.uid() AND u.status='ACTIVE'
 WHERE p.id::text=split_part(object_name,'/',3) AND p."tenantId"::text=split_part(object_name,'/',1)
 AND ((NOT write_only AND p."uploadedAt" IS NOT NULL AND EXISTS(SELECT 1 FROM public."Farm" f WHERE f.id=p."farmId" AND myfarm_private.officer_owner_active(u.id,f.id,f."tenantId",f."ownerFarmerId")))
 OR (p."officerId"=u.id AND ((write_only AND p."uploadedAt" IS NULL) OR (NOT write_only AND p."uploadedAt" IS NOT NULL)) AND myfarm_private.officer_assigned(v."assignmentId",u.id,p."farmId",p."tenantId",'VISITS'))));
$$;
REVOKE ALL ON FUNCTION myfarm_private.officer_storage_access(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION myfarm_private.officer_storage_access(text,boolean) TO authenticated;
DROP POLICY IF EXISTS myfarm_scoped_private_read ON storage.objects;
CREATE POLICY myfarm_scoped_private_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='myfarm-private' AND (myfarm_private.myfarm_can_read_storage(name) OR myfarm_private.officer_storage_access(name,false)));
DROP POLICY IF EXISTS myfarm_scoped_private_insert ON storage.objects;
CREATE POLICY myfarm_scoped_private_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='myfarm-private' AND (myfarm_private.myfarm_can_read_storage(name) OR myfarm_private.officer_storage_access(name,true)));
COMMIT;
