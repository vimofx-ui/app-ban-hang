// =============================================================================
// POS PAGE - Multi-Order Tabs, Enhanced UX, Security Logging
// =============================================================================

import { logPrintProvisional } from '@/lib/ghostScan';

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
import { usePOSScanner } from '@/hooks/usePOSScanner';
import { usePOSCart } from '@/hooks/usePOSCart';
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
import { SavedOrdersDrawer } from '@/components/orders/SavedOrdersDrawer';
import { BarcodeScannerModal } from '@/components/common/BarcodeScannerModal';
import { POSTabs } from '@/components/pos/POSTabs';
import { POSCartList } from '@/components/pos/POSCartList';
import { POSProductList } from '@/components/pos/POSProductList';
import { POSCustomerSection } from '@/components/pos/POSCustomerSection';
import { POSPaymentPanel } from '@/components/pos/POSPaymentPanel';
import type { OrderTab } from '@/types/pos';
import type { Category } from '@/stores/categoryStore';

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



export function POSPage() {
    const navigate = useNavigate();

    // Refs for click outside handling
    const inputRef = useRef<HTMLInputElement>(null);
    const [productPanelHeight, setProductPanelHeight] = useState(300); // Default height for product panel
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    // selectedCustomer state removed
    const [usePoints, setUsePoints] = useState(false);
    const [pointsToUse, setPointsToUse] = useState(0);

    // --- LOCAL STATE RESTORED ---
    const [orderNote, setOrderNote] = useState('');
    const [showMobilePayment, setShowMobilePayment] = useState(false);




    const [showNoteModal, setShowNoteModal] = useState(false);
    // State moved to usePOSCart: editingItem, priceAdjustmentItem, priceAdjust, showNumpad, itemDiscount
    const [manualCash, setManualCash] = useState('');
    const [showCloseConfirm, setShowCloseConfirm] = useState<number | null>(null);
    const [tempDiscount, setTempDiscount] = useState<{ type: DiscountType, value: number }>({ type: 'percent', value: 0 }); // For global discount
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
    const [showScanner, setShowScanner] = useState(false); // Camera scanner modal
    const [scannerMode, setScannerMode] = useState(true); // Barcode scanner mode toggle - default ON
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showCategorySettings, setShowCategorySettings] = useState(false);
    const [showOrderLookup, setShowOrderLookup] = useState(false);
    const [showCustomerLookup, setShowCustomerLookup] = useState(false);


    // Multi-payment state
    const [paymentSplit, setPaymentSplit] = useState<POSPaymentSplit>({ cash: 0, transfer: 0, card: 0, debt: 0, points: 0 });

    const [orderTabs, setOrderTabs] = useState<OrderTab[]>([{ id: '1', label: 'Đơn 1', items: [], customer: null, note: '' }]);
    const [activeTabIndex, setActiveTabIndex] = useState(0);

    // --- STORE HOOKS (Fixed & Aliased) ---
    const {
        cartItems, addItem, addItemWithUnit, removeItem, updateItemQuantity, clearCart,
        customer, setCustomer,
        subtotal, total, discountAmount, setDiscount, taxAmount, taxRate, setTaxRate,
        cashReceived, setCashReceived, change,
        submitOrder, parkOrder, draftOrders, deleteDraftOrder, resumeOrder,
        paymentMethod, setPaymentMethod, updateItemUnit,
        isSubmitting, updateItemNote, updateItemDiscount, setPointsDiscount, updateItemPrice,
        wholesaleMode, toggleWholesaleMode, setWholesaleMode, setLastPrintTime
    } = usePOSStore();

    // Custom Hooks
    const {
        editingItem, setEditingItem,
        priceAdjustmentItem, setPriceAdjustmentItem,
        priceAdjust, setPriceAdjust,
        itemDiscount, setItemDiscount,
        handleQuantityChange,
        handleUnitChange,
        handlePriceAdjustmentRequest,
        handleEditRequest
    } = usePOSCart();

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
    const { isMobile, isTablet, width } = useBreakpoint();
    // Custom breakpoint for Tablet Landscape (1280x720) optimization
    // Applies when width is between 1024 and 1280 (inclusive)
    const isTabletLandscape = width >= 1024 && width <= 1280;

    // Auto-redirect mobile users to dedicated MobilePOS page for better UX
    useEffect(() => {
        if (isMobile && width < 768) {
            navigate('/mobile-pos', { replace: true });
        }
    }, [isMobile, width, navigate]);

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
            navigate('/dang-nhap');
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


    // Use extracted POS Scanner hook
    const {
        barcodeMatches,
        setBarcodeMatches,
        barcodeError,
        setBarcodeError,
        handleBarcodeSelect,
        handleBarcodeScan
    } = usePOSScanner({
        products,
        addToCart,
        addItemWithUnit,
        setSearchQuery,
        setShowSearchDropdown
    });


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
    }, [cartItems.length, isSubmitting, submitOrder, showSearchDropdown, searchQuery, toggleFullscreen, paymentMethod, customer, pointsToUse, loyalty, orderNote, paymentSplit, setPointsDiscount]);

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
            lastPrintTime: usePOSStore.getState().lastPrintTime,
            switchCount: usePOSStore.getState().switchCount,
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

        // Load Risk State
        usePOSStore.setState({
            lastPrintTime: tab.lastPrintTime || null,
            switchCount: tab.switchCount || 0
        });

        // 3. Recalculate totals (implicitly handled by store subscriptions or next render, 
        // but explicit action might be safer if store has computed properties)
    };

    // Switch Tab
    const handleTabSwitch = (index: number) => {
        if (index === activeTabIndex) return;

        // Save current work
        const tabsWithSavedState = saveCurrentTabState(orderTabs, activeTabIndex);
        setOrderTabs(tabsWithSavedState);

        // Increment switch count for target tab (Risk Analysis)
        const targetTab = tabsWithSavedState[index];
        targetTab.switchCount = (targetTab.switchCount || 0) + 1;

        // Load new work
        loadTabState(targetTab);
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
            note: '',
            lastPrintTime: null,
            switchCount: 0
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

    // Local handleQuantityChange moved to usePOSCart

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

    const handlePrintProvisional = async () => {
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

        // Log to Ghost Scan
        logPrintProvisional({
            orderId: 'PROVISIONAL',
            itemsCount: cartItems.length,
            totalAmount: total,
            shiftId: currentShift?.id,
            userId: user?.id
        });

        setLastPrintTime(new Date());
        usePOSStore.getState().setLastPrintTime(new Date()); // Update store for tracking
    };

    const handlePaymentSubmit = async () => {
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

                // Print receipt if checkbox checked
                if (shouldPrintReceipt) {
                    printSalesReceipt(order, user?.name || user?.email || 'Thu ngân');
                }
            }
        } catch (e: any) {
            console.error('Payment error:', e);
            alert('Lỗi hệ thống: ' + (e.message || JSON.stringify(e)));
        }
    };

    return (
        <>
            {showScanner && (
                <BarcodeScannerModal
                    onScan={(code) => {
                        handleBarcodeScan(code);
                        setShowScanner(false);
                    }}
                    onClose={() => setShowScanner(false)}
                    title="Quét sản phẩm"
                />
            )}

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
                    <button
                        onClick={() => navigate('/')}
                        className={cn("hover:bg-white/20 p-2 rounded-lg", isTabletLandscape && "hidden")}
                        title="Về trang chủ (Home)"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </button>

                    {/* Workflow Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleNewOrder}
                            className={cn(
                                "hidden md:flex bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium items-center gap-1 shadow-sm transition-colors",
                                isTabletLandscape && "!hidden" // Force hide on Tablet Landscape to override md:flex
                            )}
                            title="Tạo đơn mới (Xóa giỏ hàng hiện tại)"
                        >
                            <span>✨</span> <span className="hidden lg:inline">Tạo mới</span>
                        </button>

                        <button
                            onClick={() => setShowDraftsList(prev => !prev)}
                            className={cn(
                                "relative bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors",
                                isTabletLandscape && "bg-transparent hover:bg-transparent px-0 py-0" // Remove button styling on Tablet
                            )}
                            title="Danh sách đơn đang chờ"
                        >
                            {/* Icon: Use SVG for customizable color (white) instead of emoji */}
                            {isTabletLandscape ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                            ) : (
                                <span className="text-xl">📋</span>
                            )}

                            <span className={cn("hidden lg:inline", isTabletLandscape && "!hidden")}>Đơn chờ</span> {/* Text hidden on Tablet */}
                            {/* Draft orders badge */}
                            {draftOrders.length > 0 && (
                                <span className={cn(
                                    "absolute text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold",
                                    isTabletLandscape ? "-top-1 -right-2 w-5 h-5 text-xs bg-amber-500 border-2 border-green-600" : "-top-1 -right-1 bg-amber-500"
                                )}>
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
                            {/* Dollar Icon - customizable color */}
                            <svg xmlns="http://www.w3.org/2000/svg" className={cn("w-5 h-5", wholesaleMode ? "text-white" : "text-gray-300")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className={cn("hidden lg:inline", isTabletLandscape && "hidden")}>{wholesaleMode ? 'Giá buôn' : 'Giá lẻ'}</span>
                        </button>
                    </div>

                    {/* Search - Fixed width on desktop, full on mobile */}
                    <div className={cn(
                        "relative flex-1 md:flex-none",
                        isTabletLandscape ? "w-96" : "md:w-[640px]" // Wider on Tablet Landscape (approx 50% more than previous w-64)
                    )}>
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
                        {/* Barcode scan button - CAMERA */}
                        <button
                            type="button"
                            onClick={() => setShowScanner(true)}
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
                    <POSTabs
                        tabs={orderTabs}
                        activeTabIndex={activeTabIndex}
                        onSwitchTab={handleTabSwitch}
                        onCloseTab={closeOrderTab}
                        onAddTab={addOrderTab}
                    />

                    {/* Right side: Offline indicator, Employee name, Fullscreen, Logout */}
                    <div className="flex items-center gap-2 ml-auto flex-shrink-0 z-[100]">

                        {/* CUSTOMER SEARCH - TABLET LANDSCAPE: REMOVED from Header (Moved back to Right Panel) */}

                        {/* Offline Indicator */}
                        {!isOnline && (
                            <div className="bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold animate-pulse flex items-center gap-1">
                                <span>📴</span> Offline
                            </div>
                        )}

                        {/* Employee Name - Hide on Tablet Landscape */}
                        {!isTabletLandscape && (
                            <span className="hidden md:inline text-sm font-medium opacity-90 drop-shadow-md">
                                👤 {user?.name || user?.email || 'Nhân viên'}
                            </span>
                        )}

                        {/* Fullscreen Button - Hide on Tablet Landscape */}
                        {!isTabletLandscape && (
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
                        )}

                        {/* Logout Button - Icon only - Hide on Tablet Landscape */}
                        {!isTabletLandscape && (
                            <button
                                type="button"
                                onClick={() => window.location.href = '/dang-nhap'}
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
                        )}
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
                        <POSCartList
                            items={cartItems}
                            onUpdateQuantity={handleQuantityChange}
                            onRemoveItem={removeItem}
                            onUnitChange={handleUnitChange}
                            onRequestPriceAdjustment={handlePriceAdjustmentRequest}
                            onRequestEdit={handleEditRequest}
                        />

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
                        <POSProductList
                            products={gridProducts}
                            orderedCategories={orderedCategories}
                            selectedCategory={selectedCategory}
                            onSelectCategory={setSelectedCategory}
                            visibleCategoryIds={posCategories.visibleCategoryIds}
                            showAllTab={posCategories.showAllTab}
                            customLists={posCategories.customLists}
                            onShowOrderLookup={() => setShowOrderLookup(true)}
                            onShowCustomerLookup={() => setShowCustomerLookup(true)}
                            onShowShiftModal={() => setShowShiftModal(true)}
                            onShowReminderManager={() => setShowReminderManager(true)}
                            onShowCategorySettings={() => setShowCategorySettings(true)}
                            gridColumns={rawPosCategories.productGridColumns || 6}
                            panelHeight={productPanelHeight}
                            onProductClick={handleProductClick}
                        />
                    </div>

                    {/* Right - Payment Panel - Green Theme */}
                    {/* Right - Payment Panel - Green Theme */}
                    <POSPaymentPanel
                        total={total}
                        subtotal={subtotal}
                        discountAmount={discountAmount}
                        taxAmount={taxAmount}
                        taxRate={taxRate}
                        setTaxRate={setTaxRate}
                        customer={customer}
                        onSelectCustomer={setCustomer}
                        onShowCustomerModal={(type, phone) => {
                            if (type === 'add') {
                                setInitialPhone(phone || '');
                                setShowAddCustomerModal(true);
                            } else {
                                setShowEditCustomerModal(true);
                            }
                        }}
                        onShowCustomerLookup={() => setShowCustomerLookup(true)}
                        inputRef={inputRef as React.RefObject<HTMLInputElement>}
                        loyalty={loyalty}
                        pointsToUse={pointsToUse}
                        setPointsToUse={setPointsToUse}
                        paymentMethod={paymentMethod || 'cash'}
                        setPaymentMethod={setPaymentMethod}
                        paymentMethodsConfig={paymentMethodsConfig}
                        paymentSplit={paymentSplit}
                        setPaymentSplit={setPaymentSplit}
                        cashReceived={cashReceived}
                        setCashReceived={setCashReceived}
                        manualCash={manualCash}
                        setManualCash={setManualCash}
                        orderNote={orderNote}
                        setOrderNote={setOrderNote}
                        cartItemCount={cartItems.length}
                        tempDiscount={tempDiscount}
                        setTempDiscount={setTempDiscount}
                        setDiscount={setDiscount}
                        isDeliveryMode={isDeliveryMode}
                        setIsDeliveryMode={setIsDeliveryMode}
                        deliveryInfo={deliveryInfo}
                        setDeliveryInfo={setDeliveryInfo}
                        isSubmitting={isSubmitting}
                        onSubmit={handlePaymentSubmit}
                        onSaveDraft={handleSaveDraft}
                        onPrintProvisional={handlePrintProvisional}
                        shouldPrintReceipt={shouldPrintReceipt}
                        setShouldPrintReceipt={setShouldPrintReceipt}
                        isMobile={isMobile}
                        isTablet={isTablet}
                        isTabletLandscape={isTabletLandscape}
                        className={cn(
                            (isMobile || isTablet) && !isTabletLandscape
                                ? `fixed inset-x-0 bottom-0 border-t rounded-t-3xl ${showMobilePayment ? 'translate-y-0 h-[85vh]' : 'translate-y-[calc(100%-80px)] h-[85vh]'}`
                                : isTabletLandscape
                                    ? "w-[70%] h-full"
                                    : "w-[660px] h-full"
                        )}
                    />
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

                {/* Saved Orders Modal (replaces Drafts List & Delete Confirm) */}
                <SavedOrdersDrawer open={showDraftsList} onOpenChange={setShowDraftsList} />

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
                                        // setCustomerSearch(''); // Clear search - state removed
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
                {
                    showEditCustomerModal && customer && (
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
                    )
                }

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
