import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { requestForToken, onMessageListener } from '@/lib/firebase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuthStore } from './authStore';

export interface Notification {
    id: string;
    title: string;
    body: string;
    type: 'order_created' | 'order_update' | 'stock_low' | 'system' | 'other';
    is_read: boolean;
    created_at: string;
    data?: any;
}

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    permissionStatus: NotificationPermission; // 'default' | 'granted' | 'denied'

    // Actions
    loadNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    requestPermission: () => Promise<boolean>;
    subscribeToNotifications: () => (() => void) | undefined;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    permissionStatus: Notification.permission,

    loadNotifications: async () => {
        set({ isLoading: true });
        try {
            if (!supabase) return;

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) {
                set({
                    notifications: data as Notification[],
                    unreadCount: data.filter((n: any) => !n.is_read).length
                });
            }
        } catch (err) {
            console.error('Error loading notifications:', err);
        } finally {
            set({ isLoading: false });
        }
    },

    markAsRead: async (id: string) => {
        // Optimistic update
        set(state => {
            const newNotifs = state.notifications.map(n =>
                n.id === id ? { ...n, is_read: true } : n
            );
            return {
                notifications: newNotifs,
                unreadCount: newNotifs.filter(n => !n.is_read).length
            };
        });

        if (supabase) {
            await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', id);
        }
    },

    markAllAsRead: async () => {
        set(state => ({
            notifications: state.notifications.map(n => ({ ...n, is_read: true })),
            unreadCount: 0
        }));

        if (supabase) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from('notifications')
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .eq('recipient_id', user.id)
                    .eq('is_read', false);
            }
        }
    },

    requestPermission: async () => {
        if ('Notification' in window) {
            try {
                const permission = await Notification.requestPermission();
                set({ permissionStatus: permission });

                if (permission === 'granted') {
                    // Get FCM Token
                    const token = await requestForToken();
                    if (token && supabase) {
                        // Save token to Supabase
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            await supabase.from('push_subscriptions').upsert({
                                user_id: user.id,
                                token: token,
                                device_type: 'web',
                                user_agent: navigator.userAgent
                            }, { onConflict: 'user_id, token' });
                            console.log('FCM Token registered:', token);
                        }
                    }
                    return true;
                }
            } catch (err) {
                console.error('Error requesting notification permission:', err);
            }
        }
        return false;
    },

    subscribeToNotifications: () => {
        if (!supabase) return;

        // 1. Subscribe to Realtime DB (In-App)
        // Get current user first
        const user = (useAuthStore.getState() as any).user;
        // Or better:
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;

            const channel = supabase
                .channel('user-notifications')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: user ? `recipient_id=eq.${user.id}` : undefined
                    },
                    async (payload) => {
                        const newNotif = payload.new as Notification;

                        // Check if it belongs to me (double check)
                        const { data: { user } } = await supabase.auth.getUser();
                        // payload.new might not have all fields if RLS masks them, but INSERT usually has them

                        // Add to store
                        set(state => ({
                            notifications: [newNotif, ...state.notifications],
                            unreadCount: state.unreadCount + 1
                        }));

                        // Play sound
                        const audio = new Audio('/notification.mp3'); // TODO: Add sound file
                        audio.play().catch(e => console.log('Audio play failed', e));

                        // Show system notification if in background
                        if (document.visibilityState === 'hidden' && Notification.permission === 'granted') {
                            new Notification(newNotif.title, {
                                body: newNotif.body,
                                icon: '/icons/icon-192.png'
                            });
                        }
                    }
                )
                .subscribe();

            // 2. Listen to Foreground FCM messages
            onMessageListener().then((payload: any) => {
                console.log('Foreground FCM Message:', payload);
                // Can handle extra logic here
            });

        }); // End getUser()
        return () => {
            // Cleanup: unsubscribe from the channel
            // Note: getChannels() is the correct method in Supabase JS v2
            try {
                const channels = supabase.getChannels();
                const userNotificationChannel = channels.find(c => c.topic === 'user-notifications');
                if (userNotificationChannel) {
                    supabase.removeChannel(userNotificationChannel);
                }
            } catch (e) {
                console.warn('Error cleaning up notification channel:', e);
            }
        };
    }
}));
