// =============================================================================
// SUPPLIERS PAGE - Supplier Management
// =============================================================================

import { useState, useEffect } from 'react';
import { useSupplierStore } from '@/stores/supplierStore';
import { cn } from '@/lib/utils';
import type { Supplier } from '@/types';
import { Pagination } from '@/components/common/Pagination';
import { SupplierDetailsView } from '@/components/suppliers/SupplierDetailsView';

export function SuppliersPage() {
    const { suppliers, isLoading, loadSuppliers, addSupplier, updateSupplier, deleteSupplier } = useSupplierStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingSupplierId, setViewingSupplierId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    useEffect(() => {
        loadSuppliers();
    }, [loadSuppliers]);

    const filteredSuppliers = suppliers.filter((s) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(query) ||
            s.code?.toLowerCase().includes(query) ||
            s.phone?.includes(searchQuery);
    });

    const paginatedSuppliers = filteredSuppliers.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setShowForm(true);
    };

    const handleDelete = async (supplier: Supplier) => {
        if (confirm(`Xóa nhà cung cấp "${supplier.name}"?`)) {
            await deleteSupplier(supplier.id);
        }
    };

    const handleSave = async (data: Partial<Supplier>) => {
        if (editingSupplier) {
            await updateSupplier(editingSupplier.id, data);
        } else {
            await addSupplier(data as Omit<Supplier, 'id' | 'created_at'>);
        }
        setShowForm(false);
        setEditingSupplier(null);
    };

    const viewingSupplier = suppliers.find(s => s.id === viewingSupplierId);
    if (viewingSupplier) {
        return (
            <>
                <SupplierDetailsView
                    supplier={viewingSupplier}
                    onBack={() => setViewingSupplierId(null)}
                    onEdit={(s) => { setEditingSupplier(s); setShowForm(true); }}
                    onDelete={(id) => {
                        handleDelete(viewingSupplier);
                        setViewingSupplierId(null);
                    }}
                />
                {showForm && (
                    <SupplierFormModal
                        supplier={editingSupplier}
                        onSave={handleSave}
                        onClose={() => { setShowForm(false); setEditingSupplier(null); }}
                    />
                )}
            </>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200">
                <div className="container-app py-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Nhà cung cấp</h1>
                            <p className="text-sm text-gray-500">{suppliers.length} nhà cung cấp</p>
                        </div>
                        <button
                            onClick={() => { setEditingSupplier(null); setShowForm(true); }}
                            className="px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-primary to-primary-dark"
                        >
                            + Thêm NCC
                        </button>
                    </div>
                </div>
            </header>

            <div className="container-app py-4">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên, mã, SĐT..."
                    className="w-full md:w-96 px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary"
                />
            </div>

            <main className="container-app pb-6">
                {isLoading ? (
                    <div className="text-center py-12 text-gray-500">Đang tải...</div>
                ) : (
                    <>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {paginatedSuppliers.map((supplier) => (
                                <SupplierCard
                                    key={supplier.id}
                                    supplier={supplier}
                                    onView={() => setViewingSupplierId(supplier.id)}
                                    onEdit={() => handleEdit(supplier)}
                                    onDelete={() => handleDelete(supplier)}
                                />
                            ))}
                        </div>
                        {/* Pagination */}
                        <div className="mt-4 bg-white rounded-xl border px-4">
                            <Pagination
                                currentPage={currentPage}
                                totalItems={filteredSuppliers.length}
                                pageSize={pageSize}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                            />
                        </div>
                    </>
                )}
            </main>

            {showForm && (
                <SupplierFormModal
                    supplier={editingSupplier}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditingSupplier(null); }}
                />
            )}
        </div>
    );
}

function SupplierCard({ supplier, onView, onEdit, onDelete }: { supplier: Supplier; onView: () => void; onEdit: () => void; onDelete: () => void }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={onView}>
            <div className="flex items-start justify-between mb-3">
                <div>
                    <span className="text-xs text-gray-400 font-mono">{supplier.code}</span>
                    <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                </div>
                <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg">
                        <EditIcon className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
                {supplier.contact_person && <p>👤 {supplier.contact_person}</p>}
                {supplier.phone && <p>📞 {supplier.phone}</p>}
                {supplier.email && <p>✉️ {supplier.email}</p>}
                {supplier.address && <p className="text-xs text-gray-400 truncate">📍 {supplier.address}</p>}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">Công nợ: {supplier.payment_terms} ngày</span>
            </div>
        </div>
    );
}

function SupplierFormModal({ supplier, onSave, onClose }: { supplier: Supplier | null; onSave: (data: Partial<Supplier>) => Promise<void>; onClose: () => void }) {
    const [formData, setFormData] = useState({
        code: supplier?.code || '',
        name: supplier?.name || '',
        contact_person: supplier?.contact_person || '',
        phone: supplier?.phone || '',
        email: supplier?.email || '',
        address: supplier?.address || '',
        tax_id: supplier?.tax_id || '',
        payment_terms: supplier?.payment_terms || 30,
        notes: supplier?.notes || '',
        is_active: supplier?.is_active ?? true,
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(formData);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-[90vw] md:w-[600px] max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold">{supplier ? 'Sửa NCC' : 'Thêm NCC mới'}</h2>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mã NCC</label>
                            <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Công nợ (ngày)</label>
                            <input type="number" value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: Number(e.target.value) })}
                                className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên NCC *</label>
                        <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Người liên hệ</label>
                        <input type="text" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">SĐT</label>
                            <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                        <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                        <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2}
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-medium bg-gray-100 text-gray-700">Hủy</button>
                        <button type="submit" disabled={isSaving} className="flex-1 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-primary to-primary-dark disabled:opacity-50">
                            {isSaving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function EditIcon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}

function TrashIcon({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
}

export default SuppliersPage;
