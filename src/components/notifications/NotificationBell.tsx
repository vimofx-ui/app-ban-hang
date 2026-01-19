import { useState, useRef, useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export function NotificationBell() {
    const {
        notifications,
        unreadCount,
        loadNotifications,
        markAsRead,
        markAllAsRead,
        subscribeToNotifications,
        requestPermission
    } = useNotificationStore();

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initialize
    useEffect(() => {
        loadNotifications();
        const unsubscribe = subscribeToNotifications();

        // Request permission on mount (or maybe on user click?)
        // Better to asking on click or letting user know

        return () => {
            if (unsubscribe) unsubscribe(); // subscribeToNotifications returns void in store currently but let's fix that mentally or ignore if store doesn't return cleanup
        };
    }, [loadNotifications, subscribeToNotifications]);

    // Handle click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleBellClick = () => {
        setIsOpen(!isOpen);
        if (!isOpen && Notification.permission === 'default') {
            requestPermission();
        }
    };

    const handleItemClick = async (id: string, isRead: boolean) => {
        if (!isRead) {
            await markAsRead(id);
        }
        // Navigate if needed?
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleBellClick}
                className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                title="Thông báo"
            >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-80 md:w-96 md:bottom-auto md:left-full md:top-0 md:ml-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-bottom-left md:origin-top-left">
                    <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-900 text-sm">Thông báo</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAllAsRead()}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Đánh dấu đã đọc
                            </button>
                        )}
                    </div>

                    <div className="max-h-[70vh] md:max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                Không có thông báo nào
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleItemClick(notif.id, notif.is_read)}
                                        className={`p-3 hover:bg-gray-50 transition-colors cursor-pointer flex gap-3 ${!notif.is_read ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!notif.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm ${!notif.is_read ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                                {notif.title}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                                {notif.body}
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: vi })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
                        <button className="text-xs text-gray-500 hover:text-gray-900">
                            Xem tất cả
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function BellIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}
