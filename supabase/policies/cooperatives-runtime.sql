-- Phase 15. Existing shared server role; application services enforce current caller scope.
-- No browser permissions, private farm role expansion, wallet or provider payment grants.
BEGIN;
REVOKE ALL ON "CooperativeMember", "CooperativeShare", "CooperativeForecast", "CooperativeLot", "CooperativeEntry", "CooperativeReceipt" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT, INSERT ON "CooperativeMember", "CooperativeShare", "CooperativeForecast", "CooperativeLot", "CooperativeEntry", "CooperativeReceipt" TO myfarm_runtime;
GRANT UPDATE (status, role, "invitedBy", version) ON "CooperativeMember" TO myfarm_runtime;
GRANT UPDATE ("revokedAt", version) ON "CooperativeShare" TO myfarm_runtime;
GRANT UPDATE ("cancelledAt", version) ON "CooperativeForecast" TO myfarm_runtime;
GRANT UPDATE (published, version) ON "CooperativeLot" TO myfarm_runtime;
GRANT INSERT ON "Organization" TO myfarm_runtime;
DROP POLICY IF EXISTS cooperative_organization_create ON "Organization";
CREATE POLICY cooperative_organization_create ON "Organization" FOR INSERT TO myfarm_runtime WITH CHECK (kind='ORGANIZATION');

CREATE OR REPLACE FUNCTION myfarm_private.cooperative_member_active(actor uuid, org uuid, roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public."CooperativeMember" m JOIN public."User" u ON u.id=m."userId" JOIN public."Organization" o ON o.id=m."organizationId"
 WHERE u.id=actor AND u.status='ACTIVE' AND o.id=org AND o.kind='ORGANIZATION' AND m.status='ACTIVE' AND m.role=ANY(roles));
$$;
REVOKE ALL ON FUNCTION myfarm_private.cooperative_member_active(uuid,uuid,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION myfarm_private.cooperative_member_active(uuid,uuid,text[]) TO myfarm_runtime;
CREATE OR REPLACE FUNCTION myfarm_private.cooperative_production_share(share_id uuid, org_id uuid, owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public."CooperativeShare" s JOIN public."Farm" f ON f.id=s."farmId" AND f."tenantId"=s."tenantId"
 WHERE s.id=share_id AND s."organizationId"=org_id AND s."revokedAt" IS NULL AND s."shareProduction"
 AND (owner_id IS NULL OR s."grantedBy"=owner_id)
 AND myfarm_private.cooperative_member_active(s."grantedBy",org_id,ARRAY['FARMER'])
 AND myfarm_private.officer_owner_active(s."grantedBy",f.id,f."tenantId",f."ownerFarmerId"));
$$;
REVOKE ALL ON FUNCTION myfarm_private.cooperative_production_share(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION myfarm_private.cooperative_production_share(uuid,uuid,uuid) TO myfarm_runtime;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['CooperativeMember','CooperativeShare','CooperativeForecast','CooperativeLot','CooperativeEntry','CooperativeReceipt'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS myfarm_server_read ON %I',tab);
  EXECUTE format('CREATE POLICY myfarm_server_read ON %I FOR SELECT TO myfarm_runtime USING (true)',tab);
 END LOOP;
END $$;
DROP POLICY IF EXISTS cooperative_member_insert ON "CooperativeMember";
CREATE POLICY cooperative_member_insert ON "CooperativeMember" FOR INSERT TO myfarm_runtime WITH CHECK (
 EXISTS(SELECT 1 FROM "User" u WHERE u.id="CooperativeMember"."userId" AND u.status='ACTIVE') AND
 ((status='INVITED' AND version=1 AND myfarm_private.cooperative_member_active("invitedBy","organizationId",ARRAY['MANAGER'])) OR
 (status='ACTIVE' AND role='MANAGER' AND "userId"="invitedBy" AND version=1
 AND EXISTS(SELECT 1 FROM "Organization" o WHERE o.id="CooperativeMember"."organizationId" AND o.kind='ORGANIZATION')
 AND NOT EXISTS(SELECT 1 FROM "CooperativeMember" m WHERE m."organizationId"="CooperativeMember"."organizationId")))
);
DROP POLICY IF EXISTS cooperative_member_update ON "CooperativeMember";
CREATE POLICY cooperative_member_update ON "CooperativeMember" FOR UPDATE TO myfarm_runtime USING (true) WITH CHECK (version>1);
DROP POLICY IF EXISTS cooperative_share_insert ON "CooperativeShare";
CREATE POLICY cooperative_share_insert ON "CooperativeShare" FOR INSERT TO myfarm_runtime WITH CHECK (
 version=1 AND "revokedAt" IS NULL AND myfarm_private.cooperative_member_active("grantedBy","organizationId",ARRAY['FARMER'])
 AND EXISTS(SELECT 1 FROM "Farm" f WHERE f.id="CooperativeShare"."farmId" AND f."tenantId"="CooperativeShare"."tenantId"
 AND myfarm_private.officer_owner_active("grantedBy",f.id,f."tenantId",f."ownerFarmerId"))
);
DROP POLICY IF EXISTS cooperative_share_update ON "CooperativeShare";
CREATE POLICY cooperative_share_update ON "CooperativeShare" FOR UPDATE TO myfarm_runtime USING ("revokedAt" IS NULL) WITH CHECK ("revokedAt" IS NOT NULL);
DROP POLICY IF EXISTS cooperative_forecast_insert ON "CooperativeForecast";
CREATE POLICY cooperative_forecast_insert ON "CooperativeForecast" FOR INSERT TO myfarm_runtime WITH CHECK (
 version=1 AND "cancelledAt" IS NULL AND myfarm_private.cooperative_member_active("createdBy","organizationId",ARRAY['FARMER'])
 AND myfarm_private.cooperative_production_share("shareId","organizationId","createdBy")
);
DROP POLICY IF EXISTS cooperative_forecast_update ON "CooperativeForecast";
CREATE POLICY cooperative_forecast_update ON "CooperativeForecast" FOR UPDATE TO myfarm_runtime USING ("cancelledAt" IS NULL) WITH CHECK ("cancelledAt" IS NOT NULL);
DROP POLICY IF EXISTS cooperative_lot_insert ON "CooperativeLot";
CREATE POLICY cooperative_lot_insert ON "CooperativeLot" FOR INSERT TO myfarm_runtime WITH CHECK (
 version=1 AND NOT published AND myfarm_private.cooperative_member_active("createdBy","organizationId",ARRAY['MANAGER'])
 AND myfarm_private.cooperative_production_share("shareId","organizationId",NULL)
 AND ("harvestId" IS NULL OR EXISTS(SELECT 1 FROM "Harvest" h JOIN "CooperativeShare" s ON s.id="CooperativeLot"."shareId" AND s."organizationId"="CooperativeLot"."organizationId"
 WHERE h.id="CooperativeLot"."harvestId" AND h."farmId"=s."farmId" AND h."tenantId"=s."tenantId" AND h.unit::text="CooperativeLot".unit AND h."cropName"="CooperativeLot".product AND h."harvestDate"<="CooperativeLot"."occurredOn"))
);
DROP POLICY IF EXISTS cooperative_lot_update ON "CooperativeLot";
CREATE POLICY cooperative_lot_update ON "CooperativeLot" FOR UPDATE TO myfarm_runtime USING (true) WITH CHECK (version>1);
DROP POLICY IF EXISTS cooperative_entry_insert ON "CooperativeEntry";
CREATE POLICY cooperative_entry_insert ON "CooperativeEntry" FOR INSERT TO myfarm_runtime WITH CHECK (myfarm_private.cooperative_member_active("createdBy","organizationId",ARRAY['MANAGER']));
DROP POLICY IF EXISTS cooperative_receipt_insert ON "CooperativeReceipt";
CREATE POLICY cooperative_receipt_insert ON "CooperativeReceipt" FOR INSERT TO myfarm_runtime WITH CHECK (EXISTS(SELECT 1 FROM "User" u WHERE u.id="actorId" AND u.status='ACTIVE'));

CREATE OR REPLACE FUNCTION myfarm_private.cooperative_transition() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Invalid cooperative version' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='CooperativeMember' THEN
  IF NOT ((OLD.status='INVITED' AND NEW.status IN ('ACTIVE','REVOKED') AND NEW.role=OLD.role AND NEW."invitedBy"=OLD."invitedBy") OR
          (OLD.status='ACTIVE' AND NEW.status='REVOKED' AND NEW.role=OLD.role AND NEW."invitedBy"=OLD."invitedBy") OR
          (OLD.status='REVOKED' AND NEW.status='INVITED')) THEN RAISE EXCEPTION 'Invalid membership transition' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='CooperativeShare' THEN
  IF OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL THEN RAISE EXCEPTION 'Invalid sharing transition' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='CooperativeForecast' THEN
  IF OLD."cancelledAt" IS NOT NULL OR NEW."cancelledAt" IS NULL THEN RAISE EXCEPTION 'Invalid forecast transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION myfarm_private.cooperative_transition() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['CooperativeMember','CooperativeShare','CooperativeForecast','CooperativeLot'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS cooperative_transition ON %I',tab);
  EXECUTE format('CREATE TRIGGER cooperative_transition BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION myfarm_private.cooperative_transition()',tab);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION myfarm_private.cooperative_reversal() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE original public."CooperativeEntry";
BEGIN
 IF NEW."reversalOfId" IS NOT NULL THEN
  SELECT * INTO original FROM public."CooperativeEntry" WHERE id=NEW."reversalOfId" AND "organizationId"=NEW."organizationId" AND "lotId"=NEW."lotId";
  IF NOT FOUND OR original."reversalOfId" IS NOT NULL OR original.kind<>NEW.kind OR original.location<>NEW.location OR original."occurredOn"<>NEW."occurredOn"
  OR original."quantityDelta"<>-NEW."quantityDelta" OR original."amountDelta"<>-NEW."amountDelta" THEN RAISE EXCEPTION 'Invalid cooperative reversal' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION myfarm_private.cooperative_reversal() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS cooperative_reversal ON "CooperativeEntry";
CREATE TRIGGER cooperative_reversal BEFORE INSERT ON "CooperativeEntry" FOR EACH ROW EXECUTE FUNCTION myfarm_private.cooperative_reversal();
COMMIT;
