-- Phase2 provider-only grants, after migration 202610090001_farmer_registry and runtime-role.sql.
-- One transaction and re-runnable. Application services authorize every request; these policies are defense
-- in depth that reject rows whose actor/owner columns contradict existing farmer, farm and membership rows.
-- The server supplies the actor (createdBy/updatedBy), so they check consistency, not who the caller is.
BEGIN;

-- Browser Supabase roles never read or write registry tables (Supabase default privileges grant them).
REVOKE ALL ON TABLE public."Farmer", public."FarmerProfile", public."Farm", public."Plot", public."FarmMember"
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public."Farmer", public."FarmerProfile", public."Farm", public."Plot", public."FarmMember" TO myfarm_runtime;
GRANT INSERT ON TABLE public."Farmer", public."FarmerProfile", public."Farm", public."Plot", public."FarmMember" TO myfarm_runtime;
-- Profile edits only; identifiers and creation time are immutable. No DELETE grant anywhere.
GRANT UPDATE ("name", "phone", "alternativePhone", "district", "subcounty", "village", "preferredLanguage", "ownershipType", "mainActivities", "version", "updatedAt", "updatedBy")
ON TABLE public."FarmerProfile" TO myfarm_runtime;
-- Farmer registration creates the actor's PERSONAL organization and FARMER membership (D-P02-002).
GRANT INSERT ON TABLE public."Organization", public."Membership" TO myfarm_runtime;

DROP POLICY IF EXISTS myfarm_server_personal_organization_create ON public."Organization";
CREATE POLICY myfarm_server_personal_organization_create ON public."Organization" FOR INSERT TO myfarm_runtime
WITH CHECK (kind = 'PERSONAL');

-- Only the first, FARMER-role membership of a PERSONAL organization; never joins an existing tenant or grants ADMIN/AGENT.
DROP POLICY IF EXISTS myfarm_server_personal_membership_create ON public."Membership";
CREATE POLICY myfarm_server_personal_membership_create ON public."Membership" FOR INSERT TO myfarm_runtime
WITH CHECK (
role = 'FARMER' AND status = 'ACTIVE'
AND EXISTS (SELECT 1 FROM public."Organization" o WHERE o.id = "organizationId" AND o.kind = 'PERSONAL')
AND NOT EXISTS (SELECT 1 FROM public."Membership" m WHERE m."organizationId" = "Membership"."organizationId")
);

DROP POLICY IF EXISTS myfarm_server_farmer_read ON public."Farmer";
CREATE POLICY myfarm_server_farmer_read ON public."Farmer" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_farmer_create ON public."Farmer";
CREATE POLICY myfarm_server_farmer_create ON public."Farmer" FOR INSERT TO myfarm_runtime
WITH CHECK (EXISTS (SELECT 1 FROM public."Membership" m WHERE m."userId" = "Farmer"."userId" AND m."organizationId" = "Farmer"."tenantId" AND m.role = 'FARMER' AND m.status = 'ACTIVE'));

DROP POLICY IF EXISTS myfarm_server_profile_read ON public."FarmerProfile";
CREATE POLICY myfarm_server_profile_read ON public."FarmerProfile" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_profile_create ON public."FarmerProfile";
CREATE POLICY myfarm_server_profile_create ON public."FarmerProfile" FOR INSERT TO myfarm_runtime
WITH CHECK (EXISTS (SELECT 1 FROM public."Farmer" f WHERE f.id = "farmerId" AND f."userId" = "updatedBy"));
DROP POLICY IF EXISTS myfarm_server_profile_update ON public."FarmerProfile";
CREATE POLICY myfarm_server_profile_update ON public."FarmerProfile" FOR UPDATE TO myfarm_runtime
USING (true)
WITH CHECK (EXISTS (SELECT 1 FROM public."Farmer" f WHERE f.id = "farmerId" AND f."userId" = "updatedBy"));

DROP POLICY IF EXISTS myfarm_server_farm_read ON public."Farm";
CREATE POLICY myfarm_server_farm_read ON public."Farm" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_farm_create ON public."Farm";
CREATE POLICY myfarm_server_farm_create ON public."Farm" FOR INSERT TO myfarm_runtime
WITH CHECK (EXISTS (SELECT 1 FROM public."Farmer" f JOIN public."Membership" m ON m."userId" = f."userId" AND m."organizationId" = f."tenantId"
WHERE f.id = "ownerFarmerId" AND f."tenantId" = "Farm"."tenantId" AND f."userId" = "createdBy" AND m.role = 'FARMER' AND m.status = 'ACTIVE'));

DROP POLICY IF EXISTS myfarm_server_farm_member_read ON public."FarmMember";
CREATE POLICY myfarm_server_farm_member_read ON public."FarmMember" FOR SELECT TO myfarm_runtime USING (true);
-- The farm owner becomes its first member; nobody can be added to a farm they do not own in Phase2.
DROP POLICY IF EXISTS myfarm_server_farm_member_create ON public."FarmMember";
CREATE POLICY myfarm_server_farm_member_create ON public."FarmMember" FOR INSERT TO myfarm_runtime
WITH CHECK (role = 'OWNER' AND status = 'ACTIVE' AND EXISTS (SELECT 1 FROM public."Farm" fa JOIN public."Farmer" f ON f.id = fa."ownerFarmerId"
WHERE fa.id = "farmId" AND fa."tenantId" = "FarmMember"."tenantId" AND f."userId" = "FarmMember"."userId"));

DROP POLICY IF EXISTS myfarm_server_plot_read ON public."Plot";
CREATE POLICY myfarm_server_plot_read ON public."Plot" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_plot_create ON public."Plot";
CREATE POLICY myfarm_server_plot_create ON public."Plot" FOR INSERT TO myfarm_runtime
WITH CHECK (EXISTS (SELECT 1 FROM public."FarmMember" fm WHERE fm."farmId" = "Plot"."farmId" AND fm."tenantId" = "Plot"."tenantId" AND fm."userId" = "createdBy" AND fm.status = 'ACTIVE'));
COMMIT;
