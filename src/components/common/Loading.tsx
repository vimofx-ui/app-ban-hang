import React from 'react';

interface LoadingProps {
    fullScreen?: boolean;
    className?: string;
}

export const Loading: React.FC<LoadingProps> = ({ fullScreen = false, className = '' }) => {
    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className={`flex items-center justify-center p-4 ${className}`}>
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
        </div>
    );
};
