
DROP POLICY IF EXISTS "Authenticated admins view menu items" ON public.menu_items;
CREATE POLICY "Menu items are viewable by everyone"
  ON public.menu_items FOR SELECT
  USING (true);
