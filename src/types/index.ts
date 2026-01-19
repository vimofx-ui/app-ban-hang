// =============================================================================
// GROCERY POS - TYPESCRIPT TYPES
// =============================================================================

// ============= Common Types =============
export type UUID = string;

export interface BaseEntity {
    id: UUID;
    created_at: string;
    updated_at?: string;
}

// ============= User Types =============
// ============= User Types =============
export type UserRole = 'admin' | 'staff' | string; // Allow dynamic roles
export type DiscountType = 'percent' | 'amount'; // Add DiscountType

export interface Role {
    id: UUID;
    name: string;
    description?: string;
    permissions: string[];
    is_system?: boolean; // If true, cannot delete (e.g. Admin)
}

export interface UserProfile extends BaseEntity {
    full_name: string;
    role: UserRole; // Storing the ID or Code. Ideally ID, but for compat, lets keep it string.
    role_id?: UUID; // Link to Role entity
    avatar_url?: string;
    phone?: string;
    email?: string;
    hourly_rate?: number;
    permissions?: string[]; // Optional override or cache
    is_active: boolean;
    assigned_branch_id?: string | null;
}

// ============= Product Types =============
export type ProductKind = 'normal' | 'combo' | 'unit_conversion';

export interface ComboItem {
    product_id: UUID;
    product_name?: string;
    quantity: number;
}

export interface Category extends BaseEntity {
    name: string;
    description?: string;
    parent_id?: UUID;
    sort_order: number;
}

export interface Product extends BaseEntity {
    code?: string; // Added code field
    sku?: string | null;
    barcode?: string | null;
    name: string;
    description?: string | null;
    category_id?: UUID | null;
    category_ids?: string[]; // Multi-category support
    brand_id?: string; // Brand reference
    product_type_id?: string; // Product type reference
    base_unit: string;
    purchase_price?: number; // Giá nhập - dùng cho đơn nhập hàng
    cost_price: number; // Giá vốn = avg từ giá nhập (tính tự động)
    avg_cost?: number; // WAC - Weighted Average Cost từ inventory_costs
    total_cost_value?: number; // Total inventory value = avg_cost * current_stock
    selling_price: number;
    wholesale_price?: number;
    current_stock: number;
    min_stock: number;
    allow_negative_stock: boolean;
    image_url?: string | null;
    weight?: number;
    brand?: string;
    tax_apply?: boolean;
    tax_rate?: number;
    is_active: boolean;
    units?: ProductUnit[];
    created_by?: string; // ID người tạo (để phân quyền xóa)
    created_by_name?: string; // Tên người tạo (để hiển thị)
    // Combo support
    product_kind?: ProductKind;
    combo_items?: ComboItem[];
    last_sold_at?: string; // Track last sale date for "not sold" filter
    total_sold?: number; // Track total quantity sold for sorting
    exclude_from_loyalty_points?: boolean; // If true, this product does not earn points
    attributes?: ProductAttribute[]; // Product attributes (e.g., color, size)
    variants?: ProductVariant[]; // Product variants (e.g., Lốc 6, Thùng 24)

    // Multi-Branch Pricing
    base_price?: number; // Original price before branch override
    has_price_override?: boolean; // Flag to indicate if price is overridden
}

// Product attribute for variants
export interface ProductAttribute {
    name: string; // e.g., "Màu sắc", "Kích thước"
    value: string; // e.g., "Đỏ", "XL"
}

// Product variant (phiên bản sản phẩm)
export interface ProductVariant {
    id: string;
    product_id?: string;
    name: string; // e.g., "Lốc 6", "Thùng 24"
    sku?: string;
    barcode?: string;
    selling_price?: number;
    cost_price?: number;
    current_stock?: number;
    image_url?: string;
    attributes?: ProductAttribute[];
    is_default?: boolean;
}

export interface ProductUnit extends BaseEntity {
    product_id: UUID;
    unit_name: string;
    conversion_rate: number;
    barcode?: string;
    sku?: string;
    selling_price?: number;
    cost_price?: number;
    is_base_unit: boolean;
    image_url?: string; // Image for this specific unit
}

// ============= Customer Types =============
export type Gender = 'male' | 'female' | 'other';

export interface Customer extends BaseEntity {
    code?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    gender?: Gender;
    date_of_birth?: string;  // Ngày sinh
    points_balance: number;
    total_spent: number;
    total_orders: number;
    debt_balance: number;
    notes?: string;
    is_active: boolean;
    last_purchase_at?: string; // Track last purchase time
    points?: number; // Alias for points_balance for UI compatibility
}

// ============= Order Types =============
export type OrderStatus =
    | 'draft'               // Chưa lưu
    | 'pending_approval'    // Chờ duyệt
    | 'approved'            // Đã duyệt - Chờ đóng gói
    | 'packing'             // Đang đóng gói
    | 'packed'              // Đã đóng gói - Chờ giao/Chờ lấy
    | 'shipping'            // Đang giao hàng
    | 'completed'           // Hoàn tất (Đã xuất kho & thanh toán)
    | 'returned'            // Trả hàng
    | 'cancelled';          // Đã hủy

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'debt' | 'mixed';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface DeliveryInfo {
    recipient_name: string;
    recipient_phone: string;
    shipping_address: string;
    delivery_notes?: string;
    carrier_name?: string;     // Đơn vị vận chuyển
    tracking_code?: string;    // Mã vận đơn
    delivery_fee?: number;     // Phí vận chuyển
    cod_amount?: number;       // Tiền thu hộ
    estimated_delivery?: string;

    // Vietnam Address Picker fields
    province?: string;
    province_code?: number;
    district?: string;
    district_code?: number;
    ward?: string;
    ward_code?: number;
    address_detail?: string;   // Số nhà, đường, tòa nhà...
}

export interface Order extends BaseEntity {
    order_number: string;
    brand_id?: UUID;
    branch_id?: UUID;
    shift_id?: UUID;
    customer_id?: UUID;
    status: OrderStatus;

    // Delivery fields (Phase 18)
    is_delivery?: boolean;
    delivery_info?: DeliveryInfo;
    source?: string;

    payment_status?: PaymentStatus;

    subtotal: number;
    discount_amount: number;
    discount_percent: number;
    points_used: number;
    points_discount: number;
    tax_amount: number;
    total_amount: number;

    payment_method?: PaymentMethod;
    cash_received: number;
    change_amount: number;
    transfer_amount: number;
    card_amount: number;
    debt_amount: number;

    // Debt tracking
    paid_amount?: number;          // Total amount paid (for debt orders)
    remaining_debt?: number;       // Remaining debt = debt_amount - paid_amount
    paid_at?: string;              // When fully paid

    original_order_id?: UUID;
    return_reason?: string;
    notes?: string;
    provisional_printed: boolean;
    receipt_printed: boolean;

    created_by?: UUID;

    // Workflow timestamps for each status change
    approved_at?: string;       // When order was approved
    packing_at?: string;        // When packing started
    packed_at?: string;         // When packing completed
    shipped_at?: string;        // When shipped/left warehouse
    completed_at?: string;      // When order completed
    cancelled_at?: string;      // When order was cancelled

    // Seller tracking (Phase 2)
    seller_id?: UUID;
    seller_name?: string;

    // Joined fields
    order_items?: OrderItem[];
    customer?: Customer;
}

export interface OrderItem extends BaseEntity {
    order_id: UUID;
    product_id: UUID;
    unit_id?: UUID;
    quantity: number;
    unit_price: number;
    discount_amount: number;
    total_price: number;
    base_quantity?: number;
    returned_quantity: number;
    notes?: string;

    // Joined fields for display
    product?: Product;
    unit?: ProductUnit;
}

// ============= Shift & Cash Types =============
export type ShiftStatus = 'active' | 'open' | 'closed' | 'reconciled';
export type ReconciliationStatus = 'exact' | 'short' | 'over' | 'pending';

export interface CashDenomination {
    value: number;
    name: string;
    quantity: number;
}

export interface CashDetails {
    denominations: CashDenomination[];
    total: number;
    notes?: string;
    handoverFrom?: string;
    handoverTo?: string;
    imgUrls?: string[];
}

export interface Shift extends BaseEntity {
    user_id: UUID;

    clock_in: string;
    clock_out?: string;

    opening_cash: number;
    opening_cash_details?: CashDetails;
    opening_bank_balance: number; // New: Bank balance at start

    closing_cash?: number;
    closing_cash_details?: CashDetails;
    closing_bank_balance?: number; // New: Bank balance at end

    total_cash_sales: number;
    total_card_sales: number;
    total_transfer_sales: number;
    total_debt_sales: number;
    total_point_sales: number;
    total_returns: number;
    total_expenses: number;

    // Salary Calculation
    salary_computed?: number; // Calculated salary for shift
    salary_rate_snapshot?: number; // Hourly rate at time of shift

    expected_cash?: number;
    discrepancy_amount?: number;
    reconciliation_status?: ReconciliationStatus;
    reconciliation_notes?: string;

    status: ShiftStatus;
}

// ============= Cash Reconciliation =============
export interface ReconciliationResult {
    opening_cash: number;
    total_cash_sales: number;
    total_expenses: number;
    expected_cash: number;
    actual_cash: number;
    discrepancy: number;
    status: ReconciliationStatus;
}

// ============= Audit Log Types =============
export type AuditActionType =
    | 'ghost_scan'      // Item deleted from cart
    | 'cart_cleared'    // Cart was cleared
    | 'price_edit'      // Selling price changed
    | 'order_cancel'    // Order cancelled
    | 'stock_adjust'    // Stock manually adjusted
    | 'void_item'       // Item voided during sale
    | 'discount_apply'  // Discount applied
    | 'refund';         // Refund processed

export interface AuditLog extends BaseEntity {
    user_id?: UUID;
    action_type: AuditActionType;
    entity_type: string;
    entity_id?: UUID;
    old_value?: Record<string, unknown>;
    new_value?: Record<string, unknown>;
    reason?: string;
    ip_address?: string;
    user_agent?: string;
    shift_id?: UUID;
    order_id?: UUID;
    product_id?: UUID;
}

// ============= Transaction Types =============
export type TransactionType = 'income' | 'expense';

export interface TransactionCategory extends BaseEntity {
    name: string;
    type: TransactionType;
    description?: string;
    is_active: boolean;
}

export interface Transaction extends BaseEntity {
    transaction_number: string;
    shift_id?: UUID;
    category_id?: UUID;
    type: TransactionType;
    amount: number;
    payment_method: 'cash' | 'transfer' | 'card';
    description?: string;
    reference_type?: string;
    reference_id?: UUID;
    attachment_url?: string;
    created_by?: UUID;
    transaction_date: string;
    is_accounting?: boolean; // Hạch toán vào kết quả kinh doanh?
    target_name?: string; // Tên đối tượng (Khách hàng/NCC)
}

// ============= Supplier Types =============
export interface Supplier extends BaseEntity {
    code?: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    tax_id?: string;
    payment_terms: number;
    notes?: string;
    is_active: boolean;
    debt_balance: number;          // Công nợ với nhà cung cấp
    brand_id?: string;
}

// ============= Debt Payment Types =============
export type DebtPaymentType = 'customer' | 'supplier';

export interface DebtPayment extends BaseEntity {
    payment_type: DebtPaymentType;
    order_id?: UUID;               // Đơn hàng liên quan (customer)
    purchase_order_id?: UUID;      // Đơn nhập liên quan (supplier)
    customer_id?: UUID;            // Khách hàng
    supplier_id?: UUID;            // Nhà cung cấp
    amount: number;                // Số tiền thanh toán
    payment_method: 'cash' | 'transfer' | 'card';
    debt_before: number;           // Công nợ trước khi thanh toán
    debt_after: number;            // Công nợ sau khi thanh toán
    notes?: string;
    created_by?: UUID;
    created_by_name?: string;
}

// ============= Purchase Order Types =============
export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'received' | 'cancelled';

export interface PurchaseOrder extends BaseEntity {
    po_number: string;
    supplier_id?: UUID;
    brand_id?: UUID;
    branch_id?: UUID;
    status: PurchaseOrderStatus;
    subtotal: number;
    discount_amount: number;
    discount_percent: number;
    points_used?: number;
    points_discount?: number;
    tax_amount: number;
    total_amount: number;

    // Cost Allocation Fields (Phase C)
    shipping_cost?: number;      // Phí vận chuyển
    import_tax?: number;         // Thuế nhập khẩu
    other_costs?: number;        // Chi phí khác
    supplier_discount?: number;  // Chiết khấu từ NCC (giảm tổng đơn)

    notes?: string;
    tags?: string[];
    invoice_images?: string[]; // Array of image URLs or base64 data
    expected_date?: string;
    received_date?: string;
    created_by?: UUID;
    received_by?: UUID;
}

export interface PurchaseOrderItem extends BaseEntity {
    purchase_order_id: UUID;
    product_id: UUID;
    unit_id?: UUID;
    quantity: number;
    received_quantity: number;
    returned_quantity?: number;
    unit_price: number;
    total_price: number;

    // Cost Allocation Fields
    allocated_cost?: number;     // Chi phí phân bổ cho mục này (tổng)
    final_unit_cost?: number;    // Giá vốn cuối cùng đơn vị (sau khi cộng chi phí phân bổ)
}

// ============= Search Types =============
export interface ProductUnitBasic {
    id: string;
    unit_name: string;
    conversion_rate: number;
    cost_price?: number;
    selling_price?: number;
    barcode?: string;
    sku?: string;
}

export interface ProductSearchItem {
    id: string; // Composite: product_id or product_id-unit_id
    product_id: string;
    name: string; // Display name (e.g. "Bia Tiger (Thùng)")
    unit_name: string;
    barcode?: string;
    sku?: string;
    price: number; // Selling price
    cost_price: number; // Purchase/Cost price
    purchase_price?: number; // Latest purchase price
    stock: number; // Converted stock
    image_url?: string;
    type: 'product' | 'unit';

    // Original references
    product: Product;
    unit?: ProductUnitBasic;
}

// ============= Payment Method Config =============
export interface PaymentMethodConfig {
    id: string;
    name: string;
    icon: string; // Emoji or URL to uploaded icon
    iconType: 'emoji' | 'url';
    enabled: boolean; // Show in POS
    sortOrder: number; // Display order
    isSystem: boolean; // Cannot delete system methods (cash, transfer, card, debt)
}

// ============= Payment Split for Multi-Payment =============
export interface PaymentSplit {
    methodId: string;
    methodName: string;
    amount: number;
    pointsUsed?: number; // For points payment
}

// Payment Split used in POS Page (Phase 3 Legacy/Simpler version)
export interface POSPaymentSplit {
    cash: number;
    transfer: number;
    card: number;
    debt: number;
    points: number;
    [key: string]: number;
}

// ============= Reminder Types =============
export interface Reminder extends BaseEntity {
    title: string;
    message?: string;
    type: 'shift_elapsed' | 'scheduled';
    elapsed_minutes?: number; // For shift_elapsed
    schedule_time?: string; // HH:MM:SS for scheduled
    days_of_week?: number[]; // 0-6 or null
    is_active: boolean;
    repeat_interval?: number; // Minutes
    max_repeats: number; // Default 1
    created_by?: UUID;
}
