ALTER TABLE public.entregadores RENAME TO delivery_drivers;
ALTER TABLE public.delivery_drivers RENAME COLUMN nome TO name;
ALTER TABLE public.delivery_drivers RENAME COLUMN telefone TO phone;
ALTER TABLE public.delivery_drivers RENAME COLUMN ativo TO active;