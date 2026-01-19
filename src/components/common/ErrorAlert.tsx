import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
    message: string | null;
    onClose?: () => void;
    className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onClose, className = '' }) => {
    if (!message) return null;

    return (
        <div className={`bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3 ${className}`}>
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
                <p className="font-medium">{message}</p>
            </div>
            {onClose && (
                <button
                    onClick={onClose}
                    className="text-red-400 hover:text-red-700 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            )}
        </div>
    );
};
