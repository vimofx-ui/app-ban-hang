// =============================================================================
// SUPPLIERS PAGE - Manage suppliers for the brand
// =============================================================================

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Phone, Mail, MapPin, Search, X } from 'lucide-react';
import { useSupplierStore, type Supplier } from '@/stores/supplierStore';
import { Loading } from '@/components/common/Loading';

export function SuppliersPage() {
    const { suppliers, isLoading, error, fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } = useSupplierStore();
    const [showForm, setShowForm] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        phone: '',
        email: '',
        address: '',
        tax_code: '',
        contact_person: '',
        bank_account: '',
        bank_name: '',
        payment_terms: '30 ngày',
        notes: '',
    });

    useEffect(() => {
        fetchSuppliers();
    }, []);

    useEffect(() => {
        if (editingSupplier) {
            setFormData({
                name: editingSupplier.name || '',
                code: editingSupplier.code || '',
                phone: editingSupplier.phone || '',
                email: editingSupplier.email || '',
                address: editingSupplier.address || '',
                tax_code: editingSupplier.tax_code || '',
                contact_person: editingSupplier.contact_person || '',
                bank_account: editingSupplier.bank_account || '',
                bank_name: editingSupplier.bank_name || '',
                payment_terms: editingSupplier.payment_terms || '30 ngày',
                notes: editingSupplier.notes || '',
            });
            setShowForm(true);
        }
    }, [editingSupplier]);

    const resetForm = () => {
        setFormData({
            name: '',
            code: '',
            phone: '',
            email: '',
            address: '',
            tax_code: '',
            contact_person: '',
            bank_account: '',
            bank_name: '',
            payment_terms: '30 ngày',
            notes: '',
        });
        setEditingSupplier(null);
        setShowForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('Vui lòng nhập tên nhà cung cấp');
            return;
        }

        // Auto-generate code if empty to avoid unique constraint error
        const submitData = {
            ...formData,
            code: formData.code.trim() ? formData.code.trim() : `NCC-${Date.now().toString().slice(-6)}`,
            is_active: true
        };

        let success = false;
        if (editingSupplier) {
            success = await updateSupplier(editingSupplier.id, submitData);
        } else {
            const newSupplier = await createSupplier(submitData);
            success = !!newSupplier;
        }

        if (success) {
            resetForm();
            fetchSuppliers();
        } else {
            // Get the specific error from store
            const storeError = useSupplierStore.getState().error;
            alert(`Có lỗi xảy ra: ${storeError || 'Không xác định'}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xoá nhà cung cấp này?')) return;
        await deleteSupplier(id);
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone?.includes(searchQuery)
    );

    if (isLoading && suppliers.length === 0) return <Loading />;

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Nhà Cung Cấp</h1>
                        <p className="text-gray-500 text-sm mt-1">{suppliers.length} nhà cung cấp</p>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                        <Plus size={20} />
                        Thêm NCC
                    </button>
                </div>

                {/* Search */}
                <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên, mã, số điện thoại..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>
                </div>

                {/* Supplier Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSuppliers.map(supplier => (
                        <div key={supplier.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg">{supplier.name}</h3>
                                    {supplier.code && (
                                        <span className="text-sm text-gray-500">Mã: {supplier.code}</span>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setEditingSupplier(supplier)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                        title="Sửa"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(supplier.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                        title="Xoá"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm">
                                {supplier.contact_person && (
                                    <div className="text-gray-600">👤 {supplier.contact_person}</div>
                                )}
                                {supplier.phone && (
                                    <a href={`tel:${supplier.phone}`} className="flex items-center gap-2 text-gray-600 hover:text-green-600">
                                        <Phone size={14} />
                                        {supplier.phone}
                                    </a>
                                )}
                                {supplier.email && (
                                    <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 text-gray-600 hover:text-green-600">
                                        <Mail size={14} />
                                        {supplier.email}
                                    </a>
                                )}
                                {supplier.address && (
                                    <div className="flex items-start gap-2 text-gray-600">
                                        <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                                        <span className="line-clamp-2">{supplier.address}</span>
                                    </div>
                                )}
                            </div>

                            {supplier.payment_terms && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <span className="text-xs text-gray-500">Thanh toán: {supplier.payment_terms}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {filteredSuppliers.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        {searchQuery ? 'Không tìm thấy nhà cung cấp phù hợp' : 'Chưa có nhà cung cấp nào'}
                    </div>
                )}

                {/* Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full md:w-[700px] max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center p-4 border-b border-gray-200">
                                <h2 className="text-lg font-bold text-gray-900">
                                    {editingSupplier ? 'Sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp'}
                                </h2>
                                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên NCC *</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mã NCC</label>
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Điện thoại</label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Người liên hệ</label>
                                        <input
                                            type="text"
                                            value={formData.contact_person}
                                            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mã số thuế</label>
                                        <input
                                            type="text"
                                            value={formData.tax_code}
                                            onChange={(e) => setFormData({ ...formData, tax_code: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                                        <input
                                            type="text"
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Số tài khoản</label>
                                        <input
                                            type="text"
                                            value={formData.bank_account}
                                            onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngân hàng</label>
                                        <input
                                            type="text"
                                            value={formData.bank_name}
                                            onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Thanh toán</label>
                                        <select
                                            value={formData.payment_terms}
                                            onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        >
                                            <option value="Thanh toán ngay">Thanh toán ngay</option>
                                            <option value="7 ngày">7 ngày</option>
                                            <option value="15 ngày">15 ngày</option>
                                            <option value="30 ngày">30 ngày</option>
                                            <option value="45 ngày">45 ngày</option>
                                            <option value="60 ngày">60 ngày</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows={2}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                    >
                                        Huỷ
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                    >
                                        {editingSupplier ? 'Cập nhật' : 'Thêm mới'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
