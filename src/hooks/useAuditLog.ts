import { supabase } from '@/lib/supabase';

interface LogActivityParams {
    action: string;
    entityType?: string;
    entityId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

/**
 * Hook for logging user activities to the audit_logs table.
 * Used for tracking critical actions like deleting brands, changing prices, etc.
 */
export const useAuditLog = () => {
    const logActivity = async ({
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        metadata
    }: LogActivityParams): Promise<string | null> => {
        if (!supabase) {
            console.warn('[AuditLog] Supabase not configured, skipping log.');
            return null;
        }

        try {
            const { data, error } = await supabase.rpc('log_activity', {
                p_action: action,
                p_entity_type: entityType || null,
                p_entity_id: entityId || null,
                p_old_values: oldValues ? JSON.stringify(oldValues) : null,
                p_new_values: newValues ? JSON.stringify(newValues) : null,
                p_metadata: metadata ? JSON.stringify(metadata) : null
            });

            if (error) {
                console.error('[AuditLog] Failed to log activity:', error.message);
                return null;
            }

            return data as string; // Returns the log ID
        } catch (err) {
            console.error('[AuditLog] Error:', err);
            return null;
        }
    };

    // Convenience methods for common actions
    const logCreate = (entityType: string, entityId: string, newValues: Record<string, unknown>) =>
        logActivity({ action: 'CREATE', entityType, entityId, newValues });

    const logUpdate = (entityType: string, entityId: string, oldValues: Record<string, unknown>, newValues: Record<string, unknown>) =>
        logActivity({ action: 'UPDATE', entityType, entityId, oldValues, newValues });

    const logDelete = (entityType: string, entityId: string, oldValues: Record<string, unknown>) =>
        logActivity({ action: 'DELETE', entityType, entityId, oldValues });

    return {
        logActivity,
        logCreate,
        logUpdate,
        logDelete
    };
};

export default useAuditLog;
