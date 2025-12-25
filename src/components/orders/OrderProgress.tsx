import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

interface OrderProgressProps {
    status: OrderStatus;
    order?: Order;
    className?: string;
    theme?: 'light' | 'dark';
    onStatusChange?: (newStatus: OrderStatus) => void;
}

export function OrderProgress({ status, order, className, theme = 'light', onStatusChange }: OrderProgressProps) {
    const steps = [
        { id: 'placed', label: 'Đặt hàng', targetStatus: 'pending_approval' as OrderStatus },
        { id: 'approved', label: 'Duyệt', targetStatus: 'approved' as OrderStatus },
        { id: 'packing', label: 'Đóng gói', targetStatus: 'packing' as OrderStatus },
        { id: 'shipping', label: 'Xuất kho', targetStatus: 'shipping' as OrderStatus },
        { id: 'completed', label: 'Hoàn thành', targetStatus: 'completed' as OrderStatus },
    ];

    const getStatusIndex = (s: OrderStatus) => {
        switch (s) {
            case 'draft': return -1;
            case 'pending_approval': return 0;
            case 'approved': return 1;
            case 'packing': return 2;
            case 'packed': return 3;
            case 'shipping': return 3; // shipping allows clicking on completed (index 4)
            case 'completed': return 4;
            case 'cancelled': return -1;
            default: return 0;
        }
    };

    // Get timestamp for each step from order data
    const getStepTimestamp = (stepId: string): string | null => {
        if (!order) return null;
        const o = order as any; // Cast to access dynamic fields
        switch (stepId) {
            case 'placed': return o.created_at;
            case 'approved': return o.approved_at;
            case 'packing': return o.packing_at || o.packed_at;
            case 'shipping': return o.shipped_at;
            case 'completed': return o.completed_at;
            default: return null;
        }
    };

    // Format timestamp for display
    const formatTimestamp = (timestamp: string | null): string => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
            date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    let currentIndex = getStatusIndex(status);
    const isCancelled = status === 'cancelled';
    const isDark = theme === 'dark';

    const handleStepClick = (index: number, targetStatus: OrderStatus) => {
        // Only allow clicking on the NEXT step
        if (onStatusChange && index === currentIndex + 1 && !isCancelled) {
            console.log('[OrderProgress] Step clicked:', { index, targetStatus, currentIndex });
            onStatusChange(targetStatus);
        }
    };

    return (
        <div className={cn("w-full px-4 pb-5", className)}>
            <div className="relative flex justify-between items-center w-full">

                {/* Background Line (Gray) - smaller */}
                <div className={cn(
                    "absolute top-[12px] left-0 w-full h-[1.5px] -translate-y-1/2 z-0",
                    isDark ? "bg-white/20" : "bg-gray-200"
                )} />

                {/* Active Line (Blue) - smaller */}
                <div
                    className={cn(
                        "absolute top-[12px] left-0 h-[1.5px] -translate-y-1/2 z-0 transition-all duration-500",
                        isCancelled ? 'bg-red-500' : "bg-blue-500"
                    )}
                    style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, index) => {
                    const isCompleted = index <= currentIndex;
                    const isFuture = index > currentIndex;
                    const isNextStep = index === currentIndex + 1;
                    const isClickable = onStatusChange && isNextStep && !isCancelled;
                    const timestamp = getStepTimestamp(step.id);
                    const showTimestamp = isCompleted && timestamp;

                    return (
                        <div key={step.id} className="relative z-10 flex flex-col items-center">
                            {/* Circle - Clickable if next step - SMALLER */}
                            <button
                                type="button"
                                onClick={() => handleStepClick(index, step.targetStatus)}
                                disabled={!isClickable}
                                className={cn(
                                    "rounded-full flex items-center justify-center transition-all duration-300 border-2",
                                    "w-6 h-6", // Shrunk from w-9 h-9
                                    isCompleted && !isCancelled && "bg-blue-500 border-blue-500 text-white",
                                    isCancelled && isCompleted && "bg-red-500 border-red-500 text-white",
                                    isFuture && "bg-white border-gray-200 text-gray-400 shadow-sm",
                                    isClickable && "cursor-pointer hover:scale-110 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 ring-2 ring-blue-300 ring-offset-1",
                                    !isClickable && isFuture && "cursor-default"
                                )}
                                title={isClickable ? `Chuyển sang: ${step.label}` : ''}
                            >
                                {isCompleted && !isCancelled ? (
                                    <Check size={12} strokeWidth={3} />
                                ) : isCancelled && isCompleted ? (
                                    <Check size={12} strokeWidth={3} />
                                ) : (
                                    <span className="text-[10px] font-bold">{index + 1}</span>
                                )}
                            </button>

                            {/* Label + Timestamp */}
                            <div className="absolute top-7 w-24 text-center left-1/2 transform -translate-x-1/2">
                                <p
                                    className={cn(
                                        "text-[11px] font-medium transition-colors whitespace-nowrap",
                                        isDark ? "text-white" : "text-gray-900",
                                        isFuture && (isDark ? "text-white/70" : "text-gray-400"),
                                        isCancelled && isCompleted && "text-red-500"
                                    )}
                                >
                                    {step.label}
                                </p>
                                {/* Timestamp under label */}
                                {showTimestamp && (
                                    <p className={cn(
                                        "text-[9px] mt-0.5 whitespace-nowrap",
                                        isDark ? "text-white/60" : "text-gray-400"
                                    )}>
                                        {formatTimestamp(timestamp)}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

