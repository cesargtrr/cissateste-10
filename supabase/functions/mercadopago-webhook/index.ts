import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
}

function ok(body: unknown = { received: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function mapStatus(s: string): string {
  switch (s) {
    case 'approved': return 'paid'
    case 'pending':
    case 'in_process': return 'awaiting_pix'
    case 'cancelled': return 'cancelled'
    case 'rejected': return 'cancelled'
    case 'refunded':
    case 'charged_back': return 'refunded'
    case 'expired': return 'expired'
    default: return s || 'pending'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const body = await req.json().catch(() => ({} as any))

    // Mercado Pago sends: { type/topic, data: { id } } or query ?type=payment&data.id=...
    const type = body?.type || body?.topic || url.searchParams.get('type') || url.searchParams.get('topic')
    const paymentId =
      body?.data?.id ||
      body?.resource ||
      url.searchParams.get('data.id') ||
      url.searchParams.get('id')

    console.log('[MP webhook]', { type, paymentId })

    if (!paymentId || (type && !String(type).includes('payment'))) {
      return ok({ ignored: true })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Find transaction to discover restaurant + credentials.
    // Keep this query flat: selecting unrelated nested tables can fail and make
    // the webhook insert a duplicate transaction instead of confirming the order.
    const { data: transactions, error: txError } = await admin
      .from('payment_transactions')
      .select('*')
      .eq('provider', 'mercadopago')
      .eq('provider_transaction_id', String(paymentId))
      .order('created_at', { ascending: true })

    if (txError) {
      console.error('[MP webhook] transaction lookup failed', txError.message)
    }

    const tx = transactions?.[0] ?? null

    // Use credentials from the transaction's restaurant if available, fallback to default active
    const restaurantId = tx?.restaurant_id
    
    let settingsQuery = admin
      .from('payment_provider_settings')
      .select('access_token')
      .eq('provider', 'mercadopago')
      .eq('active', true)

    if (restaurantId) {
      settingsQuery = settingsQuery.eq('restaurant_id', restaurantId)
    }

    const { data: settings } = await settingsQuery
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!settings?.access_token) {
      console.error('[MP webhook] no credentials')
      return ok({ skipped: true })
    }

    const mp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${settings.access_token}` },
    })
    const payment = await mp.json().catch(() => null) as any
    if (!mp.ok || !payment?.id) {
      console.error('[MP webhook] payment fetch failed', mp.status)
      return ok({ skipped: true })
    }

    const newStatus = mapStatus(payment.status)
    const orderId = tx?.order_id || payment.external_reference

    if (transactions && transactions.length > 0) {
      await admin
        .from('payment_transactions')
        .update({
          status: newStatus,
          paid_at: newStatus === 'paid' ? new Date().toISOString() : tx.paid_at,
          raw_payload: payment,
        })
        .eq('provider', 'mercadopago')
        .eq('provider_transaction_id', String(paymentId))
    } else if (orderId) {
      await admin.from('payment_transactions').insert({
        order_id: orderId,
        provider: 'mercadopago',
        provider_transaction_id: String(payment.id),
        payment_method: 'pix',
        amount: Number(payment.transaction_amount || 0),
        status: newStatus,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
        raw_payload: payment,
      })
    }

    if (orderId && newStatus === 'paid') {
      await admin.from('orders').update({ status_financeiro: 'pago' }).eq('id', orderId)
    } else if (orderId && (newStatus === 'cancelled' || newStatus === 'expired')) {
      await admin.from('orders').update({ status_financeiro: newStatus }).eq('id', orderId)
    }

    return ok({ status: newStatus })
  } catch (error) {
    console.error('[MP webhook] unexpected', (error as Error).message)
    return ok({ error: 'unexpected' })
  }
})