// =============================================================================
// CREATE/EDIT PURCHASE ORDER PAGE - Refactored Layout
// =============================================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Plus, Trash2, Search, Package, X, ChevronDown,
    ChevronRight, Image as ImageIcon, Upload, Tag, ScanBarcode,
    Calculator, Info, Save
} from 'lucide-react';
import { usePurchaseOrderStore, type PurchaseOrderItem } from '@/stores/purchaseOrderStore';
import { useSupplierStore } from '@/stores/supplierStore';
import { useProductStore } from '@/stores/productStore';
import { useBrandStore } from '@/stores/brandStore';
import { useBranchStore } from '@/stores/branchStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { BarcodeScannerModal } from '@/components/common/BarcodeScannerModal';
import { BarcodeSelectionModal, findProductsByBarcode, type BarcodeMatch } from '@/components/common/BarcodeSelectionModal';
import { POSAudio } from '@/lib/posAudio';
import { toast } from 'sonner';
import { ProductDetailsModal } from '@/components/products/ProductDetailsModal';

interface CartItem extends Partial<PurchaseOrderItem> {
    key: string;
    discount_percent?: number;
    tax_percent?: number;
    unit_options?: { name: string; ratio: number; price: number }[];
    selected_unit?: string;
    base_qty?: number;
    image_url?: string;
    // Generated
    allocated_cost?: number;
    final_unit_cost?: number;
}

export function CreatePurchaseOrderPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;
    const user = useAuthStore(state => state.user);

    const { createPurchaseOrder, getSuggestedOrders } = usePurchaseOrderStore();
    const { suppliers, fetchSuppliers } = useSupplierStore();
    const { products, loadProducts } = useProductStore();

    // Brand & Branch
    const brandIdFromBrandStore = useBrandStore(state => state.currentBrand?.id);
    const brandIdFromAuth = useAuthStore(state => state.brandId);
    const brandId = brandIdFromBrandStore || brandIdFromAuth;
    const currentBranch = useBranchStore(state => state.getCurrentBranch());

    // Form state
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [notes, setNotes] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [expectedDate, setExpectedDate] = useState('');
    const [assignee, setAssignee] = useState('Admin');

    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [showUnitDropdown, setShowUnitDropdown] = useState<string | null>(null);
    const [invoiceImages, setInvoiceImages] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    // Supplier search state
    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

    // Cost Allocation State
    const [shippingCost, setShippingCost] = useState(0);
    const [importTax, setImportTax] = useState(0);
    const [otherCost, setOtherCost] = useState(0);
    const [supplierDiscount, setSupplierDiscount] = useState(0);

    // Scanner states
    const [showScanner, setShowScanner] = useState(false);
    const [barcodeMatches, setBarcodeMatches] = useState<BarcodeMatch[]>([]);

    // Product Details Modal state
    const [viewingProduct, setViewingProduct] = useState<any | null>(null);

    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const unitDropdownRef = useRef<HTMLDivElement>(null);
    const supplierDropdownRef = useRef<HTMLDivElement>(null);
    const productDropdownRef = useRef<HTMLDivElement>(null);

    // localStorage key for draft
    const DRAFT_KEY = 'po_draft_' + (id || 'new');

    // Filtered and sorted suppliers
    const filteredSuppliers = useMemo(() => {
        const term = supplierSearch.toLowerCase().trim();
        const sorted = [...suppliers].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

        if (term) {
            return sorted.filter(s =>
                s.name.toLowerCase().includes(term) ||
                s.phone?.includes(term) ||
                s.code?.toLowerCase().includes(term)
            );
        }
        return sorted;
    }, [suppliers, supplierSearch]);

    // Load initial data
    useEffect(() => {
        if (brandId) {
            fetchSuppliers();
            loadProducts();
        }
    }, [brandId]);

    // Load PO / Draft
    useEffect(() => {
        if (isEditing && id) loadExistingPO();
        else loadDraftFromStorage();
    }, [id, isEditing]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target as Node)) {
                setShowSupplierDropdown(false);
            }
            if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
                setShowProductDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle Barcode
    const handleBarcodeScan = (code: string) => {
        const matches = findProductsByBarcode(products, code);
        if (matches.length === 0) {
            POSAudio.playError();
            toast.error(`Mã "${code}" không tồn tại!`);
        } else if (matches.length === 1) {
            setShowScanner(false);
            addProduct(matches[0].product);
            POSAudio.playAddItem();
            toast.success(`Đã thêm: ${matches[0].displayName}`);
        } else {
            setShowScanner(false);
            setBarcodeMatches(matches);
        }
    };

    const handleBarcodeSelect = (match: BarcodeMatch) => {
        setBarcodeMatches([]);
        addProduct(match.product);
        POSAudio.playAddItem();
        toast.success(`Đã thêm: ${match.displayName}`);
    };

    const handleBarcodeSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const term = searchQuery.trim().toLowerCase();
        if (!term) return;
        const exact = products.find(p => p.barcode === term || p.sku === term);
        if (exact) { addProduct(exact); setSearchQuery(''); return; }
        const matches = products.filter(p => p.name.toLowerCase().includes(term) || p.sku?.includes(term));
        if (matches.length === 1) { addProduct(matches[0]); setSearchQuery(''); }
        else if (matches.length > 1) setShowScanner(true); // Or product picker
        else alert('Không tìm thấy sản phẩm');
    };

    // Cache cho giá nhập gần nhất
    const [lastImportPriceCache, setLastImportPriceCache] = useState<Record<string, number>>({});

    // Lấy giá nhập từ đơn gần nhất
    const getLastImportPrice = async (productId: string): Promise<number | null> => {
        // Check cache
        if (lastImportPriceCache[productId] !== undefined) {
            return lastImportPriceCache[productId];
        }

        try {
            const { data } = await supabase
                .from('purchase_order_items')
                .select(`
                    unit_price,
                    purchase_orders!inner(created_at, status)
                `)
                .eq('product_id', productId)
                .neq('purchase_orders.status', 'cancelled')
                .order('purchase_orders(created_at)', { ascending: false })
                .limit(1)
                .single();

            const price = data?.unit_price || null;
            // Update cache
            if (price !== null) {
                setLastImportPriceCache(prev => ({ ...prev, [productId]: price }));
            }
            return price;
        } catch (error) {
            console.log('No previous import price found for product:', productId);
            return null;
        }
    };

    // Add Product - Lấy giá từ đơn gần nhất
    const addProduct = async (product: any) => {
        const existing = cartItems.find(item => item.product_id === product.id);
        if (existing) {
            updateItem(existing.key, { ordered_qty: (existing.ordered_qty || 0) + 1 });
        } else {
            // Lấy giá nhập từ đơn gần nhất
            const lastPrice = await getLastImportPrice(product.id);
            const importPrice = lastPrice ?? product.cost_price ?? 0;

            // Build unit options từ product.units với đúng field names
            const baseUnit = { name: product.base_unit || 'Cái', ratio: 1, price: importPrice };
            const additionalUnits = (product.units || []).map((u: any) => ({
                name: u.unit_name || u.name || '',
                ratio: u.conversion_rate || u.ratio || 1,
                price: u.selling_price || importPrice * (u.conversion_rate || u.ratio || 1)
            })).filter((u: any) => u.name);

            const newItem: CartItem = {
                key: `${product.id}-${Date.now()}`,
                product_id: product.id,
                product_name: product.name,
                sku: product.sku,
                image_url: product.image_url,
                ordered_qty: 1,
                unit_price: importPrice,
                unit: product.base_unit || 'Cái',
                unit_options: additionalUnits.length > 0 ? [baseUnit, ...additionalUnits] : undefined,
                selected_unit: product.base_unit || 'Cái',
            };
            setCartItems(prev => [...prev, newItem]);
        }
    };

    const updateItem = (key: string, updates: Partial<CartItem>) => setCartItems(prev => prev.map(item => item.key === key ? { ...item, ...updates } : item));
    const removeItem = (key: string) => setCartItems(prev => prev.filter(item => item.key !== key));

    const handleUnitChange = (key: string, unitName: string) => {
        const item = cartItems.find(i => i.key === key);
        const opt = item?.unit_options?.find(u => u.name === unitName);
        if (item && opt) updateItem(key, { selected_unit: unitName, unit: unitName, unit_price: opt.price });
        setShowUnitDropdown(null);
    };

    // Toggle expand/collapse for unit conversion details
    const toggleExpand = (key: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Image Upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsLoading(true);
        try {
            const uploadedUrls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                const filePath = `po-invoices/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('invoices').upload(filePath, file);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(filePath);
                uploadedUrls.push(publicUrl);
            }
            setInvoiceImages(prev => [...prev, ...uploadedUrls]);
        } catch (error: any) {
            console.error('Upload error:', error);
            alert('Lỗi tải ảnh: ' + error.message);
        } finally {
            setIsLoading(false);
            e.target.value = '';
        }
    };

    // Cost Calculation
    const calculateSubtotal = () => {
        return cartItems.reduce((sum, item) => sum + ((item.ordered_qty || 0) * (item.unit_price || 0)), 0);
    };

    const getComputedItems = () => {
        const subtotal = calculateSubtotal();
        const totalAllocatableCost = (shippingCost || 0) + (importTax || 0) + (otherCost || 0) - (supplierDiscount || 0);

        return cartItems.map(item => {
            const qty = item.ordered_qty || 0;
            const price = item.unit_price || 0;
            const itemSubtotal = qty * price;
            const ratio = subtotal > 0 ? (itemSubtotal / subtotal) : 0;
            const allocated = totalAllocatableCost * ratio;
            const finalUnitCost = qty > 0 ? (itemSubtotal + allocated) / qty : 0;
            return { ...item, allocated_cost: allocated, final_unit_cost: finalUnitCost };
        });
    };

    const computedItems = getComputedItems();
    const totalAmount = calculateSubtotal() + (shippingCost || 0) + (importTax || 0) + (otherCost || 0) - (supplierDiscount || 0);
    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount);

    // Save
    const handleSubmit = async (isDraft = false) => {
        if (!selectedSupplierId && !isDraft) {
            toast.error('⚠️ Vui lòng chọn nhà cung cấp trước khi tạo đơn!');
            return;
        }
        if (cartItems.length === 0) {
            toast.error('⚠️ Vui lòng thêm ít nhất 1 sản phẩm!');
            return;
        }

        setIsLoading(true);
        try {
            const finalItems = getComputedItems();
            const poData = {
                supplier_id: selectedSupplierId || undefined,
                notes,
                expected_date: expectedDate || undefined,
                status: isDraft ? 'draft' : 'pending',
                subtotal: calculateSubtotal(),
                shipping_cost: shippingCost,
                import_tax: importTax,
                other_costs: otherCost,
                supplier_discount: supplierDiscount,
                total_amount: totalAmount,
                invoice_images: invoiceImages
            };

            const po = await createPurchaseOrder(poData as any, finalItems);

            if (po) {
                localStorage.removeItem(DRAFT_KEY);
                navigate(`/nhap-hang/${po.id}`);
                toast.success('Đã lưu đơn hàng thành công');
            } else {
                const errorMsg = usePurchaseOrderStore.getState().error;
                alert('Có lỗi khi tạo đơn hàng: ' + (errorMsg || 'Vui lòng kiểm tra lại kết nối hoặc dữ liệu'));
            }
        } catch (err) {
            console.error(err);
            alert('Có lỗi xảy ra.');
        } finally {
            setIsLoading(false);
        }
    };

    // Load data helpers...
    const loadDraftFromStorage = () => {
        try {
            const draft = localStorage.getItem(DRAFT_KEY);
            if (draft) {
                const data = JSON.parse(draft);
                if (data.cartItems?.length > 0 || data.selectedSupplierId) {
                    setSelectedSupplierId(data.selectedSupplierId || '');
                    setCartItems(data.cartItems || []);
                    setNotes(data.notes || '');
                    setTags(data.tags || []);
                    setExpectedDate(data.expectedDate || '');
                    setShippingCost(data.shippingCost || 0);
                    setImportTax(data.importTax || 0);
                    setOtherCost(data.otherCost || 0);
                    setSupplierDiscount(data.supplierDiscount || 0);
                }
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (cartItems.length > 0 || selectedSupplierId) {
            const draftData = { selectedSupplierId, cartItems, notes, tags, expectedDate, shippingCost, importTax, otherCost, supplierDiscount, savedAt: new Date().toISOString() };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
        }
    }, [cartItems, selectedSupplierId, notes, tags, expectedDate, shippingCost, importTax, otherCost, supplierDiscount]);

    const loadExistingPO = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const { getPurchaseOrder } = usePurchaseOrderStore.getState();
            const po = await getPurchaseOrder(id);
            if (po) {
                setSelectedSupplierId(po.supplier_id || '');
                setNotes(po.notes || '');
                setExpectedDate(po.expected_date || '');
                setShippingCost(po.shipping_cost || 0);
                setImportTax(po.import_tax || 0);
                setOtherCost(po.other_costs || 0);
                setSupplierDiscount(po.supplier_discount || 0);
                setInvoiceImages(po.invoice_images || []);
                if (po.items) {
                    setCartItems(po.items.map((item: any) => ({
                        ...item, key: `${item.product_id}-${Date.now()}`,
                        product_name: item.product_name || item.products?.name,
                        unit_options: [{ name: item.unit || 'Cái', ratio: 1, price: item.unit_price }],
                        selected_unit: item.unit, ordered_qty: item.quantity || item.ordered_qty || 1
                    })));
                }
            }
        } finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-6 md:pb-10">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4 flex justify-between items-center bg-white">
                    <button onClick={() => navigate('/nhap-hang')} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                        <ArrowLeft size={20} className="mr-1 md:mr-2" /> <span className="hidden md:inline">Quay lại</span>
                    </button>
                    <h1 className="text-lg md:text-xl font-bold text-gray-800 truncate px-2">{isEditing ? 'Sửa đơn' : 'Tạo đơn nhập'}</h1>
                    <div className="flex gap-2">
                        <button onClick={() => handleSubmit(true)} className="px-3 py-1.5 md:px-4 md:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 text-sm md:text-base">Thoát</button>
                        <button onClick={() => handleSubmit(false)} className="px-4 py-1.5 md:px-6 md:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 text-sm md:text-base">
                            {isLoading ? <span className="animate-spin">⏳</span> : <Save size={18} className="hidden sm:inline" />}
                            <span>{isLoading ? 'Đang tạo...' : 'Tạo đơn nhập'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 max-w-7xl w-full mx-auto px-3 md:px-4 py-4 md:py-8 space-y-4 md:space-y-6">

                {/* SECTION 1: INFO & VENDOR */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    {/* 1. VENDOR INFO */}
                    <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-100 flex flex-col">
                        <h3 className="font-semibold text-gray-800 mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base"><Tag size={18} /> Thông tin nhà cung cấp</h3>
                        <div className="relative flex-1" ref={supplierDropdownRef}>
                            {selectedSupplierId ? (
                                <div className="flex items-center justify-between p-3 md:p-4 border rounded-lg bg-green-50 border-green-200 group h-full">
                                    <div>
                                        <div className="font-bold text-green-800 text-base md:text-lg">
                                            {suppliers.find(s => s.id === selectedSupplierId)?.name}
                                        </div>
                                        <div className="text-sm text-green-700 mt-1">
                                            {suppliers.find(s => s.id === selectedSupplierId)?.phone || '0901234567'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedSupplierId(''); setSupplierSearch(''); }}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ) : (
                                <div className="h-full">
                                    <div className="relative w-full">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="🔍 Tìm nhà cung cấp..."
                                            value={supplierSearch}
                                            onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                                            onFocus={() => setShowSupplierDropdown(true)}
                                            className="w-full pl-10 pr-4 py-2.5 md:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors text-sm md:text-base"
                                        />
                                    </div>
                                    {showSupplierDropdown && (
                                        <div className="absolute z-30 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {filteredSuppliers.length === 0 ? (
                                                <div className="p-4 text-center text-gray-500 text-sm">Không tìm thấy NCC</div>
                                            ) : (
                                                filteredSuppliers.map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => { setSelectedSupplierId(s.id); setSupplierSearch(''); setShowSupplierDropdown(false); }}
                                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                                    >
                                                        <div className="font-medium text-gray-900">{s.name}</div>
                                                        <div className="text-xs text-gray-500">{s.phone}</div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. ORDER INFO */}
                    <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-100 h-full">
                        <h3 className="font-semibold text-gray-800 mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base"><Info size={18} /> Thông tin đơn hàng</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-x-6 md:gap-y-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Chi nhánh</label>
                                <div className="font-medium text-gray-900 bg-gray-100 p-2 rounded border text-sm md:text-base truncate">{currentBranch?.name || 'Chi nhánh mặc định'}</div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Nhân viên</label>
                                <select
                                    value={assignee}
                                    onChange={(e) => setAssignee(e.target.value)}
                                    className="w-full p-2 border rounded bg-white font-medium text-gray-800 outline-none focus:ring-1 focus:ring-blue-500 text-sm md:text-base"
                                >
                                    <option value="Admin">Admin</option>
                                    <option value={user?.email || 'Staff'}>{user?.email || 'Staff'}</option>
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Ngày hẹn giao</label>
                                <input
                                    type="date"
                                    value={expectedDate}
                                    onChange={e => setExpectedDate(e.target.value)}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: PRODUCTS */}
                <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-100 min-h-[400px]">
                    <h3 className="font-semibold text-gray-800 mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base"><Package size={18} /> Sản phẩm ({computedItems.length})</h3>

                    {/* Search Bar & Options */}
                    <div className="flex gap-2 md:gap-4 mb-4">
                        <form onSubmit={handleBarcodeSearch} className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                ref={barcodeInputRef}
                                type="text"
                                placeholder="🔍 Tìm SP, SKU, Barcode... (F3)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setShowProductDropdown(true)}
                                className="w-full pl-10 pr-10 md:pr-12 py-2.5 md:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all shadow-sm text-sm md:text-base"
                            />
                            <button type="button" onClick={() => setShowScanner(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200 rounded text-gray-500 hover:text-blue-600">
                                <ScanBarcode size={20} />
                            </button>
                            {/* Product Dropdown */}
                            {showProductDropdown && (
                                <div ref={productDropdownRef} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border z-30 max-h-60 md:max-h-80 overflow-y-auto">
                                    {(() => {
                                        // Filter products hoặc hiện mới nhất nếu search rỗng
                                        const filtered = searchQuery.trim()
                                            ? products.filter(p =>
                                                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                p.sku?.includes(searchQuery) ||
                                                p.barcode?.includes(searchQuery)
                                            )
                                            : [...products].sort((a, b) =>
                                                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                                            );

                                        return filtered.slice(0, 10).map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => { addProduct(p); setSearchQuery(''); setShowProductDropdown(false); }}
                                                className="p-2 md:p-3 hover:bg-gray-50 cursor-pointer border-b flex items-center gap-3 group"
                                            >
                                                {/* Thumbnail */}
                                                <div className="w-10 h-10 rounded-lg border overflow-hidden flex-shrink-0 bg-gray-100">
                                                    {p.image_url ? (
                                                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                            <Package size={20} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium group-hover:text-blue-600 text-sm md:text-base truncate">{p.name}</div>
                                                    <div className="text-xs text-gray-500">{p.sku} | Tồn: {p.current_stock || 0}</div>
                                                </div>
                                                <div className="font-bold text-blue-600 text-sm whitespace-nowrap">{formatCurrency(p.cost_price || 0)}đ</div>
                                            </div>
                                        ));
                                    })()}
                                    {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && searchQuery.trim() && (
                                        <div className="p-4 text-center text-gray-500 text-sm">Không tìm thấy sản phẩm</div>
                                    )}
                                </div>
                            )}
                        </form>
                        <button onClick={() => setShowScanner(true)} className="md:hidden p-2.5 bg-blue-100 text-blue-600 rounded-lg">
                            <ScanBarcode size={20} />
                        </button>
                    </div>

                    {/* Table - Mobile Overflow */}
                    <div className="overflow-x-auto border rounded-lg -mx-2 md:mx-0">
                        <table className="w-full text-sm min-w-[700px] md:min-w-full">
                            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                                <tr>
                                    <th className="p-2 md:p-3 text-left w-8">#</th>
                                    <th className="p-2 md:p-3 text-left">Tên sản phẩm</th>
                                    <th className="p-2 md:p-3 text-center w-20">ĐVT</th>
                                    <th className="p-2 md:p-3 text-center w-24">SL</th>
                                    <th className="p-2 md:p-3 text-right">Giá nhập</th>
                                    <th className="p-2 md:p-3 text-right text-orange-600" title="Giá sau khi phân bổ chi phí">Giá vốn*</th>
                                    <th className="p-2 md:p-3 text-right">Thành tiền</th>
                                    <th className="p-2 md:p-3 w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {computedItems.map((item, idx) => {
                                    const hasUnits = item.unit_options && item.unit_options.length > 1;
                                    const isExpanded = expandedItems.has(item.key);
                                    const selectedOpt = item.unit_options?.find(u => u.name === item.selected_unit);
                                    const baseOpt = item.unit_options?.[0]; // First is base unit

                                    return (
                                        <React.Fragment key={item.key}>
                                            <tr className="hover:bg-blue-50/30 transition-colors">
                                                <td className="p-2 md:p-3 text-center text-gray-400">{idx + 1}</td>
                                                <td className="p-2 md:p-3">
                                                    <div
                                                        className="font-medium text-gray-900 text-blue-600 cursor-pointer line-clamp-2 min-w-[120px] hover:underline"
                                                        onClick={() => {
                                                            const product = products.find(p => p.id === item.product_id);
                                                            if (product) setViewingProduct(product);
                                                        }}
                                                    >{item.product_name}</div>
                                                    <div className="text-xs text-gray-500">{item.sku}</div>
                                                    {/* Expand/Collapse button for products with unit options */}
                                                    {hasUnits && (
                                                        <button
                                                            onClick={() => toggleExpand(item.key)}
                                                            className="mt-1 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                        >
                                                            {isExpanded ? '▲ Ẩn quy đổi' : '▼ Xem quy đổi'}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="p-2 md:p-3 text-center">
                                                    <div className="relative inline-block w-full">
                                                        {hasUnits ? (
                                                            <button onClick={() => setShowUnitDropdown(showUnitDropdown === item.key ? null : item.key)} className="w-full px-1 py-1 bg-white border rounded text-xs font-medium hover:border-blue-500 flex justify-between items-center text-gray-700 whitespace-nowrap">
                                                                {item.selected_unit} <ChevronDown size={12} />
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-500 text-xs px-2 py-1 bg-gray-100 rounded whitespace-nowrap">{item.unit}</span>
                                                        )}

                                                        {showUnitDropdown === item.key && (
                                                            <div ref={unitDropdownRef} className="absolute z-10 top-full left-0 mt-1 bg-white border shadow-lg rounded p-1 w-full min-w-[100px]">
                                                                {item.unit_options?.map(u => (
                                                                    <div
                                                                        key={u.name}
                                                                        onClick={() => handleUnitChange(item.key, u.name)}
                                                                        className={`p-2 hover:bg-gray-100 cursor-pointer text-left text-xs ${u.name === item.selected_unit ? 'bg-blue-50 font-medium' : ''}`}
                                                                    >
                                                                        {u.name} {u.ratio > 1 && <span className="text-gray-400">({u.ratio}x)</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-2 md:p-3 text-center">
                                                    <div className="flex items-center justify-center border rounded overflow-hidden h-8">
                                                        <button onClick={() => updateItem(item.key, { ordered_qty: Math.max(1, (item.ordered_qty || 1) - 1) })} className="w-8 flex items-center justify-center hover:bg-gray-100 border-r text-gray-500 h-full">-</button>
                                                        <input
                                                            type="number" value={item.ordered_qty}
                                                            onChange={(e) => updateItem(item.key, { ordered_qty: Number(e.target.value) })}
                                                            className="w-10 md:w-12 text-center outline-none font-medium text-gray-800 h-full text-sm"
                                                            min="1"
                                                        />
                                                        <button onClick={() => updateItem(item.key, { ordered_qty: (item.ordered_qty || 0) + 1 })} className="w-8 flex items-center justify-center hover:bg-gray-100 border-l text-gray-500 h-full">+</button>
                                                    </div>
                                                </td>
                                                <td className="p-2 md:p-3 text-right">
                                                    <input type="number" value={item.unit_price} onChange={e => updateItem(item.key, { unit_price: Number(e.target.value) })} className="w-20 md:w-24 text-right p-1 border rounded outline-none focus:border-blue-500 text-sm" />
                                                </td>
                                                <td className="p-2 md:p-3 text-right font-medium text-orange-600 bg-orange-50/20 whitespace-nowrap">
                                                    {formatCurrency(Math.round(item.final_unit_cost || item.unit_price || 0))}
                                                </td>
                                                <td className="p-2 md:p-3 text-right font-bold text-gray-900 whitespace-nowrap">{formatCurrency((item.ordered_qty || 0) * (item.unit_price || 0))}</td>
                                                <td className="p-2 md:p-3 text-center">
                                                    <button onClick={() => removeItem(item.key)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                            {/* Expanded row showing unit conversion details */}
                                            {hasUnits && isExpanded && (
                                                <tr className="bg-blue-50/50">
                                                    <td colSpan={8} className="p-3 pl-8">
                                                        <div className="text-xs space-y-2">
                                                            <div className="font-semibold text-gray-700 mb-2">📦 Đơn vị quy đổi:</div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                {item.unit_options?.map((u, i) => (
                                                                    <div
                                                                        key={u.name}
                                                                        className={`p-2 rounded border ${u.name === item.selected_unit ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'}`}
                                                                    >
                                                                        <div className="font-medium text-gray-800">{u.name}</div>
                                                                        <div className="text-gray-500">
                                                                            {i === 0 ? (
                                                                                <span className="text-green-600">Đơn vị gốc</span>
                                                                            ) : (
                                                                                <span>1 {u.name} = {u.ratio} {baseOpt?.name || 'ĐVT gốc'}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-blue-600 font-semibold">Giá: {formatCurrency(u.price)}đ</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {computedItems.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-10 text-center text-gray-400 font-medium">Chưa có sản phẩm nào được chọn</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SECTION 3: BOTTOM (Notes, Images, Totals) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT (2/3): Notes & Images */}
                    <div className="lg:col-span-2 space-y-4 md:space-y-6 order-2 lg:order-1">
                        {/* Notes */}
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                <div>
                                    <label className="font-semibold text-gray-700 mb-2 block text-sm">Ghi chú đơn</label>
                                    <textarea
                                        value={notes} onChange={e => setNotes(e.target.value)}
                                        className="w-full p-3 border rounded-lg h-24 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors"
                                        placeholder="Ví dụ: Hàng tặng kèm..."
                                    />
                                </div>
                                <div className="hidden md:block">
                                    <label className="font-semibold text-gray-700 mb-2 block text-sm">Tags</label>
                                    <input
                                        type="text"
                                        placeholder="Nhập tags..."
                                        className="w-full p-3 border rounded-lg text-sm bg-gray-50 mb-2"
                                        disabled
                                    />
                                    <div className="text-xs text-gray-400 italic">Tính năng Tags đang cập nhật</div>
                                </div>
                            </div>
                        </div>

                        {/* Images */}
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-100">
                            <h3 className="font-semibold text-gray-800 mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base"><ImageIcon size={18} /> Ảnh hóa đơn <span className="text-gray-400 font-normal text-sm">({invoiceImages.length})</span></h3>
                            <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg mb-4 border border-yellow-200 flex items-center gap-2">
                                <Info size={16} /> <span className="flex-1">Ảnh sẽ tự động xóa sau 6 tháng.</span>
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 md:gap-3">
                                {invoiceImages.map((url, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-lg border overflow-hidden group bg-gray-100">
                                        <img src={url} alt="Hóa đơn" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => setInvoiceImages(prev => prev.filter((_, i) => i !== idx))}
                                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                                            title="Xóa ảnh"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}

                                <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group">
                                    <Upload size={24} className="text-gray-400 group-hover:text-blue-500 mb-1" />
                                    <span className="text-xs text-gray-500 font-medium group-hover:text-blue-600">Thêm ảnh</span>
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT (1/3): Totals */}
                    <div className="md:space-y-6 order-1 lg:order-2 mb-4 lg:mb-0">
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-100 h-full flex flex-col">
                            <h3 className="font-semibold mb-4 text-gray-800 flex items-center gap-2 text-sm md:text-base"><Calculator size={18} /> Tổng thanh toán (Tạm tính)</h3>
                            <div className="space-y-3 md:space-y-4 text-sm flex-1">
                                <div className="flex justify-between items-center text-gray-600">
                                    <span>Tổng tiền hàng ({computedItems.length} SP)</span>
                                    <span className="font-medium text-gray-900">{formatCurrency(calculateSubtotal())} ₫</span>
                                </div>
                                <div className="border-t border-dashed border-gray-200 my-1 md:my-2"></div>

                                <div className="space-y-2 md:space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-gray-600">Phí vận chuyển</label>
                                        <input type="number" value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))} className="w-20 md:w-24 text-right p-1 border rounded bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-500 text-sm" placeholder="0" />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <label className="text-gray-600">Thuế nhập khẩu</label>
                                        <input type="number" value={importTax} onChange={e => setImportTax(Number(e.target.value))} className="w-20 md:w-24 text-right p-1 border rounded bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-500 text-sm" placeholder="0" />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <label className="text-gray-600">Chi phí khác</label>
                                        <input type="number" value={otherCost} onChange={e => setOtherCost(Number(e.target.value))} className="w-20 md:w-24 text-right p-1 border rounded bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-500 text-sm" placeholder="0" />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <label className="text-green-700 font-medium">Chiết khấu NCC (-)</label>
                                        <input type="number" value={supplierDiscount} onChange={e => setSupplierDiscount(Number(e.target.value))} className="w-20 md:w-24 text-right p-1 border rounded bg-green-50 text-green-700 font-bold focus:bg-white outline-none focus:ring-1 focus:ring-green-500 text-sm" placeholder="0" />
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 mt-4 md:mt-6 pt-3 md:pt-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-gray-600 font-medium">Tiền cần trả NCC</span>
                                        <span className="text-lg md:text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)} ₫</span>
                                    </div>
                                    <p className="text-xs text-right text-gray-400 italic">Đã cộng chi phí vào giá vốn</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showScanner && (
                <BarcodeScannerModal
                    onScan={handleBarcodeScan}
                    onClose={() => setShowScanner(false)}
                    title="Quét sản phẩm nhập hàng"
                />
            )}

            {/* Product Details Modal */}
            {viewingProduct && (
                <ProductDetailsModal
                    product={viewingProduct}
                    onClose={() => setViewingProduct(null)}
                    onEdit={() => { /* No-op, read-only in PO */ }}
                />
            )}

            {barcodeMatches.length > 0 && (
                <BarcodeSelectionModal
                    matches={barcodeMatches}
                    onSelect={handleBarcodeSelect}
                    onClose={() => setBarcodeMatches([])}
                />
            )}
        </div>
    );
}
