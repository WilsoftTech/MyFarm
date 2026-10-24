-- T005 consistency backstop. HTTP identity and read isolation remain application responsibilities.
BEGIN;
REVOKE ALL ON TABLE public."CropCycle", public."CropCatalog" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT ON TABLE public."CropCatalog" TO myfarm_runtime;
GRANT SELECT, INSERT ON TABLE public."CropCycle" TO myfarm_runtime;

DROP POLICY IF EXISTS myfarm_server_crop_catalog_read ON public."CropCatalog";
CREATE POLICY myfarm_server_crop_catalog_read ON public."CropCatalog" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_crop_cycle_read ON public."CropCycle";
CREATE POLICY myfarm_server_crop_cycle_read ON public."CropCycle" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_crop_cycle_create ON public."CropCycle";
CREATE POLICY myfarm_server_crop_cycle_create ON public."CropCycle" FOR INSERT TO myfarm_runtime WITH CHECK (
  status = 'ACTIVE' AND version = 1
  AND EXISTS (
    SELECT 1 FROM public."FarmMember" fm
    JOIN public."Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId"
    JOIN public."User" u ON u.id = fm."userId"
    WHERE fm."farmId" = "CropCycle"."farmId" AND fm."tenantId" = "CropCycle"."tenantId"
      AND fm."userId" = "CropCycle"."createdBy" AND fm.status = 'ACTIVE'
      AND m.role = 'FARMER' AND m.status = 'ACTIVE' AND u.status = 'ACTIVE'
  )
  AND EXISTS (SELECT 1 FROM public."Enterprise" e WHERE e.id = "CropCycle"."enterpriseId" AND e."farmId" = "CropCycle"."farmId" AND e."tenantId" = "CropCycle"."tenantId" AND e.type = 'CROP' AND e.status = 'ACTIVE')
  AND EXISTS (SELECT 1 FROM public."Season" s WHERE s.id = "CropCycle"."seasonId" AND s."farmId" = "CropCycle"."farmId" AND s."tenantId" = "CropCycle"."tenantId" AND s.status = 'ACTIVE')
  AND EXISTS (SELECT 1 FROM public."CropCatalog" c WHERE c.id = "CropCycle"."cropId" AND c.active AND c.name = "CropCycle"."cropName")
);
-- No UPDATE/DELETE/catalog administration/Plot privileges or security-definer functions.
COMMIT;
