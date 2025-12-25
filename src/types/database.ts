// =============================================================================
// DATABASE TYPES - Auto-generated from Supabase schema
// These types match the database_schema.sql
// =============================================================================

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            user_profiles: {
                Row: {
                    id: string;
                    full_name: string;
                    role: 'admin' | 'staff';
                    avatar_url: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    full_name: string;
                    role?: 'admin' | 'staff';
                    avatar_url?: string | null;
                    is_active?: boolean;
                };
                Update: {
                    full_name?: string;
                    role?: 'admin' | 'staff';
                    avatar_url?: string | null;
                    is_active?: boolean;
                };
            };
            products: {
                Row: {
                    id: string;
                    sku: string | null;
                    barcode: string | null;
                    name: string;
                    description: string | null;
                    category_id: string | null;
                    base_unit: string;
                    cost_price: number;
                    selling_price: number;
                    current_stock: number;
                    min_stock: number;
                    allow_negative_stock: boolean;
                    image_url: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    sku?: string | null;
                    barcode?: string | null;
                    name: string;
                    description?: string | null;
                    category_id?: string | null;
                    base_unit?: string;
                    cost_price?: number;
                    selling_price: number;
                    current_stock?: number;
                    min_stock?: number;
                    allow_negative_stock?: boolean;
                    image_url?: string | null;
                    is_active?: boolean;
                };
                Update: {
                    sku?: string | null;
                    barcode?: string | null;
                    name?: string;
                    description?: string | null;
                    category_id?: string | null;
                    base_unit?: string;
                    cost_price?: number;
                    selling_price?: number;
                    current_stock?: number;
                    min_stock?: number;
                    allow_negative_stock?: boolean;
                    image_url?: string | null;
                    is_active?: boolean;
                };
            };
            orders: {
                Row: {
                    id: string;
                    order_number: string;
                    shift_id: string | null;
                    customer_id: string | null;
                    status: 'draft' | 'completed' | 'returned' | 'cancelled';
                    subtotal: number;
                    discount_amount: number;
                    discount_percent: number;
                    points_used: number;
                    points_discount: number;
                    tax_amount: number;
                    total_amount: number;
                    payment_method: 'cash' | 'transfer' | 'card' | 'debt' | 'mixed' | null;
                    cash_received: number;
                    change_amount: number;
                    transfer_amount: number;
                    card_amount: number;
                    debt_amount: number;
                    original_order_id: string | null;
                    return_reason: string | null;
                    notes: string | null;
                    provisional_printed: boolean;
                    receipt_printed: boolean;
                    created_by: string | null;
                    completed_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    order_number: string;
                    shift_id?: string | null;
                    customer_id?: string | null;
                    status?: 'draft' | 'completed' | 'returned' | 'cancelled';
                    subtotal?: number;
                    discount_amount?: number;
                    discount_percent?: number;
                    points_used?: number;
                    points_discount?: number;
                    tax_amount?: number;
                    total_amount?: number;
                    payment_method?: 'cash' | 'transfer' | 'card' | 'debt' | 'mixed' | null;
                    cash_received?: number;
                    change_amount?: number;
                    transfer_amount?: number;
                    card_amount?: number;
                    debt_amount?: number;
                    notes?: string | null;
                };
                Update: {
                    status?: 'draft' | 'completed' | 'returned' | 'cancelled';
                    customer_id?: string | null;
                    subtotal?: number;
                    discount_amount?: number;
                    discount_percent?: number;
                    points_used?: number;
                    points_discount?: number;
                    tax_amount?: number;
                    total_amount?: number;
                    payment_method?: 'cash' | 'transfer' | 'card' | 'debt' | 'mixed' | null;
                    cash_received?: number;
                    change_amount?: number;
                    transfer_amount?: number;
                    card_amount?: number;
                    debt_amount?: number;
                    notes?: string | null;
                    completed_at?: string | null;
                };
            };
            order_items: {
                Row: {
                    id: string;
                    order_id: string;
                    product_id: string;
                    unit_id: string | null;
                    quantity: number;
                    unit_price: number;
                    discount_amount: number;
                    total_price: number;
                    base_quantity: number | null;
                    returned_quantity: number;
                    notes: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    order_id: string;
                    product_id: string;
                    unit_id?: string | null;
                    quantity: number;
                    unit_price: number;
                    discount_amount?: number;
                    total_price: number;
                    base_quantity?: number | null;
                    notes?: string | null;
                };
                Update: {
                    quantity?: number;
                    unit_price?: number;
                    discount_amount?: number;
                    total_price?: number;
                    returned_quantity?: number;
                    notes?: string | null;
                };
            };
            shifts: {
                Row: {
                    id: string;
                    user_id: string;
                    clock_in: string;
                    clock_out: string | null;
                    opening_cash: number;
                    opening_cash_details: Json | null;
                    closing_cash: number | null;
                    closing_cash_details: Json | null;
                    total_cash_sales: number;
                    total_card_sales: number;
                    total_transfer_sales: number;
                    total_debt_sales: number;
                    total_returns: number;
                    total_expenses: number;
                    expected_cash: number | null;
                    discrepancy_amount: number | null;
                    reconciliation_status: 'exact' | 'short' | 'over' | 'pending' | null;
                    reconciliation_notes: string | null;
                    status: 'active' | 'closed' | 'reconciled';
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    clock_in?: string;
                    opening_cash?: number;
                    opening_cash_details?: Json | null;
                };
                Update: {
                    clock_out?: string | null;
                    closing_cash?: number | null;
                    closing_cash_details?: Json | null;
                    total_cash_sales?: number;
                    total_card_sales?: number;
                    total_transfer_sales?: number;
                    total_debt_sales?: number;
                    total_returns?: number;
                    total_expenses?: number;
                    expected_cash?: number | null;
                    discrepancy_amount?: number | null;
                    reconciliation_status?: 'exact' | 'short' | 'over' | 'pending' | null;
                    reconciliation_notes?: string | null;
                    status?: 'active' | 'closed' | 'reconciled';
                };
            };
            audit_logs: {
                Row: {
                    id: string;
                    user_id: string | null;
                    action_type: string;
                    entity_type: string;
                    entity_id: string | null;
                    old_value: Json | null;
                    new_value: Json | null;
                    reason: string | null;
                    ip_address: string | null;
                    user_agent: string | null;
                    shift_id: string | null;
                    order_id: string | null;
                    product_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string | null;
                    action_type: string;
                    entity_type: string;
                    entity_id?: string | null;
                    old_value?: Json | null;
                    new_value?: Json | null;
                    reason?: string | null;
                    ip_address?: string | null;
                    user_agent?: string | null;
                    shift_id?: string | null;
                    order_id?: string | null;
                    product_id?: string | null;
                };
                Update: never; // Audit logs should never be updated
            };
            customers: {
                Row: {
                    id: string;
                    code: string | null;
                    name: string;
                    phone: string | null;
                    email: string | null;
                    address: string | null;
                    points_balance: number;
                    total_spent: number;
                    total_orders: number;
                    debt_balance: number;
                    notes: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    code?: string | null;
                    name: string;
                    phone?: string | null;
                    email?: string | null;
                    address?: string | null;
                    notes?: string | null;
                };
                Update: {
                    code?: string | null;
                    name?: string;
                    phone?: string | null;
                    email?: string | null;
                    address?: string | null;
                    points_balance?: number;
                    total_spent?: number;
                    total_orders?: number;
                    debt_balance?: number;
                    notes?: string | null;
                    is_active?: boolean;
                };
            };
            reminders: {
                Row: {
                    id: string;
                    title: string;
                    message: string | null;
                    type: 'shift_elapsed' | 'scheduled';
                    elapsed_minutes: number | null;
                    schedule_time: string | null;
                    days_of_week: number[] | null;
                    is_active: boolean;
                    repeat_interval: number | null;
                    max_repeats: number;
                    created_at: string;
                    created_by: string | null;
                };
                Insert: {
                    id?: string;
                    title: string;
                    message?: string | null;
                    type?: 'shift_elapsed' | 'scheduled';
                    elapsed_minutes?: number | null;
                    schedule_time?: string | null;
                    days_of_week?: number[] | null;
                    is_active?: boolean;
                    repeat_interval?: number | null;
                    max_repeats?: number;
                    created_by?: string | null;
                };
                Update: {
                    title?: string;
                    message?: string | null;
                    type?: 'shift_elapsed' | 'scheduled';
                    elapsed_minutes?: number | null;
                    schedule_time?: string | null;
                    days_of_week?: number[] | null;
                    is_active?: boolean;
                    repeat_interval?: number | null;
                    max_repeats?: number;
                };
            };
        };
    };
}
