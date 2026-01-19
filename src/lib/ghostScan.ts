// =============================================================================
// GHOST SCAN LOGGING SERVICE
// Logs security events like item deletion, cart clearing, price changes
// =============================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Product, OrderItem, AuditActionType } from '@/types';

export interface GhostScanEntry {
    action_type: AuditActionType | 'print_provisional' | 'delete_draft_order' | 'order_session_summary';
    entity_type: string;
    entity_id?: string;
    old_value?: Record<string, unknown> | null;
    new_value?: Record<string, unknown> | null;
    reason?: string;
    shift_id?: string;
    order_id?: string;
    product_id?: string;
    user_id?: string;
    // Risk assessment
    risk_score?: number;
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
}

export interface OrderSessionLog {
    orderId: string;
    sessionStartTime: Date;
    sessionEndTime: Date;
    maxPotentialValue: number;
    finalValue: number;
    removedItems: Array<{
        productName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        removedAt: string;
        reason?: string;
    }>;
    events: Array<{
        type: string;
        description: string;
        time: string;
        valueDiff?: number;
    }>;
    sessionEvents?: Array<{
        type: string;
        description: string;
        time: string;
        valueDiff?: number;
    }>;
    shiftId?: string;
    userId?: string;
}

export interface EmployeeRiskStats {
    userId: string;
    fullName?: string;
    email?: string;
    totalRiskScore: number;
    violationCount: number;
    lastViolationDate?: string;
    riskLevel: 'safe' | 'warning' | 'high';
    // Financials
    totalRevenue: number;
    totalVoidValue: number;
    potentialRevenue: number;
    // Risk Breakdown
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
}

// In-memory log for demo mode (when Supabase not configured)
const localAuditLog: Array<GhostScanEntry & { id: string; created_at: string }> = [];

// Helper: Calculate risk level
const calculateRiskLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (score >= 90) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
};

/**
 * ADVANCED RISK ANALYSIS ENGINE
 * Analyzes the context of an action to assign a risk score
 */
async function analyzeRiskAction(
    actionType: string,
    context: {
        orderId?: string;
        sessionStartTime?: Date;
        lastPrintTime?: Date | null; // Nullable
        durationSinceAdd?: number; // ms since item was added
        isDraftDeleted?: boolean;
        switchCount?: number; // Tab switching frequency
    }
): Promise<{ score: number, reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];

    // 1. Ghost Scan Pattern: Print Provisional -> Clear/Delete
    if (context.lastPrintTime) {
        // CRITICAL RISK: Printing then modifying is the #1 fraud signal
        score += 80;
        reasons.push('Đã in tạm tính');
    }

    // 2. Tab Juggling
    if ((context.switchCount || 0) > 2) {
        score += 20;
        reasons.push(`Đảo tab ${context.switchCount} lần`);
    }

    // 3. Long Duration Void / Quick Void / Clearing
    if (context.durationSinceAdd) {
        const minutes = context.durationSinceAdd / 1000 / 60;
        if (minutes > 30) {
            score += 40; // Long Con: Added long ago, now voiding
            reasons.push('Thời gian chờ > 30p');
        } else if (minutes > 5) {
            score += 20; // Suspicious
            reasons.push('Thời gian chờ > 5p');
        }
    } else if (actionType === 'cart_cleared' && context.lastPrintTime) {
        // Also check duration for cleared cart if session start time available? 
        // For now rely on Print logic
    }

    // 4. Tab Shuffle / Saved Order Deletion
    if (actionType === 'delete_draft_order') {
        score += 30; // High risk but depends on context
        if (!context.lastPrintTime && (context.switchCount || 0) <= 2) {
            // If just deleting a draft without print or shuffle, it might be legit cancellation
            score = Math.min(score, 30);
        }
    }

    // 5. Price Manipulation
    if (actionType === 'price_edit') {
        score += 40;
    }

    return { score: Math.min(score, 100), reasons };
}

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
    addedAt?: Date; // When was this item added?
    events?: any[]; // Session events timeline
    lastPrintTime?: Date | null;
    switchCount?: number;
}): Promise<void> {
    const durationSinceAdd = params.addedAt ? (new Date().getTime() - params.addedAt.getTime()) : 0;

    // Analyze risk
    const { score: riskScore, reasons } = await analyzeRiskAction('void_item', {
        orderId: params.orderId,
        durationSinceAdd,
        lastPrintTime: params.lastPrintTime,
        switchCount: params.switchCount
    });

    const finalReason = reasons.length > 0
        ? `${params.reason || 'Xóa sản phẩm'} [⚠️ ${reasons.join(', ')}]`
        : (params.reason || 'Xóa sản phẩm khỏi giỏ hàng');

    const entry: GhostScanEntry = {
        action_type: 'void_item', // Start with standard naming, mapped from frontend
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
        reason: finalReason,
        shift_id: params.shiftId,
        order_id: params.orderId,
        product_id: params.product.id,
        user_id: params.userId,
        risk_score: riskScore,
        risk_level: calculateRiskLevel(riskScore)
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
    lastPrintTime?: Date | null; // When was provisional receipt printed?
    switchCount?: number;
    events?: any[];
}): Promise<void> {
    const { score: riskScore, reasons } = await analyzeRiskAction('cart_cleared', {
        orderId: params.orderId,
        lastPrintTime: params.lastPrintTime,
        switchCount: params.switchCount
    });

    const finalReason = reasons.length > 0
        ? `${params.reason || 'Xóa giỏ hàng'} [⚠️ ${reasons.join(', ')}]`
        : (params.reason || 'Xóa toàn bộ giỏ hàng');

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
            cleared_at: new Date().toISOString(),
            session_events: params.events
        },
        new_value: { items_count: 0, items: [], total_value: 0 },
        reason: finalReason,
        shift_id: params.shiftId,
        order_id: params.orderId,
        user_id: params.userId,
        risk_score: riskScore,
        risk_level: calculateRiskLevel(riskScore)
    };

    await saveAuditLog(entry);
}

/**
 * Logs when provisional receipt is printed
 */
export async function logPrintProvisional(params: {
    orderId?: string;
    itemsCount: number;
    totalAmount: number;
    shiftId?: string;
    userId?: string;
}): Promise<void> {
    // Printing itself is low risk, but sets context for future risks
    const entry: GhostScanEntry = {
        action_type: 'print_provisional',
        entity_type: 'order',
        entity_id: params.orderId,
        old_value: null,
        new_value: {
            items_count: params.itemsCount,
            total_amount: params.totalAmount
        },
        reason: 'In phiếu tạm tính',
        shift_id: params.shiftId,
        order_id: params.orderId,
        user_id: params.userId,
        risk_score: 0,
        risk_level: 'low'
    };

    await saveAuditLog(entry);
}

/**
 * Logs when a draft order is deleted
 */
export async function logDraftDeleted(params: {
    orderId: string;
    note?: string;
    totalAmount?: number;
    shiftId?: string;
    userId?: string;
    events?: any[];
    items?: Array<{ productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
    lastPrintTime?: Date | null;
    switchCount?: number;
}): Promise<void> {
    const { score: riskScore, reasons } = await analyzeRiskAction('delete_draft_order', {
        orderId: params.orderId,
        isDraftDeleted: true,
        lastPrintTime: params.lastPrintTime,
        switchCount: params.switchCount
    });

    const finalReason = reasons.length > 0
        ? `Xóa đơn nháp [⚠️ ${reasons.join(', ')}]`
        : `Xóa đơn nháp (${params.items?.length || 0} sản phẩm, ${params.totalAmount?.toLocaleString() || 0}đ)`;

    const entry: GhostScanEntry = {
        action_type: 'delete_draft_order',
        entity_type: 'order',
        entity_id: params.orderId,
        old_value: {
            note: params.note,
            total_amount: params.totalAmount,
            items: params.items // Include items for detail view
        },
        new_value: {
            deleted_at: new Date().toISOString(),
            session_events: params.events
        },
        reason: finalReason,
        shift_id: params.shiftId,
        order_id: params.orderId,
        user_id: params.userId,
        risk_score: riskScore,
        risk_level: calculateRiskLevel(riskScore)
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
    addedAt?: Date;
    events?: any[];
    lastPrintTime?: Date | null;
    switchCount?: number;
}): Promise<void> {
    // Only log if quantity decreased (potential fraud)
    if (params.newQuantity >= params.oldQuantity) return;

    const durationSinceAdd = params.addedAt ? (new Date().getTime() - params.addedAt.getTime()) : 0;

    // Treat quantity decrease similar to void item but maybe slightly less severe unless repeated
    // Re-use void_item logic for now or specific
    const { score: riskScore, reasons } = await analyzeRiskAction('void_item', {
        orderId: params.orderId,
        durationSinceAdd,
        lastPrintTime: params.lastPrintTime,
        switchCount: params.switchCount
    });

    const finalReason = reasons.length > 0
        ? `Giảm số lượng [⚠️ ${reasons.join(', ')}]`
        : `Giảm số lượng từ ${params.oldQuantity} xuống ${params.newQuantity}`;

    const entry: GhostScanEntry = {
        action_type: 'void_item', // Categorize as void item or specific 'quantity_decrease'
        entity_type: 'order_item',
        entity_id: params.item.id,
        old_value: {
            product_name: params.product.name,
            quantity: params.oldQuantity,
        },
        new_value: {
            product_name: params.product.name,
            quantity: params.newQuantity,
            session_events: params.events
        },
        reason: finalReason,
        shift_id: params.shiftId,
        order_id: params.orderId,
        product_id: params.product.id,
        user_id: params.userId,
        risk_score: riskScore,
        risk_level: calculateRiskLevel(riskScore)
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
    const { score: riskScore, reasons } = await analyzeRiskAction('price_edit', {});

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
        risk_score: riskScore,
        risk_level: calculateRiskLevel(riskScore)
    };

    await saveAuditLog(entry);
}

/**
 * Logs a full order session summary (Phase 8)
 * Aggregates all removals and financial data for a session
 */
export async function logOrderSessionSummary(params: OrderSessionLog): Promise<void> {
    const durationMs = params.sessionEndTime.getTime() - params.sessionStartTime.getTime();
    const durationMinutes = Math.round(durationMs / 1000 / 60 * 10) / 10;

    const voidValue = params.removedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const voidCount = params.removedItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPotential = params.maxPotentialValue;

    // Calculate Risk
    let riskScore = 0;

    // 1. Value Destroyed Logic
    if (voidValue > 0) {
        const voidRate = totalPotential > 0 ? (voidValue / totalPotential) : 1;

        if (voidValue > 5000000) riskScore += 50; // High value void
        else if (voidValue > 1000000) riskScore += 30;

        if (voidRate > 0.8) riskScore += 40; // Voided > 80% of cart
        else if (voidRate > 0.5) riskScore += 20;
    }

    // 2. Time Logic (Long con)
    if (params.removedItems.length > 0 && durationMinutes > 15) {
        riskScore += 20; // Spent a lot of time just to delete items
    }

    // 3. Ghost Scan Pattern: Print Provisional -> Delete Items -> Clear/New Order
    // Check if events contain print_provisional followed by remove/clear actions
    const events = params.events || [];
    const hasPrint = events.some(e => e.type === 'print_provisional');
    const hasClearOrRemove = events.some(e => e.type === 'clear_cart' || e.type === 'remove_item' || e.type === 'void_item');

    if (hasPrint && hasClearOrRemove && voidValue > 0) {
        // This is the classic Ghost Scan pattern - HIGH RISK
        riskScore += 50; // Bump to HIGH or CRITICAL
    }

    // 4. Cleared/New Order with no payment (finalValue = 0 but had potential)
    if (params.finalValue === 0 && totalPotential > 0 && voidValue > 0) {
        riskScore += 30; // Abandoned order after adding items
    }

    const riskLevel = calculateRiskLevel(riskScore);

    const entry: GhostScanEntry = {
        action_type: 'order_session_summary' as any, // Custom type
        entity_type: 'order_session',
        entity_id: params.orderId,
        old_value: {
            max_potential: params.maxPotentialValue,
            void_value: voidValue,
            removed_items: params.removedItems,
            sessionStartTime: params.sessionStartTime.toISOString()
        },
        new_value: {
            final_value: params.finalValue,
            duration_minutes: durationMinutes,
            void_rate: totalPotential > 0 ? Math.round((voidValue / totalPotential) * 100) : 0,
            session_events: params.events || [], // Include the timeline events
            sessionEndTime: params.sessionEndTime.toISOString()
        },
        reason: `Phiên kết thúc. Đã xóa ${voidCount} món (₫${voidValue.toLocaleString()})`,
        shift_id: params.shiftId,
        order_id: params.orderId,
        user_id: params.userId,
        risk_score: riskScore,
        risk_level: riskLevel
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
    events?: any[];
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
            session_events: params.events
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
            // Try inserting with new columns
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
                risk_score: entry.risk_score || 0,
                risk_level: entry.risk_level || 'low',
                ip_address: null,
                user_agent: navigator.userAgent,
            });

            if (error) {
                // If error is related to missing columns (Postgres error 42703), retry without them
                if (error.code === '42703' || error.message?.includes('column')) {
                    console.warn('Risk columns missing, retrying without risk data...', error.message);
                    const { error: retryError } = await supabase.from('audit_logs').insert({
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
                        // Omit risk columns
                        ip_address: null,
                        user_agent: navigator.userAgent,
                    });
                    if (retryError) throw retryError;
                    return;
                }

                console.error('Failed to save audit log to Supabase:', error);
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

    if (entry.risk_level === 'critical' || entry.risk_level === 'high') {
        console.warn(`🚨 HIGH RISK DETECTED: [${entry.risk_level.toUpperCase()}] ${entry.reason}`, entry);
    } else {
        console.log('🔍 Ghost Scan Log:', entry);
    }
}

/**
 * Gets recent audit logs
 */
export async function getRecentAuditLogs(limit = 50): Promise<Array<GhostScanEntry & { id: string; created_at: string }>> {
    // Check auto cleanup (10%)
    if (Math.random() < 0.1) {
        cleanupOldLogs(60);
    }

    let logs: Array<GhostScanEntry & { id: string; created_at: string }> = [];

    // 1. Fetch from Supabase
    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (!error && data) {
            logs = data as any;
        } else if (error) {
            console.error('Failed to fetch audit logs from Supabase:', error);
        }
    }

    // 2. Fetch from Local Storage and Merge
    try {
        const stored = localStorage.getItem('ghost_scan_logs') || '[]';
        const localLogs = JSON.parse(stored);

        // Merge: Concat local logs
        logs = [...logs, ...localLogs];

        // Final Sort by Date Descending
        logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Re-slice to limit
        logs = logs.slice(0, limit);

    } catch (e) {
        // Fallback to memory logs if local strage fails
        if (logs.length === 0) logs = localAuditLog.slice(0, limit);
    }

    return logs;
}

/**
 * Gets audit logs by date range (Supabase, Local, or Both)
 */
export async function getAuditLogsByDate(start: Date, end: Date): Promise<Array<GhostScanEntry & { id: string; created_at: string; user: any }>> {
    let logs: any[] = [];

    if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
            .from('audit_logs') // Revert to old table
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

        if (!error && data) {
            logs = data;
        }
    }

    // Merge with Local
    try {
        const stored = localStorage.getItem('ghost_scan_logs') || '[]';
        const localLogs = JSON.parse(stored);

        const filteredLocal = localLogs.filter((log: any) => {
            const date = new Date(log.created_at);
            return date >= start && date <= end;
        }).map((log: any) => ({
            ...log,
            user: log.user_id ? { full_name: 'Nhân viên (Demo)', email: 'demo@example.com' } : undefined
        }));

        logs = [...logs, ...filteredLocal];
        logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    } catch (e) { console.warn("Failed merge local logs"); }

    return logs;
}

/**
 * Cleans up logs older than specified days
 */
export async function cleanupOldLogs(daysToKeep = 60): Promise<void> {
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
    }

    // Always Try Local cleanup too
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

/**
 * Aggregates risk stats per employee (Merged)
 */
export async function getEmployeeRiskStats(start: Date, end: Date): Promise<EmployeeRiskStats[]> {
    let logs: any[] = [];

    // 1. Fetch Logs from Supabase
    if (isSupabaseConfigured() && supabase) {
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select(`
                    *,
                    user:user_id (
                        full_name,
                        email
                    )
                `)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString());

            if (!error && data) {
                logs = data;
            }
        } catch (e) { console.error("Supabase fetch stats error", e); }
    }

    // 2. Fetch from Local Storage and Merge
    try {
        const stored = localStorage.getItem('ghost_scan_logs') || '[]';
        const localLogs = JSON.parse(stored);

        // Filter recent
        const recentLocal = localLogs.filter((l: any) => {
            const d = new Date(l.created_at);
            return d >= start && d <= end;
        });

        // Merge
        logs = [...logs, ...recentLocal];

    } catch (e) { console.warn("Local storage read stats error"); }


    // 3. Aggregate
    const statsMap = new Map<string, EmployeeRiskStats>();

    logs.forEach(log => {
        // Skip logs without user_id
        if (!log.user_id) return;

        const userId = log.user_id;
        const currentScore = log.risk_score || 0;

        if (!statsMap.has(userId)) {
            const userName = log.user?.full_name || 'Nhân viên';
            const userEmail = log.user?.email || 'N/A';

            statsMap.set(userId, {
                userId,
                fullName: userName,
                email: userEmail,
                totalRiskScore: 0,
                violationCount: 0,
                lastViolationDate: undefined,
                riskLevel: 'safe',
                totalRevenue: 0,
                totalVoidValue: 0,
                potentialRevenue: 0,
                highRiskCount: 0,
                mediumRiskCount: 0,
                lowRiskCount: 0
            });
        }

        const stats = statsMap.get(userId)!;
        stats.totalRiskScore += currentScore;

        // Aggregate Financials from Session Summaries
        if (log.action_type === 'order_session_summary') {
            const oldValue = typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value;
            const newValue = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value;

            if (oldValue && newValue) {
                const voidVal = Number(oldValue.void_value) || 0;
                const finalVal = Number(newValue.final_value) || 0;
                const potentialVal = Number(oldValue.max_potential) || (voidVal + finalVal);

                stats.totalVoidValue += voidVal;
                stats.totalRevenue += finalVal;
                stats.potentialRevenue += potentialVal;
            }
        }

        if (currentScore > 0) {
            if (currentScore >= 60) stats.highRiskCount++;
            else if (currentScore >= 30) stats.mediumRiskCount++;
            else stats.lowRiskCount++;
        }

        if (currentScore >= 30) {
            stats.violationCount += 1;
            // Update last violation date if this log is more recent
            if (!stats.lastViolationDate || new Date(log.created_at) > new Date(stats.lastViolationDate)) {
                stats.lastViolationDate = log.created_at;
            }
        }
    });

    return Array.from(statsMap.values()).map(stats => {
        // Calculate Risk Level based on total score AND violation frequency
        // Normalized score: Total Score / (Revenue / 1,000,000) or just logic thresholds?
        // Let's keep it simple: > 300 score OR > 5 high risk violations = High
        if (stats.totalRiskScore > 300 || stats.highRiskCount >= 5) stats.riskLevel = 'high';
        else if (stats.totalRiskScore > 100 || stats.mediumRiskCount >= 5) stats.riskLevel = 'warning';
        else stats.riskLevel = 'safe';
        return stats;
    });
}

/**
 * Fetch detailed logs for a specific employee within a date range
 */
export async function getEmployeeDetailLogs(userId: string, start: Date, end: Date): Promise<GhostScanEntry[]> {
    const allLogs = await getAuditLogsByDate(start, end);
    return allLogs.filter(log => log.user_id === userId);
}


