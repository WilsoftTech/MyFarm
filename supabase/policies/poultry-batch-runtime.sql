-- T008 consistency backstop. HTTP identity and read isolation remain application responsibilities.
BEGIN;
REVOKE ALL ON TABLE public."PoultryBatch", public."AnimalTypeCatalog" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT ON TABLE public."AnimalTypeCatalog" TO myfarm_runtime;
GRANT SELECT, INSERT ON TABLE public."PoultryBatch" TO myfarm_runtime;

DROP POLICY IF EXISTS myfarm_server_animal_type_read ON public."AnimalTypeCatalog";
CREATE POLICY myfarm_server_animal_type_read ON public."AnimalTypeCatalog" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_poultry_batch_read ON public."PoultryBatch";
CREATE POLICY myfarm_server_poultry_batch_read ON public."PoultryBatch" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_poultry_batch_create ON public."PoultryBatch";
CREATE POLICY myfarm_server_poultry_batch_create ON public."PoultryBatch" FOR INSERT TO myfarm_runtime WITH CHECK (
  status = 'ACTIVE' AND version = 1
  AND EXISTS (
    SELECT 1 FROM public."FarmMember" fm
    JOIN public."Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId"
    JOIN public."User" u ON u.id = fm."userId"
    WHERE fm."farmId" = "PoultryBatch"."farmId" AND fm."tenantId" = "PoultryBatch"."tenantId"
      AND fm."userId" = "PoultryBatch"."createdBy" AND fm.status = 'ACTIVE'
      AND m.role = 'FARMER' AND m.status = 'ACTIVE' AND u.status = 'ACTIVE'
  )
  AND EXISTS (SELECT 1 FROM public."Enterprise" e WHERE e.id = "PoultryBatch"."enterpriseId" AND e."farmId" = "PoultryBatch"."farmId" AND e."tenantId" = "PoultryBatch"."tenantId" AND e.type = 'POULTRY' AND e.status = 'ACTIVE')
  AND EXISTS (SELECT 1 FROM public."AnimalTypeCatalog" c WHERE c.id = "PoultryBatch"."animalTypeId" AND c.active AND c.name = "PoultryBatch"."animalTypeName")
);
-- No UPDATE/DELETE/catalog administration privileges or security-definer functions.
COMMIT;
