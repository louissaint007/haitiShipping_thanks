import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// MonCash configuration
const MONCASH_CLIENT_ID = process.env.MONCASH_CLIENT_ID;
const MONCASH_CLIENT_SECRET = process.env.MONCASH_CLIENT_SECRET;
const MONCASH_API_URL = process.env.MONCASH_MODE === 'sandbox'
    ? 'https://sandbox.moncashbutton.digicelgroup.com/Api'
    : 'https://moncashbutton.digicelgroup.com/Api';

export default async function handler(request, response) {
    // 1. Enable CORS
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    const { transactionId, orderId } = request.query;

    if (!transactionId) {
        return response.status(400).json({ error: 'Transaction ID is required' });
    }

    try {
        // 2. Get MonCash Token
        // NOTE: In a real production app, cache this token!
        const tokenResponse = await fetch(`${MONCASH_API_URL}/oauth/token`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(MONCASH_CLIENT_ID + ':' + MONCASH_CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'scope=read,write&grant_type=client_credentials'
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to authenticate with MonCash');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 3. Look up Transaction by Transaction ID using new token
        const paymentLookupResponse = await fetch(`${MONCASH_API_URL}/v1/RetrieveTransactionPayment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ transactionId: transactionId })
        });

        // Note: MonCash might return 200 even if transaction not found, check payload
        const paymentData = await paymentLookupResponse.json();

        if (!paymentData || !paymentData.payment) {
            console.error("MonCash Lookup Failed:", paymentData);
            // If we can't verify with MonCash, we might still want to record the attempt manually
            // but strictly speaking, we should fail or mark as pending.
            return response.status(404).json({ error: 'Transaction not found in MonCash', details: paymentData });
        }

        const moncashPayment = paymentData.payment;
        // Verify payment status (e.g. if it is 'successful' or 'completed')
        // note: MonCash message might be "successful"

        // Try to get orderId from query params or MonCash reference
        // MonCash 'reference' field often contains the internal order ID
        const finalOrderId = orderId || moncashPayment.reference;

        if (!finalOrderId) {
            console.warn("Order ID is missing in both query params and MonCash reference.");
            // We can't insert into payments without order_id due to schema constraint.
            // We could either return an error or try to find a way to handle this.
            // For now, let's return a specific error so we know what's happening.
            return response.status(400).json({
                error: 'Order ID not found',
                details: 'Could not determine Order ID from URL or MonCash reference.'
            });
        }

        // 4. Update/Insert into Supabase
        // We use the service role key so we can write to the table regardless of RLS

        // Check if exists first
        const { data: existing } = await supabase
            .from('payments')
            .select('id')
            .eq('moncash_transaction_id', transactionId)
            .single();

        let dbResult;

        if (existing) {
            // Update
            dbResult = await supabase
                .from('payments')
                .update({
                    status: 'COMPLETED', // Or allow moncash status mapping
                    payload: moncashPayment,
                    updated_at: new Date().toISOString()
                })
                .eq('moncash_transaction_id', transactionId);
        } else {
            // Insert - assuming we have orderId from the query params to link it
            // If we don't have orderId, we can still record it but it might be orphaned
            dbResult = await supabase
                .from('payments')
                .insert({
                    order_id: finalOrderId,
                    moncash_transaction_id: transactionId,
                    amount_htg: moncashPayment.cost,
                    status: 'COMPLETED',
                    payment_method: 'MONCASH',
                    payload: moncashPayment,
                    created_at: new Date().toISOString()
                });
        }

        if (dbResult.error) {
            throw dbResult.error;
        }

        return response.status(200).json({
            success: true,
            message: 'Payment verified and recorded',
            payment: moncashPayment
        });

    } catch (error) {
        console.error('Verification Error:', error);
        return response.status(500).json({ error: error.message });
    }
}
