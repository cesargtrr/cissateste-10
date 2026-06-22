-- Grant execute on has_role to essential roles
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated, anon, service_role;

-- Replace existing complex policies with simpler ones based on authentication
-- This ensures that any authenticated user can manage files in the bucket, 
-- bypassing potentially broken custom has_role logic within the Storage context if needed.

DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- New simplified policies
CREATE POLICY "Authenticated users can upload images" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update images" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete images" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'product-images');

-- Ensure public access for viewing remains
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Anyone can view images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');
