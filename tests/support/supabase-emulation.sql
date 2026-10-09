-- TEST-ONLY stand-in for what a hosted Supabase project already provides before MyFarm provisioning runs.
-- It lets the real supabase/policies files execute on plain PostgreSQL. It is supplementary evidence only:
-- passing tests here do not prove hosted Supabase behaves the same way.
-- Modelled on the hosted dev project's catalog (read-only review, 2026-10-09). Re-runnable.
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN CREATE ROLE postgres NOLOGIN; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN CREATE ROLE supabase_storage_admin NOLOGIN; END IF;
END $$;

-- Auth: only the objects MyFarm's provider SQL reads.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS auth.sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id), not_after timestamptz);
-- Created only when missing, so a real Supabase image keeps its own definitions.
DO $$ BEGIN
IF to_regprocedure('auth.jwt()') IS NULL THEN
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
AS 'SELECT coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb';
END IF;
IF to_regprocedure('auth.uid()') IS NULL THEN
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS 'SELECT nullif(auth.jwt()->>''sub'', '''')::uuid';
END IF;
END $$;
-- As on hosted: owned by the auth service role, RLS on, readable by postgres (owner of MyFarm's definer functions).
ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;
ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON auth.users, auth.sessions TO postgres;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid() TO anon, authenticated, service_role;

-- Storage: bucket registry and object table with RLS, as the storage API provides.
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false, file_size_limit bigint);
CREATE TABLE IF NOT EXISTS storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text NOT NULL);
-- As on hosted: owned by the storage service role, RLS on, writable by postgres.
ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;
ALTER TABLE storage.objects OWNER TO supabase_storage_admin;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON storage.buckets, storage.objects TO postgres;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role, postgres;
GRANT SELECT ON storage.objects TO authenticated;

-- Supabase's default privileges in public: objects created by these roles grant browser roles everything.
-- The role running this file stands in for postgres, which runs `prisma migrate deploy` on hosted Supabase.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
DO $$
DECLARE creator name;
BEGIN
FOR creator IN SELECT unnest(ARRAY['postgres', 'supabase_admin', current_user]::name[]) LOOP
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role', creator);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role', creator);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role', creator);
END LOOP;
END $$;
