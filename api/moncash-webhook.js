const { createClient } = require('@supabase/supabase-js');

// Server-side Supabase credentials (set these in Vercel Environment Variables)
const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Missing Supabase server env vars (SUPABASE_URL / SERVICE_ROLE_KEY)');
}

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  // do not persist auth or attempt client-side flows
  auth: { persistSession: false, autoRefreshToken: false },
});

// Flexible webhook handler for MonCash -> inserts / upserts into `payments` table
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Optional: verify a shared secret header (configure MONCASH_WEBHOOK_SECRET in Vercel)
  const webhookSecret = process.env.MONCASH_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig = (req.headers['x-moncash-signature'] || req.headers['x-hook-secret'] || req.headers['x-secret'] || req.headers['authorization'] || '').toString();
    if (!sig || sig !== webhookSecret) {
      console.warn('Invalid MonCash webhook signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }

  // Parse body (handle JSON and urlencoded payloads)
  let payload = req.body;
  const ctype = (req.headers['content-type'] || '').toString();
  if (typeof payload === 'string') {
    if (ctype.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(payload);
      payload = Object.fromEntries(params.entries());
    } else {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        // keep raw string
      }
    }
  }

  // Try many common field names used by payment providers
  const transactionId = payload?.transactionId || payload?.transaction_id || payload?.mc_transaction_id || payload?.txn_id || payload?.tid || payload?.payment_reference;
  const orderId = payload?.orderId || payload?.order_id || payload?.order || payload?.client_order_id || payload?.reference || payload?.orderRef;
  const amount = parseFloat(payload?.amount || payload?.mc_gross || payload?.amt || payload?.price || 0) || 0;

  if (!transactionId || !orderId) {
    console.warn('Webhook missing transactionId or orderId', { transactionId, orderId, payload });
    return res.status(400).json({ error: 'Missing transactionId or orderId' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase server configuration' });
  }

  try {
    // Upsert by order_id (requires a unique constraint on `order_id` in your `payments` table)
    const record = {
      order_id: String(orderId),
      moncash_transaction_id: String(transactionId),
      amount_htg: amount,
      status: 'COMPLETED',
      payment_method: 'MONCASH',
      payload: { raw: payload },
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('payments')
      .upsert([record], { onConflict: 'order_id' });

    if (error) {
      console.error('Supabase upsert error (moncash webhook):', error);
      return res.status(500).json({ error: 'db_error', details: error.message });
    }

    console.log('MonCash webhook recorded (order):', orderId, 'tx:', transactionId);
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Unexpected webhook handler error:', err);
    return res.status(500).json({ error: 'internal_error', details: err.message });
  }
};
