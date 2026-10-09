-- Provider-only: browser Supabase roles (anon, authenticated) hold no privilege on objects in schema public,
-- today or for objects created later. MyFarm reads and writes application data only through the server
-- (myfarm_runtime); browsers never use the Data API for public tables.
-- Run last in the provisioning order, and again after every migration, as the role that runs
-- `prisma migrate deploy` (postgres on hosted Supabase). One transaction and re-runnable.
-- Kept on purpose: schema USAGE for browser roles, service_role privileges, and the Supabase-managed
-- auth/storage/graphql/realtime schemas. A future object meant for browsers must be granted explicitly
-- AND listed here first; otherwise the next run revokes it.
BEGIN;

-- 1. Default privileges. Every role that creates objects in public (owns one, or has default ACLs there),
--    plus the executing role, stops granting browser roles access to future tables, sequences and functions.
--    Functions also lose the built-in EXECUTE-to-PUBLIC default, which browser roles inherit.
--    Roles this session cannot act for are checked in step 3.
DO $$
DECLARE creator name;
BEGIN
FOR creator IN
  SELECT pg_get_userbyid(d.defaclrole) FROM pg_default_acl d WHERE d.defaclnamespace IN (0, 'public'::regnamespace)
  UNION SELECT pg_get_userbyid(c.relowner) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace
  UNION SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
  UNION SELECT current_user
LOOP
  IF pg_has_role(current_user, creator, 'MEMBER') THEN
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated', creator);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated', creator);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated', creator);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', creator);
  END IF;
END LOOP;
END $$;

-- 2. Existing objects, including Prisma's _prisma_migrations table.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 3. Postconditions. Any failure raises and rolls back the whole file.
DO $$
DECLARE leftover text;
BEGIN
-- No direct browser or PUBLIC grant on any relation in public.
SELECT string_agg(DISTINCT c.relname, ', ') INTO leftover
FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p','v','m','f','S')
AND (a.grantee = 0 OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated')));
IF leftover IS NOT NULL THEN RAISE EXCEPTION 'Browser roles still hold privileges on public relations: %', leftover; END IF;

-- No browser EXECUTE on any function in public (direct or through PUBLIC).
SELECT string_agg(DISTINCT p.oid::regprocedure::text, ', ') INTO leftover
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
IF leftover IS NOT NULL THEN RAISE EXCEPTION 'Browser roles can still execute public functions: %', leftover; END IF;

-- No role that already owns objects in public may still grant browser roles future access.
SELECT string_agg(DISTINCT pg_get_userbyid(d.defaclrole), ', ') INTO leftover
FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE d.defaclnamespace IN (0, 'public'::regnamespace)
AND a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated'))
AND (EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relowner = d.defaclrole)
  OR EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proowner = d.defaclrole)
  OR pg_has_role(current_user, d.defaclrole, 'MEMBER'));
IF leftover IS NOT NULL THEN RAISE EXCEPTION 'Default privileges still grant browser roles access for: %', leftover; END IF;

-- Creator roles this session cannot act for, and that own nothing in public yet, are reported, not hidden.
SELECT string_agg(DISTINCT pg_get_userbyid(d.defaclrole), ', ') INTO leftover
FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE d.defaclnamespace IN (0, 'public'::regnamespace)
AND a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated'));
IF leftover IS NOT NULL THEN
  RAISE WARNING 'Not changeable from this role (owns nothing in public yet; objects it creates there would grant browser roles access): %', leftover;
END IF;
END $$;
COMMIT;
