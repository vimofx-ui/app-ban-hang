import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useOrderStore } from '@/stores/orderStore';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeOrders() {
    const { loadOrders } = useOrderStore();

    useEffect(() => {
        if (!supabase) return;

        let channel: RealtimeChannel;

        const setupSubscription = async () => {
            channel = supabase
                .channel('orders-realtime')
                .on(
                    'postgres_changes',
                    {
                        event: '*', // Listen to INSERT, UPDATE, DELETE
                        schema: 'public',
                        table: 'orders',
                    },
                    (payload) => {
                        console.log('Realtime Order Change:', payload);
                        // Simple strategy: Reload orders to ensure fresh data
                        // Improved strategy could be:
                        // - INSERT: addOrder(payload.new)
                        // - UPDATE: updateOrder(payload.new.id, payload.new)
                        // But loadOrders ensures all joins (items, customers) are correct without complex logic here
                        loadOrders();
                    }
                )
                .subscribe();
        };

        setupSubscription();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [loadOrders]);
}
