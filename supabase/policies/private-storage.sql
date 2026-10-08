-- Reviewed development-project setup, NOT automatically executed by Prisma.
-- Run only after confirming the intended isolated Supabase project.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('myfarm-private', 'myfarm-private', false, 10485760)
ON CONFLICT (id) DO NOTHING;
-- Never convert an existing public bucket silently. Stop instead.
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'myfarm-private' AND public) THEN
RAISE EXCEPTION 'myfarm-private must be private; review existing bucket before use';
END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS myfarm_private;
REVOKE ALL ON SCHEMA myfarm_private FROM PUBLIC;
GRANT USAGE ON SCHEMA myfarm_private TO authenticated;
CREATE OR REPLACE FUNCTION myfarm_private.myfarm_can_read_storage(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
SELECT EXISTS (
SELECT 1 FROM auth.sessions s
WHERE s.id::text = auth.jwt()->>'session_id' AND s.user_id = auth.uid()
AND (s.not_after IS NULL OR s.not_after > now())
) AND EXISTS (
SELECT 1 FROM public."Membership" m JOIN public."User" u ON u.id = m."userId"
WHERE u."authSubject" = auth.uid() AND u.status = 'ACTIVE' AND m.status = 'ACTIVE'
AND m."organizationId"::text = split_part(object_name, '/', 1)
AND object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'
);
$$;
REVOKE ALL ON FUNCTION myfarm_private.myfarm_can_read_storage(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION myfarm_private.myfarm_can_read_storage(text) TO authenticated;
CREATE POLICY myfarm_scoped_private_read ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'myfarm-private' AND myfarm_private.myfarm_can_read_storage(name));
-- No browser upload/update/delete grant in Phase 1. Provision synthetic files using project administration only.
