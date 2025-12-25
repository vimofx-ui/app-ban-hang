// =============================================================================
// Responsive Modal - Fullscreen on mobile, centered on desktop
// =============================================================================

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';

interface ResponsiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
}

export function ResponsiveModal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
}: ResponsiveModalProps) {
    const { isMobile } = useBreakpoint();

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-full',
    };

    return (
        <div className="fixed inset-0 z-[9999]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 animate-fade-in"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                className={cn(
                    "absolute bg-white animate-scale-in",
                    isMobile
                        ? "inset-0 rounded-none"
                        : `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl w-[95%] ${sizeClasses[size]} max-h-[90vh]`
                )}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className={cn(
                        "flex items-center justify-between border-b border-gray-200",
                        isMobile ? "px-4 py-3 bg-white sticky top-0 z-10" : "px-6 py-4"
                    )}>
                        <h2 className={cn(
                            "font-bold text-gray-900",
                            isMobile ? "text-lg" : "text-xl"
                        )}>
                            {title}
                        </h2>
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className={cn(
                                    "text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100",
                                    isMobile ? "p-3 -mr-2" : "p-2"
                                )}
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className={cn(
                    "overflow-y-auto",
                    isMobile ? "h-[calc(100vh-60px)]" : "max-h-[calc(90vh-80px)]"
                )}>
                    {children}
                </div>
            </div>
        </div>
    );
}

function CloseIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

export default ResponsiveModal;
