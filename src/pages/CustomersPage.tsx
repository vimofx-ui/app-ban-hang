// =============================================================================
// CUSTOMERS PAGE - Customer Management
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useCustomerStore } from '@/stores/customerStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '@/lib/utils';
import { exportToCSV, parseCSV } from '@/lib/csvHelper';
import type { Customer } from '@/types';

import { CustomerDetailsView } from '@/components/customers/CustomerDetailsView';
import { CustomerModal } from '@/components/customers/CustomerModal';
import { Pagination } from '@/components/common/Pagination';

export function CustomersPage() {
    const { customers, isLoading, loadCustomers, addCustomer, updateCustomer, deleteCustomer } = useCustomerStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'debt'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    // Derive viewing customer from store to ensure updates are reflected
    const viewingCustomer = customers.find(c => c.id === viewingCustomerId);

    const filteredCustomers = customers.filter((c) => {
        if (filter === 'debt' && c.debt_balance <= 0) return false;
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(query) || c.phone?.includes(searchQuery);
    });

    const paginatedCustomers = filteredCustomers.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const totalDebt = customers.reduce((sum, c) => sum + c.debt_balance, 0);
    const debtCount = customers.filter((c) => c.debt_balance > 0).length;

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setShowForm(true);
    };

    const handleDelete = async (customer: Customer) => {
        if (confirm(`Xóa khách hàng "${customer.name}"?`)) {
            await deleteCustomer(customer.id);
            if (viewingCustomerId === customer.id) {
                setViewingCustomerId(null);
            }
        }
    };


    const handleSave = async (data: Partial<Customer>) => {
        if (editingCustomer) {
            await updateCustomer(editingCustomer.id, data);
        } else {
            await addCustomer({
                points_balance: 0,
                total_spent: 0,
                total_orders: 0,
                debt_balance: 0,
                is_active: true,
                ...data,
            } as Omit<Customer, 'id' | 'created_at'>);
        }
        setShowForm(false);
        setEditingCustomer(null);
    };

    if (viewingCustomer) {
        return (
            <>
                <CustomerDetailsView
                    customer={viewingCustomer}
                    onBack={() => setViewingCustomerId(null)}
                    onEdit={(c) => handleEdit(c)}
                    onDelete={(id) => {
                        const c = customers.find(x => x.id === id);
                        if (c) handleDelete(c);
                    }}
                />
                {showForm && (
                    <CustomerModal
                        customer={editingCustomer}
                        onSave={handleSave}
                        onClose={() => { setShowForm(false); setEditingCustomer(null); }}
                    />
                )}
            </>
        );
    }

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        const columns = [
            { key: 'code', header: 'Mã KH' },
            { key: 'name', header: 'Tên khách hàng' },
            { key: 'phone', header: 'Số điện thoại' },
            { key: 'address', header: 'Địa chỉ' },
            { key: 'email', header: 'Email' },
            { key: 'debt_balance', header: 'Công nợ', formatter: (val: number) => val?.toString() || '0' },
            { key: 'points_balance', header: 'Điểm tích lũy', formatter: (val: number) => val?.toString() || '0' },
            { key: 'notes', header: 'Ghi chú' }
        ];
        const filename = `customers_export_${new Date().toISOString().split('T')[0]}`;
        exportToCSV(customers, columns, filename);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const rawData = await parseCSV(file);
            let successCount = 0;
            for (const row of rawData) {
                const name = row['Tên khách hàng'] || row['name'];
                const phone = row['Số điện thoại'] || row['phone'];
                if (name && phone) {
                    await addCustomer({
                        name,
                        phone,
                        code: row['Mã KH'] || row['code'],
                        address: row['Địa chỉ'] || row['address'],
                        email: row['Email'] || row['email'],
                        notes: row['Ghi chú'] || row['notes'],
                        debt_balance: parseInt(row['Công nợ'] || row['debt_balance'] || '0'),
                        points_balance: parseInt(row['Điểm tích lũy'] || row['points_balance'] || '0'),
                        total_orders: 0,
                        total_spent: 0,
                        is_active: true
                    });
                    successCount++;
                }
            }
            alert(`Đã nhập thành công ${successCount} khách hàng`);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            alert('Lỗi khi nhập file CSV');
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200">
                <div className="container-app py-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Khách hàng</h1>
                            <p className="text-sm text-gray-500">
                                {customers.length} khách • Công nợ: {formatVND(totalDebt)}
                            </p>
                        </div>
                        <button
                            onClick={() => { setEditingCustomer(null); setShowForm(true); }}
                            className="px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-primary to-primary-dark"
                        >
                            + Thêm khách hàng
                        </button>
                    </div>
                </div>
            </header>

            <div className="container-app py-4 flex flex-col md:flex-row gap-4">
                <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50">📥 Nhập file</button>
                    <button onClick={handleExport} className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50">📤 Xuất file</button>
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên, SĐT..."
                    className="flex-1 px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary"
                />
                {/* ... rest of filters */}
                <div className="flex gap-2">
                    <button onClick={() => setFilter('all')} className={cn('px-4 py-2 rounded-lg text-sm font-medium', filter === 'all' ? 'bg-primary text-white' : 'bg-white border text-gray-700')}>
                        Tất cả
                    </button>
                    <button onClick={() => setFilter('debt')} className={cn('px-4 py-2 rounded-lg text-sm font-medium', filter === 'debt' ? 'bg-red-500 text-white' : 'bg-white border text-gray-700')}>
                        💰 Công nợ ({debtCount})
                    </button>
                </div>
            </div>

            <main className="container-app pb-6">
                {isLoading ? (
                    <div className="text-center py-12 text-gray-500">Đang tải...</div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-white border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Khách hàng</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Liên hệ</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Điểm</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Công nợ</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {paginatedCustomers.map((customer) => (
                                    <CustomerRow
                                        key={customer.id}
                                        customer={customer}
                                        onView={() => setViewingCustomerId(customer.id)}
                                        onEdit={() => handleEdit(customer)}
                                        onDelete={() => handleDelete(customer)}
                                    />
                                ))}
                            </tbody>
                        </table>
                        {/* Pagination */}
                        <div className="border-t px-4">
                            <Pagination
                                currentPage={currentPage}
                                totalItems={filteredCustomers.length}
                                pageSize={pageSize}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                            />
                        </div>
                    </div>
                )}
            </main>

            {showForm && (
                <CustomerModal
                    customer={editingCustomer}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditingCustomer(null); }}
                />
            )}
        </div>
    );
}

function CustomerRow({ customer, onView, onEdit, onDelete }: { customer: Customer; onView: () => void; onEdit: () => void; onDelete: () => void }) {
    return (
        <tr onClick={onView} className="hover:bg-gray-50/80 cursor-pointer transition-colors border-b border-gray-50 last:border-0">
            <td className="px-6 py-4">
                <div className="font-medium text-gray-900 text-blue-600 hover:underline">{customer.name}</div>
                <div className="text-xs text-gray-400">{customer.code} • {customer.total_orders} đơn</div>
            </td>
            <td className="px-6 py-4 hidden md:table-cell">
                <div className="text-sm text-gray-600">{customer.phone || '-'}</div>
                <div className="text-xs text-gray-400">{customer.email}</div>
            </td>
            <td className="px-6 py-4 text-right">
                <span className="text-primary font-medium">{customer.points_balance}</span>
            </td>
            <td className="px-6 py-4 text-right">
                {customer.debt_balance > 0 ? (
                    <span className="text-red-600 font-medium">{formatVND(customer.debt_balance)}</span>
                ) : (
                    <span className="text-gray-400">-</span>
                )}
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg">
                        <EditIcon className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
}

function EditIcon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}

function TrashIcon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
}

export default CustomersPage;

