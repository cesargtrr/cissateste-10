
-- Add tipo column to categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'produto'
  CHECK (tipo IN ('produto','adicional'));

-- Junction table for category -> allowed adicionais
CREATE TABLE IF NOT EXISTS public.categoria_adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  adicional_id uuid NOT NULL REFERENCES public.adicionais(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, adicional_id)
);

GRANT SELECT ON public.categoria_adicionais TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categoria_adicionais TO authenticated;
GRANT ALL ON public.categoria_adicionais TO service_role;

ALTER TABLE public.categoria_adicionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Category adicionais are viewable by everyone"
  ON public.categoria_adicionais FOR SELECT USING (true);

CREATE POLICY "Category adicionais are manageable by admins"
  ON public.categoria_adicionais FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
