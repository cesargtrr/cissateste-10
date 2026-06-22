import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MP_ENDPOINT = 'https://api.mercadopago.com/users/me'

function maskToken(token: string): string {
  if (!token) return '****'
  const tail = token.slice(-4)
  const prefix = token.startsWith('APP_USR-')
    ? 'APP_USR-'
    : token.startsWith('TEST-')
    ? 'TEST-'
    : ''
  return `${prefix}****${tail}`
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Não autorizado' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      return jsonResponse({ success: false, error: 'Não autorizado' }, 401)
    }

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleRow) {
      return jsonResponse({ success: false, error: 'Permissão insuficiente' }, 403)
    }

    let payload: { accessToken?: string }
    try {
      payload = await req.json()
    } catch {
      return jsonResponse({ success: false, error: 'Requisição inválida' }, 400)
    }

    const accessToken = payload?.accessToken?.trim()
    if (!accessToken) {
      return jsonResponse({ success: false, error: 'Access Token é obrigatório' }, 400)
    }

    // Diagnostic log (token masked, never logged in full)
    console.log('[MP test-connection] request', {
      endpoint: MP_ENDPOINT,
      method: 'GET',
      token: maskToken(accessToken),
    })

    let mpResponse: Response
    try {
      mpResponse = await fetch(MP_ENDPOINT, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      })
    } catch (err) {
      console.error('[MP test-connection] network error:', (err as Error).message)
      return jsonResponse(
        { success: false, error: 'Erro de comunicação com Mercado Pago' },
        200,
      )
    }

    let data: any = null
    try {
      data = await mpResponse.json()
    } catch {
      data = null
    }

    console.log('[MP test-connection] response', {
      status: mpResponse.status,
      ok: mpResponse.ok,
      summary: data
        ? { id: data.id, nickname: data.nickname, site_id: data.site_id }
        : null,
    })

    if (!mpResponse.ok) {
      let friendly = 'Erro de comunicação com Mercado Pago'
      if (mpResponse.status === 401) friendly = 'Credencial inválida ou token expirado'
      else if (mpResponse.status === 403) friendly = 'Permissão insuficiente para este Access Token'
      else if (mpResponse.status === 400) friendly = 'Credencial inválida'
      return jsonResponse(
        { success: false, error: friendly, status: mpResponse.status },
        200,
      )
    }

    const accountName =
      `${data?.first_name ?? ''} ${data?.last_name ?? ''}`.trim() ||
      data?.nickname ||
      'Conta Mercado Pago'
    const accountEmail = data?.email ?? null

    return jsonResponse(
      {
        success: true,
        account_name: accountName,
        account_email: accountEmail,
        account: { name: accountName, email: accountEmail },
      },
      200,
    )
  } catch (error) {
    console.error('[MP test-connection] unexpected error:', (error as Error).message)
    return jsonResponse(
      { success: false, error: 'Erro de comunicação com Mercado Pago' },
      200,
    )
  }
})