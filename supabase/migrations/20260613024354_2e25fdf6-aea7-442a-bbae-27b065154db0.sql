CREATE TABLE public.entregadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  tipo_veiculo TEXT,
  placa TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entregadores_restaurant ON public.entregadores(restaurant_id);
CREATE INDEX idx_entregadores_nome ON public.entregadores(nome);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregadores TO authenticated;
GRANT ALL ON public.entregadores TO service_role;

ALTER TABLE public.entregadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view entregadores"
  ON public.entregadores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert entregadores"
  ON public.entregadores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update entregadores"
  ON public.entregadores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete entregadores"
  ON public.entregadores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_entregadores_updated_at
  BEFORE UPDATE ON public.entregadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();