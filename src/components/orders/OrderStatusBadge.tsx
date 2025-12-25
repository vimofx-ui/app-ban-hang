import { cn } from '@/lib/utils';

export function OrderStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        completed: 'bg-green-100 text-green-700',
        returned: 'bg-yellow-100 text-yellow-700',
        cancelled: 'bg-red-100 text-red-700',
        draft: 'bg-gray-100 text-gray-700',
        pending_approval: 'bg-blue-100 text-blue-700',
        approved: 'bg-indigo-100 text-indigo-700',
        packing: 'bg-orange-100 text-orange-700',
        packed: 'bg-purple-100 text-purple-700',
        shipping: 'bg-teal-100 text-teal-700'
    };
    const labels: Record<string, string> = {
        completed: 'Hoàn thành',
        returned: 'Đã trả hàng',
        cancelled: 'Đã hủy',
        draft: 'Đơn tạm',
        pending_approval: 'Đang chờ phê duyệt',
        approved: 'Đã phê duyệt',
        packing: 'Đang đóng gói',
        packed: 'Đã đóng gói',
        shipping: 'Đang giao hàng'
    };
    return <span className={cn('px-2 py-1 rounded-full text-xs font-bold', styles[status] || styles.draft)}>{labels[status] || status}</span>;
}
