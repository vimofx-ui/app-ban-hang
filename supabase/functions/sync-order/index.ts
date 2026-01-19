// =============================================================================
// SYNC-ORDER EDGE FUNCTION - Server-side order synchronization
// =============================================================================
// This function handles offline order sync from PWA clients
// Deploy: supabase functions deploy sync-order

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface OrderPayload {
    offline_id: string;
    brand_id: string;
    branch_id: string;
    order_number: string;
    order_type: 'pos' | 'online' | 'delivery';
    status: string;
    items: Array<{
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
        discount: number;
        total: number;
    }>;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    payment_method: string;
    customer_id?: string;
    customer_name?: string;
    notes?: string;
    created_at: string;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing authorization header')
        }

        // Create Supabase client with auth
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: authHeader },
            },
        })

        // Parse request body
        const { orders } = await req.json() as { orders: OrderPayload[] }

        if (!orders || !Array.isArray(orders) || orders.length === 0) {
            throw new Error('No orders to sync')
        }

        console.log(`[sync-order] Processing ${orders.length} orders`)

        const results: Array<{ offline_id: string; success: boolean; order_id?: string; error?: string }> = []

        for (const order of orders) {
            try {
                // Check if order already exists (avoid duplicates)
                const { data: existing } = await supabase
                    .from('orders')
                    .select('id')
                    .eq('order_number', order.order_number)
                    .eq('brand_id', order.brand_id)
                    .single()

                if (existing) {
                    // Order already synced
                    results.push({
                        offline_id: order.offline_id,
                        success: true,
                        order_id: existing.id,
                    })
                    continue
                }

                // Insert order
                const { data: newOrder, error: orderError } = await supabase
                    .from('orders')
                    .insert({
                        brand_id: order.brand_id,
                        branch_id: order.branch_id,
                        order_number: order.order_number,
                        order_type: order.order_type,
                        status: order.status,
                        subtotal: order.subtotal,
                        tax_amount: order.tax_amount,
                        discount_amount: order.discount_amount,
                        total_amount: order.total_amount,
                        payment_method: order.payment_method,
                        customer_id: order.customer_id,
                        customer_name: order.customer_name,
                        notes: order.notes,
                        created_at: order.created_at,
                        synced_at: new Date().toISOString(),
                    })
                    .select()
                    .single()

                if (orderError) throw orderError

                // Insert order items
                if (order.items && order.items.length > 0) {
                    const orderItems = order.items.map(item => ({
                        order_id: newOrder.id,
                        product_id: item.product_id,
                        product_name: item.product_name,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        discount: item.discount || 0,
                        total: item.total,
                    }))

                    const { error: itemsError } = await supabase
                        .from('order_items')
                        .insert(orderItems)

                    if (itemsError) {
                        console.error('[sync-order] Items insert error:', itemsError)
                    }
                }

                // Update inventory (deduct stock)
                for (const item of order.items) {
                    await supabase.rpc('decrement_inventory', {
                        p_branch_id: order.branch_id,
                        p_product_id: item.product_id,
                        p_quantity: item.quantity,
                    })
                }

                results.push({
                    offline_id: order.offline_id,
                    success: true,
                    order_id: newOrder.id,
                })

                console.log(`[sync-order] Order ${order.order_number} synced successfully`)

            } catch (err: any) {
                console.error(`[sync-order] Failed to sync order ${order.order_number}:`, err)
                results.push({
                    offline_id: order.offline_id,
                    success: false,
                    error: err.message,
                })
            }
        }

        // Summary
        const successCount = results.filter(r => r.success).length
        const failCount = results.filter(r => !r.success).length

        console.log(`[sync-order] Completed: ${successCount} success, ${failCount} failed`)

        return new Response(
            JSON.stringify({
                success: true,
                synced: successCount,
                failed: failCount,
                results,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error: any) {
        console.error('[sync-order] Error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
