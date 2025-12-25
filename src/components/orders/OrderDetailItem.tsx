import React from 'react';
import { formatVND } from '@/lib/cashReconciliation';

interface OrderDetailItemProps {
    item: any; // Ideally this should be OrderItem type
}

export function OrderDetailItem({ item }: OrderDetailItemProps) {
    return (
        <tr className="hover:bg-gray-50 transition-colors">
            <td className="py-3 pr-2">
                <div className="font-medium text-gray-900">{item.product?.name || 'Sản phẩm đã xóa'}</div>
                <div className="text-xs text-gray-400">{item.product?.code}</div>
            </td>
            <td className="py-3 text-center px-2">{item.quantity}</td>
            <td className="py-3 text-right px-2 text-gray-600">{formatVND(item.unit_price)}</td>
            <td className="py-3 text-right font-medium text-gray-900 pl-2">
                {formatVND(item.total_price || (item.quantity * item.unit_price))}
            </td>
        </tr>
    );
}
