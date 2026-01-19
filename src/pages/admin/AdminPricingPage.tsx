import { useState } from 'react';
import { PricingPage } from '@/pages/PricingPage'; // Reuse the public page for preview
// In a real app, this would edit a config in the DB. For now, it explains that the pricing is code-based.

export function AdminPricingPage() {
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Quản lý Gói & Bảng giá</h1>
                <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                    <button
                        onClick={() => setViewMode('preview')}
                        className={`px-4 py-2 rounded-md text-sm font-medium ${viewMode === 'preview' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
                    >
                        Xem trước (Preview)
                    </button>
                    <button
                        onClick={() => setViewMode('edit')}
                        className={`px-4 py-2 rounded-md text-sm font-medium ${viewMode === 'edit' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
                    >
                        Cấu hình
                    </button>
                </div>
            </div>

            {viewMode === 'preview' ? (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs text-gray-500 flex justify-between">
                        <span>Preview: http://localhost:5173/pricing</span>
                        <span>Live View</span>
                    </div>
                    <PricingPage />
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                            <span className="text-3xl">⚙️</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Tính năng đang phát triển</h2>
                        <p className="text-gray-500 mt-2">
                            Hiện tại, nội dung bảng giá đang được cấu hình trực tiếp trong code (`PricingPage.tsx`).
                            <br />
                            Trong phiên bản tới, bạn có thể chỉnh sửa giá và tính năng trực tiếp tại đây mà không cần deploy lại.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="border-t border-gray-100 pt-6">
                            <h3 className="font-medium text-gray-900 mb-4">Cấu hình nhanh (Simulation)</h3>
                            <div className="grid gap-4">
                                <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <div>
                                        <div className="font-medium">Giá gói Basic</div>
                                        <div className="text-sm text-gray-500">Hiện tại: 99k/tháng</div>
                                    </div>
                                    <input type="number" className="border rounded px-2 py-1 w-32" placeholder="99000" disabled />
                                </label>
                                <label className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <div>
                                        <div className="font-medium">Giá gói Pro</div>
                                        <div className="text-sm text-gray-500">Hiện tại: 299k/tháng</div>
                                    </div>
                                    <input type="number" className="border rounded px-2 py-1 w-32" placeholder="299000" disabled />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
