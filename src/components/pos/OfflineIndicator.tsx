// =============================================================================
// OFFLINE INDICATOR COMPONENT - Shows sync status in UI
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { useOfflineOrders, useAutoSyncOrders } from '@/hooks/useOfflineOrders';
import { syncOrderToServer } from '@/services/orderSyncService';

interface OfflineIndicatorProps {
    className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [unsyncedCount, setUnsyncedCount] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const { getUnsyncedCount } = useOfflineOrders();
    const { syncAllPending } = useAutoSyncOrders(syncOrderToServer);

    // Update online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Update unsynced count periodically
    useEffect(() => {
        const updateCount = async () => {
            const count = await getUnsyncedCount();
            setUnsyncedCount(count);
        };

        updateCount();
        const interval = setInterval(updateCount, 5000); // Check every 5 seconds

        return () => clearInterval(interval);
    }, []);

    // Manual sync
    const handleManualSync = async () => {
        if (!isOnline || syncing) return;

        setSyncing(true);
        try {
            await syncAllPending();
            const count = await getUnsyncedCount();
            setUnsyncedCount(count);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className={`flex items-center gap-2 ${className || ''}`}>
            {/* Connection Status */}
            <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${isOnline
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
            >
                {isOnline ? (
                    <>
                        <Cloud className="w-4 h-4" />
                        <span>Online</span>
                    </>
                ) : (
                    <>
                        <CloudOff className="w-4 h-4" />
                        <span>Offline</span>
                    </>
                )}
            </div>

            {/* Unsynced Count */}
            {unsyncedCount > 0 && (
                <button
                    onClick={handleManualSync}
                    disabled={!isOnline || syncing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isOnline
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 cursor-pointer'
                            : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        }`}
                    title={isOnline ? 'Click to sync now' : 'Will sync when online'}
                >
                    {syncing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <AlertCircle className="w-4 h-4" />
                    )}
                    <span>{unsyncedCount} chưa đồng bộ</span>
                </button>
            )}

            {/* All synced indicator */}
            {unsyncedCount === 0 && isOnline && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-50 text-green-600">
                    <Check className="w-4 h-4" />
                    <span>Đã đồng bộ</span>
                </div>
            )}
        </div>
    );
};

// =============================================================================
// SYNC STATUS WIDGET - For POS Page
// =============================================================================

export const SyncStatusWidget: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [unsyncedCount, setUnsyncedCount] = useState(0);
    const { getUnsyncedCount, getAllOrders } = useOfflineOrders();
    const { syncAllPending } = useAutoSyncOrders(syncOrderToServer);
    const [syncing, setSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);

    useEffect(() => {
        const updateStatus = async () => {
            const count = await getUnsyncedCount();
            setUnsyncedCount(count);
        };

        updateStatus();

        window.addEventListener('online', () => setIsOnline(true));
        window.addEventListener('offline', () => setIsOnline(false));

        const interval = setInterval(updateStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleSync = async () => {
        if (!isOnline || syncing) return;

        setSyncing(true);
        try {
            await syncAllPending();
            setLastSynced(new Date());
            const count = await getUnsyncedCount();
            setUnsyncedCount(count);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Trạng thái đồng bộ
            </h3>

            <div className="space-y-3">
                {/* Connection */}
                <div className="flex items-center justify-between">
                    <span className="text-gray-600">Kết nối:</span>
                    <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                        {isOnline ? '🟢 Online' : '🔴 Offline'}
                    </span>
                </div>

                {/* Pending */}
                <div className="flex items-center justify-between">
                    <span className="text-gray-600">Chờ đồng bộ:</span>
                    <span className={`font-medium ${unsyncedCount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {unsyncedCount} đơn
                    </span>
                </div>

                {/* Last sync */}
                {lastSynced && (
                    <div className="flex items-center justify-between">
                        <span className="text-gray-600">Lần cuối:</span>
                        <span className="text-gray-500 text-sm">
                            {lastSynced.toLocaleTimeString()}
                        </span>
                    </div>
                )}

                {/* Sync button */}
                {unsyncedCount > 0 && isOnline && (
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {syncing ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Đang đồng bộ...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                Đồng bộ ngay
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default OfflineIndicator;
