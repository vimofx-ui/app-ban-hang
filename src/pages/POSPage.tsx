// =============================================================================
// POS PAGE - Multi-Order Tabs, Enhanced UX, Security Logging
// =============================================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOSStore, type CartItem } from '@/stores/posStore';
import { ShiftControlModal } from '@/components/pos/ShiftControlModal';
import { ReminderManager, ReminderPopup } from '@/components/pos/ReminderComponents';
import { useShiftStore } from '@/stores/shiftStore';
import { useReminderStore } from '@/stores/reminderStore';
import { useProductStore } from '@/stores/productStore';
import { useCustomerStore } from '@/stores/customerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { CustomerModal } from '@/components/customers/CustomerModal';
import { BarcodeSelectionModal, findProductsByBarcode, type BarcodeMatch } from '@/components/common/BarcodeSelectionModal';
import { CategorySettingsModal } from '@/components/pos/CategorySettingsModal';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import type { Product, Customer, PaymentMethod, ProductSearchItem, DiscountType, Order, POSPaymentSplit, DeliveryInfo } from '@/types';
import { searchProducts, getRecentProducts } from '@/lib/productSearch';
import { POSAudio } from '@/lib/posAudio';
import { CurrencyInput } from '@/components/common/CurrencyInput';
import { OrderLookupModal, CustomerLookupModal } from '@/components/pos/LookupModals';
import { usePrint } from '@/hooks/usePrint';

// Helper to determine emoji
const getProductEmoji = (name?: string) => {
    if (!name) return '📦';
    const n = name.toLowerCase();
    if (n.includes('bánh')) return '🥖';
    if (n.includes('kẹo')) return '🍬';
    if (n.includes('sữa')) return '🥛';
    if (n.includes('nước') || n.includes('sting') || n.includes('pepsi')) return '🥤';
    if (n.includes('rau')) return '🥬';
    if (n.includes('thịt')) return '🥩';
    if (n.includes('cá')) return '🐟';
    return '📦';
};

interface OrderTab {
    id: string;
    label: string;
    items: CartItem[];
    customer: Customer | null;
    note: string;
}

export function POSPage() {
    const navigate = useNavigate();

    // Refs for click outside handling
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setShowCustomerDropdown(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    const [productPanelHeight, setProductPanelHeight] = useState(300); // Default height for product panel
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    // selectedCustomer state removed
    const [usePoints, setUsePoints] = useState(false);
    const [pointsToUse, setPointsToUse] = useState(0);

    // --- LOCAL STATE RESTORED ---
    const [orderNote, setOrderNote] = useState('');
    const [showMobilePayment, setShowMobilePayment] = useState(false);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);




    const [showNoteModal, setShowNoteModal] = useState(false);
    const [editingItem, setEditingItem] = useState<CartItem | null>(null);
    const [priceAdjustmentItem, setPriceAdjustmentItem] = useState<CartItem | null>(null);
    const [priceAdjust, setPriceAdjust] = useState({ mode: 'percent' as 'percent' | 'amount' | 'custom', value: 0, reason: '', note: '' });
    const [showNumpad, setShowNumpad] = useState(false);
    const [itemDiscount, setItemDiscount] = useState({ type: 'percent' as 'percent' | 'amount', value: 0 });
    const [manualCash, setManualCash] = useState('');
    const [showCloseConfirm, setShowCloseConfirm] = useState<number | null>(null);
    const [tempDiscount, setTempDiscount] = useState({ type: 'percent', value: 0 }); // For global discount
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [showDraftsList, setShowDraftsList] = useState(false);
    const [showNewOrderConfirm, setShowNewOrderConfirm] = useState(false);

    // Shift & Reminder State
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [showReminderManager, setShowReminderManager] = useState(false);
    const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
    const [initialPhone, setInitialPhone] = useState('');
    const [scannerMode, setScannerMode] = useState(true); // Barcode scanner mode toggle - default ON
    const [barcodeMatches, setBarcodeMatches] = useState<BarcodeMatch[]>([]); // For barcode selection modal
    const [barcodeError, setBarcodeError] = useState<string | null>(null); // For barcode error notification
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showCategorySettings, setShowCategorySettings] = useState(false);
    const [showOrderLookup, setShowOrderLookup] = useState(false);
    const [showCustomerLookup, setShowCustomerLookup] = useState(false);


    // Multi-payment state
    const [paymentSplit, setPaymentSplit] = useState<{
        cash: number;
        transfer: number;
        card: number;
        debt: number;
        points: number;
        [key: string]: number; // For custom payment methods
    }>({ cash: 0, transfer: 0, card: 0, debt: 0, points: 0 });

    const [orderTabs, setOrderTabs] = useState<OrderTab[]>([{ id: '1', label: 'Đơn 1', items: [], customer: null, note: '' }]);
    const [activeTabIndex, setActiveTabIndex] = useState(0);

    // --- STORE HOOKS (Fixed & Aliased) ---
    const {
        cartItems, addItem, addItemWithUnit, removeItem, updateItemQuantity, clearCart,
        customer, setCustomer,
        // orderNote is local state
        subtotal, total, discountAmount, setDiscount, taxAmount, taxRate, setTaxRate,
        cashReceived, setCashReceived, change,
        submitOrder, parkOrder, draftOrders, deleteDraftOrder, resumeOrder,
        paymentMethod, setPaymentMethod, updateItemUnit,
        isSubmitting, updateItemNote, updateItemDiscount, setPointsDiscount, updateItemPrice,
        wholesaleMode, toggleWholesaleMode, setWholesaleMode
    } = usePOSStore();

    // Direct alias since addItem now handles wholesale logic
    const addToCart = addItem;



    const finalTotal = total;
    const changeDue = change;
    const setTax = setTaxRate;

    // DELIVERY MODE STATE (Moved here to access customer)
    const [isDeliveryMode, setIsDeliveryMode] = useState(false);
    const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
        recipient_name: '',
        recipient_phone: '',
        shipping_address: '',
        delivery_notes: ''
    });

    // Auto-fill delivery info from customer
    useEffect(() => {
        if (customer && isDeliveryMode) {
            setDeliveryInfo(prev => ({
                ...prev,
                recipient_name: customer.name,
                recipient_phone: customer.phone || '',
                shipping_address: customer.address || '',
            }));
        }
    }, [customer, isDeliveryMode]);

    const { products, loadProducts } = useProductStore();
    const { customers, loadCustomers } = useCustomerStore();
    const { currentShift, updateShiftTotals } = useShiftStore();
    const { isMobile, isTablet } = useBreakpoint();

    // Category settings with safe defaults for migration
    const { categories } = useCategoryStore();
    const rawPosCategories = useSettingsStore(state => state.posCategories);
    const loyalty = useSettingsStore(state => state.loyalty);
    const paymentMethodsConfig = useSettingsStore(state => state.paymentMethods);
    const defaultPaymentMethodId = useSettingsStore(state => state.defaultPaymentMethod);
    const { user, logout } = useAuthStore();
    const { pendingOrders: offlinePendingOrders, isSyncing: isOfflineSyncing, syncPendingOrders } = useOfflineStore();
    const { printSalesReceipt, printProvisionalReceipt, isAutoPrintEnabled } = usePrint();
    // Print checkbox state - defaults to true
    const [shouldPrintReceipt, setShouldPrintReceipt] = useState(true);

    // Fullscreen toggle with robust fallback
    const toggleFullscreen = useCallback(() => {
        console.log('Fullscreen button clicked');

        const root = document.getElementById('root');

        // Check if we're in pseudo-fullscreen - toggle OFF
        if (root?.classList.contains('pseudo-fullscreen')) {
            root.classList.remove('pseudo-fullscreen');
            setIsFullscreen(false);
            console.log('Exited pseudo-fullscreen');
            return;
        }

        // Check if we're in native fullscreen - toggle OFF
        if (document.fullscreenElement) {
            const exitFS = document.exitFullscreen ||
                (document as any).webkitExitFullscreen ||
                (document as any).mozCancelFullScreen ||
                (document as any).msExitFullscreen;
            if (exitFS) {
                exitFS.call(document).catch(console.error);
            }
            return;
        }

        // ENTER FULLSCREEN MODE
        const elem = document.documentElement;
        const requestFS = elem.requestFullscreen ||
            (elem as any).webkitRequestFullscreen ||
            (elem as any).mozRequestFullScreen ||
            (elem as any).msRequestFullscreen;

        // Apply pseudo-fullscreen immediately for instant feedback
        if (root) {
            root.classList.add('pseudo-fullscreen');
            setIsFullscreen(true);
            console.log('Applied pseudo-fullscreen for instant feedback');
        }

        // Then try native fullscreen (will override pseudo if successful)
        if (requestFS) {
            try {
                const promise = requestFS.call(elem);
                if (promise && promise.then) {
                    promise.then(() => {
                        // Native fullscreen succeeded - remove pseudo class
                        if (root) {
                            root.classList.remove('pseudo-fullscreen');
                        }
                        console.log('Native fullscreen activated');
                    }).catch((err: any) => {
                        console.error('Native fullscreen failed:', err);
                        // Pseudo-fullscreen already applied, show tip
                        alert(
                            '🖥️ Đang dùng chế độ mở rộng tạm thời!\n\n' +
                            '💡 Bấm F11 để toàn màn hình thực sự (ẩn thanh địa chỉ).'
                        );
                    });
                }
            } catch (e) {
                console.error('Fullscreen error:', e);
            }
        }
    }, []);

    // Handle logout
    const handleLogout = useCallback(async () => {
        if (confirm('Bạn có chắc muốn đăng xuất?')) {
            await logout();
            navigate('/login');
        }
    }, [logout, navigate]);

    // Fullscreen change listener - simplified
    useEffect(() => {
        const updateFullscreenState = () => {
            const isFullscreenNow = !!(
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement ||
                (document as any).mozFullScreenElement ||
                (document as any).msFullscreenElement
            );
            console.log('Fullscreen state changed to:', isFullscreenNow);
            setIsFullscreen(isFullscreenNow);
        };

        // Initial check
        updateFullscreenState();

        // Listen to all fullscreen change events
        document.addEventListener('fullscreenchange', updateFullscreenState);
        document.addEventListener('webkitfullscreenchange', updateFullscreenState);
        document.addEventListener('mozfullscreenchange', updateFullscreenState);
        document.addEventListener('MSFullscreenChange', updateFullscreenState);

        return () => {
            document.removeEventListener('fullscreenchange', updateFullscreenState);
            document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
            document.removeEventListener('mozfullscreenchange', updateFullscreenState);
            document.removeEventListener('MSFullscreenChange', updateFullscreenState);
        };
    }, []);

    // Online/Offline detection
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    const posCategories = rawPosCategories || {
        visibleCategoryIds: [],
        customLists: [],
        categoryOrder: [],
        defaultCategoryId: 'all',
        showAllTab: true,
    };

    // --- LOCAL FILTERS & HANDLERS ---

    // Get ordered categories based on settings
    const orderedCategories = React.useMemo(() => {
        const order = posCategories.categoryOrder || [];
        if (order.length === 0) return categories;
        return [...categories].sort((a, b) => {
            const aIdx = order.indexOf(a.id);
            const bIdx = order.indexOf(b.id);
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });
    }, [categories, posCategories.categoryOrder]);

    // Initialize data
    useEffect(() => {
        if (products.length === 0) loadProducts();
        if (customers.length === 0) loadCustomers();
    }, [loadProducts, loadCustomers, products.length, customers.length]);

    // Filter Logic - Search dropdown
    const [filteredProducts, setFilteredProducts] = useState<ProductSearchItem[]>([]);

    const filterProducts = useCallback((query: string) => {
        if (!query.trim()) {
            // Show recent products when no query
            setFilteredProducts(getRecentProducts(products, 10));
        } else {
            setFilteredProducts(searchProducts(products, query));
        }
    }, [products]);

    // Category-based grid (separate from search)
    const [selectedCategory, setSelectedCategory] = useState<string>(posCategories.defaultCategoryId || 'all');
    const gridProducts = React.useMemo(() => {
        // Convert products to ProductSearchItem for consistent display
        const allItems = products.map(p => ({
            id: p.id,
            product_id: p.id,
            name: `${p.name} (${p.base_unit})`,
            unit_name: p.base_unit,
            barcode: p.barcode || undefined,
            sku: p.sku || undefined,
            price: p.selling_price,
            cost_price: p.cost_price,
            stock: p.current_stock,
            image_url: p.image_url || undefined,
            type: 'product' as const,
            product: p,
            unit: undefined,
            category_id: p.category_id,
            // Add category_ids for multi-category support
            category_ids: p.category_ids || (p.category_id ? [p.category_id] : [])
        }));

        // Check if it's the "all" tab
        if (selectedCategory === 'all') return allItems;

        // Check if it's a custom list
        const customList = posCategories.customLists.find(l => l.id === selectedCategory);
        if (customList) {
            return allItems.filter(item => customList.productIds.includes(item.id));
        }

        // Otherwise filter by category_ids (support multi-category)
        return allItems.filter(item => {
            const itemCategoryIds = (item as any).category_ids || (item.category_id ? [item.category_id] : []);
            return itemCategoryIds.includes(selectedCategory);
        });
    }, [products, selectedCategory, posCategories.customLists]);

    const searchCustomers = useCallback((query: string) => {
        if (!query) {
            setFilteredCustomers(customers);
        } else {
            const lower = query.toLowerCase();
            setFilteredCustomers(customers.filter(c => c.name.toLowerCase().includes(lower) || c.phone?.includes(query))); // Fixed c.phone check
        }
    }, [customers]);

    // Sync filters when data changes
    useEffect(() => { setFilteredProducts(searchProducts(products, searchQuery)); }, [products, searchQuery]);
    useEffect(() => { setFilteredCustomers(customers); }, [customers]);

    // Search effects
    useEffect(() => { filterProducts(searchQuery); }, [searchQuery, filterProducts]);
    useEffect(() => { searchCustomers(customerSearch); }, [customerSearch, searchCustomers]);

    const handleProductClick = (item: ProductSearchItem) => {
        console.log('>>> handleProductClick CALLED with:', item.name);

        // Check if unit
        if (item.type === 'unit' && item.unit) {
            addItemWithUnit(item.product, 1, item.unit.unit_name, item.price, item.unit.conversion_rate, item.unit.id);
        } else {
            addToCart(item.product);
        }

        setSearchQuery('');
        filterProducts('');
        setShowSearchDropdown(false);

        // IMPORTANT: Blur any focused element to prevent barcode scanner Enter key
        // from re-triggering the product button click
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    };


    const handleBarcodeScan = (code: string) => {
        // FIRST: Blur any focused element to prevent accidental re-triggering
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        // Clear search input immediately when scanner detects a barcode
        setSearchQuery('');
        setShowSearchDropdown(false);

        // Find all products/units matching this barcode
        const matches = findProductsByBarcode(products, code);

        if (matches.length === 0) {
            // No match - play error sound and show notification only
            POSAudio.playError();
            setBarcodeError(`⚠️ Mã "${code}" không tồn tại!`);
            setTimeout(() => setBarcodeError(null), 3000); // Auto hide after 3s
            console.log(`[SCANNER] ❌ Not found: ${code}`);
        } else if (matches.length === 1) {
            // Single match - add directly to cart
            const match = matches[0];
            if (match.unit) {
                addItemWithUnit(
                    match.product,
                    1,
                    match.displayUnit,
                    match.price,
                    match.unit.conversion_rate,
                    match.unit.id
                );
            } else {
                addToCart(match.product);
            }
            // Play success sound
            POSAudio.playAddItem();
            console.log(`[SCANNER] ✅ Added: ${match.displayName} (${match.displayUnit})`);
        } else {
            // Multiple matches - show selection modal
            setBarcodeMatches(matches);
            console.log(`[SCANNER] 📌 Multiple matches (${matches.length}) for: ${code}`);
        }
    };

    // Handle barcode selection from modal
    const handleBarcodeSelect = (match: BarcodeMatch) => {
        if (match.unit) {
            addItemWithUnit(
                match.product,
                1,
                match.displayUnit,
                match.price,
                match.unit.conversion_rate,
                match.unit.id
            );
        } else {
            addToCart(match.product);
        }
        setBarcodeMatches([]);
        // Play success sound using POSAudio
        POSAudio.playAddItem();
    };

    useBarcodeScanner({ onScan: handleBarcodeScan });

    // === PHASE 1: Default payment method = cash ===
    useEffect(() => {
        if (!paymentMethod) {
            setPaymentMethod('cash');
        }
    }, [paymentMethod, setPaymentMethod]);

    // === PHASE 1: Keyboard shortcuts ===
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                // Only allow F keys and ESC in inputs
                if (!e.key.startsWith('F') && e.key !== 'Escape') return;
            }

            switch (e.key) {
                case 'F1':
                    e.preventDefault();
                    // Submit order / Thanh toán - same logic as button click
                    if (cartItems.length > 0 && !isSubmitting) {
                        if (paymentMethod === 'debt' && !customer) {
                            alert('Vui lòng chọn khách hàng để ghi nợ!');
                            return;
                        }
                        // Set points discount before submitting
                        if (pointsToUse > 0 && loyalty) {
                            setPointsDiscount(pointsToUse, pointsToUse * (loyalty.redemptionRate || 1000));
                        }
                        submitOrder({ note: orderNote, paymentSplit }).then(order => {
                            if (order) {
                                // Success - no alert, just clear form
                                setManualCash('');
                                setPointsToUse(0);
                                setOrderNote('');
                                setPaymentSplit({ cash: 0, transfer: 0, card: 0, debt: 0, points: 0 });

                                // Auto-print receipt if enabled
                                if (isAutoPrintEnabled('sales_receipt')) {
                                    printSalesReceipt(order, user?.name || user?.email || 'Thu ngân');
                                }
                            }
                        });
                    }
                    break;
                case 'F3':
                    e.preventDefault();
                    // Focus search input
                    searchInputRef.current?.focus();
                    break;
                case 'F9':
                    e.preventDefault();
                    // Print temp receipt (In tạm tính)
                    // TODO: Implement print temp functionality
                    alert('In tạm tính - Chức năng đang phát triển');
                    break;
                case 'Escape':
                    e.preventDefault();
                    // Close dropdowns or clear search
                    if (showSearchDropdown) {
                        setShowSearchDropdown(false);
                    } else if (showCustomerDropdown) {
                        setShowCustomerDropdown(false);
                    } else if (searchQuery) {
                        setSearchQuery('');
                    }
                    break;
                // case 'F11':
                //    // Allow native browser F11 behavior
                //    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cartItems.length, isSubmitting, submitOrder, showSearchDropdown, showCustomerDropdown, searchQuery, toggleFullscreen, paymentMethod, customer, pointsToUse, loyalty, orderNote, paymentSplit, setPointsDiscount]);

    // NOTE: Click-outside handler REMOVED - it was closing dropdowns immediately
    // Dropdowns will close via:
    // 1. handleProductClick/customer selection (closes after selection)
    // 2. User navigating away from the page
    // 3. Pressing Escape key


    // Helper: Save current store state to the active tab
    const saveCurrentTabState = (tabs: OrderTab[], currentIndex: number) => {
        const updatedTabs = [...tabs];
        updatedTabs[currentIndex] = {
            ...updatedTabs[currentIndex],
            items: usePOSStore.getState().cartItems,
            customer: usePOSStore.getState().customer,
            note: orderNote, // Use local state
        };
        return updatedTabs;
    };

    // Helper: Load a tab's state into the store
    const loadTabState = (tab: OrderTab) => {
        // 1. Quietly clear store
        usePOSStore.setState({
            cartItems: [],
            customer: null,
            cashReceived: 0,
            discountAmount: 0,
            taxAmount: 0
        });

        // 2. Load data
        if (tab.items.length > 0) usePOSStore.setState({ cartItems: tab.items });
        if (tab.customer) usePOSStore.setState({ customer: tab.customer });
        if (tab.note) setOrderNote(tab.note); // Use local state setter

        // 3. Recalculate totals (implicitly handled by store subscriptions or next render, 
        // but explicit action might be safer if store has computed properties)
    };

    // Switch Tab
    const handleTabSwitch = (index: number) => {
        if (index === activeTabIndex) return;

        // Save current work
        const tabsWithSavedState = saveCurrentTabState(orderTabs, activeTabIndex);
        setOrderTabs(tabsWithSavedState);

        // Load new work
        loadTabState(tabsWithSavedState[index]);
        setActiveTabIndex(index);
    };

    // Add new order tab
    const addOrderTab = () => {
        // Save current first
        const tabsWithSavedState = saveCurrentTabState(orderTabs, activeTabIndex);

        // Find the smallest available ID (fill gaps)
        const existingIds = tabsWithSavedState.map(tab => parseInt(tab.id) || 0);
        let newId = 1;
        while (existingIds.includes(newId)) {
            newId++;
        }
        const newIdStr = String(newId);

        const newTab: OrderTab = {
            id: newIdStr,
            label: `Đơn ${newIdStr}`,
            items: [],
            customer: null,
            note: ''
        };

        // Append new tab at the end (rightmost position)
        const newTabs = [...tabsWithSavedState, newTab];
        setOrderTabs(newTabs);

        // Switch to new tab (which is the last one)
        loadTabState(newTab);
        setActiveTabIndex(newTabs.length - 1);
    };

    // Close order tab with confirmation
    const closeOrderTab = (index: number) => {
        // If it's the only tab, just clear it (Reset)
        if (orderTabs.length === 1) {
            if (cartItems.length > 0) {
                setShowCloseConfirm(index); // Confirm before clearing if has items
            } else {
                // Already empty, maybe just reset ID to 1 if user wants "reset"? 
                // But simply doing nothing is fine, or reset logs.
                // Let's reset ID to 1 to feel like a "new start"
                setOrderTabs([{ id: '1', label: 'Đơn 1', items: [], customer: null, note: '' }]);
                loadTabState({ id: '1', label: 'Đơn 1', items: [], customer: null, note: '' });
                setActiveTabIndex(0);
            }
            return;
        }

        // If tab has items, confirm
        // Note: We need to check the items of the tab being closed, not necessarily the active one.
        // But for simplicity, we usually switch to it or let user confirm.
        // If closing INACTIVE tab, we should check *that* tab's items.
        // For now, assume we close the tab provided by index. 

        const tabToClose = index === activeTabIndex
            ? { ...orderTabs[index], items: cartItems } // Current state
            : orderTabs[index]; // Saved state

        if (tabToClose.items && tabToClose.items.length > 0) {
            setShowCloseConfirm(index);
        } else {
            confirmCloseTab(index);
        }
    };

    const confirmCloseTab = (index: number) => {
        // Security Log
        const tabToClose = index === activeTabIndex
            ? { ...orderTabs[index], items: cartItems, total: total }
            : orderTabs[index];

        if (tabToClose.items && tabToClose.items.length > 0) {
            const logEntry = {
                type: 'ORDER_CLOSED',
                timestamp: new Date().toISOString(),
                items: tabToClose.items.map(i => ({ name: i.product.name, qty: i.quantity, price: i.total_price })),
                total: (tabToClose as any).total || 0,
                reason: `Đóng ${tabToClose.label}`,
                staff: 'Current User' // Should be from auth context
            };
            const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
            logs.unshift(logEntry);
            localStorage.setItem('security_logs', JSON.stringify(logs.slice(0, 500)));
        }

        const newTabs = orderTabs.filter((_, i) => i !== index);

        if (newTabs.length === 0) {
            // Should not happen due to length===1 check, but safeguard:
            setOrderTabs([{ id: '1', label: 'Đơn 1', items: [], customer: null, note: '' }]);
            loadTabState({ id: '1', label: 'Đơn 1', items: [], customer: null, note: '' });
            setActiveTabIndex(0);
        } else {
            // Determine new active index
            let newActiveIndex = activeTabIndex;
            if (index < activeTabIndex) {
                newActiveIndex = activeTabIndex - 1;
            } else if (index === activeTabIndex) {
                newActiveIndex = Math.max(0, index - 1);
            }

            // If we closed the active tab, we must load the state of the NEW active tab
            if (index === activeTabIndex) {
                loadTabState(newTabs[newActiveIndex]);
            }

            setOrderTabs(newTabs);
            setActiveTabIndex(newActiveIndex);
        }

        setShowCloseConfirm(null);
    };

    // Complete payment
    const handleCompletePayment = useCallback(async () => {
        const method = paymentMethod || 'cash'; // Fallback

        // If cash and 0, assume full amount
        if (method === 'cash' && cashReceived === 0) {
            setCashReceived(finalTotal);
        }

        const order = await submitOrder();
        if (order) {
            setIsDeliveryMode(false); // Reset delivery mode
            if (order.payment_method === 'cash') {
                updateShiftTotals({ total_cash_sales: (currentShift?.total_cash_sales || 0) + order.total_amount });
            }
            setCustomer(null);
            setOrderNote('');
            setWholesaleMode(false); // Reset wholesale mode for next order
        }
    }, [submitOrder, updateShiftTotals, currentShift, paymentMethod, cashReceived, finalTotal, setCashReceived, setCustomer, setOrderNote]);

    // Cash suggestions - only show values > finalTotal
    const cashSuggestions = React.useMemo(() => {
        if (finalTotal <= 0) return [];
        const denoms = [20000, 50000, 100000, 200000, 500000, 1000000];
        return denoms.filter(d => d > finalTotal).slice(0, 5);
    }, [finalTotal]);

    // Handle manual cash input
    const handleManualCash = (value: string) => {
        setManualCash(value);
        const num = parseInt(value.replace(/\D/g, '')) || 0;
        setCashReceived(num);
    };

    // Update quantity directly
    const handleQuantityChange = (itemId: string, newQty: number) => {
        if (newQty <= 0) removeItem(itemId);
        else updateItemQuantity(itemId, newQty);
    };

    useEffect(() => { searchInputRef.current?.focus(); }, []);

    // Draft & New Order Handlers
    const handleSaveDraft = () => {
        if (cartItems.length === 0) return;
        parkOrder(orderNote);
        setOrderNote('');
        // Optional: Notify user
        // alert('Đã lưu đơn nháp!');
    };

    const handleNewOrder = () => {
        if (cartItems.length > 0) {
            setShowNewOrderConfirm(true);
        } else {
            clearCart('Tạo đơn mới');
            setOrderNote('');
            setCustomer(null);
        }
    };

    const confirmNewOrder = () => {
        clearCart('Tạo đơn mới (Xác nhận xóa giỏ hàng)');
        setOrderNote('');
        setCustomer(null);
        setIsDeliveryMode(false); // Reset delivery mode
        setShowNewOrderConfirm(false);
    };

    return (
        <>
            <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden">
                {/* Barcode Error Notification - Animated overlay */}
                {barcodeError && (
                    <div
                        onClick={() => setBarcodeError(null)}
                        className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] bg-red-600 text-white px-8 py-4 rounded-xl shadow-2xl animate-bounce cursor-pointer flex items-center gap-3 border-4 border-white/50"
                        style={{ animation: 'bounce 0.5s ease-in-out' }}
                    >
                        <span className="text-3xl">⚠️</span>
                        <span className="text-xl font-bold">{barcodeError}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); setBarcodeError(null); }}
                            className="ml-4 bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Top Bar - Green Theme */}
                <div className="h-14 bg-gradient-to-r from-green-600 via-green-600 to-green-700 flex items-center px-3 md:px-4 gap-2 md:gap-4 text-white flex-shrink-0 shadow-lg relative z-50">
                    <button onClick={() => navigate('/')} className="hover:bg-white/20 p-2 rounded-lg" title="Về trang chủ (Home)">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </button>

                    {/* Workflow Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleNewOrder}
                            className="hidden md:flex bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium items-center gap-1 shadow-sm transition-colors"
                            title="Tạo đơn mới (Xóa giỏ hàng hiện tại)"
                        >
                            <span>✨</span> <span className="hidden lg:inline">Tạo mới</span>
                        </button>

                        <button
                            onClick={() => setShowDraftsList(true)}
                            className="relative bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                            title="Danh sách đơn đang chờ"
                        >
                            <span>📋</span> <span className="hidden lg:inline">Đơn chờ</span>
                            {/* Draft orders badge */}
                            {draftOrders.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                    {draftOrders.length}
                                </span>
                            )}
                            {/* Offline pending orders badge */}
                            {offlinePendingOrders.length > 0 && (
                                <span className={cn(
                                    "absolute text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold",
                                    draftOrders.length > 0 ? "-top-1 right-3 bg-red-500" : "-top-1 -right-1 bg-red-500",
                                    isOfflineSyncing && "animate-spin"
                                )}>
                                    {isOfflineSyncing ? "⟳" : offlinePendingOrders.length}
                                </span>
                            )}
                        </button>

                        {/* Wholesale Mode Toggle - Moved to top bar */}
                        <button
                            onClick={toggleWholesaleMode}
                            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${wholesaleMode
                                ? 'bg-blue-800 text-white shadow-lg ring-2 ring-blue-300'
                                : 'bg-white/20 hover:bg-white/30 text-white'
                                }`}
                            title={wholesaleMode ? 'Đang bật giá bán buôn (cho đơn này)' : 'Bấm để bật giá bán buôn'}
                        >
                            <span>📦</span> <span className="hidden lg:inline">{wholesaleMode ? 'Bán buôn ✓' : 'Bán buôn'}</span>
                        </button>
                    </div>

                    {/* Search - Fixed width on desktop, full on mobile */}
                    <div className="relative flex-1 md:flex-none md:w-[640px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
                            onFocus={() => {
                                setShowSearchDropdown(true);
                                if (!searchQuery.trim()) filterProducts('');
                            }}
                            onBlur={() => {
                                // Delay to allow click on dropdown items
                                setTimeout(() => setShowSearchDropdown(false), 200);
                            }}
                            placeholder="Tìm sản phẩm hoặc quét mã [F3]"
                            className="w-full pl-10 pr-24 py-2.5 rounded-xl text-gray-900 text-sm"
                        />
                        {/* X button to clear search */}
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setShowSearchDropdown(false); searchInputRef.current?.focus(); }}
                                className="absolute right-20 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 hover:text-gray-700 transition-colors"
                                title="Xóa tìm kiếm (C)"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                        {/* Scanner Mode toggle - compact */}
                        <button
                            type="button"
                            onClick={() => setScannerMode(!scannerMode)}
                            className={`absolute right-10 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${scannerMode
                                ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                                : 'bg-gray-200 text-gray-500 hover:bg-green-100 hover:text-green-600'
                                }`}
                            title={scannerMode ? 'Scanner Mode: BẬT (Click để tắt)' : 'Scanner Mode: TẮT (Click để bật)'}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 5V3h4M17 3h4v2M3 19v2h4M17 21h4v-2" />
                                <path d="M7 7v10M11 7v10M15 7v10M19 7v10" strokeWidth="1.5" />
                            </svg>
                        </button>
                        {/* Barcode scan button - MOBILE ONLY */}
                        <button
                            type="button"
                            onClick={() => {
                                // Open camera barcode scanner
                                const modal = document.createElement('div');
                                modal.id = 'barcode-scanner-modal';
                                modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;';
                                modal.innerHTML = `
                                <div style="width:100%;max-width:360px;text-align:center;">
                                    <video id="barcode-video" style="width:100%;border-radius:12px;background:#000;" autoplay playsinline></video>
                                    <p id="scan-status" style="color:white;margin:12px 0;font-size:14px;">Đang mở camera...</p>
                                    <button id="close-scanner" style="padding:12px 32px;background:#ef4444;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:16px;">✕ Đóng</button>
                                </div>
                            `;
                                document.body.appendChild(modal);
                                const video = document.getElementById('barcode-video') as HTMLVideoElement;
                                const statusEl = document.getElementById('scan-status') as HTMLElement;
                                const closeBtn = document.getElementById('close-scanner') as HTMLButtonElement;
                                let stream: MediaStream | null = null;
                                const cleanup = () => { if (stream) stream.getTracks().forEach(t => t.stop()); modal.remove(); };
                                closeBtn.onclick = cleanup;
                                modal.onclick = (e) => { if (e.target === modal) cleanup(); };
                                navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                                    .then(async (s) => {
                                        stream = s;
                                        video.srcObject = stream;
                                        statusEl.textContent = 'Hướng camera vào mã vạch...';
                                        if ('BarcodeDetector' in window) {
                                            const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] });
                                            const detect = async () => {
                                                if (!video.srcObject) return;
                                                try {
                                                    const barcodes = await detector.detect(video);
                                                    if (barcodes.length > 0) {
                                                        const code = barcodes[0].rawValue;
                                                        setSearchQuery(code);
                                                        setShowSearchDropdown(true);
                                                        statusEl.innerHTML = '<span style="color:#22c55e;">✅ ' + code + '</span>';
                                                        setTimeout(cleanup, 800);
                                                        return;
                                                    }
                                                } catch (e) { }
                                                requestAnimationFrame(detect);
                                            };
                                            detect();
                                        } else {
                                            statusEl.innerHTML = '<span style="color:#fbbf24;">⚠️ Trình duyệt chưa hỗ trợ quét tự động</span>';
                                        }
                                    })
                                    .catch(() => { statusEl.innerHTML = '<span style="color:#ef4444;">❌ Không thể mở camera</span>'; });
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors md:hidden"
                            title="Quét mã vạch bằng camera"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 5V3h4M17 3h4v2M3 19v2h4M17 21h4v-2" />
                                <path d="M7 7v10M11 7v10M15 7v10M19 7v10" strokeWidth="1.5" />
                            </svg>
                        </button>
                        {/* Search Dropdown */}
                        {showSearchDropdown && filteredProducts.length > 0 && (
                            <div
                                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] max-h-[60vh] overflow-y-auto ring-1 ring-black/5"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    const target = e.target as HTMLElement;
                                    const itemEl = target.closest('[data-product-id]') as HTMLElement;
                                    if (itemEl) {
                                        const itemId = itemEl.dataset.productId;
                                        const item = filteredProducts.find(p => p.id === itemId);
                                        if (item) {
                                            handleProductClick(item);
                                        }
                                    }
                                }}
                            >
                                {/* Header for recent products */}
                                {!searchQuery.trim() && (
                                    <div className="px-4 py-2 bg-gray-50 border-b text-xs text-gray-500 font-medium">
                                        📋 Sản phẩm gần đây
                                    </div>
                                )}
                                {filteredProducts.map((item) => (
                                    <div
                                        key={item.id}
                                        data-product-id={item.id}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 cursor-pointer border-b last:border-0"
                                    >
                                        <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
                                            {getProductEmoji(item.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                                            <p className="text-xs text-gray-400">{item.barcode || item.sku}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-bold text-green-600">{formatVND(item.price)}</p>
                                            <p className="text-xs text-gray-400">Kho: {item.stock}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Order Tabs - Scrollable with Navigation */}
                    <div className="hidden md:flex items-center gap-1 flex-1 min-w-0">
                        {/* Left Scroll Button */}
                        {orderTabs.length > 3 && (
                            <button
                                onClick={() => {
                                    const container = document.getElementById('order-tabs-container');
                                    if (container) container.scrollBy({ left: -80, behavior: 'smooth' });
                                }}
                                className="w-6 h-6 bg-white/20 hover:bg-white/30 rounded text-white flex items-center justify-center flex-shrink-0"
                            >
                                ‹
                            </button>
                        )}

                        {/* Scrollable Tab Container */}
                        <div
                            id="order-tabs-container"
                            className="flex items-center gap-1 overflow-x-auto flex-1"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {orderTabs.map((tab, index) => (
                                <div key={tab.id} className="relative group flex-shrink-0">
                                    <button
                                        onClick={() => handleTabSwitch(index)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                                            activeTabIndex === index ? 'bg-white text-green-600' : 'bg-white/20 hover:bg-white/30'
                                        )}
                                    >
                                        Đơn {tab.id}
                                    </button>
                                    {orderTabs.length > 1 && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); closeOrderTab(index); }}
                                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                            {/* Add Tab Button - Inside scrollable container */}
                            <button
                                onClick={addOrderTab}
                                className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-lg text-lg font-bold flex-shrink-0 flex items-center justify-center"
                            >
                                +
                            </button>
                        </div>

                        {/* Right Scroll Button */}
                        {orderTabs.length > 3 && (
                            <button
                                onClick={() => {
                                    const container = document.getElementById('order-tabs-container');
                                    if (container) container.scrollBy({ left: 80, behavior: 'smooth' });
                                }}
                                className="w-6 h-6 bg-white/20 hover:bg-white/30 rounded text-white flex items-center justify-center flex-shrink-0"
                            >
                                ›
                            </button>
                        )}
                    </div>

                    {/* Right side: Offline indicator, Employee name, Fullscreen, Logout */}
                    <div className="flex items-center gap-2 ml-auto flex-shrink-0 z-[100]">
                        {/* Offline Indicator */}
                        {!isOnline && (
                            <div className="bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold animate-pulse flex items-center gap-1">
                                <span>📴</span> Offline
                            </div>
                        )}

                        {/* Employee Name */}
                        <span className="hidden md:inline text-sm font-medium opacity-90 drop-shadow-md">
                            👤 {user?.name || user?.email || 'Nhân viên'}
                        </span>

                        {/* Fullscreen Button */}
                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-lg transition-colors shadow-sm"
                            title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                        >
                            {isFullscreen ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="4 14 10 14 10 20" />
                                    <polyline points="20 10 14 10 14 4" />
                                    <line x1="14" y1="10" x2="21" y2="3" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 3 21 3 21 9" />
                                    <polyline points="9 21 3 21 3 15" />
                                    <line x1="21" y1="3" x2="14" y2="10" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            )}
                        </button>

                        {/* Logout Button - Icon only */}
                        <button
                            type="button"
                            onClick={() => window.location.href = '/login'}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-lg transition-colors shadow-sm"
                            title="Đăng xuất"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Main Content - Responsive */}
                <div className={cn(
                    "flex-1 flex overflow-hidden",
                    (isMobile || isTablet) && "flex-col"
                )}>
                    {/* Left - Cart & Product Area */}
                    <div className="flex-1 flex flex-col bg-slate-50 relative">
                        {/* Cart Section - Flex Grow */}
                        <div className="flex-1 flex flex-col bg-white m-2 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            {/* Cart Header */}
                            <div className="h-10 border-b border-gray-100 flex items-center px-2 md:px-4 text-[10px] md:text-xs font-semibold text-gray-400 bg-white">
                                <span className="w-8 hidden md:block">STT</span>
                                <span className="flex-1">Sản phẩm ({cartItems.length})</span>
                                <span className="w-20 text-center hidden md:block">ĐVT</span>
                                <span className="w-24 text-right">Đơn giá</span>
                                <span className="w-24 md:w-32 text-center">Số lượng</span>
                                <span className="w-20 md:w-24 text-right hidden sm:block">Thành tiền</span>
                                <span className="w-8"></span>
                            </div>

                            {/* Cart Items */}
                            <div className="flex-1 overflow-auto">
                                {cartItems.length === 0 ? (
                                    <div className="text-center py-16 text-gray-300 select-none">
                                        <span className="text-6xl block mb-4 opacity-50">🛒</span>
                                        <p className="font-light">Chưa có sản phẩm</p>
                                    </div>
                                ) : (
                                    cartItems.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center px-4 py-3 border-b border-gray-50 hover:bg-green-50/30 transition-colors group relative"
                                        >
                                            <span className="w-8 text-gray-300 text-sm font-light">{index + 1}</span>
                                            <div className="flex-1 flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-xl flex-shrink-0 shadow-sm border border-gray-100">
                                                    {getProductEmoji(item.product?.name)}
                                                </div>
                                                <div className="min-w-0">
                                                    {item.notes && <p className="text-[10px] text-amber-600 mb-0.5 font-medium line-clamp-1 bg-amber-50 inline-block px-1 rounded">📝 {item.notes}</p>}
                                                    <p className="font-medium text-gray-800 text-sm truncate">{item.product?.name || 'Sản phẩm lỗi'}</p>
                                                </div>
                                            </div>
                                            {/* Unit Selector - Only show dropdown if product has conversion units */}
                                            <div className="w-20 text-center hidden md:block" onClick={(e) => e.stopPropagation()}>
                                                {item.product?.units && item.product.units.length > 0 ? (
                                                    <select
                                                        value={item.unitName || item.product?.base_unit || 'Cái'}
                                                        onChange={(e) => {
                                                            const selectedUnitName = e.target.value;
                                                            const unit = item.product?.units?.find(u => u.unit_name === selectedUnitName);
                                                            if (unit) {
                                                                // Switch to conversion unit
                                                                addItemWithUnit(item.product!, 1, unit.unit_name, unit.selling_price || item.product!.selling_price * unit.conversion_rate, unit.conversion_rate, unit.id);
                                                                removeItem(item.id);
                                                            } else {
                                                                // Switch back to base unit
                                                                updateItemUnit(item.id, selectedUnitName);
                                                            }
                                                        }}
                                                        className="w-full bg-transparent text-xs text-center font-medium border-none focus:ring-0 cursor-pointer text-gray-500 hover:text-green-600 py-1"
                                                    >
                                                        <option value={item.product?.base_unit || 'Cái'}>{item.product?.base_unit || 'Cái'}</option>
                                                        {item.product.units.map(unit => (
                                                            <option key={unit.id} value={unit.unit_name}>{unit.unit_name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-xs text-gray-500">{item.unitName || item.product?.base_unit || 'Cái'}</span>
                                                )}
                                            </div>
                                            {/* Unit Price Click -> Price Adjustment */}
                                            <div
                                                className="w-24 text-right text-gray-700 font-medium text-sm cursor-pointer hover:bg-gray-100 py-1 rounded transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPriceAdjustmentItem(item);
                                                    setPriceAdjust({ mode: 'percent', value: 0, reason: '', note: item.notes || '' });
                                                }}
                                            >
                                                {formatVND(item.unit_price)}
                                                {item.discount_amount > 0 && <p className="text-[10px] text-red-400 line-through">-{formatVND(item.discount_amount)}</p>}
                                            </div>
                                            {/* Quantity Click -> Edit Modal */}
                                            <div
                                                className="w-24 md:w-32 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-gray-50 rounded p-1"
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Avoid double trigger if any
                                                    setEditingItem(item);
                                                }}
                                            >
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuantityChange(item.id, item.quantity - 1); }}
                                                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 font-bold text-sm transition-colors flex items-center justify-center"
                                                >−</button>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    step="any"
                                                    min="0"
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val) && val > 0) {
                                                            updateItemQuantity(item.id, val);
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (isNaN(val) || val <= 0) {
                                                            removeItem(item.id);
                                                        } else {
                                                            updateItemQuantity(item.id, val);
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-14 h-7 text-center font-bold bg-transparent border-b border-gray-200 focus:border-green-500 focus:outline-none text-sm text-gray-800"
                                                />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuantityChange(item.id, item.quantity + 1); }}
                                                    className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-700 font-bold text-sm transition-colors flex items-center justify-center"
                                                >+</button>
                                            </div>
                                            {/* Total Price Click -> Edit Modal */}
                                            <span
                                                className="w-20 md:w-24 text-right font-bold text-sm hidden sm:block cursor-pointer hover:text-green-600 text-gray-800"
                                                onClick={() => setEditingItem(item)}
                                            >
                                                {formatVND(item.total_price)}
                                            </span>
                                            {/* Print Barcode Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Open new tab to labels page with product pre-selected
                                                    const product = item.product;
                                                    if (product) {
                                                        const labelData = {
                                                            id: product.id,
                                                            name: product.name,
                                                            barcode: product.barcode || product.sku || '',
                                                            price: item.unit_price || product.selling_price || 0,
                                                            quantity: 1 // Default 1 label per click
                                                        };
                                                        // Store in sessionStorage and navigate
                                                        sessionStorage.setItem('quick_print_label', JSON.stringify(labelData));
                                                        window.open('/barcode-print', '_blank');
                                                    }
                                                }}
                                                className="w-8 flex items-center justify-center text-gray-300 hover:text-orange-500 transition-colors"
                                                title="In tem mã vạch"
                                            >
                                                🏷️
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                                                className="w-8 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Resizable Divider */}
                        <div
                            className="h-2 bg-slate-100 hover:bg-green-100 cursor-ns-resize flex items-center justify-center z-10 group transition-colors"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                const startY = e.clientY;
                                const startHeight = productPanelHeight;
                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const newHeight = startHeight - (moveEvent.clientY - startY);
                                    setProductPanelHeight(Math.max(150, Math.min(window.innerHeight - 200, newHeight)));
                                };
                                const handleMouseUp = () => {
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                };
                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                            }}
                        >
                            <div className="w-16 h-1 rounded-full bg-gray-300 group-hover:bg-green-400 transform transition-all duration-200"></div>
                        </div>

                        {/* Products Bottom Section - Resizable */}
                        <div
                            style={{ height: productPanelHeight }}
                            className="bg-white border-t border-gray-100 flex flex-col shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 transition-[height] duration-75 relative"
                        >
                            {/* Header & Categories */}
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
                                {/* Quick Actions Dropdown */}
                                <div className="relative group">
                                    <button className="w-9 h-9 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                    </button>
                                    {/* Quick Menu Popup */}
                                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-1 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 origin-bottom-left z-[100]">
                                        <button onClick={() => setShowOrderLookup(true)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                                            📄 Tra đơn hàng
                                        </button>
                                        <button onClick={() => setShowCustomerLookup(true)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                                            👥 Tra khách hàng
                                        </button>
                                        <div className="h-px bg-gray-100 my-1"></div>
                                        <button onClick={() => setShowShiftModal(true)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                                            ⏱️ Quản lý ca
                                        </button>
                                        <button onClick={() => setShowReminderManager(true)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                                            ⏰ Lời nhắc
                                        </button>
                                    </div>
                                </div>

                                {/* Ca làm việc Button - Visible */}
                                <button
                                    onClick={() => setShowShiftModal(true)}
                                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium flex items-center gap-1 transition-colors flex-shrink-0"
                                    title="Quản lý ca làm việc"
                                >
                                    <span>⏱️</span> <span className="hidden sm:inline">Ca làm việc</span>
                                </button>

                                {/* Tra đơn Button - Visible */}
                                <button
                                    onClick={() => setShowOrderLookup(true)}
                                    className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 text-xs font-medium flex items-center gap-1 transition-colors flex-shrink-0"
                                    title="Tra cứu đơn hàng"
                                >
                                    <span>📄</span> <span className="hidden sm:inline">Tra đơn</span>
                                </button>



                                <div className="h-6 w-px bg-gray-200 mx-1"></div>

                                {/* All Tab */}
                                {posCategories.showAllTab && (
                                    <button
                                        onClick={() => setSelectedCategory('all')}
                                        className={cn("px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex-shrink-0",
                                            selectedCategory === 'all' ? "bg-green-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                                        )}
                                    >
                                        Tất cả
                                    </button>
                                )}

                                {/* Dynamic Categories from Store - ORDERED */}
                                <div className="flex-1 overflow-x-auto flex gap-2 no-scrollbar">
                                    {orderedCategories
                                        .filter(cat =>
                                            posCategories.visibleCategoryIds.length === 0 ||
                                            posCategories.visibleCategoryIds.includes(cat.id)
                                        )
                                        .map((cat) => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setSelectedCategory(cat.id)}
                                                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                                                    selectedCategory === cat.id ? "bg-green-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                                                )}
                                            >
                                                {cat.name}
                                            </button>
                                        ))
                                    }
                                    {/* Custom Lists */}
                                    {posCategories.customLists.map((list) => (
                                        <button
                                            key={list.id}
                                            onClick={() => setSelectedCategory(list.id)}
                                            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                                                selectedCategory === list.id ? "bg-green-600 text-white" : "bg-purple-100 hover:bg-purple-200 text-purple-700"
                                            )}
                                        >
                                            📋 {list.name}
                                        </button>
                                    ))}
                                </div>

                                {/* Settings Gear Icon - RIGHT SIDE */}
                                <button
                                    onClick={() => setShowCategorySettings(true)}
                                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0 ml-2"
                                    title="Cài đặt danh mục"
                                >
                                    ⚙️
                                </button>
                            </div>

                            {/* Product Grid - By Category */}
                            <div className="flex-1 p-2 overflow-y-auto bg-slate-50">
                                <div
                                    className="grid gap-2"
                                    style={{
                                        gridTemplateColumns: `repeat(${rawPosCategories.productGridColumns || 6}, minmax(0, 1fr))`
                                    }}
                                >
                                    {gridProducts.slice(0, 50).map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleProductClick(item)}
                                            className="bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-lg transition-all duration-200 text-left group flex h-16 overflow-hidden shadow-sm"
                                        >
                                            {/* Left: Square Image Block */}
                                            <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-r border-gray-100 rounded-l-xl relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent" />
                                                <span className="text-3xl relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-200">
                                                    {getProductEmoji(item.name)}
                                                </span>
                                            </div>
                                            {/* Right: Name, Price, Stock */}
                                            <div className="flex-1 min-w-0 p-2 flex flex-col justify-between">
                                                <p className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-tight">{item.name}</p>
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-[10px] font-bold bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-1.5 py-0.5 rounded-md border border-green-100">
                                                        {formatVND(item.price)}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[9px] font-medium px-1 py-0.5 rounded",
                                                        item.stock > 10 ? "bg-blue-50 text-blue-600" :
                                                            item.stock > 0 ? "bg-amber-50 text-amber-600" :
                                                                "bg-red-50 text-red-600"
                                                    )}>
                                                        SL: {item.stock}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right - Payment Panel - Green Theme */}
                    <div className={cn(
                        "bg-white flex flex-col shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] z-30 transition-all duration-300 md:rounded-l-3xl border-l border-gray-100",
                        isMobile || isTablet
                            ? `fixed inset-x-0 bottom-0 border-t rounded-t-3xl ${showMobilePayment ? 'translate-y-0 h-[85vh]' : 'translate-y-[calc(100%-80px)] h-[85vh]'}`
                            : "w-[660px] h-full"
                    )}>
                        {/* Customer Header */}
                        <div className="p-3 relative bg-white z-20 shrink-0" data-customer-search>
                            {customer ? (
                                <div className="relative">
                                    <div className="flex items-center gap-3">
                                        <div className="text-gray-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setShowEditCustomerModal(true)}
                                                    className="font-bold text-green-600 text-base hover:underline hover:text-green-700 cursor-pointer"
                                                    title="Click để chỉnh sửa thông tin khách hàng"
                                                >
                                                    {customer.name}
                                                </button>
                                                <span className="text-gray-500 font-medium text-sm">- {customer.phone}</span>
                                            </div>
                                            <div className="flex gap-3 text-sm text-gray-600">
                                                <span>Nợ: <span className="font-bold text-red-500">{formatVND(customer.debt_balance)}</span></span>
                                                <span className="text-gray-300">|</span>
                                                <span>Điểm: <span className="font-bold text-amber-500">{customer.points_balance}</span></span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setCustomer(null)}
                                            className="text-gray-400 hover:text-red-500 p-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={customerSearch}
                                        onChange={(e) => {
                                            setCustomerSearch(e.target.value);
                                            setShowCustomerDropdown(true);
                                        }}
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && filteredCustomers.length > 0) {
                                                setCustomer(filteredCustomers[0]);
                                                setCustomerSearch('');
                                                setShowCustomerDropdown(false);
                                            }
                                        }}
                                        placeholder="Thêm khách hàng vào đơn (F4)"
                                        className="w-full pl-10 pr-10 py-2 border-b border-gray-300 focus:border-green-500 focus:outline-none text-sm bg-transparent relative z-[200]"
                                    />
                                    <button
                                        onClick={() => {
                                            setInitialPhone(customerSearch);
                                            setShowAddCustomerModal(true);
                                        }}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-green-600 z-[200]"
                                        title="Thêm khách hàng mới"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            {/* Dropdown Menu */}
                            {showCustomerDropdown && (
                                <div
                                    ref={dropdownRef}
                                    className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 z-[201] mt-2 max-h-[60vh] overflow-hidden ring-1 ring-black/5"
                                >
                                    <div className="max-h-80 overflow-y-auto">
                                        {filteredCustomers.length === 0 ? (
                                            <div className="text-center py-8 text-gray-400 text-sm">
                                                <p>Chưa có khách hàng</p>
                                                <button
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        setInitialPhone(customerSearch);
                                                        setShowAddCustomerModal(true);
                                                        setShowCustomerDropdown(false);
                                                    }}
                                                    className="mt-2 text-green-600 hover:underline font-medium"
                                                >
                                                    + Thêm khách hàng mới
                                                </button>
                                            </div>
                                        ) : (
                                            filteredCustomers.map((c) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        setCustomer(c);
                                                        setCustomerSearch('');
                                                        setShowCustomerDropdown(false);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-left border-b border-gray-50 last:border-0 transition-colors group"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm shrink-0 group-hover:bg-green-200 transition-colors">
                                                        {c.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-gray-800 text-sm truncate group-hover:text-green-700 transition-colors">{c.name}</p>
                                                        <p className="text-xs text-gray-500 font-medium">{c.phone}</p>
                                                    </div>
                                                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                        {/* Only show debt in dropdown - points shown after selection */}
                                                        {c.debt_balance > 0 && (
                                                            <span className="text-red-600 text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                                                Nợ: {formatVND(c.debt_balance)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>

                            )}
                        </div>

                        {/* Delivery Form - Only show when mode is active */}
                        {isDeliveryMode && (
                            <div className="bg-white px-3 pb-3">
                                <div className="space-y-2 bg-amber-50 p-3 rounded-xl border border-amber-100 animation-fade-in">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Người nhận</label>
                                            <input
                                                type="text"
                                                value={deliveryInfo.recipient_name}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, recipient_name: e.target.value })}
                                                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:border-amber-500 focus:outline-none"
                                                placeholder="Tên người nhận"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Điện thoại</label>
                                            <input
                                                type="text"
                                                value={deliveryInfo.recipient_phone}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, recipient_phone: e.target.value })}
                                                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:border-amber-500 focus:outline-none"
                                                placeholder="SĐT liên hệ"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Địa chỉ giao</label>
                                        <input
                                            type="text"
                                            value={deliveryInfo.shipping_address}
                                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, shipping_address: e.target.value })}
                                            className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:border-amber-500 focus:outline-none"
                                            placeholder="Số nhà, đường, phường/xã..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Ghi chú giao hàng</label>
                                        <input
                                            type="text"
                                            value={deliveryInfo.delivery_notes}
                                            onChange={(e) => setDeliveryInfo({ ...deliveryInfo, delivery_notes: e.target.value })}
                                            className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:border-amber-500 focus:outline-none"
                                            placeholder="VD: Giao giờ hành chính..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Divider Block - Under Customer Section */}
                        <div className="h-2 bg-gradient-to-b from-gray-100 to-gray-50 shrink-0"></div>

                        {/* SCROLLABLE MIDDLE CONTENT - One single container for totals and payment */}
                        <div className="flex-1 overflow-y-auto no-scrollbar pb-4">

                            {/* Totals Section */}
                            <div className="px-4 py-2 space-y-1.5 bg-white">
                                {/* Removed Online Indicator and Separator */}

                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Tổng tiền hàng</span>
                                    <span className="font-medium text-gray-900">{formatVND(subtotal)}</span>
                                </div>

                                {/* Discount Row */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Chiết khấu</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                                            <button
                                                onClick={() => {
                                                    const newType = 'percent';
                                                    setTempDiscount({ ...tempDiscount, type: newType });
                                                    setDiscount((subtotal * tempDiscount.value) / 100);
                                                }}
                                                className={cn("px-4 py-1 text-xs rounded-md font-medium transition-all w-12 flex justify-center", tempDiscount.type === 'percent' ? "bg-green-500 text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                                            >%</button>
                                            <button
                                                onClick={() => {
                                                    const newType = 'amount';
                                                    setTempDiscount({ ...tempDiscount, type: newType });
                                                    setDiscount(tempDiscount.value);
                                                }}
                                                className={cn("px-3 py-1 text-xs rounded-md font-medium transition-all flex justify-center", tempDiscount.type === 'amount' ? "bg-green-500 text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                                            >VNĐ</button>
                                        </div>
                                        <input
                                            type="number"
                                            value={tempDiscount.value}
                                            min="0"
                                            max={tempDiscount.type === 'percent' ? 100 : undefined}
                                            onChange={(e) => {
                                                let val = parseFloat(e.target.value) || 0;
                                                // Limit percent to 100%
                                                if (tempDiscount.type === 'percent' && val > 100) {
                                                    val = 100;
                                                }
                                                setTempDiscount({ ...tempDiscount, value: val });
                                                if (tempDiscount.type === 'percent') {
                                                    setDiscount((subtotal * val) / 100);
                                                } else {
                                                    setDiscount(val);
                                                }
                                            }}
                                            className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-500 font-medium"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </div>

                                {/* Tax Row */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Thuế (VAT)</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={taxRate}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setTaxRate(isNaN(val) ? 0 : val);
                                            }}
                                            className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-500 font-medium"
                                        />
                                        <span className="text-gray-400 text-xs w-10 text-right">%</span>
                                    </div>
                                </div>

                                {/* Points Payment Row - Only show when customer has points */}
                                {customer && customer.points_balance > 0 && loyalty?.enabled && (
                                    <div className="flex justify-between items-center text-sm bg-orange-50 p-2 rounded-lg border border-orange-200">
                                        <div>
                                            <span className="text-orange-700 font-medium">⭐ Thanh toán bằng điểm</span>
                                            <span className="text-xs text-orange-500 ml-2">({customer.points_balance} điểm = {formatVND(customer.points_balance * (loyalty?.redemptionRate || 1000))})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max={Math.min(customer.points_balance, Math.ceil(total / (loyalty?.redemptionRate || 1000)))}
                                                value={pointsToUse || ''}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    const maxPoints = Math.min(customer.points_balance, Math.ceil(total / (loyalty?.redemptionRate || 1000)));
                                                    const newPoints = Math.min(val, maxPoints);
                                                    const pointsDiff = newPoints - pointsToUse;
                                                    const pointsValueDiff = pointsDiff * (loyalty?.redemptionRate || 1000);

                                                    // Auto-deduct from current payment method
                                                    if (paymentMethod && paymentMethod !== 'debt') {
                                                        setPaymentSplit(prev => {
                                                            const currentValue = prev[paymentMethod] || 0;
                                                            const newValue = Math.max(0, currentValue - pointsValueDiff);
                                                            return { ...prev, [paymentMethod]: newValue };
                                                        });
                                                    }
                                                    setPointsToUse(newPoints);
                                                }}
                                                placeholder="0"
                                                className="w-20 text-right border border-orange-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500 font-medium bg-white"
                                            />
                                            <span className="text-orange-600 text-xs font-medium">= {formatVND(pointsToUse * (loyalty?.redemptionRate || 1000))}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                    <span className="font-bold text-gray-800 text-lg">KHÁCH CẦN TRẢ</span>
                                    <div className="text-right">
                                        <span className="font-bold text-3xl text-green-600">{formatVND(Math.max(0, total - pointsToUse * (loyalty?.redemptionRate || 1000)))}</span>
                                        {pointsToUse > 0 && (
                                            <span className="block text-xs text-orange-500">Đã trừ {formatVND(pointsToUse * (loyalty?.redemptionRate || 1000))} ({pointsToUse} điểm)</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Payment Inputs - HIDDEN IN DELIVERY MODE */}
                            {!isDeliveryMode && (
                                <div className="px-4">
                                    {/* Methods - Dynamic from Settings */}
                                    <div className={cn(
                                        "grid gap-1 mb-2",
                                        paymentMethodsConfig.filter(m => m.enabled).length <= 4 ? "grid-cols-4" : "grid-cols-5"
                                    )}>
                                        {paymentMethodsConfig
                                            .filter(m => m.enabled)
                                            .sort((a, b) => a.sortOrder - b.sortOrder)
                                            .map((m) => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => {
                                                        // Auto-fill remaining amount to new method
                                                        const pointsValue = pointsToUse * (loyalty?.redemptionRate || 1000);
                                                        const currentPaid = Object.values(paymentSplit).reduce((a, b) => a + b, 0) + pointsValue;
                                                        const remaining = Math.max(0, total - currentPaid);
                                                        if (remaining > 0 && m.id !== 'debt') {
                                                            setPaymentSplit(prev => ({ ...prev, [m.id]: (prev[m.id as keyof typeof prev] || 0) + remaining }));
                                                        }
                                                        setPaymentMethod(m.id as any);
                                                    }}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all duration-200",
                                                        paymentMethod === m.id
                                                            ? "bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500"
                                                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                                                    )}
                                                >
                                                    <span className="text-sm">
                                                        {m.iconType === 'url' ? (
                                                            <img src={m.icon} alt={m.name} className="w-4 h-4" />
                                                        ) : m.icon}
                                                    </span>
                                                    <span className="text-[10px] font-bold truncate max-w-full px-1">{m.name}</span>
                                                </button>
                                            ))}
                                    </div>

                                    {/* Cash Area */}
                                    {paymentMethod === 'cash' && (
                                        <div className="space-y-2 animation-fade-in bg-white border border-gray-100 rounded-xl p-2">
                                            <div className="flex justify-between items-center text-sm gap-4">
                                                <span className="text-gray-700 whitespace-nowrap font-bold">Tiền khách đưa</span>
                                                <CurrencyInput
                                                    className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-base focus:outline-none focus:border-green-500 font-bold"
                                                    value={cashReceived || ''}
                                                    onValueChange={(val) => {
                                                        setCashReceived(val);
                                                        setManualCash(val.toLocaleString('vi-VN'));
                                                        setPaymentSplit(prev => ({ ...prev, cash: val }));
                                                    }}
                                                    placeholder="0"
                                                    autoFocus
                                                />
                                            </div>

                                            {/* Numpad + Payment Summary Layout - NEW: 50/50 split */}
                                            <div className="flex gap-2">
                                                {/* Numpad - 50% width, 15% smaller */}
                                                <div className="w-1/2">
                                                    <div className="grid grid-cols-3 gap-0.5">
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                                            <button key={n} onClick={() => {
                                                                const newVal = (cashReceived || 0) * 10 + n;
                                                                setCashReceived(newVal);
                                                                setManualCash(newVal.toLocaleString('vi-VN'));
                                                                setPaymentSplit(prev => ({ ...prev, cash: newVal }));
                                                            }} className="h-10 bg-white rounded text-sm font-bold hover:bg-green-50 text-gray-700 transition-colors border border-gray-200 active:scale-95">{n}</button>
                                                        ))}
                                                        <button onClick={() => { setManualCash('0'); setCashReceived(0); setPaymentSplit(prev => ({ ...prev, cash: 0 })); }} className="h-10 bg-red-50 text-red-500 rounded text-sm font-bold hover:bg-red-100 transition-colors border border-red-100 active:scale-95">C</button>
                                                        <button onClick={() => {
                                                            const newVal = (cashReceived || 0) * 10;
                                                            setCashReceived(newVal);
                                                            setManualCash(newVal.toLocaleString('vi-VN'));
                                                            setPaymentSplit(prev => ({ ...prev, cash: newVal }));
                                                        }} className="h-10 bg-white rounded text-sm font-bold hover:bg-green-50 text-gray-700 transition-colors border border-gray-200 active:scale-95">0</button>
                                                        <button onClick={() => {
                                                            const newVal = (cashReceived || 0) * 1000;
                                                            setCashReceived(newVal);
                                                            setManualCash(newVal.toLocaleString('vi-VN'));
                                                            setPaymentSplit(prev => ({ ...prev, cash: newVal }));
                                                        }} className="h-10 bg-white rounded text-sm font-bold hover:bg-green-50 text-gray-700 transition-colors border border-gray-200 active:scale-95">000</button>
                                                    </div>
                                                </div>

                                                {/* Payment Summary - 50% width with X buttons */}
                                                <div className="w-1/2 bg-gray-50 rounded-lg p-2 border border-gray-100">
                                                    <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Chi tiết thanh toán</div>
                                                    <div className="space-y-1 text-xs max-h-24 overflow-y-auto">
                                                        {paymentSplit.cash > 0 && (
                                                            <div className="flex justify-between items-center text-green-700 group">
                                                                <span>💵 Mặt</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.cash)}</span>
                                                                    <button onClick={() => setPaymentSplit(prev => ({ ...prev, cash: 0 }))} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentSplit.transfer > 0 && (
                                                            <div className="flex justify-between items-center text-blue-700 group">
                                                                <span>🏦 CK</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.transfer)}</span>
                                                                    <button onClick={() => {
                                                                        const amt = paymentSplit.transfer;
                                                                        setPaymentSplit(prev => ({ ...prev, transfer: 0, [paymentMethod]: (prev[paymentMethod] || 0) + amt }));
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentSplit.card > 0 && (
                                                            <div className="flex justify-between items-center text-purple-700 group">
                                                                <span>💳 Thẻ</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.card)}</span>
                                                                    <button onClick={() => {
                                                                        const amt = paymentSplit.card;
                                                                        setPaymentSplit(prev => ({ ...prev, card: 0, [paymentMethod]: (prev[paymentMethod] || 0) + amt }));
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {pointsToUse > 0 && loyalty && (
                                                            <div className="flex justify-between items-center text-orange-700 group">
                                                                <span>⭐ {pointsToUse} điểm</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(pointsToUse * (loyalty.redemptionRate || 1000))}</span>
                                                                    <button onClick={() => setPointsToUse(0)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentSplit.debt > 0 && (
                                                            <div className="flex justify-between items-center text-red-700 group">
                                                                <span>📝 Nợ</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.debt)}</span>
                                                                    <button onClick={() => {
                                                                        const amt = paymentSplit.debt;
                                                                        setPaymentSplit(prev => ({ ...prev, debt: 0, [paymentMethod]: (prev[paymentMethod] || 0) + amt }));
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Show remaining */}
                                                        {(() => {
                                                            const pointsValue = pointsToUse * (loyalty?.redemptionRate || 1000);
                                                            const paid = Object.values(paymentSplit).reduce((a, b) => a + b, 0) + pointsValue;
                                                            const remaining = Math.max(0, total - paid);
                                                            if (remaining > 0) {
                                                                return (
                                                                    <div className="flex justify-between items-center text-gray-500 pt-1 border-t border-gray-200">
                                                                        <span>Còn thiếu</span>
                                                                        <span className="font-bold text-red-500 min-w-[80px] text-right">{formatVND(remaining)}</span>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                    <div className="mt-1 pt-1 border-t border-gray-200">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="font-bold text-gray-700">Tổng</span>
                                                            <span className="font-black text-green-600 min-w-[80px] text-right">{formatVND(Object.values(paymentSplit).reduce((a, b) => a + b, 0) + pointsToUse * (loyalty?.redemptionRate || 1000))}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Suggestions - Smart amounts based on order total */}
                                            {(() => {
                                                const pointsValue = pointsToUse * (loyalty?.redemptionRate || 1000);
                                                const paid = Object.values(paymentSplit).reduce((a, b) => a + b, 0) + pointsValue;
                                                const remainingTotal = Math.max(0, total - paid + paymentSplit.cash);

                                                // Generate smart cash suggestions
                                                const generateSuggestions = (amount: number) => {
                                                    const suggestions: number[] = [];
                                                    const nearest10k = Math.ceil(amount / 10000) * 10000;
                                                    if (nearest10k > amount) suggestions.push(nearest10k);
                                                    const nearest20k = Math.ceil(amount / 20000) * 20000;
                                                    if (nearest20k > amount && !suggestions.includes(nearest20k)) suggestions.push(nearest20k);
                                                    const nearest50k = Math.ceil(amount / 50000) * 50000;
                                                    if (nearest50k > amount && !suggestions.includes(nearest50k)) suggestions.push(nearest50k);
                                                    const nearest100k = Math.ceil(amount / 100000) * 100000;
                                                    if (nearest100k > amount && !suggestions.includes(nearest100k)) suggestions.push(nearest100k);
                                                    [200000, 500000, 1000000].forEach(val => {
                                                        if (val > amount && !suggestions.includes(val)) suggestions.push(val);
                                                    });
                                                    return suggestions.sort((a, b) => a - b).slice(0, 8);
                                                };

                                                const suggestions = generateSuggestions(remainingTotal);

                                                return (
                                                    <div className="grid grid-cols-4 gap-1 pt-1 border-t border-dashed border-gray-100">
                                                        {suggestions.map(amount => (
                                                            <button
                                                                key={amount}
                                                                onClick={() => {
                                                                    setCashReceived(amount);
                                                                    setManualCash(amount.toLocaleString('vi-VN'));
                                                                    setPaymentSplit(prev => ({ ...prev, cash: amount }));
                                                                }}
                                                                className="py-2 bg-gray-50 border border-gray-200 hover:border-green-500 hover:text-green-700 hover:bg-green-100 text-gray-600 font-bold rounded text-[11px] transition-all"
                                                            >
                                                                {formatVND(amount)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Non-Cash Payment Areas - Transfer */}
                                    {paymentMethod === 'transfer' && (
                                        <div className="space-y-2 animation-fade-in bg-white border border-gray-100 rounded-xl p-2">
                                            <div className="flex justify-between items-center text-sm gap-4">
                                                <span className="text-blue-700 whitespace-nowrap font-bold">🏦 Tiền chuyển khoản</span>
                                                <CurrencyInput
                                                    className="w-28 text-right border border-blue-200 rounded-lg px-2 py-1 text-base focus:outline-none focus:border-blue-500 font-bold"
                                                    value={paymentSplit.transfer || ''}
                                                    onValueChange={(val) => setPaymentSplit(prev => ({ ...prev, transfer: val }))}
                                                    placeholder="0"
                                                    autoFocus
                                                />
                                            </div>

                                            {/* Numpad + Payment Summary Layout */}
                                            <div className="flex gap-2">
                                                {/* Numpad - 50% width */}
                                                <div className="w-1/2">
                                                    <div className="grid grid-cols-3 gap-0.5">
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                                            <button key={n} onClick={() => {
                                                                const newVal = (paymentSplit.transfer || 0) * 10 + n;
                                                                setPaymentSplit(prev => ({ ...prev, transfer: newVal }));
                                                            }} className="h-10 bg-white rounded text-sm font-bold hover:bg-blue-50 text-gray-700 transition-colors border border-gray-200 active:scale-95">{n}</button>
                                                        ))}
                                                        <button onClick={() => setPaymentSplit(prev => ({ ...prev, transfer: 0 }))} className="h-10 bg-red-50 text-red-500 rounded text-sm font-bold hover:bg-red-100 transition-colors border border-red-100 active:scale-95">C</button>
                                                        <button onClick={() => {
                                                            const newVal = (paymentSplit.transfer || 0) * 10;
                                                            setPaymentSplit(prev => ({ ...prev, transfer: newVal }));
                                                        }} className="h-10 bg-white rounded text-sm font-bold hover:bg-blue-50 text-gray-700 transition-colors border border-gray-200 active:scale-95">0</button>
                                                        <button onClick={() => {
                                                            const newVal = (paymentSplit.transfer || 0) * 1000;
                                                            setPaymentSplit(prev => ({ ...prev, transfer: newVal }));
                                                        }} className="h-10 bg-white rounded text-sm font-bold hover:bg-blue-50 text-gray-700 transition-colors border border-gray-200 active:scale-95">000</button>
                                                    </div>
                                                </div>

                                                {/* Payment Summary - same as cash */}
                                                <div className="w-1/2 bg-blue-50 rounded-lg p-2 border border-blue-100">
                                                    <div className="text-[10px] font-bold text-blue-600 mb-1 uppercase">Chi tiết thanh toán</div>
                                                    <div className="space-y-1 text-xs max-h-24 overflow-y-auto">
                                                        {paymentSplit.cash > 0 && (
                                                            <div className="flex justify-between items-center text-green-700 group">
                                                                <span>💵 Mặt</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.cash)}</span>
                                                                    <button onClick={() => {
                                                                        const amt = paymentSplit.cash;
                                                                        setPaymentSplit(prev => ({ ...prev, cash: 0, transfer: (prev.transfer || 0) + amt }));
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentSplit.transfer > 0 && (
                                                            <div className="flex justify-between items-center text-blue-700 group">
                                                                <span>🏦 CK</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.transfer)}</span>
                                                                    <button onClick={() => setPaymentSplit(prev => ({ ...prev, transfer: 0 }))} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentSplit.card > 0 && (
                                                            <div className="flex justify-between items-center text-purple-700 group">
                                                                <span>💳 Thẻ</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.card)}</span>
                                                                    <button onClick={() => {
                                                                        const amt = paymentSplit.card;
                                                                        setPaymentSplit(prev => ({ ...prev, card: 0, transfer: (prev.transfer || 0) + amt }));
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {pointsToUse > 0 && loyalty && (
                                                            <div className="flex justify-between items-center text-orange-700 group">
                                                                <span>⭐ {pointsToUse} điểm</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(pointsToUse * (loyalty.redemptionRate || 1000))}</span>
                                                                    <button onClick={() => setPointsToUse(0)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentSplit.debt > 0 && (
                                                            <div className="flex justify-between items-center text-red-700 group">
                                                                <span>📝 Nợ</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.debt)}</span>
                                                                    <button onClick={() => {
                                                                        const amt = paymentSplit.debt;
                                                                        setPaymentSplit(prev => ({ ...prev, debt: 0, transfer: (prev.transfer || 0) + amt }));
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {(() => {
                                                            const pointsValue = pointsToUse * (loyalty?.redemptionRate || 1000);
                                                            const paid = Object.values(paymentSplit).reduce((a, b) => a + b, 0) + pointsValue;
                                                            const remaining = Math.max(0, total - paid);
                                                            if (remaining > 0) {
                                                                return (
                                                                    <div className="flex justify-between items-center text-gray-500 pt-1 border-t border-blue-200">
                                                                        <span>Còn thiếu</span>
                                                                        <span className="font-bold text-red-500 min-w-[80px] text-right">{formatVND(remaining)}</span>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                    <div className="mt-1 pt-1 border-t border-blue-200">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="font-bold text-gray-700">Tổng</span>
                                                            <span className="font-black text-green-600 min-w-[80px] text-right">{formatVND(Object.values(paymentSplit).reduce((a, b) => a + b, 0) + pointsToUse * (loyalty?.redemptionRate || 1000))}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Card Payment */}
                                    {paymentMethod === 'card' && (
                                        <div className="space-y-2 animation-fade-in bg-white border border-gray-100 rounded-xl p-2">
                                            <div className="flex justify-between items-center text-sm gap-4">
                                                <span className="text-purple-700 whitespace-nowrap font-bold">💳 Tiền quẹt thẻ</span>
                                                <CurrencyInput
                                                    className="w-28 text-right border border-purple-200 rounded-lg px-2 py-1 text-base focus:outline-none focus:border-purple-500 font-bold"
                                                    value={paymentSplit.card || ''}
                                                    onValueChange={(val) => setPaymentSplit(prev => ({ ...prev, card: val }))}
                                                    placeholder="0"
                                                    autoFocus
                                                />
                                            </div>

                                            {/* Numpad + Payment Summary Layout */}
                                            <div className="flex gap-2">
                                                {/* Numpad - 50% width */}
                                                <div className="w-1/2">
                                                    <div className="grid grid-cols-3 gap-0.5">
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                                            <button key={n} onClick={() => {
                                                                const newVal = (paymentSplit.card || 0) * 10 + n;
                                                                setPaymentSplit(prev => ({ ...prev, card: newVal }));
                                                            }} className="h-10 bg-white rounded text-sm font-bold hover:bg-purple-50 text-gray-700 transition-colors border border-gray-200 active:scale-95">{n}</button>
                                                        ))}
                                                        <button onClick={() => setPaymentSplit(prev => ({ ...prev, card: 0 }))} className="h-10 bg-red-50 text-red-500 rounded text-sm font-bold hover:bg-red-100 transition-colors border border-red-100 active:scale-95">C</button>
                                                        <button onClick={() => {
                                                            const newVal = (paymentSplit.card || 0) * 10;
                                                            setPaymentSplit(prev => ({ ...prev, card: newVal }));
                                                        }} className="h-10 bg-white rounded text-sm font-bold hover:bg-purple-50 text-gray-700 transition-colors border border-gray-200 active:scale-95">0</button>
                                                        <button onClick={() => {
                                                            const newVal = (paymentSplit.card || 0) * 1000;
                                                            setPaymentSplit(prev => ({ ...prev, card: newVal }));
                                                        }} className="h-10 bg-white rounded text-sm font-bold hover:bg-purple-50 text-gray-700 transition-colors border border-gray-200 active:scale-95">000</button>
                                                    </div>
                                                </div>

                                                {/* Payment Summary */}
                                                <div className="w-1/2 bg-purple-50 rounded-lg p-2 border border-purple-100">
                                                    <div className="text-[10px] font-bold text-purple-600 mb-1 uppercase">Chi tiết thanh toán</div>
                                                    <div className="space-y-1 text-xs max-h-24 overflow-y-auto">
                                                        {paymentSplit.cash > 0 && (
                                                            <div className="flex justify-between items-center text-green-700 group">
                                                                <span>💵 Mặt</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.cash)}</span>
                                                                    <button onClick={() => {
                                                                        const amt = paymentSplit.cash;
                                                                        // Add to current payment method (not card)
                                                                        setPaymentSplit(prev => {
                                                                            const pm = paymentMethod as string;
                                                                            const target = pm === 'transfer' ? 'cash' : pm;
                                                                            if (target === 'debt') return { ...prev, cash: 0 };
                                                                            return { ...prev, cash: 0, [target]: (prev[target as keyof typeof prev] || 0) + amt };
                                                                        });
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentSplit.transfer > 0 && (
                                                            <div className="flex justify-between items-center text-blue-700 group">
                                                                <span>🏦 CK</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.transfer)}</span>
                                                                    <button onClick={() => {
                                                                        const amt = paymentSplit.transfer;
                                                                        // Add to current payment method
                                                                        setPaymentSplit(prev => {
                                                                            const pm = paymentMethod as string;
                                                                            const target = pm === 'transfer' ? 'cash' : pm;
                                                                            if (target === 'debt') return { ...prev, transfer: 0 };
                                                                            return { ...prev, transfer: 0, [target]: (prev[target as keyof typeof prev] || 0) + amt };
                                                                        });
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentSplit.card > 0 && (
                                                            <div className="flex justify-between items-center text-purple-700 group">
                                                                <span>💳 Thẻ</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.card)}</span>
                                                                    <button onClick={() => {
                                                                        const amt = paymentSplit.card;
                                                                        // Add to current payment method
                                                                        setPaymentSplit(prev => {
                                                                            const target = (paymentMethod === 'card' ? 'cash' : paymentMethod) as string;
                                                                            if (target === 'debt') return { ...prev, card: 0 };
                                                                            return { ...prev, card: 0, [target]: (prev[target as keyof typeof prev] || 0) + amt };
                                                                        });
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {pointsToUse > 0 && loyalty && (
                                                            <div className="flex justify-between items-center text-orange-700 group">
                                                                <span>⭐ {pointsToUse} điểm</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(pointsToUse * (loyalty.redemptionRate || 1000))}</span>
                                                                    <button onClick={() => {
                                                                        // Add points value back to current payment method
                                                                        const pointsValue = pointsToUse * (loyalty?.redemptionRate || 1000);
                                                                        const pm = paymentMethod as string;
                                                                        if (pm && pm !== 'debt') {
                                                                            setPaymentSplit(prev => ({
                                                                                ...prev,
                                                                                [paymentMethod]: (prev[paymentMethod as keyof typeof prev] || 0) + pointsValue
                                                                            }));
                                                                        }
                                                                        setPointsToUse(0);
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {paymentSplit.debt > 0 && (
                                                            <div className="flex justify-between items-center text-red-700 group">
                                                                <span>📝 Nợ</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.debt)}</span>
                                                                    <button onClick={() => {
                                                                        const amt = paymentSplit.debt;
                                                                        // Add to current payment method
                                                                        setPaymentSplit(prev => {
                                                                            const pm = paymentMethod as string;
                                                                            const target = pm === 'debt' ? 'cash' : pm;
                                                                            return { ...prev, debt: 0, [target]: (prev[target as keyof typeof prev] || 0) + amt };
                                                                        });
                                                                    }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {(() => {
                                                            const pointsValue = pointsToUse * (loyalty?.redemptionRate || 1000);
                                                            const paid = Object.values(paymentSplit).reduce((a, b) => a + b, 0) + pointsValue;
                                                            const remaining = Math.max(0, total - paid);
                                                            if (remaining > 0) {
                                                                return (
                                                                    <div className="flex justify-between items-center text-gray-500 pt-1 border-t border-purple-200">
                                                                        <span>Còn thiếu</span>
                                                                        <span className="font-bold text-red-500 min-w-[80px] text-right">{formatVND(remaining)}</span>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                    <div className="mt-1 pt-1 border-t border-purple-200">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="font-bold text-gray-700">Tổng</span>
                                                            <span className="font-black text-green-600 min-w-[80px] text-right">{formatVND(Object.values(paymentSplit).reduce((a, b) => a + b, 0) + pointsToUse * (loyalty?.redemptionRate || 1000))}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Debt Payment - NO numpad, auto-calculate */}
                                    {paymentMethod === 'debt' && (
                                        <div className="space-y-2 animation-fade-in bg-red-50 border border-red-100 rounded-xl p-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-red-700 font-bold flex items-center gap-2">
                                                    <span className="text-xl">📝</span> Ghi nợ
                                                </span>
                                                <span className="text-xl font-black text-red-700">
                                                    {formatVND((() => {
                                                        const pointsValue = pointsToUse * (loyalty?.redemptionRate || 1000);
                                                        const otherPayments = Object.entries(paymentSplit)
                                                            .filter(([k]) => k !== 'debt')
                                                            .reduce((a, [, v]) => a + v, 0) + pointsValue;
                                                        const remaining = Math.max(0, total - otherPayments);
                                                        if (paymentSplit.debt !== remaining) {
                                                            setPaymentSplit(prev => ({ ...prev, debt: remaining }));
                                                        }
                                                        return remaining;
                                                    })())}
                                                </span>
                                            </div>

                                            {/* Payment breakdown for debt */}
                                            <div className="bg-white rounded-lg p-2 border border-red-100">
                                                <div className="text-[10px] font-bold text-red-600 mb-1 uppercase">Chi tiết thanh toán</div>
                                                <div className="space-y-1 text-xs">
                                                    {paymentSplit.cash > 0 && (
                                                        <div className="flex justify-between items-center text-green-700 group">
                                                            <span>💵 Mặt</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.cash)}</span>
                                                                <button onClick={() => setPaymentSplit(prev => ({ ...prev, cash: 0 }))} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {paymentSplit.transfer > 0 && (
                                                        <div className="flex justify-between items-center text-blue-700 group">
                                                            <span>🏦 CK</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.transfer)}</span>
                                                                <button onClick={() => setPaymentSplit(prev => ({ ...prev, transfer: 0 }))} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {paymentSplit.card > 0 && (
                                                        <div className="flex justify-between items-center text-purple-700 group">
                                                            <span>💳 Thẻ</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.card)}</span>
                                                                <button onClick={() => setPaymentSplit(prev => ({ ...prev, card: 0 }))} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {pointsToUse > 0 && loyalty && (
                                                        <div className="flex justify-between items-center text-orange-700 group">
                                                            <span>⭐ {pointsToUse} điểm</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold min-w-[80px] text-right">{formatVND(pointsToUse * (loyalty.redemptionRate || 1000))}</span>
                                                                <button onClick={() => setPointsToUse(0)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {paymentSplit.debt > 0 && (
                                                        <div className="flex justify-between items-center text-red-700 pt-1 border-t border-red-200">
                                                            <span className="font-bold">📝 Ghi nợ</span>
                                                            <span className="font-bold min-w-[80px] text-right">{formatVND(paymentSplit.debt)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-1 pt-1 border-t border-red-200">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="font-bold text-gray-700">Tổng</span>
                                                        <span className="font-black text-green-600 min-w-[80px] text-right">{formatVND(Object.values(paymentSplit).reduce((a, b) => a + b, 0) + pointsToUse * (loyalty?.redemptionRate || 1000))}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {customer ? (
                                                <div className="text-xs text-red-600 pt-1 border-t border-red-200">
                                                    Ghi nợ cho <span className="font-bold">{customer.name}</span>
                                                    {customer.debt_balance > 0 && (
                                                        <span className="ml-2 text-red-500">(Nợ cũ: {formatVND(customer.debt_balance)})</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-red-600 font-bold pt-1 border-t border-red-200">
                                                    ⚠ Vui lòng chọn khách hàng!
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Order Note - Simple clean input */}
                                    <div className="flex items-center gap-2 px-3 py-2">
                                        <span className="text-gray-400">📝</span>
                                        <input
                                            type="text"
                                            value={orderNote}
                                            onChange={(e) => setOrderNote(e.target.value)}
                                            placeholder="Ghi chú đơn hàng..."
                                            className="flex-1 bg-transparent border-none text-sm p-0 focus:ring-0 focus:outline-none placeholder-gray-400 text-gray-700"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Spacer for scroll */}
                            <div className="h-6"></div>
                        </div>

                        {/* Footer Divider Block */}
                        <div className="h-2 bg-gradient-to-b from-gray-100 to-gray-50 shrink-0"></div>

                        {/* Footer - Fixed at bottom */}
                        <div className="p-3 bg-white relative z-30">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="printReceipt"
                                        checked={shouldPrintReceipt}
                                        onChange={(e) => setShouldPrintReceipt(e.target.checked)}
                                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                    />
                                    <label htmlFor="printReceipt" className="text-sm font-medium text-gray-600 select-none cursor-pointer">In hóa đơn</label>
                                </div>

                                {/* Delivery Mode Toggle - One-time trigger */}
                                <button
                                    onClick={() => setIsDeliveryMode(!isDeliveryMode)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-sm font-bold shadow-sm mx-2",
                                        isDeliveryMode
                                            ? "bg-slate-600 border-slate-600 text-white ring-2 ring-slate-200"
                                            : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                                    )}
                                >
                                    <span className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors", isDeliveryMode ? "bg-white border-white" : "border-gray-400 bg-gray-50")}>
                                        {isDeliveryMode && <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </span>
                                    <span>Bán giao ngay</span>
                                </button>

                                {/* Change Due - Right - More Prominent */}
                                {(() => {
                                    const remainingTotal = Math.max(0, total - pointsToUse * (loyalty?.redemptionRate || 1000));
                                    const changeDue = Math.max(0, cashReceived - remainingTotal);
                                    return (
                                        <div className="flex items-center gap-3 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                                            <span className="text-sm font-semibold text-red-700">Tiền thừa trả khách</span>
                                            <span className={cn(
                                                "font-black text-xl",
                                                changeDue > 0 ? "text-red-600" : "text-gray-400"
                                            )}>
                                                {formatVND(changeDue)}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>



                            <div className="flex gap-3">
                                <button
                                    className="flex-1 py-3.5 border border-blue-300 text-blue-600 font-bold rounded-xl hover:bg-blue-50 text-xs uppercase tracking-wider bg-blue-50/50 shadow-sm flex items-center justify-center gap-2 transition-all"
                                    onClick={async () => {
                                        if (cartItems.length === 0) return;

                                        // Generate temporary order object for printing
                                        const tempOrder: any = {
                                            id: 'PROVISIONAL',
                                            order_number: 'TẠM TÍNH',
                                            created_at: new Date().toISOString(),
                                            customer: customer || undefined,
                                            order_items: cartItems.map(item => ({
                                                product: item.product,
                                                quantity: item.quantity,
                                                unit_price: item.unit_price,
                                                unit_name: item.unitName || item.product.base_unit
                                            })),
                                            total_amount: total,
                                            discount_amount: discountAmount,
                                            final_amount: total - discountAmount,
                                            payment_method: paymentMethod,
                                            points_earned: loyalty && customer ? Math.floor(total / (loyalty.pointsPerAmount || 10000)) : 0,
                                            customer_id: customer?.id
                                        };

                                        await printProvisionalReceipt(tempOrder, user?.name || user?.email || 'Thu ngân');
                                    }}
                                >
                                    ⎙ In tạm tính (F9)
                                </button>
                                <button
                                    className="px-5 py-3.5 bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2"
                                    onClick={handleSaveDraft}
                                    title="Lưu tạm đơn hàng"
                                >
                                    💾 Lưu nháp
                                </button>
                                <button
                                    onClick={async () => {
                                        console.log('Payment button clicked!', { cartItems: cartItems.length, isSubmitting, paymentMethod });
                                        if (cartItems.length === 0) {
                                            alert('Giỏ hàng trống! Vui lòng thêm sản phẩm.');
                                            return;
                                        }
                                        if (paymentMethod === 'debt' && !customer) {
                                            alert('Vui lòng chọn khách hàng để ghi nợ!');
                                            return;
                                        }
                                        try {
                                            console.log('Calling submitOrder...');

                                            // Validation for Delivery Mode
                                            if (isDeliveryMode) {
                                                if (!deliveryInfo.recipient_name || !deliveryInfo.recipient_phone || !deliveryInfo.shipping_address) {
                                                    alert('Vui lòng nhập đầy đủ: Tên, SĐT và Địa chỉ người nhận!');
                                                    return;
                                                }
                                            }

                                            // Set points discount before submitting
                                            if (pointsToUse > 0 && loyalty) {
                                                setPointsDiscount(pointsToUse, pointsToUse * (loyalty.redemptionRate || 1000));
                                            }

                                            // Prepare submit options
                                            const submitOptions = isDeliveryMode ? {
                                                status: 'pending_approval' as const,
                                                is_delivery: true,
                                                delivery_info: deliveryInfo,
                                                note: orderNote,
                                                paymentSplit
                                            } : {
                                                note: orderNote,
                                                paymentSplit
                                            };

                                            const order = await submitOrder(submitOptions);
                                            console.log('submitOrder result:', order);
                                            if (!order) {
                                                alert('Lỗi: Không thể lưu đơn hàng. Vui lòng thử lại!');
                                            } else {
                                                // Success - no alert, just clear form
                                                setManualCash('');
                                                setPointsToUse(0);
                                                setOrderNote('');
                                                setWholesaleMode(false); // Reset wholesale mode for next order
                                                setIsDeliveryMode(false); // Reset delivery mode
                                                setDeliveryInfo({ recipient_name: '', recipient_phone: '', shipping_address: '', delivery_notes: '' }); // Reset delivery info
                                                // Reset payment split
                                                setPaymentSplit({ cash: 0, transfer: 0, card: 0, debt: 0, points: 0 });

                                                // Print receipt if checkbox checked AND NOT DELIVERY (Delivery usually prints shipping label later)
                                                // But logical to print "Phiếu tạm tính" or "Phiếu đặt hàng"? 
                                                // For now, allow print if checked
                                                if (shouldPrintReceipt) {
                                                    // TODO: Maybe different print template for Delivery Order?
                                                    printSalesReceipt(order, user?.name || user?.email || 'Thu ngân');
                                                }
                                            }
                                        } catch (e: any) {
                                            console.error('Payment error:', e);
                                            alert('Lỗi hệ thống: ' + (e.message || JSON.stringify(e)));
                                        }
                                    }}
                                    disabled={isSubmitting || cartItems.length === 0}
                                    className={cn(
                                        "flex-[2] py-3.5 rounded-xl font-bold text-lg text-white shadow-lg uppercase tracking-wider",
                                        (isSubmitting || cartItems.length === 0)
                                            ? "bg-gray-400 cursor-not-allowed"
                                            : isDeliveryMode
                                                ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200"
                                                : "bg-green-600 hover:bg-green-700 shadow-green-200"
                                    )}
                                >
                                    {isSubmitting
                                        ? 'Đang xử lý...'
                                        : isDeliveryMode
                                            ? <span className="flex flex-col items-center leading-none text-sm gap-0.5"><span>LƯU ĐƠN GIAO</span><span className="text-[10px] font-normal opacity-90">Chờ duyệt</span></span>
                                            : 'THANH TOÁN (F1)'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div >

                {/* Close Order Confirmation Modal */}
                {
                    showCloseConfirm !== null && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl min-w-[300px]">
                                <div className="p-6 text-center">
                                    <span className="text-5xl block mb-4">⚠️</span>
                                    <h2 className="text-lg font-bold mb-2">Đóng đơn hàng?</h2>
                                    <p className="text-gray-600 text-sm mb-4">
                                        Đơn hàng có {cartItems.length} sản phẩm ({formatVND(total)}).
                                        Hành động này sẽ được hoàn tác.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowCloseConfirm(null)}
                                            className="flex-1 py-3 rounded-xl bg-gray-100 font-medium"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={() => confirmCloseTab(showCloseConfirm)}
                                            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium"
                                        >
                                            Đóng đơn
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Note Modal */}
                {
                    showNoteModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] min-w-[350px]">
                                <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-2xl">
                                    <h2 className="font-bold">📝 Ghi chú đơn hàng</h2>
                                    <button onClick={() => setShowNoteModal(false)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
                                </div>
                                <div className="p-4 overflow-y-auto flex-1">
                                    <textarea
                                        value={orderNote}
                                        onChange={(e) => setOrderNote(e.target.value)}
                                        placeholder="Nhập ghi chú..."
                                        rows={4}
                                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-400 focus:border-green-400"
                                        autoFocus
                                    />
                                </div>
                                <div className="p-4 border-t flex gap-3 sticky bottom-0 bg-white">
                                    <button onClick={() => setShowNoteModal(false)} className="flex-1 py-3 rounded-xl bg-gray-100 font-medium">Hủy</button>
                                    <button onClick={() => setShowNoteModal(false)} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium">Lưu</button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Item Edit Modal - Green Theme */}
                {
                    editingItem && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] min-w-[350px]">
                                <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-2xl">
                                    <h2 className="font-bold">✏️ Chỉnh sửa</h2>
                                    <button onClick={() => setEditingItem(null)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
                                </div>
                                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center text-3xl">
                                            {getProductEmoji(editingItem.product.name)}
                                        </div>
                                        <div>
                                            <p className="font-bold">{editingItem.product.name}</p>
                                            <p className="text-sm text-green-600">{formatVND(editingItem.unit_price)}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">Ghi chú sản phẩm</label>
                                        <textarea
                                            value={editingItem.notes || ''}
                                            onChange={(e) => {
                                                updateItemNote(editingItem.id, e.target.value);
                                                setEditingItem({ ...editingItem, notes: e.target.value });
                                            }}
                                            placeholder="Thêm ghi chú (VD: Không hành, không đá...)"
                                            className="w-full px-4 py-3 border rounded-xl"
                                            rows={2}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">Số lượng</label>
                                        <input
                                            type="number"
                                            value={editingItem.quantity}
                                            onChange={(e) => {
                                                const q = parseInt(e.target.value) || 1;
                                                updateItemQuantity(editingItem.id, q);
                                                setEditingItem({ ...editingItem, quantity: q });
                                            }}
                                            className="w-full px-4 py-3 border rounded-xl text-lg font-bold text-center"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">Đơn vị tính</label>
                                        <select
                                            value={editingItem.unitName || editingItem.product.base_unit || 'Cái'}
                                            onChange={(e) => {
                                                updateItemUnit(editingItem.id, e.target.value);
                                                setEditingItem({ ...editingItem, unitName: e.target.value });
                                            }}
                                            className="w-full px-4 py-3 border rounded-xl"
                                        >
                                            <option value={editingItem.product.base_unit || 'Cái'}>{editingItem.product.base_unit || 'Cái'}</option>
                                            <option value="Thùng">Thùng</option>
                                            <option value="Lốc">Lốc</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">Chiết khấu</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={itemDiscount.type}
                                                onChange={(e) => setItemDiscount({ ...itemDiscount, type: e.target.value as 'percent' | 'amount' })}
                                                className="px-3 py-3 border rounded-xl"
                                            >
                                                <option value="percent">%</option>
                                                <option value="amount">VNĐ</option>
                                            </select>
                                            <input
                                                type="number"
                                                value={itemDiscount.value}
                                                min="0"
                                                max={itemDiscount.type === 'percent' ? 100 : undefined}
                                                onChange={(e) => {
                                                    let val = parseFloat(e.target.value) || 0;
                                                    // Limit percent to 100%
                                                    if (itemDiscount.type === 'percent' && val > 100) {
                                                        val = 100;
                                                    }
                                                    setItemDiscount({ ...itemDiscount, value: val });
                                                }}
                                                className="flex-1 px-4 py-3 border rounded-xl"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 border-t flex gap-3 sticky bottom-0 bg-white">
                                    <button
                                        onClick={() => { removeItem(editingItem.id); setEditingItem(null); }}
                                        className="flex-1 py-3 rounded-xl bg-red-100 text-red-600 font-medium"
                                    >
                                        🗑️ Xóa
                                    </button>
                                    <button onClick={() => setEditingItem(null)} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium">
                                        ✓ Xong
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Price Adjustment Modal - Green Theme */}
                {
                    priceAdjustmentItem && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                            <div className="bg-white rounded-xl w-full max-w-[500px] shadow-2xl flex flex-col max-h-[90vh] min-w-[350px]">
                                <div className="flex justify-between items-center p-4 border-b">
                                    <h3 className="font-bold text-lg">Điều chỉnh giá sản phẩm</h3>
                                    <button onClick={() => setPriceAdjustmentItem(null)} className="text-gray-400 hover:text-gray-600"><span className="text-2xl">×</span></button>
                                </div>
                                <div className="p-6 overflow-y-auto">
                                    {/* Product Info */}
                                    <div className="flex gap-4 mb-6">
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-3xl border">
                                            {getProductEmoji(priceAdjustmentItem.product.name)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-lg">{priceAdjustmentItem.product.name}</p>
                                            <div className="flex items-center gap-2 text-green-600">
                                                <span className="font-bold text-xl">{formatVND(priceAdjustmentItem.unit_price)}</span>
                                                <span>✏️</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Discount Toggle */}
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="font-bold">Giảm giá</span>
                                        <div className="flex border rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => setPriceAdjust({ ...priceAdjust, mode: 'percent', value: 0 })}
                                                className={cn("px-4 py-1 text-sm font-medium", priceAdjust.mode === 'percent' ? 'bg-green-600 text-white' : 'bg-gray-50 hover:bg-gray-100')}
                                            >%</button>
                                            <button
                                                onClick={() => setPriceAdjust({ ...priceAdjust, mode: 'amount', value: 0 })}
                                                className={cn("px-4 py-1 text-sm font-medium", priceAdjust.mode === 'amount' ? 'bg-green-600 text-white' : 'bg-gray-50 hover:bg-gray-100')}
                                            >Giá trị</button>
                                        </div>
                                    </div>

                                    {/* Inputs */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Giảm giá {priceAdjust.mode === 'percent' ? '(%)' : '(đ)'}</span>
                                            <div className="relative w-48">
                                                <input
                                                    type="number"
                                                    value={priceAdjust.value}
                                                    min="0"
                                                    max={priceAdjust.mode === 'percent' ? 100 : undefined}
                                                    onChange={(e) => {
                                                        let val = parseFloat(e.target.value) || 0;
                                                        // Limit percent to 100%
                                                        if (priceAdjust.mode === 'percent' && val > 100) {
                                                            val = 100;
                                                        }
                                                        setPriceAdjust({ ...priceAdjust, value: val });
                                                    }}
                                                    className="w-full border rounded-lg p-2 text-right pr-8 font-bold"
                                                    autoFocus
                                                />
                                                <span className="absolute right-3 top-2 text-gray-500">{priceAdjust.mode === 'percent' ? '%' : 'đ'}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                                            <span className="text-gray-600 font-medium">Giá sau giảm</span>
                                            <span className="text-xl font-bold text-green-600">
                                                {formatVND(
                                                    priceAdjust.mode === 'percent'
                                                        ? priceAdjustmentItem.unit_price * (1 - priceAdjust.value / 100)
                                                        : priceAdjustmentItem.unit_price - priceAdjust.value
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Note & Reason */}
                                    <div className="mt-6 space-y-4">
                                        <div>
                                            <label className="block text-gray-600 mb-2 text-sm">Lý do giảm giá</label>
                                            <input
                                                className="w-full border rounded-lg p-2.5 text-sm"
                                                placeholder="Nhập lý do giảm giá..."
                                                value={priceAdjust.reason}
                                                onChange={(e) => setPriceAdjust({ ...priceAdjust, reason: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-600 mb-2 text-sm">Ghi chú sản phẩm (Bếp/Bar)</label>
                                            <textarea
                                                className="w-full border rounded-lg p-2.5 text-sm"
                                                placeholder="Ví dụ: Không hành, ít đá..."
                                                rows={2}
                                                value={priceAdjust.note}
                                                onChange={(e) => setPriceAdjust({ ...priceAdjust, note: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-xl">
                                    <button
                                        onClick={() => setPriceAdjustmentItem(null)}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-100 font-medium text-gray-600"
                                    >
                                        Hủy (ESC)
                                    </button>
                                    <button
                                        onClick={() => setPriceAdjust({ mode: 'percent', value: 0, reason: '', note: priceAdjustmentItem.notes || '' })}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-100 font-medium text-green-600"
                                    >
                                        Đặt lại
                                    </button>
                                    <button
                                        onClick={() => {
                                            // Discount per UNIT
                                            const discountPerUnit = priceAdjust.mode === 'percent'
                                                ? priceAdjustmentItem.unit_price * (priceAdjust.value / 100)
                                                : priceAdjust.value;

                                            // Total discount = per unit * quantity
                                            const totalDiscount = discountPerUnit * priceAdjustmentItem.quantity;

                                            updateItemDiscount(priceAdjustmentItem.id, totalDiscount, priceAdjust.reason);
                                            if (priceAdjust.note !== priceAdjustmentItem.notes) {
                                                updateItemNote(priceAdjustmentItem.id, priceAdjust.note);
                                            }
                                            setPriceAdjustmentItem(null);
                                        }}
                                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-lg shadow-green-200"
                                    >
                                        Áp dụng (F8)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* New Order Confirmation Modal */}
                {
                    showNewOrderConfirm && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl min-w-[300px]">
                                <div className="p-6 text-center">
                                    <span className="text-5xl block mb-4">🧹</span>
                                    <h2 className="text-lg font-bold mb-2">Tạo đơn mới?</h2>
                                    <p className="text-gray-600 text-sm mb-4">
                                        Giỏ hàng đang có {cartItems.length} sản phẩm.
                                        <br />Bạn có chắc chắn muốn xóa để tạo đơn mới?
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowNewOrderConfirm(false)}
                                            className="flex-1 py-3 rounded-xl bg-gray-100 font-medium hover:bg-gray-200"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={confirmNewOrder}
                                            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 shadow-lg shadow-red-200"
                                        >
                                            Đồng ý
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Drafts List Modal */}
                {
                    showDraftsList && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                            <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh]">
                                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">📋</span>
                                        <h2 className="font-bold text-lg">Danh sách đơn chờ ({draftOrders.length})</h2>
                                    </div>
                                    <button onClick={() => setShowDraftsList(false)} className="text-2xl text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">×</button>
                                </div>
                                <div className="p-0 overflow-y-auto flex-1 bg-gray-50/50">
                                    {draftOrders.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                            <span className="text-6xl mb-4 opacity-50">📭</span>
                                            <p className="font-medium">Không có đơn hàng nào đang chờ</p>
                                            <p className="text-sm mt-1">Lưu đơn nháp để xem tại đây</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 p-4">
                                            {draftOrders.map((draft, idx) => (
                                                <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-green-300 transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                                                        #{idx + 1}
                                                    </div>

                                                    <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                                                        <div>
                                                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Thời gian</p>
                                                            <p className="font-medium text-gray-700">
                                                                {new Date(draft.timestamp || draft.order.created_at || '').toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                            <p className="text-xs text-gray-400">
                                                                {new Date(draft.timestamp || '').toLocaleDateString('vi-VN')}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Khách hàng</p>
                                                            <p className="font-medium text-gray-900 truncate">
                                                                {draft.customer ? draft.customer.name : 'Khách lẻ'}
                                                            </p>
                                                            {draft.customer && <p className="text-xs text-gray-400">{draft.customer.phone}</p>}
                                                        </div>

                                                        <div className="col-span-2 sm:col-span-1">
                                                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Ghi chú</p>
                                                            <p className="text-sm text-gray-600 truncate">
                                                                {draft.note ? `📝 ${draft.note}` : <span className="opacity-50 italic">--</span>}
                                                            </p>
                                                        </div>

                                                        <div className="col-span-2 sm:col-span-1 text-left sm:text-right">
                                                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Tổng tiền</p>
                                                            <p className="font-bold text-green-600 text-lg">
                                                                {formatVND(draft.order.total_amount || 0)}
                                                            </p>
                                                            <p className="text-xs text-gray-400">{draft.items.length} sản phẩm</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-gray-100">
                                                        <button
                                                            onClick={() => setDraftToDelete(draft.id)}
                                                            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors text-sm"
                                                        >
                                                            Xóa
                                                        </button>
                                                        <button
                                                            onClick={() => { resumeOrder(draft.id); setShowDraftsList(false); }}
                                                            className="flex-1 sm:flex-none px-6 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition-colors text-sm"
                                                        >
                                                            Tiếp tục
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Draft Delete Confirmation Modal */}
                {
                    draftToDelete && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
                            <div className="bg-white rounded-2xl w-[400px] max-w-full shadow-2xl overflow-hidden">
                                <div className="p-6 text-center">
                                    <span className="text-5xl block mb-4">🗑️</span>
                                    <h2 className="text-xl font-bold mb-2 break-normal">Xóa đơn chờ?</h2>
                                    <p className="text-gray-600 text-sm mb-6 break-normal">
                                        Bạn có chắc chắn muốn xóa đơn chờ này không?
                                        <br />Hành động này không thể hoàn tác.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setDraftToDelete(null)}
                                            className="flex-1 py-3 rounded-xl bg-gray-100 font-medium hover:bg-gray-200"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (draftToDelete) {
                                                    deleteDraftOrder(draftToDelete);
                                                    // Auto-close modal if no drafts left
                                                    const remainingDrafts = draftOrders.filter(d => d.id !== draftToDelete);
                                                    if (remainingDrafts.length === 0) {
                                                        setShowDraftsList(false);
                                                    }
                                                    setDraftToDelete(null);
                                                }
                                            }}
                                            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 shadow-lg shadow-red-200 whitespace-nowrap"
                                        >
                                            Xóa ngay
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    showAddCustomerModal && (
                        <CustomerModal
                            initialPhone={initialPhone}
                            onSave={async (data) => {
                                const { customers, loadCustomers } = useCustomerStore.getState();
                                // Add customer with default values
                                await useCustomerStore.getState().addCustomer({
                                    ...data,
                                    points_balance: 0,
                                    total_spent: 0,
                                    total_orders: 0,
                                    debt_balance: 0,
                                    is_active: true
                                } as any);

                                // Find the newly created customer (by phone) and select it
                                if (data.phone) {
                                    const updatedCustomers = useCustomerStore.getState().customers;
                                    const newCustomer = updatedCustomers.find(c => c.phone === data.phone);
                                    if (newCustomer) {
                                        setCustomer(newCustomer);
                                        setCustomerSearch(''); // Clear search
                                    }
                                }
                                setShowAddCustomerModal(false);
                            }}
                            onClose={() => setShowAddCustomerModal(false)}
                        />
                    )
                }

                {/* Edit Customer Modal - for editing selected customer */}
                {/* Modals */}
                <OrderLookupModal isOpen={showOrderLookup} onClose={() => setShowOrderLookup(false)} />
                <CustomerLookupModal
                    isOpen={showCustomerLookup}
                    onClose={() => setShowCustomerLookup(false)}
                    onSelect={(customer) => {
                        setCustomer(customer);
                        // Optional: Add to cart/focus?
                    }}
                />
                <ShiftControlModal isOpen={showShiftModal} onClose={() => setShowShiftModal(false)} />
                <ReminderManager isOpen={showReminderManager} onClose={() => setShowReminderManager(false)} />
                <ReminderPopup />

                {/* Existing Modals */}
                {showEditCustomerModal && customer && (
                    <CustomerModal
                        customer={customer}
                        onSave={async (data) => {
                            await useCustomerStore.getState().updateCustomer(customer.id, data);
                            // Refresh customer data
                            const updatedCustomers = useCustomerStore.getState().customers;
                            const updatedCustomer = updatedCustomers.find(c => c.id === customer.id);
                            if (updatedCustomer) {
                                setCustomer(updatedCustomer);
                            }
                            setShowEditCustomerModal(false);
                        }}
                        onClose={() => setShowEditCustomerModal(false)}
                    />
                )}

                {/* Barcode Selection Modal - shows when multiple products match scanned barcode */}
                {
                    barcodeMatches.length > 0 && (
                        <BarcodeSelectionModal
                            matches={barcodeMatches}
                            onSelect={handleBarcodeSelect}
                            onClose={() => setBarcodeMatches([])}
                        />
                    )
                }

                {/* Category Settings Modal */}
                <CategorySettingsModal
                    isOpen={showCategorySettings}
                    onClose={() => setShowCategorySettings(false)}
                />


                {/* Order Lookup Modal */}
                <OrderLookupModal
                    isOpen={showOrderLookup}
                    onClose={() => setShowOrderLookup(false)}
                />

                {/* Customer Lookup Modal */}
                <CustomerLookupModal
                    isOpen={showCustomerLookup}
                    onClose={() => setShowCustomerLookup(false)}
                />

                {/* REMOVED: Click backdrop was blocking dropdown clicks! */}
            </div >
        </>
    );
}


export default POSPage;
