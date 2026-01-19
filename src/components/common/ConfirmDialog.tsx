import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    isOpen,
    title = 'Xác nhận',
    message,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    type = 'danger',
    onConfirm,
    onCancel
}: ConfirmDialogProps) {
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onCancel();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const colors = {
        danger: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            icon: 'text-red-500',
            iconBg: 'bg-red-100',
            button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        },
        warning: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            icon: 'text-amber-500',
            iconBg: 'bg-amber-100',
            button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
        },
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            icon: 'text-blue-500',
            iconBg: 'bg-blue-100',
            button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        }
    };

    const c = colors[type];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Dialog */}
            <div
                className="relative bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200"
                style={{ minWidth: '380px', maxWidth: '420px', width: '90vw' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <X size={20} className="text-gray-400" />
                </button>

                <div className="p-6">
                    {/* Icon */}
                    <div className={`w-14 h-14 ${c.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                        {type === 'danger' ? (
                            <Trash2 size={28} className={c.icon} />
                        ) : (
                            <AlertTriangle size={28} className={c.icon} />
                        )}
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                        {title}
                    </h3>

                    {/* Message */}
                    <p className="text-gray-600 text-center mb-6 whitespace-pre-line">
                        {message}
                    </p>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${c.button}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Hook for easy usage
interface UseConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

export function useConfirm() {
    const [state, setState] = useState<{
        isOpen: boolean;
        options: UseConfirmOptions | null;
        resolve: ((value: boolean) => void) | null;
    }>({
        isOpen: false,
        options: null,
        resolve: null
    });

    const confirm = (options: UseConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({
                isOpen: true,
                options,
                resolve
            });
        });
    };

    const handleConfirm = () => {
        state.resolve?.(true);
        setState({ isOpen: false, options: null, resolve: null });
    };

    const handleCancel = () => {
        state.resolve?.(false);
        setState({ isOpen: false, options: null, resolve: null });
    };

    const ConfirmDialogElement = state.isOpen && state.options ? (
        <ConfirmDialog
            isOpen={state.isOpen}
            title={state.options.title}
            message={state.options.message}
            confirmText={state.options.confirmText}
            cancelText={state.options.cancelText}
            type={state.options.type}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    ) : null;

    return { confirm, ConfirmDialog: ConfirmDialogElement };
}
