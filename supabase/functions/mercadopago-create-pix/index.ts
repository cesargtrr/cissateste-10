import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function maskToken(token: string): string {
  if (!token) return '****'
  const tail = token.slice(-4)
  const prefix = token.startsWith('APP_USR-') ? 'APP_USR-' : token.startsWith('TEST-') ? 'TEST-' : ''
  return `${prefix}****${tail}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const orderId = body?.order_id
    if (!orderId) {
      return jsonResponse({ error: 'order_id é obrigatório', fallback: true })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Load order
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, total_amount, customer_name, customer_whatsapp, payment_method')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return jsonResponse({ error: 'Pedido não encontrado', fallback: true })
    }

    // 2. Load active Mercado Pago credentials (first active row)
    const { data: settings, error: settingsErr } = await admin
      .from('payment_provider_settings')
      .select('access_token, environment, restaurant_id')
      .eq('provider', 'mercadopago')
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (settingsErr || !settings?.access_token) {
      return jsonResponse({
        error: 'Mercado Pago não configurado. Cadastre o Access Token nas configurações.',
        fallback: true,
      })
    }

    const accessToken = settings.access_token
    const restaurantId = settings.restaurant_id ?? null
    const orderTotal = Number(order.total_amount || 0)
    const requestedAmount = Number(body?.amount)
    const amount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : orderTotal

    console.log('[MP create-pix] amounts', {
      order_id: order.id,
      order_total: orderTotal,
      amount_sent_to_mercadopago: amount,
    })

    if (!amount || amount <= 0) {
      console.error('[MP create-pix] invalid amount, aborting', { order_id: order.id, amount })
      return jsonResponse({ error: 'Valor do pedido inválido (zero ou negativo).', fallback: true }, 400)
    }

    // 3. Check for existing active transaction to avoid duplicates (idempotency)
    const { data: existingTx } = await admin
      .from('payment_transactions')
      .select('*')
      .eq('order_id', order.id)
      .eq('status', 'awaiting_pix')
      .maybeSingle()

    if (existingTx) {
      console.log('[MP create-pix] Reusing existing transaction', existingTx.id)
      return jsonResponse({
        transaction_id: existingTx.id,
        qr_code: existingTx.pix_qr_code,
        pix_copy_paste: existingTx.pix_copy_paste,
        status: existingTx.status,
      })
    }

    const idempotencyKey = `order-${order.id}`
    const payload = {
      transaction_amount: Number(amount.toFixed(2)),
      description: `Pedido #${String(order.id).slice(0, 8).toUpperCase()}`,
      payment_method_id: 'pix',
      external_reference: order.id,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      payer: {
        email: 'cliente@oxente.com',
        first_name: (order.customer_name || 'Cliente').split(' ')[0] || 'Cliente',
      },
    }

    console.log('[MP create-pix] request', {
      endpoint: 'https://api.mercadopago.com/v1/payments',
      token: maskToken(accessToken),
      order_id: order.id,
      amount,
    })

    let mpResp: Response
    try {
      mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.error('[MP create-pix] network', (err as Error).message)
      return jsonResponse({ error: 'Erro de comunicação com Mercado Pago', fallback: true })
    }

    const mpData = await mpResp.json().catch(() => null) as any
    console.log('[MP create-pix] response', { status: mpResp.status, id: mpData?.id })

    if (!mpResp.ok || !mpData?.id) {
      let friendly = 'Falha ao gerar PIX'
      if (mpResp.status === 401) friendly = 'Credencial Mercado Pago inválida'
      else if (mpResp.status === 403) friendly = 'Permissão insuficiente no Mercado Pago'
      return jsonResponse({ error: friendly, fallback: true, status: mpResp.status })
    }

    const qrCode = mpData?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null
    const pixCopyPaste = mpData?.point_of_interaction?.transaction_data?.qr_code ?? null
    const gatewayAmount = Number(mpData?.transaction_amount ?? amount)

    if (!pixCopyPaste) {
      console.error('[MP create-pix] resposta sem qr_code', { id: mpData?.id })
      return jsonResponse({ error: 'Mercado Pago não retornou um código PIX válido', fallback: true }, 502)
    }

    // 4. Save transaction
    const { data: tx, error: txErr } = await admin
      .from('payment_transactions')
      .insert({
        order_id: order.id,
        restaurant_id: restaurantId,
        provider: 'mercadopago',
        provider_transaction_id: String(mpData.id),
        payment_method: 'pix',
        amount: gatewayAmount,
        status: 'awaiting_pix',
        pix_qr_code: qrCode,
        pix_copy_paste: pixCopyPaste,
      })
      .select('*')
      .single()

    if (txErr || !tx) {
      console.error('[MP create-pix] save tx error', txErr)
      return jsonResponse({ error: 'Falha ao salvar transação', fallback: true })
    }

    // Mark order as aguardando_pix
    await admin.from('orders').update({ status_financeiro: 'aguardando_pix' }).eq('id', order.id)

    return jsonResponse({
      transaction_id: tx.id,
      qr_code: qrCode,
      pix_copy_paste: pixCopyPaste,
      status: tx.status,
    })
  } catch (error) {
    console.error('[MP create-pix] unexpected', (error as Error).message)
    return jsonResponse({ error: 'Erro inesperado', fallback: true })
  }
})