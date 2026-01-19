import { useState, useRef, useEffect } from 'react';
import { Search, User, Plus, X } from 'lucide-react';
import { useCustomerStore } from '@/stores/customerStore';
import { cn } from '@/lib/utils';
import type { Customer } from '@/types';

interface MobileCustomerSearchProps {
    onSelect: (customer: Customer) => void;
    onClose: () => void;
    isOpen: boolean;
}

export function MobileCustomerSearch({ onSelect, onClose, isOpen }: MobileCustomerSearchProps) {
    const [query, setQuery] = useState('');
    const { customers } = useCustomerStore(); // Removed undefined properties
    const inputRef = useRef<HTMLInputElement>(null);

    // Simple local search since store might not expose searchCustomers function directly or it has different signature
    const searchCustomers = (q: string) => {
        const lowerQ = q.toLowerCase();
        return customers.filter(c =>
            c.name.toLowerCase().includes(lowerQ) ||
            (c.phone && c.phone.includes(q))
        );
    };
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const filteredCustomers = query
        ? searchCustomers(query).slice(0, 20)
        : customers.slice(0, 20); // Show recent 20 if no query

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col animate-in slide-in-from-bottom-10 duration-200">
            {/* Header */}
            <div className="flex items-center gap-2 p-3 border-b border-gray-100 shadow-sm bg-white">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 text-gray-600 active:bg-gray-100 rounded-full"
                >
                    <X className="w-6 h-6" />
                </button>
                <div className="flex-1 bg-gray-100 rounded-lg flex items-center px-3 py-2 gap-2">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Tìm khách hàng (Tên, SĐT)..."
                        className="bg-transparent border-none outline-none text-sm w-full placeholder-gray-500 text-gray-900"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className="text-gray-400">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                {/* TODO: Add New Customer Button */}
                <button className="p-2 -mr-2 text-emerald-600 active:bg-emerald-50 rounded-full">
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
                {filteredCustomers.length > 0 ? (
                    <div className="bg-white divide-y divide-gray-50">
                        {filteredCustomers.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => onSelect(c)}
                                className="w-full text-left p-4 hover:bg-gray-50 active:bg-emerald-50 transition-colors"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">{c.name}</h4>
                                        <div className="text-xs text-gray-500 mt-0.5">{c.phone}</div>
                                    </div>
                                    {c.points_balance > 0 && (
                                        <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                                            {c.points_balance} điểm
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center pt-20 text-gray-400">
                        <User className="w-12 h-12 mb-2 opacity-20" />
                        <span className="text-sm">Không tìm thấy khách hàng</span>
                    </div>
                )}
            </div>
        </div>
    );
}
