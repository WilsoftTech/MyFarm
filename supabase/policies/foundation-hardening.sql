-- Provider-only hardening, after the Phase 1 foundation migration.
-- Application access stays server-side; browser roles cannot query the foundation tables.
REVOKE ALL ON TABLE public."User", public."Organization", public."Membership", public."AuditEvent"
FROM PUBLIC, anon, authenticated;

-- Supabase's existing RLS event trigger does not need browser RPC execution.
DO $$ BEGIN
IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
END IF;
END $$;
