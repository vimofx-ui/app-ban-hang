import { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer } from '@/types';
import { useCustomerStore } from '@/stores/customerStore';
import { formatVND } from '@/lib/cashReconciliation';

interface POSCustomerSectionProps {
    customer: Customer | null;
    onSelectCustomer: (customer: Customer | null) => void;
    onShowEditModal: () => void;
    onShowAddModal: (phone: string) => void;
    onShowCustomerLookup: () => void;
    inputRef: React.RefObject<HTMLInputElement>;
}
export const POSCustomerSection = ({
    customer,
    onSelectCustomer,
    onShowEditModal,
    onShowAddModal,
    onShowCustomerLookup,
    inputRef
}: POSCustomerSectionProps) => {
    const { customers } = useCustomerStore();
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowCustomerDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Logic mới: 
    // - Khi có tìm kiếm: chỉ hiển thị kết quả tìm kiếm
    // - Khi không tìm kiếm: 5 khách mua gần nhất + danh sách khách tạo mới nhất
    const { recentBuyers, defaultList, searchResults } = useMemo(() => {
        const term = customerSearch.toLowerCase().trim();

        // Trường hợp có tìm kiếm
        if (term) {
            const results = customers.filter(c =>
                c.name.toLowerCase().includes(term) ||
                (c.phone?.includes(term) ?? false)
            ).slice(0, 10);
            return { recentBuyers: [], defaultList: [], searchResults: results };
        }

        // Trường hợp không tìm kiếm - hiển thị danh sách mặc định
        // 1. 5 khách hàng mua gần nhất (có last_purchase_at)
        const buyersWithPurchase = customers
            .filter(c => c.last_purchase_at)
            .sort((a, b) => new Date(b.last_purchase_at!).getTime() - new Date(a.last_purchase_at!).getTime())
            .slice(0, 5);

        // 2. Danh sách khách tạo mới nhất (loại trừ những khách đã hiện ở trên)
        const buyerIds = new Set(buyersWithPurchase.map(c => c.id));
        const recentlyCreated = customers
            .filter(c => !buyerIds.has(c.id))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10);

        return { recentBuyers: buyersWithPurchase, defaultList: recentlyCreated, searchResults: [] };
    }, [customerSearch, customers]);

    // Để tương thích ngược với code render dropdown
    const filteredCustomers = searchResults;

    const handleSelect = (c: Customer) => {
        onSelectCustomer(c);
        setCustomerSearch('');
        setShowCustomerDropdown(false);
    };

    return (
        <div ref={containerRef} className="p-3 relative bg-white z-20 shrink-0" data-customer-search>
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
                                    onClick={onShowEditModal}
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
                            onClick={() => onSelectCustomer(null)}
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
                    <div
                        onClick={onShowCustomerLookup}
                        className="absolute inset-y-0 left-0 pl-3 flex items-center cursor-pointer text-gray-400 hover:text-green-600 z-[201]"
                        title="Tìm kiếm nâng cao (F4)"
                    >
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
                                handleSelect(filteredCustomers[0]);
                            }
                        }}
                        placeholder="Thêm khách hàng vào đơn (F4)"
                        className="w-full pl-10 pr-10 py-2 border-b border-gray-300 focus:border-green-500 focus:outline-none text-sm bg-transparent relative z-[200]"
                    />
                    <button
                        onClick={() => onShowAddModal(customerSearch)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-green-600 z-[200]"
                        title="Thêm khách hàng mới"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                    {showCustomerDropdown && (searchResults.length > 0 || recentBuyers.length > 0 || defaultList.length > 0) && (
                        <div className="absolute top-full left-0 right-0 w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-100 z-[200] max-h-[500px] overflow-y-auto">
                            {/* Kết quả tìm kiếm */}
                            {searchResults.length > 0 && (
                                <>
                                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 bg-gray-50 sticky top-0">
                                        🔍 Kết quả tìm kiếm
                                    </div>
                                    {searchResults.map(c => (
                                        <CustomerDropdownItem key={c.id} customer={c} onSelect={handleSelect} />
                                    ))}
                                </>
                            )}

                            {/* 5 khách mua gần nhất - chỉ hiển thị khi không tìm kiếm */}
                            {!customerSearch.trim() && recentBuyers.length > 0 && (
                                <>
                                    <div className="px-3 py-1.5 text-xs font-semibold text-green-600 bg-green-50 sticky top-0">
                                        ⏱️ Mua gần đây
                                    </div>
                                    {recentBuyers.map(c => (
                                        <CustomerDropdownItem key={c.id} customer={c} onSelect={handleSelect} showLastPurchase />
                                    ))}
                                </>
                            )}

                            {/* Danh sách khách mới tạo - chỉ hiển thị khi không tìm kiếm */}
                            {!customerSearch.trim() && defaultList.length > 0 && (
                                <>
                                    <div className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 sticky top-0">
                                        👤 Khách hàng mới
                                    </div>
                                    {defaultList.map(c => (
                                        <CustomerDropdownItem key={c.id} customer={c} onSelect={handleSelect} />
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Helper component cho mỗi item trong dropdown
function CustomerDropdownItem({
    customer: c,
    onSelect,
    showLastPurchase = false
}: {
    customer: Customer;
    onSelect: (c: Customer) => void;
    showLastPurchase?: boolean;
}) {
    return (
        <button
            onClick={() => onSelect(c)}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center justify-between group"
        >
            <div>
                <div className="font-medium text-gray-800 group-hover:text-green-600">{c.name}</div>
                <div className="text-xs text-gray-500">
                    {c.phone}
                    {showLastPurchase && c.last_purchase_at && (
                        <span className="ml-2 text-green-500">
                            • {new Date(c.last_purchase_at).toLocaleString('vi-VN', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                            })}
                        </span>
                    )}
                </div>
            </div>
            {(c.debt_balance || 0) > 0 && (
                <div className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                    Nợ: {formatVND(c.debt_balance)}
                </div>
            )}
        </button>
    );
}
