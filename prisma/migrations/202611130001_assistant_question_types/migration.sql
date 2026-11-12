BEGIN;
-- Phase 11 T005 (MYF-P11-R002): the seven question types from the source (P0627-P0633). Additive: existing rows keep
-- their type; a value can only be added, so a rollback before COMMIT leaves the type unchanged.
ALTER TYPE "AssistantIntent" ADD VALUE 'ASK_RECORDS';
ALTER TYPE "AssistantIntent" ADD VALUE 'EXPLAIN_PROFIT';
ALTER TYPE "AssistantIntent" ADD VALUE 'COMPARE_SEASONS';
ALTER TYPE "AssistantIntent" ADD VALUE 'SUMMARIZE';
ALTER TYPE "AssistantIntent" ADD VALUE 'UNUSUAL_COSTS';
ALTER TYPE "AssistantIntent" ADD VALUE 'UPCOMING_TASKS';
ALTER TYPE "AssistantIntent" ADD VALUE 'FARM_REPORT';
COMMIT;
