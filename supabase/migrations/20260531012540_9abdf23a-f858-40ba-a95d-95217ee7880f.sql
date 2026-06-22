-- Remove broad SELECT policy on storage (public bucket already serves files via public URL without RLS)
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;

-- Revoke execute on has_role from public roles (RLS policies still work; they bypass grant checks)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
