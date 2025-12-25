// =============================================================================
// ORDER FORM TEMPLATE - Đơn đặt hàng
// =============================================================================

import React from 'react';
import type { OrderFormConfig } from '@/stores/settingsStore';
import { formatReceiptCurrency } from '@/lib/printService';

export interface OrderItem {
    name: string;
    sku?: string;
    quantity: number;
    unitName: string;
    unitPrice: number;
}

export interface OrderFormData {
    orderNumber: string;
    date: Date;
    expectedDelivery?: Date;
    customer: { name: string; phone: string; address?: string };
    items: OrderItem[];
    totalAmount: number;
    depositAmount?: number;
    remainingAmount?: number;
    notes?: string;
    createdBy: string;
    storeName: string;
    storeAddress: string;
    storePhone: string;
}

interface OrderFormTemplateProps {
    data: OrderFormData;
    config: OrderFormConfig;
}

export const OrderFormTemplate: React.FC<OrderFormTemplateProps> = ({ data, config }) => {
    const { orderNumber, date, expectedDelivery, customer, items, totalAmount, depositAmount, remainingAmount, notes, createdBy, storeName, storeAddress, storePhone } = data;

    const formattedDate = date.toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const formattedDelivery = expectedDelivery?.toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const isSmallPaper = config.paperWidth === '58mm' || config.paperWidth === '80mm';

    if (isSmallPaper) {
        const widthClass = config.paperWidth === '58mm' ? 'w-[58mm]' : 'w-[80mm]';

        return (
            <div className={`${widthClass} bg-white px-2 py-3 text-black font-mono text-xs leading-tight`}>
                <div className="text-center border-b border-black pb-2 mb-2">
                    <h2 className="font-bold text-sm uppercase">{storeName}</h2>
                    <p className="text-[10px]">{storePhone}</p>
                </div>
                <div className="text-center mb-2">
                    <h3 className="font-bold uppercase text-blue-600">Đơn Đặt Hàng</h3>
                    <p className="text-[10px]">Mã: {orderNumber}</p>
                    <p className="text-[10px]">Ngày: {formattedDate}</p>
                </div>
                <div className="border-b border-dashed pb-1 mb-2 text-[10px]">
                    <p className="font-bold">KH: {customer.name}</p>
                    <p>ĐT: {customer.phone}</p>
                    {formattedDelivery && <p>Giao: {formattedDelivery}</p>}
                </div>
                <table className="w-full mb-2 text-[10px]">
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td className="py-1">{item.name}</td>
                                <td className="text-center">{item.quantity}</td>
                                <td className="text-right">{formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="border-t border-black pt-1">
                    <div className="flex justify-between font-bold">
                        <span>Tổng:</span>
                        <span>{formatReceiptCurrency(totalAmount)}</span>
                    </div>
                    {depositAmount && (
                        <div className="flex justify-between text-green-600">
                            <span>Đặt cọc:</span>
                            <span>{formatReceiptCurrency(depositAmount)}</span>
                        </div>
                    )}
                    {remainingAmount && (
                        <div className="flex justify-between font-bold text-red-600">
                            <span>Còn lại:</span>
                            <span>{formatReceiptCurrency(remainingAmount)}</span>
                        </div>
                    )}
                </div>
                <div className="text-center text-[10px] mt-2 pt-2 border-t border-dashed">
                    <p>NV: {createdBy}</p>
                </div>
            </div>
        );
    }

    // Large paper
    const containerClass = config.paperWidth === 'A4' ? 'w-[210mm] p-10' : 'w-[148mm] p-6';

    return (
        <div className={`${containerClass} bg-white text-slate-800 font-sans text-sm`}>
            <div className="flex justify-between items-start border-b-2 border-blue-500 pb-4 mb-4">
                <div>
                    <h1 className="font-bold text-xl text-blue-600 uppercase">{storeName}</h1>
                    <p className="text-xs text-slate-500">{storeAddress}</p>
                    <p className="text-xs text-slate-500">ĐT: {storePhone}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-blue-600 uppercase">Đơn Đặt Hàng</h2>
                    <p className="font-bold mt-1">{orderNumber}</p>
                    <p className="text-xs">Ngày tạo: {formattedDate}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-bold text-blue-700 uppercase text-xs mb-2">👤 Thông tin khách hàng</h3>
                    <p className="font-semibold text-lg">{customer.name}</p>
                    <p>📱 {customer.phone}</p>
                    {customer.address && <p>📍 {customer.address}</p>}
                </div>
                {config.showDeliveryInfo && formattedDelivery && (
                    <div className="bg-green-50 p-4 rounded-lg">
                        <h3 className="font-bold text-green-700 uppercase text-xs mb-2">📦 Thông tin giao hàng</h3>
                        <p className="font-semibold text-lg">🗓️ {formattedDelivery}</p>
                        <p className="text-sm text-gray-600">Ngày giao dự kiến</p>
                    </div>
                )}
            </div>

            <table className="w-full mb-4 border-collapse">
                <thead>
                    <tr className="bg-blue-50 text-blue-800 uppercase text-xs">
                        <th className="border-y border-blue-200 p-2 text-left w-10">STT</th>
                        <th className="border-y border-blue-200 p-2 text-left">Sản phẩm</th>
                        <th className="border-y border-blue-200 p-2 text-center w-16">ĐVT</th>
                        <th className="border-y border-blue-200 p-2 text-center w-16">SL</th>
                        <th className="border-y border-blue-200 p-2 text-right">Đơn giá</th>
                        <th className="border-y border-blue-200 p-2 text-right">Thành tiền</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={idx} className="border-b">
                            <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-medium">{item.name}</td>
                            <td className="p-2 text-center">{item.unitName}</td>
                            <td className="p-2 text-center font-bold">{item.quantity}</td>
                            <td className="p-2 text-right">{formatReceiptCurrency(item.unitPrice)}</td>
                            <td className="p-2 text-right font-bold">{formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-blue-100">
                        <td colSpan={5} className="p-2 text-right font-bold uppercase">Tổng cộng</td>
                        <td className="p-2 text-right font-bold text-blue-600 text-lg">{formatReceiptCurrency(totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>

            {config.showDepositAmount && (depositAmount || remainingAmount) && (
                <div className="flex justify-end mb-4">
                    <div className="bg-gray-50 p-4 rounded-lg w-1/3">
                        {depositAmount && (
                            <div className="flex justify-between py-1">
                                <span>Đã đặt cọc:</span>
                                <span className="font-bold text-green-600">{formatReceiptCurrency(depositAmount)}</span>
                            </div>
                        )}
                        {remainingAmount && (
                            <div className="flex justify-between py-1 border-t font-bold">
                                <span>Còn phải TT:</span>
                                <span className="text-red-600">{formatReceiptCurrency(remainingAmount)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {notes && (
                <div className="bg-amber-50 p-3 rounded-lg mb-4">
                    <span className="font-bold">Ghi chú:</span> {notes}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-center mt-10">
                <div>
                    <p className="font-bold text-xs uppercase">Nhân viên</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-medium">{createdBy}</p>
                </div>
                <div>
                    <p className="font-bold text-xs uppercase">Khách hàng</p>
                    <p className="text-[10px] italic text-gray-500">(Ký xác nhận)</p>
                    <div className="h-16"></div>
                    <p className="font-medium">{customer.name}</p>
                </div>
            </div>
        </div>
    );
};

export function generateOrderFormHTML(data: OrderFormData, config: OrderFormConfig): string {
    const { orderNumber, date, customer, items, totalAmount, depositAmount, remainingAmount, createdBy, storeName, storeAddress } = data;
    const formattedDate = date.toLocaleDateString('vi-VN');
    const width = config.paperWidth === 'A4' ? '210mm' : config.paperWidth === 'A5' ? '148mm' : config.paperWidth;

    let itemsHtml = items.map((item, idx) => `
        <tr style="border-bottom:1px solid #bfdbfe;">
            <td style="padding:8px;text-align:center;color:#666;">${idx + 1}</td>
            <td style="padding:8px;font-weight:500;">${item.name}</td>
            <td style="padding:8px;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;text-align:right;font-weight:bold;">${formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
        </tr>
    `).join('');

    return `
        <div style="width:${width};font-family:sans-serif;font-size:12px;padding:40px;background:white;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #3b82f6;padding-bottom:16px;margin-bottom:16px;">
                <div>
                    <div style="font-weight:bold;font-size:18px;color:#3b82f6;text-transform:uppercase;">${storeName}</div>
                    <div style="font-size:11px;color:#64748b;">${storeAddress}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:20px;font-weight:bold;color:#3b82f6;text-transform:uppercase;">Đơn Đặt Hàng</div>
                    <div style="font-weight:bold;">${orderNumber}</div>
                    <div>${formattedDate}</div>
                </div>
            </div>
            <div style="background:#eff6ff;padding:12px;border-radius:8px;margin-bottom:16px;">
                <strong>KH:</strong> ${customer.name} | 📱 ${customer.phone}
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead><tr style="background:#dbeafe;text-transform:uppercase;font-size:10px;color:#1e40af;">
                    <th style="border-bottom:1px solid #bfdbfe;padding:8px;width:32px;">STT</th>
                    <th style="border-bottom:1px solid #bfdbfe;padding:8px;text-align:left;">Sản phẩm</th>
                    <th style="border-bottom:1px solid #bfdbfe;padding:8px;">SL</th>
                    <th style="border-bottom:1px solid #bfdbfe;padding:8px;text-align:right;">T.Tiền</th>
                </tr></thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot><tr style="background:#dbeafe;">
                    <td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">Tổng:</td>
                    <td style="padding:8px;text-align:right;font-weight:bold;color:#1e40af;font-size:16px;">${formatReceiptCurrency(totalAmount)}</td>
                </tr></tfoot>
            </table>
            ${depositAmount ? `<div style="text-align:right;margin-bottom:8px;">Đặt cọc: <strong style="color:#16a34a;">${formatReceiptCurrency(depositAmount)}</strong></div>` : ''}
            ${remainingAmount ? `<div style="text-align:right;font-size:14px;">Còn lại: <strong style="color:#dc2626;">${formatReceiptCurrency(remainingAmount)}</strong></div>` : ''}
            <div style="text-align:center;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:32px;">
                NV: ${createdBy} • ${formattedDate}
            </div>
        </div>
    `;
}

export default OrderFormTemplate;
