-- T002 consistency backstop. HTTP identity, read isolation, over-allocation (under per-obligation
-- advisory locks) and the exact sum of a payment's allocations remain application responsibilities.
BEGIN;
REVOKE ALL ON TABLE public."TransactionCategory", public."PaymentMethod", public."AccountingRecord", public."PaymentRecord", public."PaymentAllocation", public."AccountingReversal" FROM PUBLIC, anon, authenticated, myfarm_runtime;
GRANT SELECT ON TABLE public."TransactionCategory", public."PaymentMethod" TO myfarm_runtime;
GRANT SELECT, INSERT ON TABLE public."AccountingRecord", public."PaymentRecord", public."PaymentAllocation", public."AccountingReversal" TO myfarm_runtime;
-- Posted history is never edited; only the reversal status transition is updatable.
GRANT UPDATE (status, version, "updatedAt") ON public."AccountingRecord", public."PaymentRecord" TO myfarm_runtime;

DROP POLICY IF EXISTS myfarm_server_category_read ON public."TransactionCategory";
CREATE POLICY myfarm_server_category_read ON public."TransactionCategory" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_payment_method_read ON public."PaymentMethod";
CREATE POLICY myfarm_server_payment_method_read ON public."PaymentMethod" FOR SELECT TO myfarm_runtime USING (true);

DROP POLICY IF EXISTS myfarm_server_accounting_record_read ON public."AccountingRecord";
CREATE POLICY myfarm_server_accounting_record_read ON public."AccountingRecord" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_accounting_record_create ON public."AccountingRecord";
CREATE POLICY myfarm_server_accounting_record_create ON public."AccountingRecord" FOR INSERT TO myfarm_runtime WITH CHECK (
  status = 'POSTED' AND version = 1
  AND EXISTS (
    SELECT 1 FROM public."FarmMember" fm
    JOIN public."Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId"
    JOIN public."User" u ON u.id = fm."userId"
    WHERE fm."farmId" = "AccountingRecord"."farmId" AND fm."tenantId" = "AccountingRecord"."tenantId"
      AND fm."userId" = "AccountingRecord"."createdBy" AND fm.status = 'ACTIVE'
      AND m.role = 'FARMER' AND m.status = 'ACTIVE' AND u.status = 'ACTIVE'
  )
  AND EXISTS (
    SELECT 1 FROM public."TransactionCategory" c WHERE c.id = "AccountingRecord"."categoryId" AND c.active AND c.name = "AccountingRecord"."categoryName"
      AND c.kind = CASE WHEN "AccountingRecord".kind IN ('SALE', 'INCOME') THEN 'REVENUE'::public."TransactionCategoryKind" ELSE 'COST'::public."TransactionCategoryKind" END
  )
  AND ("paymentMethodId" IS NULL OR EXISTS (SELECT 1 FROM public."PaymentMethod" p WHERE p.id = "AccountingRecord"."paymentMethodId" AND p.active))
  AND ("plotId" IS NULL OR EXISTS (SELECT 1 FROM public."Plot" p WHERE p.id = "AccountingRecord"."plotId" AND p."farmId" = "AccountingRecord"."farmId" AND p."tenantId" = "AccountingRecord"."tenantId"))
  AND ("enterpriseId" IS NULL OR EXISTS (SELECT 1 FROM public."Enterprise" e WHERE e.id = "AccountingRecord"."enterpriseId" AND e."farmId" = "AccountingRecord"."farmId" AND e."tenantId" = "AccountingRecord"."tenantId"))
  AND ("seasonId" IS NULL OR EXISTS (SELECT 1 FROM public."Season" s WHERE s.id = "AccountingRecord"."seasonId" AND s."farmId" = "AccountingRecord"."farmId" AND s."tenantId" = "AccountingRecord"."tenantId"))
  -- D-P04-007: a CROP enterprise linked with a plot and/or season must match one of its crop cycles (any status).
  AND NOT (
    "enterpriseId" IS NOT NULL AND ("plotId" IS NOT NULL OR "seasonId" IS NOT NULL)
    AND EXISTS (SELECT 1 FROM public."Enterprise" e WHERE e.id = "AccountingRecord"."enterpriseId" AND e.type = 'CROP')
    AND NOT EXISTS (
      SELECT 1 FROM public."CropCycle" c
      WHERE c."enterpriseId" = "AccountingRecord"."enterpriseId" AND c."farmId" = "AccountingRecord"."farmId" AND c."tenantId" = "AccountingRecord"."tenantId"
        AND ("AccountingRecord"."plotId" IS NULL OR c."plotId" = "AccountingRecord"."plotId")
        AND ("AccountingRecord"."seasonId" IS NULL OR c."seasonId" = "AccountingRecord"."seasonId")
    )
  )
);
DROP POLICY IF EXISTS myfarm_server_accounting_record_reverse ON public."AccountingRecord";
CREATE POLICY myfarm_server_accounting_record_reverse ON public."AccountingRecord" FOR UPDATE TO myfarm_runtime
USING (status = 'POSTED') WITH CHECK (
  status = 'REVERSED'
  AND EXISTS (SELECT 1 FROM public."AccountingReversal" r WHERE r."recordId" = "AccountingRecord".id)
  AND NOT EXISTS (
    SELECT 1 FROM public."PaymentAllocation" a JOIN public."PaymentRecord" p ON p.id = a."paymentId"
    WHERE a."obligationId" = "AccountingRecord".id AND p.status = 'POSTED'
  )
);

DROP POLICY IF EXISTS myfarm_server_payment_read ON public."PaymentRecord";
CREATE POLICY myfarm_server_payment_read ON public."PaymentRecord" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_payment_create ON public."PaymentRecord";
CREATE POLICY myfarm_server_payment_create ON public."PaymentRecord" FOR INSERT TO myfarm_runtime WITH CHECK (
  status = 'POSTED' AND version = 1
  AND EXISTS (
    SELECT 1 FROM public."FarmMember" fm
    JOIN public."Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId"
    JOIN public."User" u ON u.id = fm."userId"
    WHERE fm."farmId" = "PaymentRecord"."farmId" AND fm."tenantId" = "PaymentRecord"."tenantId"
      AND fm."userId" = "PaymentRecord"."createdBy" AND fm.status = 'ACTIVE'
      AND m.role = 'FARMER' AND m.status = 'ACTIVE' AND u.status = 'ACTIVE'
  )
  AND EXISTS (SELECT 1 FROM public."PaymentMethod" p WHERE p.id = "PaymentRecord"."paymentMethodId" AND p.active)
);
DROP POLICY IF EXISTS myfarm_server_payment_reverse ON public."PaymentRecord";
CREATE POLICY myfarm_server_payment_reverse ON public."PaymentRecord" FOR UPDATE TO myfarm_runtime
USING (status = 'POSTED') WITH CHECK (
  status = 'REVERSED' AND EXISTS (SELECT 1 FROM public."AccountingReversal" r WHERE r."paymentId" = "PaymentRecord".id)
);

DROP POLICY IF EXISTS myfarm_server_payment_allocation_read ON public."PaymentAllocation";
CREATE POLICY myfarm_server_payment_allocation_read ON public."PaymentAllocation" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_payment_allocation_create ON public."PaymentAllocation";
CREATE POLICY myfarm_server_payment_allocation_create ON public."PaymentAllocation" FOR INSERT TO myfarm_runtime WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."PaymentRecord" p JOIN public."AccountingRecord" o ON o.id = "PaymentAllocation"."obligationId"
    WHERE p.id = "PaymentAllocation"."paymentId" AND p.status = 'POSTED' AND o.status = 'POSTED'
      AND p."farmId" = o."farmId" AND p."tenantId" = o."tenantId" AND p.currency = o.currency AND p."paidOn" >= o."occurredOn"
      AND ((p.direction = 'RECEIVED' AND o.kind = 'SALE') OR (p.direction = 'MADE' AND o.kind = 'PURCHASE'))
  )
);

DROP POLICY IF EXISTS myfarm_server_accounting_reversal_read ON public."AccountingReversal";
CREATE POLICY myfarm_server_accounting_reversal_read ON public."AccountingReversal" FOR SELECT TO myfarm_runtime USING (true);
DROP POLICY IF EXISTS myfarm_server_accounting_reversal_create ON public."AccountingReversal";
CREATE POLICY myfarm_server_accounting_reversal_create ON public."AccountingReversal" FOR INSERT TO myfarm_runtime WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."FarmMember" fm
    JOIN public."Membership" m ON m."userId" = fm."userId" AND m."organizationId" = fm."tenantId"
    JOIN public."User" u ON u.id = fm."userId"
    WHERE fm."farmId" = "AccountingReversal"."farmId" AND fm."tenantId" = "AccountingReversal"."tenantId"
      AND fm."userId" = "AccountingReversal"."createdBy" AND fm.status = 'ACTIVE'
      AND m.role = 'FARMER' AND m.status = 'ACTIVE' AND u.status = 'ACTIVE'
  )
  AND (
    EXISTS (SELECT 1 FROM public."AccountingRecord" r WHERE r.id = "AccountingReversal"."recordId" AND r.status = 'POSTED' AND r."farmId" = "AccountingReversal"."farmId" AND r."tenantId" = "AccountingReversal"."tenantId")
    OR EXISTS (SELECT 1 FROM public."PaymentRecord" p WHERE p.id = "AccountingReversal"."paymentId" AND p.status = 'POSTED' AND p."farmId" = "AccountingReversal"."farmId" AND p."tenantId" = "AccountingReversal"."tenantId")
  )
);
-- No DELETE, record-field updates, catalog administration privileges or security-definer functions.
COMMIT;
