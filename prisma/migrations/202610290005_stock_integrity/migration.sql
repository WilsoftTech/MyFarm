BEGIN;
-- numeric precision alone permits NaN; explicit finite bounds protect ledger arithmetic.
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_finite_check" CHECK (quantity <= 999999999999.999999 AND "lossQuantity" <= 999999999999.999999);
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_finite_check" CHECK (quantity <= 999999999999.999999);
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_finite_check" CHECK (quantity <= 999999999999.999999);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_finite_check" CHECK ("quantityDelta" BETWEEN -999999999999.999999 AND 999999999999.999999);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_date_check" CHECK ("occurredOn" BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');
ALTER TABLE "StockOperation" ADD CONSTRAINT "StockOperation_reversal_target_check" CHECK (type <> 'REVERSE' OR ("targetType" IS NOT NULL AND "targetId" IS NOT NULL));
COMMIT;
