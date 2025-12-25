
import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';

export default function SecurityPage() {
    const { user } = useAuthStore();
    const { hasPermission, fetchUsers, users } = useUserStore();
    const navigate = useNavigate();

    // Init
    useEffect(() => {
        // Check permissions
        if (user && !hasPermission(user as any, 'view_security')) {
            navigate('/');
            return;
        }
        if (users.length === 0) fetchUsers();
    }, [user, navigate, hasPermission, fetchUsers, users.length]);

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col gap-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldAlert className="w-8 h-8 text-indigo-600" />
                    An Ninh & Chống Gian Lận (Safe Mode)
                </h1>
                <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
                    <p>Trang này đang ở chế độ an toàn để sửa lỗi.</p>
                </div>
            </div>
        </div>
    );
}
