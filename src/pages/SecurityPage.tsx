import React, { useEffect, useState } from 'react';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import SecurityLogsPage from './SecurityLogsPage';
import SecurityEmployeePage from './SecurityEmployeePage';
import { cn } from '@/lib/utils';

export default function SecurityPage() {
    const { user } = useAuthStore();
    const { hasPermission, fetchUsers, users } = useUserStore();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'logs' | 'employees'>('logs');

    // Init
    useEffect(() => {
        if (users.length === 0) fetchUsers();
    }, [user, fetchUsers, users.length]);

    if (user && !hasPermission(user as any, 'view_security') && user.role !== 'owner' && user.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Quyền truy cập bị từ chối</h2>
                <p className="text-gray-500">Bạn không có quyền truy cập vào khu vực bảo mật này.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Tab Navigation - Responsive */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="container-app">
                    <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={cn(
                                "py-4 px-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap",
                                activeTab === 'logs'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            📋 Nhật ký rủi ro
                        </button>
                        <button
                            onClick={() => setActiveTab('employees')}
                            className={cn(
                                "py-4 px-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2",
                                activeTab === 'employees'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            👥 Giám sát nhân viên <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px]">Mới</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1">
                {activeTab === 'logs' ? <SecurityLogsPage /> : <SecurityEmployeePage />}
            </div>
        </div>
    );
}
