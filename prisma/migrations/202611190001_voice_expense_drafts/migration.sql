BEGIN;
-- CreateTable
CREATE TABLE "VoiceExpenseDraft" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "review" JSONB NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP + '30 minutes'::interval),
    "confirmedAt" TIMESTAMPTZ(6),
    "accountingRecordId" UUID,

    CONSTRAINT "VoiceExpenseDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceExpenseDraft_accountingRecordId_key" ON "VoiceExpenseDraft"("accountingRecordId");

-- CreateIndex
CREATE INDEX "VoiceExpenseDraft_farmId_tenantId_idx" ON "VoiceExpenseDraft"("farmId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceExpenseDraft_actorId_requestId_key" ON "VoiceExpenseDraft"("actorId", "requestId");

-- AddForeignKey
ALTER TABLE "VoiceExpenseDraft" ADD CONSTRAINT "VoiceExpenseDraft_farmId_tenantId_fkey" FOREIGN KEY ("farmId", "tenantId") REFERENCES "Farm"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceExpenseDraft" ADD CONSTRAINT "VoiceExpenseDraft_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceExpenseDraft" ADD CONSTRAINT "VoiceExpenseDraft_accountingRecordId_farmId_tenantId_fkey" FOREIGN KEY ("accountingRecordId", "farmId", "tenantId") REFERENCES "AccountingRecord"("id", "farmId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- D-P12-002: scoped exact-payload confirmation; application validates the full versioned review.
ALTER TABLE "VoiceExpenseDraft" ADD CONSTRAINT "VoiceExpenseDraft_version_check" CHECK ("version" >= 1);
ALTER TABLE "VoiceExpenseDraft" ADD CONSTRAINT "VoiceExpenseDraft_expiry_check" CHECK ("expiresAt" = "createdAt" + interval '30 minutes');
ALTER TABLE "VoiceExpenseDraft" ADD CONSTRAINT "VoiceExpenseDraft_hash_check" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "VoiceExpenseDraft" ADD CONSTRAINT "VoiceExpenseDraft_review_check" CHECK (
  COALESCE(jsonb_typeof("review") = 'object' AND "review"->>'schemaVersion' = '1' AND "review"->>'kind' = 'EXPENSE'
  AND jsonb_typeof("review"->'command') = 'object' AND ("review"->'command'->>'requestId') = "requestId"::text
  AND NOT ("review" ?| ARRAY['transcript', 'audio', 'confirmed', 'actorId', 'tenantId', 'farmId']), false));
ALTER TABLE "VoiceExpenseDraft" ADD CONSTRAINT "VoiceExpenseDraft_confirmation_check" CHECK (
  ("confirmedAt" IS NULL AND "accountingRecordId" IS NULL) OR
  ("confirmedAt" IS NOT NULL AND "accountingRecordId" IS NOT NULL AND "confirmedAt" >= "createdAt" AND "confirmedAt" < "expiresAt"));

CREATE FUNCTION public.myfarm_guard_voice_draft() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."confirmedAt" IS NOT NULL OR OLD."expiresAt" <= clock_timestamp() THEN
    RAISE EXCEPTION 'Draft is no longer pending' USING ERRCODE = '23514';
  END IF;
  IF (NEW.id, NEW."tenantId", NEW."farmId", NEW."actorId", NEW."requestId", NEW."createdAt", NEW."expiresAt")
    IS DISTINCT FROM (OLD.id, OLD."tenantId", OLD."farmId", OLD."actorId", OLD."requestId", OLD."createdAt", OLD."expiresAt") THEN
    RAISE EXCEPTION 'Draft identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."confirmedAt" IS NOT NULL THEN
    IF (NEW."version", NEW."review", NEW."payloadHash") IS DISTINCT FROM (OLD."version", OLD."review", OLD."payloadHash") THEN
      RAISE EXCEPTION 'Confirmation cannot edit the review' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'Edits require a fresh version' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.myfarm_guard_voice_draft() FROM PUBLIC;
CREATE TRIGGER myfarm_guard_voice_draft BEFORE UPDATE ON "VoiceExpenseDraft" FOR EACH ROW EXECUTE FUNCTION public.myfarm_guard_voice_draft();
ALTER TABLE "VoiceExpenseDraft" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "VoiceExpenseDraft" FROM PUBLIC;

COMMIT;
