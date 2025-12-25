import React from 'react';
import { formatVND } from '@/lib/cashReconciliation';
import { OrderDetailItem } from './OrderDetailItem';

interface OrderItemsTableProps {
    items: any[];
    subtotal?: number;
    discountAmount?: number;
    totalAmount: number;
    className?: string;
}

export function OrderItemsTable({ items, subtotal, discountAmount = 0, totalAmount, className = '' }: OrderItemsTableProps) {
    // If subtotal is missing, calculate or default to total + discount
    const finalSubtotal = subtotal ?? (totalAmount + discountAmount);

    return (
        <table className={`w-full text-sm ${className}`}>
            <thead>
                <tr className="border-b text-gray-500">
                    <th className="text-left py-2 font-medium">Sản phẩm</th>
                    <th className="text-center py-2 font-medium">SL</th>
                    <th className="text-right py-2 font-medium">Đơn giá</th>
                    <th className="text-right py-2 font-medium">Thành tiền</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {items?.map((item: any) => (
                    <OrderDetailItem key={item.id} item={item} />
                ))}
                {items?.length === 0 && (
                    <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-400 italic">
                            Không có sản phẩm nào
                        </td>
                    </tr>
                )}
            </tbody>
            <tfoot className="border-t font-bold text-gray-900">
                <tr>
                    <td colSpan={3} className="py-3 text-right font-normal text-gray-500">Tổng tiền hàng:</td>
                    <td className="py-3 text-right">{formatVND(finalSubtotal)}</td>
                </tr>
                {discountAmount > 0 && (
                    <tr>
                        <td colSpan={3} className="py-2 text-right text-red-500 font-normal">Giảm giá:</td>
                        <td className="py-2 text-right text-red-500">-{formatVND(discountAmount)}</td>
                    </tr>
                )}
                <tr className="text-base text-blue-600">
                    <td colSpan={3} className="py-3 text-right">Khách phải trả:</td>
                    <td className="py-3 text-right">{formatVND(totalAmount)}</td>
                </tr>
            </tfoot>
        </table>
    );
}
