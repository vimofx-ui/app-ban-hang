import { useState, useEffect } from 'react';
import type { Customer, Gender } from '@/types';

interface CustomerModalProps {
    customer?: Customer | null;
    initialPhone?: string; // New prop for POS quick add
    onSave: (data: Partial<Customer>) => Promise<void>;
    onClose: () => void;
}

export function CustomerModal({ customer, initialPhone, onSave, onClose }: CustomerModalProps) {
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        phone: '',
        email: '',
        address: '',
        gender: '' as Gender | '',
        date_of_birth: '',
        notes: '',
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (customer) {
            setFormData({
                code: customer.code || '',
                name: customer.name || '',
                phone: customer.phone || '',
                email: customer.email || '',
                address: customer.address || '',
                gender: customer.gender || '',
                date_of_birth: customer.date_of_birth || '',
                notes: customer.notes || '',
            });
        } else {
            // Reset or set initial phone
            setFormData({
                code: '',
                name: '',
                phone: initialPhone || '',
                email: '',
                address: '',
                gender: 'male',  // Mặc định là Nam
                date_of_birth: '',
                notes: '',
            });
        }
    }, [customer, initialPhone]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // Convert empty gender to 'male' (default)
            const dataToSave = {
                ...formData,
                gender: (formData.gender || 'male') as Gender,  // Mặc định là Nam
                date_of_birth: formData.date_of_birth || undefined,
            };
            await onSave(dataToSave);
            onClose();
        } catch (error) {
            console.error(error);
            // Optionally handle error here
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white rounded-2xl shadow-xl w-[90vw] md:w-[600px] max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">{customer ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mã KH</label>
                            <input
                                type="text"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                placeholder="Tự động tạo nếu trống"
                                className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">SĐT</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên khách hàng *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Giới tính</label>
                        <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="gender"
                                    value="male"
                                    checked={formData.gender === 'male' || !formData.gender}
                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                                />
                                <span className="text-gray-700">Nam</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="gender"
                                    value="female"
                                    checked={formData.gender === 'female'}
                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                                />
                                <span className="text-gray-700">Nữ</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                        <input
                            type="date"
                            value={formData.date_of_birth}
                            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                    <div className="flex gap-3 pt-4 border-t mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 py-3 rounded-xl font-medium text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 disabled:opacity-50"
                        >
                            {isSaving ? 'Đang lưu...' : 'Lưu khách hàng'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
