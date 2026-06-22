
ALTER TABLE public.adicionais ADD COLUMN IF NOT EXISTS category_id uuid;
CREATE INDEX IF NOT EXISTS adicionais_category_id_idx ON public.adicionais(category_id);

CREATE TABLE IF NOT EXISTS public.produto_grupos_adicionais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id uuid NOT NULL,
  category_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, category_id)
);

GRANT SELECT ON public.produto_grupos_adicionais TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_grupos_adicionais TO authenticated;
GRANT ALL ON public.produto_grupos_adicionais TO service_role;

ALTER TABLE public.produto_grupos_adicionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produto grupos viewable by everyone"
  ON public.produto_grupos_adicionais FOR SELECT
  USING (true);

CREATE POLICY "Produto grupos manageable by admins"
  ON public.produto_grupos_adicionais FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
