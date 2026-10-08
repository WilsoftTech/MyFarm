-- Provider-only server role. NOLOGIN until an operator configures an isolated credential.
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='myfarm_runtime') THEN
CREATE ROLE myfarm_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
END IF;
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='myfarm_runtime' AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)) THEN
RAISE EXCEPTION 'Existing myfarm_runtime role has excessive privileges';
END IF;
END $$;
-- The existing database administrator may assume this narrower role for verification.
GRANT myfarm_runtime TO postgres;
GRANT USAGE ON SCHEMA public, myfarm_private TO myfarm_runtime;
GRANT SELECT ON TABLE public."User", public."Organization", public."Membership", public."AuditEvent" TO myfarm_runtime;
GRANT INSERT ON TABLE public."AuditEvent" TO myfarm_runtime;
CREATE POLICY myfarm_server_user_read ON public."User" FOR SELECT TO myfarm_runtime USING (true);
CREATE POLICY myfarm_server_organization_read ON public."Organization" FOR SELECT TO myfarm_runtime USING (true);
CREATE POLICY myfarm_server_membership_read ON public."Membership" FOR SELECT TO myfarm_runtime USING (true);
CREATE POLICY myfarm_server_audit_read ON public."AuditEvent" FOR SELECT TO myfarm_runtime USING (true);
CREATE POLICY myfarm_server_audit_append ON public."AuditEvent" FOR INSERT TO myfarm_runtime WITH CHECK (true);

-- Session rows remain inaccessible to the runtime/browser roles.
-- The caller supplies IDs derived exclusively from verified Supabase identity/claims.
CREATE OR REPLACE FUNCTION myfarm_private.myfarm_session_is_active(session_id uuid, subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
SELECT EXISTS (SELECT 1 FROM auth.sessions s
WHERE s.id=session_id AND s.user_id=subject_id
AND (s.not_after IS NULL OR s.not_after > now()));
$$;
REVOKE ALL ON FUNCTION myfarm_private.myfarm_session_is_active(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION myfarm_private.myfarm_session_is_active(uuid,uuid) TO myfarm_runtime;
-- Scope and account authorization still run in application services on every request.
-- No account/membership mutation, schema administration or audit update/delete grant.
