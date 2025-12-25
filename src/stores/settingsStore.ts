// =============================================================================
// SETTINGS STORE - App Configuration with Advanced Features
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// INTERFACES
// ============================================================================

export interface LoyaltySettings {
    enabled: boolean;
    pointsPerAmount: number;
    redemptionRate: number;
    minPointsToRedeem: number;
}

export interface PaymentMethodConfig {
    id: string;
    name: string;
    icon: string; // Emoji or URL to uploaded icon
    iconType: 'emoji' | 'url';
    enabled: boolean;
    sortOrder: number;
    isSystem: boolean; // Cannot delete system methods (cash, transfer, card, debt)
}

export interface ReceiptSettings {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    storeLogo?: string;
    showQRCode: boolean;
    footerText: string;
    paperWidth: '58mm' | '80mm';
}

// =============================================================================
// PRINT SETTINGS - Printer Connection & Template Configuration
// =============================================================================

export type PrintTemplateType =
    | 'sales_receipt'      // Hóa đơn bán hàng
    | 'cash_voucher'       // Phiếu chi
    | 'purchase_receipt'   // Phiếu nhập hàng
    | 'stock_check'        // Phiếu kiểm kho
    | 'return_receipt'     // Phiếu đổi/trả
    | 'order_form'         // Đơn đặt hàng
    | 'transfer_receipt'   // Phiếu chuyển kho
    | 'supplier_return'    // Đơn trả NCC
    | 'barcode_label';     // Tem mã vạch

export interface PrintTemplateConfig {
    enabled: boolean;
    paperWidth: '58mm' | '80mm' | 'A5' | 'A4';
    showLogo: boolean;
    showBarcode: boolean;
    showQRCode: boolean;
    copies: number;
    autoPrint: boolean;
}

export interface PrinterSettings {
    method: 'driver' | 'usb' | 'lan';
    lanIp: string;
    lanPort: string;
    usbDeviceName: string | null;
    isUsbConnected: boolean;
}

export interface SalesReceiptConfig extends PrintTemplateConfig {
    showCustomerInfo: boolean;
    showPaymentDetails: boolean;
    showPointsEarned: boolean;
    showPointsTotal: boolean;
    logoPosition: 'center' | 'left' | 'right';
}

export interface CashVoucherConfig extends PrintTemplateConfig {
    showApprover: boolean;
    showReason: boolean;
}

export interface PurchaseReceiptConfig extends PrintTemplateConfig {
    showSupplierInfo: boolean;
    showPaymentStatus: boolean;
}

export interface StockCheckConfig extends PrintTemplateConfig {
    showDifference: boolean;
    showAdjustmentValue: boolean;
}

export interface ReturnReceiptConfig extends PrintTemplateConfig {
    showReturnReason: boolean;
    showCustomerInfo: boolean;
    showRefundAmount: boolean;
}

export interface OrderFormConfig extends PrintTemplateConfig {
    showDeliveryInfo: boolean;
    showDepositAmount: boolean;
}

export interface TransferReceiptConfig extends PrintTemplateConfig {
    showFromWarehouse: boolean;
    showToWarehouse: boolean;
}

export interface SupplierReturnConfig extends PrintTemplateConfig {
    showReturnReason: boolean;
    showRefundExpected: boolean;
}

// Barcode Label Config (Tem mã vạch)
export interface LabelConfig {
    cols: 1 | 2 | 3;                    // Số cột tem/hàng
    paperWidth: number;                  // Khổ giấy (mm)
    labelHeight: number;                 // Cao tem (mm)
    colGap: number;                      // Khoảng cách ngang (mm)
    rowGap: number;                      // Khoảng cách dọc (mm)
    showShopName: boolean;               // Hiển thị tên cửa hàng
    showProductName: boolean;            // Hiển thị tên sản phẩm
    showBarcode: boolean;                // Hiển thị mã vạch
    showPrice: boolean;                  // Hiển thị giá
    fontSize: number;                    // Cỡ chữ chung (px)
    textAlign: 'center' | 'left';        // Căn lề
    barcodeWidth: number;                // Chiều rộng mã vạch (mm)
    barcodeHeight: number;               // Chiều cao mã vạch (mm)
    productFontSize: number;             // Cỡ chữ tên sản phẩm (px)
    priceFontSize: number;               // Cỡ chữ giá (px)
}

// Shipping Label Config (Vận đơn)
export interface ShippingLabelConfig {
    paperSize: '100x150' | '75x100' | '50x50';  // Kích thước giấy
    showSender: boolean;                 // Hiển thị người gửi
    showRecipient: boolean;              // Hiển thị người nhận
    showItems: boolean;                  // Hiển thị danh sách hàng
    showCod: boolean;                    // Hiển thị tiền COD
    showNote: boolean;                   // Hiển thị ghi chú
    customNote: string;                  // Ghi chú tùy chỉnh
    showOrderBarcode: boolean;           // Hiển thị mã vạch đơn hàng
    showLogo: boolean;                   // Hiển thị logo
}

export interface PrintSettings {
    // Store info (shared across templates)
    storeName: string;
    storeAddress: string;
    storePhone: string;
    storeLogo?: string;
    logoSize: number; // Logo width in pixels (40-150)
    footerText: string;
    noteText?: string; // Lưu ý bên dưới lời cảm ơn

    // Printer connection
    printer: PrinterSettings;

    // Template configs
    templates: {
        sales_receipt: SalesReceiptConfig;
        cash_voucher: CashVoucherConfig;
        purchase_receipt: PurchaseReceiptConfig;
        stock_check: StockCheckConfig;
        return_receipt: ReturnReceiptConfig;
        order_form: OrderFormConfig;
        transfer_receipt: TransferReceiptConfig;
        supplier_return: SupplierReturnConfig;
        barcode_label: PrintTemplateConfig;
    };
}


// NEW: Expiry Date Settings
export interface ExpirySettings {
    enabled: boolean;
    alertDays: number[];           // Days before expiry to show alerts [7, 14, 30]
    blockSaleOnExpiry: boolean;    // Prevent selling expired products
    showExpiryOnReceipt: boolean;
    autoMarkdownEnabled: boolean;  // Auto-discount near expiry
    autoMarkdownDays: number;      // Days before expiry to apply markdown
    autoMarkdownPercent: number;   // Discount percentage
}

// NEW: Stock Alert Settings
export interface StockAlertSettings {
    enabled: boolean;
    lowStockThreshold: number;     // Default threshold for all products
    criticalStockThreshold: number; // Critical level
    showOnDashboard: boolean;
    emailNotification: boolean;
    autoReorderEnabled: boolean;   // Auto-create purchase orders
}

// NEW: Promotion Types
export type PromotionType =
    | 'percentage'      // X% off
    | 'fixed_amount'    // Fixed VND off
    | 'buy_x_get_y'     // Buy X get Y free
    | 'bundle'          // Bundle deal
    | 'happy_hour';     // Time-based

export interface Promotion {
    id: string;
    name: string;
    type: PromotionType;
    active: boolean;
    startDate: string;
    endDate: string;
    // For percentage/fixed
    discountValue?: number;
    minPurchase?: number;
    maxDiscount?: number;
    // For buy_x_get_y
    buyQuantity?: number;
    getQuantity?: number;
    // For bundle
    bundleProducts?: string[];  // Product IDs
    bundlePrice?: number;
    // For happy_hour
    startTime?: string;  // "10:00"
    endTime?: string;    // "14:00"
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    // Conditions
    applicableProducts?: string[]; // Empty = all products
    applicableCategories?: string[];
    customerGroups?: string[];     // Empty = all customers
    couponCode?: string;
    usageLimit?: number;
    usedCount: number;
    // Auto-Gift Configuration
    autoGift?: {
        enabled: boolean;
        triggerProducts: string[];    // Product IDs that trigger the gift
        triggerQuantity: number;      // Min quantity to trigger (e.g., buy 2 get 1 free)
        giftProducts: {
            productId: string;
            quantity: number;
            maxPerOrder?: number;     // Maximum gift count per order
        }[];
        giftCondition: 'any' | 'all'; // 'any' = any trigger product, 'all' = all required
        autoAdd: boolean;             // Auto-add gift to cart when condition met
        autoRemove: boolean;          // Auto-remove gift when condition no longer met
    };
}

export interface PromotionSettings {
    promotions: Promotion[];
    stackable: boolean;           // Allow multiple promos per order
    maxPromotionsPerOrder: number;
}

// NEW: Notification Settings (Medium Priority)
export interface NotificationSettings {
    smsEnabled: boolean;
    emailEnabled: boolean;
    smsProvider: 'esms' | 'speedsms' | 'fpt' | 'none';
    smsApiKey?: string;
    smsSenderId?: string;
    emailProvider: 'gmail' | 'sendgrid' | 'mailgun' | 'none';
    emailApiKey?: string;
    emailFrom?: string;

    // Notification Types
    orderConfirmation: boolean;    // SMS when order completed
    shippingUpdate: boolean;       // SMS when order shipped
    birthdayWish: boolean;         // Birthday message with voucher
    loyaltyReminder: boolean;      // Remind about unused points
    debtReminder: boolean;         // Remind about outstanding debt
    promotionBlast: boolean;       // Marketing SMS about promotions

    // Templates
    templates: {
        orderConfirmation: string;
        birthdayWish: string;
        debtReminder: string;
    };
}

// NEW: Debt/Credit Management Settings (Medium Priority)
export interface DebtSettings {
    enabled: boolean;
    defaultCreditLimit: number;       // Default credit limit for new customers (VND)
    maxCreditLimit: number;           // Maximum allowed credit limit
    warningThreshold: number;         // Warn when debt reaches X% of limit
    blockSaleOnOverLimit: boolean;    // Block sales when over limit
    overdueDays: number;              // Days after which debt is considered overdue
    sendOverdueReminder: boolean;     // Auto-send reminder for overdue debt
    reminderDays: number[];           // Days before/after due date to send reminders [-3, 0, 7, 14]
    interestRate: number;             // Monthly interest rate for overdue debt (%)
    applyInterest: boolean;           // Whether to apply interest on overdue
}

// NEW: Shift Settings
export interface ShiftSettings {
    mode: 'auto' | 'manual'; // 'auto' = real-time, 'manual' = user picks time
    showRevenueInReconciliation: boolean; // Whether to show revenue in end-shift reconciliation
    showDiscrepancyInReconciliation: boolean; // Whether to show discrepancy calculation (separate from revenue)
}

// NEW: POS Category Settings
export interface CustomProductList {
    id: string;
    name: string;
    productIds: string[];
    sortOrder: number;
}

export interface POSCategorySettings {
    visibleCategoryIds: string[];    // Category IDs to show (empty = all)
    customLists: CustomProductList[]; // User-created product lists
    categoryOrder: string[];          // Order of category tabs (IDs)
    defaultCategoryId: string;        // Default selected category ('all' or category ID)
    showAllTab: boolean;              // Whether to show "Tất cả" tab
    productGridColumns: number;       // Number of columns in product grid (3-9)
}

// ============================================================================
// MAIN STATE
// ============================================================================

export interface SettingsState {
    loyalty: LoyaltySettings;
    paymentMethods: PaymentMethodConfig[];
    defaultPaymentMethod: string; // Default payment method ID for POS
    receipt: ReceiptSettings;
    allowNegativeStock: boolean;

    // High Priority Settings
    expiry: ExpirySettings;
    stockAlerts: StockAlertSettings;
    promotionSettings: PromotionSettings;

    // Medium Priority Settings
    notifications: NotificationSettings;
    debt: DebtSettings;
    shift: ShiftSettings; // Added shift settings

    // POS Category Settings
    posCategories: POSCategorySettings;

    // Print Settings
    printSettings: PrintSettings;

    // Label Printing Settings
    labelConfig: LabelConfig; // Legacy single config
    labelConfigs: {
        single: LabelConfig;  // 1 tem/hàng
        double: LabelConfig;  // 2 tem/hàng
        triple: LabelConfig;  // 3 tem/hàng
    };
    shippingLabelConfig: ShippingLabelConfig;

    // Actions
    updateLoyalty: (settings: Partial<LoyaltySettings>) => void;
    updatePaymentMethod: (id: string, updates: Partial<PaymentMethodConfig>) => void;
    addPaymentMethod: (method: Omit<PaymentMethodConfig, 'sortOrder'>) => void;
    deletePaymentMethod: (id: string) => void;
    reorderPaymentMethods: (methods: PaymentMethodConfig[]) => void;
    setDefaultPaymentMethod: (id: string) => void;
    updateReceipt: (settings: Partial<ReceiptSettings>) => void;
    setAllowNegativeStock: (allow: boolean) => void;
    calculatePoints: (amount: number) => number;
    calculateDiscount: (points: number) => number;

    // High Priority Actions
    updateExpiry: (settings: Partial<ExpirySettings>) => void;
    updateStockAlerts: (settings: Partial<StockAlertSettings>) => void;
    addPromotion: (promotion: Omit<Promotion, 'id' | 'usedCount'>) => void;
    updatePromotion: (id: string, updates: Partial<Promotion>) => void;
    deletePromotion: (id: string) => void;
    updatePromotionSettings: (settings: Partial<Omit<PromotionSettings, 'promotions'>>) => void;
    getActivePromotions: () => Promotion[];

    // Medium Priority Actions
    updateNotifications: (settings: Partial<NotificationSettings>) => void;
    updateDebt: (settings: Partial<DebtSettings>) => void;

    // POS Category Actions
    updatePosCategories: (settings: Partial<POSCategorySettings>) => void;
    addCustomList: (name: string) => CustomProductList;
    updateCustomList: (id: string, updates: Partial<CustomProductList>) => void;
    deleteCustomList: (id: string) => void;
    reorderCategories: (order: string[]) => void;
    updateShiftSettings: (settings: Partial<ShiftSettings>) => void;

    // Print Settings Actions
    updatePrintSettings: (settings: Partial<PrintSettings>) => void;
    updatePrinter: (settings: Partial<PrinterSettings>) => void;
    updatePrintTemplate: (
        templateType: PrintTemplateType,
        settings: Partial<PrintTemplateConfig>
    ) => void;

    // Label Printing Actions
    updateLabelConfig: (settings: Partial<LabelConfig>) => void;
    updateLabelConfigByLayout: (layout: 'single' | 'double' | 'triple', settings: Partial<LabelConfig>) => void;
    updateShippingLabelConfig: (settings: Partial<ShippingLabelConfig>) => void;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
    { id: 'cash', name: 'Tiền mặt', icon: '💵', iconType: 'emoji', enabled: true, sortOrder: 0, isSystem: true },
    { id: 'transfer', name: 'Chuyển khoản', icon: '🏦', iconType: 'emoji', enabled: true, sortOrder: 1, isSystem: true },
    { id: 'card', name: 'Thẻ', icon: '💳', iconType: 'emoji', enabled: true, sortOrder: 2, isSystem: true },
    { id: 'momo', name: 'MoMo', icon: '🟣', iconType: 'emoji', enabled: false, sortOrder: 3, isSystem: false },
    { id: 'zalopay', name: 'ZaloPay', icon: '🔵', iconType: 'emoji', enabled: false, sortOrder: 4, isSystem: false },
    { id: 'vnpay', name: 'VNPay', icon: '🔴', iconType: 'emoji', enabled: false, sortOrder: 5, isSystem: false },
    { id: 'debt', name: 'Ghi nợ', icon: '📝', iconType: 'emoji', enabled: true, sortOrder: 6, isSystem: true },
];

const DEFAULT_EXPIRY_SETTINGS: ExpirySettings = {
    enabled: true,
    alertDays: [7, 14, 30],
    blockSaleOnExpiry: true,
    showExpiryOnReceipt: false,
    autoMarkdownEnabled: false,
    autoMarkdownDays: 7,
    autoMarkdownPercent: 20,
};

const DEFAULT_STOCK_ALERTS: StockAlertSettings = {
    enabled: true,
    lowStockThreshold: 10,
    criticalStockThreshold: 3,
    showOnDashboard: true,
    emailNotification: false,
    autoReorderEnabled: false,
};

const DEFAULT_PROMOTION_SETTINGS: PromotionSettings = {
    promotions: [],
    stackable: false,
    maxPromotionsPerOrder: 1,
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    smsEnabled: false,
    emailEnabled: false,
    smsProvider: 'none',
    emailProvider: 'none',
    orderConfirmation: true,
    shippingUpdate: false,
    birthdayWish: true,
    loyaltyReminder: true,
    debtReminder: true,
    promotionBlast: false,
    templates: {
        orderConfirmation: 'Cảm ơn {customer_name}! Đơn hàng #{order_number} đã hoàn tất. Tổng: {total}. Cửa hàng {store_name}',
        birthdayWish: 'Chúc mừng sinh nhật {customer_name}! {store_name} tặng bạn mã giảm giá {coupon_code} - Giảm {discount}%',
        debtReminder: '{customer_name}, bạn còn công nợ {debt_amount} tại {store_name}. Vui lòng thanh toán trước {due_date}',
    },
};

const DEFAULT_DEBT_SETTINGS: DebtSettings = {
    enabled: true,
    defaultCreditLimit: 5000000,   // 5 million VND
    maxCreditLimit: 50000000,     // 50 million VND
    warningThreshold: 80,         // Warn at 80% of limit
    blockSaleOnOverLimit: false,
    overdueDays: 30,
    sendOverdueReminder: true,
    reminderDays: [-3, 0, 7, 14], // 3 days before, on due date, 7 & 14 days after
    interestRate: 0,
    applyInterest: false,
};

const DEFAULT_POS_CATEGORIES: POSCategorySettings = {
    visibleCategoryIds: [],       // Empty = show all categories
    customLists: [],
    categoryOrder: [],            // Empty = use default order
    defaultCategoryId: 'all',     // Default to "Tất cả" tab
    showAllTab: true,
    productGridColumns: 6,        // Default 6 columns
};

// Default template config base
const DEFAULT_TEMPLATE_BASE: PrintTemplateConfig = {
    enabled: true,
    paperWidth: '80mm',
    showLogo: true,
    showBarcode: true,
    showQRCode: false,
    copies: 1,
    autoPrint: false,
};

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
    storeName: 'GROCERY POS',
    storeAddress: '123 Đường ABC, Quận XYZ, TP.HCM',
    storePhone: '0901234567',
    footerText: 'Cảm ơn quý khách! Hẹn gặp lại.',
    noteText: 'Hàng đã mua không đổi/trả. Giữ hóa đơn để được bảo hành.',
    logoSize: 80, // Logo width in pixels (40-150)

    printer: {
        method: 'driver',
        lanIp: '192.168.1.200',
        lanPort: '9100',
        usbDeviceName: null,
        isUsbConnected: false,
    },

    templates: {
        sales_receipt: {
            ...DEFAULT_TEMPLATE_BASE,
            autoPrint: true,  // Auto print on checkout
            showCustomerInfo: true,
            showPaymentDetails: true,
            showPointsEarned: true,
            showPointsTotal: true,
            logoPosition: 'center',
        },
        cash_voucher: {
            ...DEFAULT_TEMPLATE_BASE,
            paperWidth: 'A5',
            showApprover: true,
            showReason: true,
        },
        purchase_receipt: {
            ...DEFAULT_TEMPLATE_BASE,
            showSupplierInfo: true,
            showPaymentStatus: true,
        },
        stock_check: {
            ...DEFAULT_TEMPLATE_BASE,
            paperWidth: 'A4',
            showDifference: true,
            showAdjustmentValue: true,
        },
        return_receipt: {
            ...DEFAULT_TEMPLATE_BASE,
            showReturnReason: true,
            showCustomerInfo: true,
            showRefundAmount: true,
        },
        order_form: {
            ...DEFAULT_TEMPLATE_BASE,
            showDeliveryInfo: true,
            showDepositAmount: true,
        },
        transfer_receipt: {
            ...DEFAULT_TEMPLATE_BASE,
            showFromWarehouse: true,
            showToWarehouse: true,
        },
        supplier_return: {
            ...DEFAULT_TEMPLATE_BASE,
            showReturnReason: true,
            showRefundExpected: true,
        },
        barcode_label: {
            ...DEFAULT_TEMPLATE_BASE,
            paperWidth: '80mm',
        },
    },
};

const DEFAULT_LABEL_CONFIG: LabelConfig = {
    cols: 3,
    paperWidth: 105,
    labelHeight: 22,
    colGap: 2,
    rowGap: 2,
    showShopName: true,
    showProductName: true,
    showBarcode: true,
    showPrice: true,
    fontSize: 10,
    textAlign: 'center',
    barcodeWidth: 40,
    barcodeHeight: 15,
    productFontSize: 10,
    priceFontSize: 12,
};

// Separate configs for each layout type
const DEFAULT_LABEL_CONFIGS = {
    single: {
        cols: 1 as const,
        paperWidth: 50,
        labelHeight: 30,
        colGap: 0,
        rowGap: 2,
        showShopName: true,
        showProductName: true,
        showBarcode: true,
        showPrice: true,
        fontSize: 11,
        textAlign: 'center' as const,
        barcodeWidth: 30,
        barcodeHeight: 6,
        productFontSize: 12,
        priceFontSize: 13,
    },
    double: {
        cols: 2 as const,
        paperWidth: 74,
        labelHeight: 22,
        colGap: 2,
        rowGap: 2,
        showShopName: true,
        showProductName: true,
        showBarcode: true,
        showPrice: true,
        fontSize: 10,
        textAlign: 'center' as const,
        barcodeWidth: 23,
        barcodeHeight: 4,
        productFontSize: 11,
        priceFontSize: 11,
    },
    triple: {
        cols: 3 as const,
        paperWidth: 110,
        labelHeight: 22,
        colGap: 2,
        rowGap: 2,
        showShopName: true,
        showProductName: true,
        showBarcode: true,
        showPrice: true,
        fontSize: 11,
        textAlign: 'center' as const,
        barcodeWidth: 25,
        barcodeHeight: 5,
        productFontSize: 9,
        priceFontSize: 10,
    },
};

const DEFAULT_SHIPPING_LABEL_CONFIG: ShippingLabelConfig = {
    paperSize: '100x150',
    showSender: true,
    showRecipient: true,
    showItems: true,
    showCod: true,
    showNote: true,
    customNote: 'Cho xem hàng - Không thử',
    showOrderBarcode: true,
    showLogo: true,
};

// ============================================================================
// STORE
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            // Existing settings
            loyalty: {
                enabled: true,
                pointsPerAmount: 10000,
                redemptionRate: 1000,
                minPointsToRedeem: 10,
            },
            paymentMethods: DEFAULT_PAYMENT_METHODS,
            defaultPaymentMethod: 'cash', // Default to cash
            receipt: {
                storeName: 'GROCERY POS',
                storeAddress: '123 Đường ABC, Quận XYZ, TP.HCM',
                storePhone: '0901234567',
                showQRCode: true,
                footerText: 'Cảm ơn quý khách! Hẹn gặp lại.',
                paperWidth: '80mm',
            },
            allowNegativeStock: false,

            // NEW settings
            expiry: DEFAULT_EXPIRY_SETTINGS,
            stockAlerts: DEFAULT_STOCK_ALERTS,
            promotionSettings: DEFAULT_PROMOTION_SETTINGS,
            shift: { mode: 'auto', showRevenueInReconciliation: true, showDiscrepancyInReconciliation: true }, // Default to show both

            // Medium Priority settings
            notifications: DEFAULT_NOTIFICATION_SETTINGS,
            debt: DEFAULT_DEBT_SETTINGS,

            // POS Category settings
            posCategories: DEFAULT_POS_CATEGORIES,

            // Print settings
            printSettings: DEFAULT_PRINT_SETTINGS,

            // Label Printing settings
            labelConfig: DEFAULT_LABEL_CONFIG,
            labelConfigs: DEFAULT_LABEL_CONFIGS,
            shippingLabelConfig: DEFAULT_SHIPPING_LABEL_CONFIG,

            // Existing actions
            updateLoyalty: (settings) => {
                set((state) => ({
                    loyalty: { ...state.loyalty, ...settings }
                }));
            },

            updatePaymentMethod: (id, updates) => {
                set((state) => ({
                    paymentMethods: state.paymentMethods.map((m) =>
                        m.id === id ? { ...m, ...updates } : m
                    )
                }));
            },

            reorderPaymentMethods: (methods) => {
                set({ paymentMethods: methods });
            },

            addPaymentMethod: (method) => {
                set((state) => {
                    const maxOrder = Math.max(...state.paymentMethods.map(m => m.sortOrder), -1);
                    return {
                        paymentMethods: [
                            ...state.paymentMethods,
                            { ...method, sortOrder: maxOrder + 1 }
                        ]
                    };
                });
            },

            deletePaymentMethod: (id) => {
                set((state) => {
                    const method = state.paymentMethods.find(m => m.id === id);
                    if (method?.isSystem) return state; // Cannot delete system methods
                    return {
                        paymentMethods: state.paymentMethods.filter(m => m.id !== id)
                    };
                });
            },

            setDefaultPaymentMethod: (id) => {
                set({ defaultPaymentMethod: id });
            },

            updateReceipt: (settings) => {
                set((state) => ({
                    receipt: { ...state.receipt, ...settings }
                }));
            },

            setAllowNegativeStock: (allow) => {
                set({ allowNegativeStock: allow });
            },

            calculatePoints: (amount) => {
                const { loyalty } = get();
                if (!loyalty.enabled || amount <= 0) return 0;
                return Math.floor(amount / loyalty.pointsPerAmount);
            },

            calculateDiscount: (points) => {
                const { loyalty } = get();
                if (!loyalty.enabled || points < loyalty.minPointsToRedeem) return 0;
                return points * loyalty.redemptionRate;
            },

            // NEW actions
            updateExpiry: (settings) => {
                set((state) => ({
                    expiry: { ...state.expiry, ...settings }
                }));
            },

            updateStockAlerts: (settings) => {
                set((state) => ({
                    stockAlerts: { ...state.stockAlerts, ...settings }
                }));
            },

            addPromotion: (promotion) => {
                const newPromotion: Promotion = {
                    ...promotion,
                    id: `promo-${Date.now()}`,
                    usedCount: 0,
                };
                set((state) => ({
                    promotionSettings: {
                        ...state.promotionSettings,
                        promotions: [...state.promotionSettings.promotions, newPromotion],
                    }
                }));
            },

            updatePromotion: (id, updates) => {
                set((state) => ({
                    promotionSettings: {
                        ...state.promotionSettings,
                        promotions: state.promotionSettings.promotions.map((p) =>
                            p.id === id ? { ...p, ...updates } : p
                        ),
                    }
                }));
            },

            deletePromotion: (id) => {
                set((state) => ({
                    promotionSettings: {
                        ...state.promotionSettings,
                        promotions: state.promotionSettings.promotions.filter((p) => p.id !== id),
                    }
                }));
            },

            updatePromotionSettings: (settings) => {
                set((state) => ({
                    promotionSettings: { ...state.promotionSettings, ...settings }
                }));
            },

            getActivePromotions: () => {
                const { promotionSettings } = get();
                const now = new Date();
                return promotionSettings.promotions.filter((p) => {
                    if (!p.active) return false;
                    const start = new Date(p.startDate);
                    const end = new Date(p.endDate);
                    return now >= start && now <= end;
                });
            },

            // Medium Priority actions
            updateNotifications: (settings) => {
                set((state) => ({
                    notifications: { ...state.notifications, ...settings }
                }));
            },

            updateDebt: (settings) => {
                set((state) => ({
                    debt: { ...state.debt, ...settings }
                }));
            },

            // POS Category Actions

            updatePosCategories: (settings) => {
                set((state) => ({
                    posCategories: { ...state.posCategories, ...settings }
                }));
            },

            addCustomList: (name) => {
                const newList: CustomProductList = {
                    id: `list-${Date.now()}`,
                    name,
                    productIds: [],
                    sortOrder: get().posCategories.customLists.length,
                };
                set((state) => ({
                    posCategories: {
                        ...state.posCategories,
                        customLists: [...state.posCategories.customLists, newList],
                    }
                }));
                return newList;
            },

            updateCustomList: (id, updates) => {
                set((state) => ({
                    posCategories: {
                        ...state.posCategories,
                        customLists: state.posCategories.customLists.map((list) =>
                            list.id === id ? { ...list, ...updates } : list
                        ),
                    }
                }));
            },

            deleteCustomList: (id) => {
                set((state) => ({
                    posCategories: {
                        ...state.posCategories,
                        customLists: state.posCategories.customLists.filter((list) => list.id !== id),
                    }
                }));
            },

            updateShiftSettings: (settings: Partial<ShiftSettings>) => {
                set((state) => ({ shift: { ...state.shift, ...settings } }));
            },

            reorderCategories: (order) => {
                set((state) => ({
                    posCategories: { ...state.posCategories, categoryOrder: order }
                }));
            },

            // Print Settings Actions
            updatePrintSettings: (settings) => {
                set((state) => ({
                    printSettings: { ...state.printSettings, ...settings }
                }));
            },

            updatePrinter: (settings) => {
                set((state) => ({
                    printSettings: {
                        ...state.printSettings,
                        printer: { ...state.printSettings.printer, ...settings }
                    }
                }));
            },

            updatePrintTemplate: (templateType, settings) => {
                set((state) => ({
                    printSettings: {
                        ...state.printSettings,
                        templates: {
                            ...state.printSettings.templates,
                            [templateType]: {
                                ...(state.printSettings.templates as any)[templateType],
                                ...settings
                            }
                        }
                    }
                }));
            },

            // Label Printing Actions
            updateLabelConfig: (settings) => {
                set((state) => ({
                    labelConfig: { ...state.labelConfig, ...settings }
                }));
            },

            updateLabelConfigByLayout: (layout, settings) => {
                set((state) => ({
                    labelConfigs: {
                        ...state.labelConfigs,
                        [layout]: { ...state.labelConfigs[layout], ...settings }
                    }
                }));
            },

            updateShippingLabelConfig: (settings) => {
                set((state) => ({
                    shippingLabelConfig: { ...state.shippingLabelConfig, ...settings }
                }));
            },
        }),
        {
            name: 'settings-store',
        }
    )
);
