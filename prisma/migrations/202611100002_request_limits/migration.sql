BEGIN;
-- D-P09-014: per-person request counts for abuse limits. Additive; rows older than a day are removed by the
-- runtime function in supabase/policies/request-limits-runtime.sql.
-- CreateTable
CREATE TABLE "RequestCount" (
    "id" UUID NOT NULL,
    "subject" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "requestKey" VARCHAR(128),
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestCount_subject_action_occurredAt_idx" ON "RequestCount"("subject", "action", "occurredAt");

-- CreateIndex
CREATE INDEX "RequestCount_occurredAt_idx" ON "RequestCount"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestCount_subject_action_requestKey_key" ON "RequestCount"("subject", "action", "requestKey");

ALTER TABLE "RequestCount" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "RequestCount" FROM PUBLIC;
COMMIT;
