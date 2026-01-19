import { supabase } from './supabase';

export async function logAction(action: string, table: string, recordId: string, details: Record<string, any> = {}) {
    if (!supabase) return;
    try {
        await supabase.rpc('log_action', {
            p_action: action,
            p_table: table,
            p_record_id: recordId,
            p_details: details
        });
    } catch (error) {
        console.error('Audit Log Error:', error);
    }
}
