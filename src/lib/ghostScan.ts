// =============================================================================
// GHOST SCAN LOGGING SERVICE
// Logs security events like item deletion, cart clearing, price changes
// =============================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Product, OrderItem, AuditActionType } from '@/types';

export interface GhostScanEntry {
    action_type: AuditActionType;
    entity_type: string;
    entity_id?: string;
    old_value?: Record<string, unknown> | null;
    new_value?: Record<string, unknown> | null;
    reason?: string;
    shift_id?: string;
    order_id?: string;
    product_id?: string;
    user_id?: string;
}

// In-memory log for demo mode (when Supabase not configured)
const localAuditLog: Array<GhostScanEntry & { id: string; created_at: string }> = [];

/**
 * Logs a ghost scan event (item removed from cart)
 */
export async function logGhostScan(params: {
    item: OrderItem;
    product: Product;
    reason?: string;
    shiftId?: string;
    orderId?: string;
    userId?: string;
}): Promise<void> {
    const entry: GhostScanEntry = {
        action_type: 'ghost_scan',
        entity_type: 'order_item',
        entity_id: params.item.id,
        old_value: {
            product_id: params.product.id,
            product_name: params.product.name,
            quantity: params.item.quantity,
            unit_price: params.item.unit_price,
            total_price: params.item.total_price,
        },
        new_value: null,
        reason: params.reason || 'Xóa sản phẩm khỏi giỏ hàng',
        shift_id: params.shiftId,
        order_id: params.orderId,
        product_id: params.product.id,
        user_id: params.userId,
    };

    await saveAuditLog(entry);
}

/**
 * Logs when cart is cleared
 */
export async function logCartCleared(params: {
    items: Array<{ product: Product; item: OrderItem }>;
    reason?: string;
    shiftId?: string;
    orderId?: string;
    userId?: string;
}): Promise<void> {
    const entry: GhostScanEntry = {
        action_type: 'cart_cleared',
        entity_type: 'order',
        entity_id: params.orderId,
        old_value: {
            items_count: params.items.length,
            items: params.items.map(({ product, item }) => ({
                product_name: product.name,
                quantity: item.quantity,
                total_price: item.total_price,
            })),
            total_value: params.items.reduce((sum, { item }) => sum + item.total_price, 0),
        },
        new_value: { items_count: 0, items: [], total_value: 0 },
        reason: params.reason || 'Xóa toàn bộ giỏ hàng',
        shift_id: params.shiftId,
        order_id: params.orderId,
        user_id: params.userId,
    };

    await saveAuditLog(entry);
}

/**
 * Logs when item quantity is changed (for tracking suspicious changes)
 */
export async function logQuantityChange(params: {
    item: OrderItem;
    product: Product;
    oldQuantity: number;
    newQuantity: number;
    shiftId?: string;
    orderId?: string;
    userId?: string;
}): Promise<void> {
    // Only log if quantity decreased (potential fraud)
    if (params.newQuantity >= params.oldQuantity) return;

    const entry: GhostScanEntry = {
        action_type: 'void_item',
        entity_type: 'order_item',
        entity_id: params.item.id,
        old_value: {
            product_name: params.product.name,
            quantity: params.oldQuantity,
        },
        new_value: {
            product_name: params.product.name,
            quantity: params.newQuantity,
        },
        reason: `Giảm số lượng từ ${params.oldQuantity} xuống ${params.newQuantity}`,
        shift_id: params.shiftId,
        order_id: params.orderId,
        product_id: params.product.id,
        user_id: params.userId,
    };

    await saveAuditLog(entry);
}

/**
 * Logs when price is manually changed
 */
export async function logPriceEdit(params: {
    product: Product;
    oldPrice: number;
    newPrice: number;
    userId?: string;
}): Promise<void> {
    const entry: GhostScanEntry = {
        action_type: 'price_edit',
        entity_type: 'product',
        entity_id: params.product.id,
        old_value: {
            product_name: params.product.name,
            selling_price: params.oldPrice,
        },
        new_value: {
            product_name: params.product.name,
            selling_price: params.newPrice,
        },
        reason: `Thay đổi giá từ ${params.oldPrice} thành ${params.newPrice}`,
        product_id: params.product.id,
        user_id: params.userId,
    };

    await saveAuditLog(entry);
}

/**
 * Logs when discount is applied to an item
 */
export async function logDiscountChange(params: {
    item: OrderItem;
    product: Product;
    oldDiscount: number;
    newDiscount: number;
    reason?: string;
    orderId?: string;
    shiftId?: string;
    userId?: string;
}): Promise<void> {
    const entry: GhostScanEntry = {
        action_type: 'discount_apply',
        entity_type: 'order_item',
        entity_id: params.item.id,
        old_value: {
            product_name: params.product.name,
            discount_amount: params.oldDiscount,
            total_price: params.item.total_price, // Price BEFORE limit check? No, old price
        },
        new_value: {
            product_name: params.product.name,
            discount_amount: params.newDiscount,
        },
        reason: params.reason || `Chiết khấu changed from ${params.oldDiscount} to ${params.newDiscount}`,
        product_id: params.product.id,
        order_id: params.orderId,
        shift_id: params.shiftId,
        user_id: params.userId,
    };

    await saveAuditLog(entry);
}

/**
 * Saves audit log entry to database or local storage
 */
async function saveAuditLog(entry: GhostScanEntry): Promise<void> {
    const timestamp = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
        try {
            const { error } = await supabase.from('audit_logs').insert({
                action_type: entry.action_type,
                entity_type: entry.entity_type,
                entity_id: entry.entity_id,
                old_value: entry.old_value,
                new_value: entry.new_value,
                reason: entry.reason,
                shift_id: entry.shift_id,
                order_id: entry.order_id,
                product_id: entry.product_id,
                user_id: entry.user_id,
                ip_address: null, // Would get from request in real app
                user_agent: navigator.userAgent,
            });

            if (error) {
                console.error('Failed to save audit log to Supabase:', error);
                // Fall back to local storage
                saveToLocalLog(entry, timestamp);
            }
        } catch (err) {
            console.error('Error saving audit log:', err);
            saveToLocalLog(entry, timestamp);
        }
    } else {
        // Demo mode - save to local log
        saveToLocalLog(entry, timestamp);
    }
}

function saveToLocalLog(entry: GhostScanEntry, timestamp: string): void {
    const logEntry = {
        ...entry,
        id: crypto.randomUUID(),
        created_at: timestamp,
    };

    localAuditLog.unshift(logEntry);

    // Keep only last 1000 entries in memory
    if (localAuditLog.length > 1000) {
        localAuditLog.pop();
    }

    // Also persist to localStorage for demo
    try {
        const stored = localStorage.getItem('ghost_scan_logs') || '[]';
        const logs = JSON.parse(stored);
        logs.unshift(logEntry);
        localStorage.setItem('ghost_scan_logs', JSON.stringify(logs.slice(0, 500)));
    } catch (e) {
        console.warn('Failed to persist ghost scan log:', e);
    }

    console.log('🔍 Ghost Scan Log:', logEntry);
}

/**
 * Gets recent audit logs
 */
export async function getRecentAuditLogs(limit = 50): Promise<Array<GhostScanEntry & { id: string; created_at: string }>> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Failed to fetch audit logs:', error);
            return localAuditLog.slice(0, limit);
        }

        return data as Array<GhostScanEntry & { id: string; created_at: string }>;
    }

    // Demo mode - return from localStorage
    try {
        const stored = localStorage.getItem('ghost_scan_logs') || '[]';
        return JSON.parse(stored).slice(0, limit);
    } catch {
        return localAuditLog.slice(0, limit);
    }
}

/**
 * Gets audit logs by date range (Supabase or Local)
 */
export async function getAuditLogsByDate(start: Date, end: Date): Promise<Array<GhostScanEntry & { id: string; created_at: string; user: any }>> {
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('audit_logs')
            .select(`
                *,
                user:user_id (
                    full_name,
                    email,
                    avatar_url
                )
            `)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch audit logs:', error);
            return [];
        }
        return data as Array<GhostScanEntry & { id: string; created_at: string; user: any }>;
    }

    // Demo/Local Mode
    try {
        const stored = localStorage.getItem('ghost_scan_logs') || '[]';
        const logs = JSON.parse(stored) as Array<GhostScanEntry & { id: string; created_at: string; user_id?: string }>;

        // Filter by date
        const filtered = logs.filter(log => {
            const date = new Date(log.created_at);
            return date >= start && date <= end;
        });

        // Mock user join (since we don't have user_profiles locally joined)
        // We can try to look up user from useUserStore? No, circular dependency potential.
        // Just return as is, and UI/Store handles missing user object.
        return filtered.map(log => ({
            ...log,
            user: log.user_id ? { full_name: 'Nhân viên (Demo)', email: 'demo@example.com' } : undefined
        }));

    } catch (e) {
        console.warn('Failed to read local logs:', e);
        return [];
    }
}

/**
 * Cleans up logs older than specified days
 */
export async function cleanupOldLogs(daysToKeep = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffISO = cutoffDate.toISOString();

    if (isSupabaseConfigured() && supabase) {
        try {
            const { error } = await supabase
                .from('audit_logs')
                .delete()
                .lt('created_at', cutoffISO);

            if (error) {
                console.error('Failed to clean up old logs:', error);
            } else {
                console.log(`Cleaned up logs older than ${daysToKeep} days`);
            }
        } catch (err) {
            console.error('Error in log cleanup:', err);
        }
    } else {
        // Local cleanup
        try {
            const stored = localStorage.getItem('ghost_scan_logs');
            if (stored) {
                const logs = JSON.parse(stored) as Array<GhostScanEntry & { created_at: string }>;
                const filtered = logs.filter(log => log.created_at >= cutoffISO);
                if (filtered.length < logs.length) {
                    localStorage.setItem('ghost_scan_logs', JSON.stringify(filtered));
                    console.log(`Cleaned up ${logs.length - filtered.length} local logs`);
                }
            }
        } catch (e) {
            console.warn('Failed to cleanup local logs:', e);
        }
    }
}
