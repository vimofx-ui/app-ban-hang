// =============================================================================
// ADMIN SETTINGS PAGE - System configuration
// =============================================================================

import { useState } from 'react';

export function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState<'general' | 'plans' | 'notifications' | 'security'>('general');

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Cấu hình Hệ thống</h1>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
                    {[
                        { id: 'general', label: '⚙️ Chung' },
                        { id: 'plans', label: '💰 Gói dịch vụ' },
                        { id: 'notifications', label: '🔔 Thông báo' },
                        { id: 'security', label: '🔒 Bảo mật' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === tab.id
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* General Settings */}
                {activeTab === 'general' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cài đặt chung</h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tên hệ thống
                                </label>
                                <input
                                    type="text"
                                    defaultValue="Bango POS"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email hỗ trợ
                                </label>
                                <input
                                    type="email"
                                    defaultValue="support@bangopos.com"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Số điện thoại hotline
                                </label>
                                <input
                                    type="text"
                                    defaultValue="1900 xxxx"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                                Lưu thay đổi
                            </button>
                        </div>
                    </div>
                )}

                {/* Plans Settings */}
                {activeTab === 'plans' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cấu hình Gói dịch vụ</h2>

                        <div className="space-y-6">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-gray-900">Trial (Dùng thử)</span>
                                    <span className="text-sm text-gray-500">Miễn phí</span>
                                </div>
                                <div className="text-sm text-gray-600">14 ngày • 1 chi nhánh • 5 user</div>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-blue-900">Basic</span>
                                    <input
                                        type="number"
                                        defaultValue="99000"
                                        className="w-32 px-3 py-1 border border-blue-200 rounded-lg text-right"
                                    />
                                </div>
                                <div className="text-sm text-blue-600">1 chi nhánh • 5 user • Export Excel</div>
                            </div>

                            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-purple-900">Pro</span>
                                    <input
                                        type="number"
                                        defaultValue="299000"
                                        className="w-32 px-3 py-1 border border-purple-200 rounded-lg text-right"
                                    />
                                </div>
                                <div className="text-sm text-purple-600">Không giới hạn • Offline • Báo cáo nâng cao</div>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                                Lưu thay đổi
                            </button>
                        </div>
                    </div>
                )}

                {/* Notifications Settings */}
                {activeTab === 'notifications' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cài đặt Thông báo</h2>

                        <div className="space-y-4">
                            {[
                                { label: 'Email khi có đăng ký mới', enabled: true },
                                { label: 'Email khi trial sắp hết hạn', enabled: true },
                                { label: 'Email khi có yêu cầu nâng cấp', enabled: true },
                                { label: 'Báo cáo doanh thu hàng ngày', enabled: false },
                                { label: 'Push notification', enabled: false },
                            ].map((item, idx) => (
                                <label key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                    <span className="text-gray-700">{item.label}</span>
                                    <input
                                        type="checkbox"
                                        defaultChecked={item.enabled}
                                        className="w-5 h-5 text-blue-600 rounded"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Security Settings */}
                {activeTab === 'security' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cài đặt Bảo mật</h2>

                        <div className="space-y-4">
                            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <div className="font-medium text-gray-900">Bắt buộc xác thực 2 yếu tố</div>
                                    <div className="text-sm text-gray-500">Yêu cầu tất cả admin bật 2FA</div>
                                </div>
                                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" />
                            </label>

                            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <div className="font-medium text-gray-900">Giới hạn IP truy cập</div>
                                    <div className="text-sm text-gray-500">Chỉ cho phép IP được whitelist</div>
                                </div>
                                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" />
                            </label>

                            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <div className="font-medium text-gray-900">Auto-lock sau 30 phút</div>
                                    <div className="text-sm text-gray-500">Tự động đăng xuất nếu không hoạt động</div>
                                </div>
                                <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600 rounded" />
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
