## Fase 15 — Contas de Entregadores e Login Unificado

Antes de implementar, quero alinhar o plano porque essa fase mexe em auth, RLS, rotas admin e portal do entregador.

### 1. Limpeza de arquivos órfãos
- Remover `src/routes/admin/index.tsx (replacement)` (arquivo com espaço no nome, não usado pelo router, polui o build).

### 2. Backend — Edge Function para criar entregador com login
Criar `supabase/functions/admin-create-driver` (verify_jwt off, valida admin via `has_role` usando SERVICE_ROLE):
- Input: `{ name, phone, vehicle_type, plate, observacoes, active, email, password, restaurant_id }`
- Fluxo:
  1. Valida sessão do chamador (auth header) e confere `has_role(uid,'admin')`.
  2. `auth.admin.createUser({ email, password, email_confirm: true })`.
  3. Insere em `public.delivery_drivers` com `user_id` preenchido.
  4. Insere também em `public.delivery_driver_users` (mantendo compatibilidade com o portal atual).
  5. Retorna `{ driver_id, user_id }`.
- Endpoints irmãos: `admin-update-driver-email`, `admin-reset-driver-password` (gera link via `auth.admin.generateLink`), `admin-set-driver-active` (já existe via UPDATE no client; manter no client).

### 3. Migration — RLS e coluna user_id
- Garantir coluna `delivery_drivers.user_id uuid UNIQUE` (já pode existir; usar `IF NOT EXISTS`).
- Policies extras:
  - `select_own_driver`: `auth.uid() = user_id` (além das existentes de admin).
- Sem novas tabelas.

### 4. Modal "Novo Entregador" em `src/routes/admin/entregas.tsx`
- Adicionar seção **Dados de Acesso** (somente em criação, não em edição): email, senha, confirmar senha, checkbox "Enviar credenciais por WhatsApp".
- Submit:
  - Em criação: chama edge function `admin-create-driver`. Se WhatsApp marcado e telefone preenchido, abre `https://wa.me/<phone>?text=...` em nova aba com mensagem formatada.
  - Em edição: mantém UPDATE direto (sem mexer em auth). Botão extra "Resetar senha" chama `admin-reset-driver-password`.
- Ações por linha: ver Jornada (`/driver/jornada?driverId=`), Histórico (`/admin/entregas/relatorios?driverId=`), Mapa (`/admin/entregadores/mapa?driverId=`) — apenas links, reaproveitando rotas existentes.

### 5. Login unificado em `src/routes/admin/login.tsx`
- Após `signInWithPassword`:
  1. Busca em `delivery_drivers` por `user_id = uid`.
  2. Se achar e `active=true` → `navigate({ to: "/driver" })`.
  3. Se achar e `active=false` → `signOut` + toast "Conta desativada".
  4. Senão → checa `has_role(uid,'admin')`; se admin → `/admin`; senão → signOut + toast.
- Adicionar link "Esqueci minha senha" → input email + `resetPasswordForEmail(email, { redirectTo: origin + "/driver" })` (entregadores) e fluxo `/admin/login` para admins (mesma tela, decidido por contexto pós-login).
- Não remover a rota `/admin/login` (é a rota unificada). Remover qualquer rota `driver/login` separada se existir (não vi nenhuma; o login do entregador hoje está embutido em `/driver` — vou manter o formulário lá como fallback, mas redirecionar para `/admin/login` no botão principal).

### 6. Route guard
- Em `src/routes/admin.tsx` (layout admin): após `checkIsAdmin`, se o usuário também for entregador (linha em `delivery_drivers` com seu user_id) **e não for admin**, `navigate({ to: "/driver", replace: true })`. Admins que também são entregadores continuam no admin.
- Em `src/routes/driver.tsx`: se `active=false` → signOut e toast.

### 7. Página `/driver/profile`
- Nova rota `src/routes/driver.profile.tsx`: formulário Senha Atual / Nova / Confirmar.
- Reautentica com `signInWithPassword(email, currentPassword)` e depois `updateUser({ password: newPassword })`.
- Link no header do `/driver`.

### 8. Verificação
- `bunx vite build` deve passar.
- Testar criação de entregador na preview.

### Pontos para confirmar
1. **Restaurante**: o sistema parece single-tenant (uma linha em `restaurant_settings`). Posso pegar o primeiro `restaurant_id` automaticamente na edge function, certo?
2. **Admin existente também entregador**: devo permitir (não redirecionar) ou bloquear? Plano atual: permite, admin tem prioridade.
3. **Recuperação de senha**: posso usar a própria `/admin/login` como destino do `redirectTo` (mesma tela detecta `type=recovery` e mostra form de nova senha)?

Se confirmar (ou disser "ok"), implemento tudo de uma vez.