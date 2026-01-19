// =============================================================================
// OFFLINE INDICATOR - Shows network status and pending sync count
// =============================================================================

import { useState, useEffect } from 'react';
import { useOfflineOrders } from '@/hooks/useOfflineOrders';

export function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [show, setShow] = useState(false);
    const { getUnsyncedCount } = useOfflineOrders();

    useEffect(() => {
        const updateOnlineStatus = () => {
            setIsOnline(navigator.onLine);
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

    useEffect(() => {
        const checkPending = async () => {
            const count = await getUnsyncedCount();
            setPendingCount(count);
        };

        checkPending();
        const interval = setInterval(checkPending, 5000);

        return () => clearInterval(interval);
    }, []);

    // Show indicator when offline or has pending
    useEffect(() => {
        setShow(!isOnline || pendingCount > 0);
    }, [isOnline, pendingCount]);

    if (!show) return null;

    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium ${isOnline
                    ? 'bg-blue-500 text-white'
                    : 'bg-orange-500 text-white'
                }`}>
                {isOnline ? (
                    <>
                        <span className="animate-pulse">🔄</span>
                        <span>Đang đồng bộ {pendingCount} đơn...</span>
                    </>
                ) : (
                    <>
                        <span>📡</span>
                        <span>Offline Mode</span>
                        {pendingCount > 0 && (
                            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                                {pendingCount} đơn chờ
                            </span>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// Minimal badge version for header
export function OfflineBadge() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const { getUnsyncedCount } = useOfflineOrders();

    useEffect(() => {
        const updateOnlineStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

    useEffect(() => {
        const check = async () => setPendingCount(await getUnsyncedCount());
        check();
        const interval = setInterval(check, 5000);
        return () => clearInterval(interval);
    }, []);

    if (isOnline && pendingCount === 0) {
        return (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Online
            </span>
        );
    }

    if (!isOnline) {
        return (
            <span className="flex items-center gap-1.5 text-xs text-orange-600">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                Offline {pendingCount > 0 && `(${pendingCount})`}
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1.5 text-xs text-blue-600">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Syncing {pendingCount}...
        </span>
    );
}
