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
CREATE OR REPLACE FUNCTION public.myfarm_can_read_storage(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
SELECT EXISTS (
SELECT 1 FROM public."Membership" m JOIN public."User" u ON u.id = m."userId"
WHERE u."authSubject" = auth.uid() AND u.status = 'ACTIVE' AND m.status = 'ACTIVE'
AND m."organizationId"::text = split_part(object_name, '/', 1)
AND object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'
);
$$;
REVOKE ALL ON FUNCTION public.myfarm_can_read_storage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.myfarm_can_read_storage(text) TO authenticated;
CREATE POLICY myfarm_scoped_private_read ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'myfarm-private' AND public.myfarm_can_read_storage(name));
-- No browser upload/update/delete grant in Phase 1. Provision synthetic files using project administration only.
