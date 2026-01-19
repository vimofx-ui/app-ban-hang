// =============================================================================
// INSTALL PWA BUTTON - Prompt user to install the app
// =============================================================================

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

// Listen for the install prompt event
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
    });
}

export function useInstallPrompt() {
    const [canInstall, setCanInstall] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        // Check if prompt is available
        const checkPrompt = () => {
            setCanInstall(deferredPrompt !== null);
        };

        // Listen for changes
        window.addEventListener('beforeinstallprompt', () => {
            setCanInstall(true);
        });

        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setCanInstall(false);
            deferredPrompt = null;
        });

        // Initial check
        checkPrompt();

        // Re-check periodically
        const interval = setInterval(checkPrompt, 1000);

        return () => clearInterval(interval);
    }, []);

    const promptInstall = async (): Promise<boolean> => {
        if (!deferredPrompt) {
            console.log('[PWA] Install prompt not available');
            return false;
        }

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                console.log('[PWA] User accepted install');
                deferredPrompt = null;
                return true;
            } else {
                console.log('[PWA] User dismissed install');
                return false;
            }
        } catch (err) {
            console.error('[PWA] Install error:', err);
            return false;
        }
    };

    return {
        canInstall,
        isInstalled,
        promptInstall,
    };
}

interface InstallButtonProps {
    className?: string;
    children?: React.ReactNode;
}

export function InstallAppButton({ className, children }: InstallButtonProps) {
    const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
    const [dismissed, setDismissed] = useState(false);

    // Check if user has dismissed before
    useEffect(() => {
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedDate = new Date(dismissed);
            const daysSince = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
            // Show again after 7 days
            if (daysSince < 7) {
                setDismissed(true);
            }
        }
    }, []);

    const handleInstall = async () => {
        const installed = await promptInstall();
        if (!installed) {
            // User dismissed, remember for 7 days
            localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
            setDismissed(true);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
        setDismissed(true);
    };

    if (isInstalled || !canInstall || dismissed) {
        return null;
    }

    return (
        <div className={`relative ${className || ''}`}>
            <button
                onClick={handleInstall}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium text-sm"
            >
                <span className="text-lg">📲</span>
                {children || 'Cài Bango POS'}
            </button>
            <button
                onClick={handleDismiss}
                className="absolute -top-2 -right-2 w-5 h-5 bg-gray-200 rounded-full text-gray-600 hover:bg-gray-300 text-xs flex items-center justify-center"
                title="Ẩn"
            >
                ×
            </button>
        </div>
    );
}

// Floating install banner for first-time users
export function InstallBanner() {
    const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Show banner after 5 seconds if can install
        const timer = setTimeout(() => {
            if (canInstall && !isInstalled) {
                const dismissed = localStorage.getItem('pwa-banner-dismissed');
                if (!dismissed) {
                    setShow(true);
                }
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [canInstall, isInstalled]);

    const handleInstall = async () => {
        await promptInstall();
        setShow(false);
    };

    const handleDismiss = () => {
        localStorage.setItem('pwa-banner-dismissed', 'true');
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 animate-slide-up">
            <div className="flex gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    📲
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-gray-900">Cài đặt Bango POS</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Thêm ứng dụng vào màn hình chính để truy cập nhanh hơn, ngay cả khi offline.
                    </p>
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={handleInstall}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                        >
                            Cài đặt
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg"
                        >
                            Để sau
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
