// =============================================================================
// RETURN RECEIPT TEMPLATE - Phiếu đổi/trả hàng
// =============================================================================

import React from 'react';
import type { ReturnReceiptConfig } from '@/stores/settingsStore';
import { formatReceiptCurrency } from '@/lib/printService';

export interface ReturnItem {
    name: string;
    quantity: number;
    unitName: string;
    unitPrice: number;
    reason?: string;
}

export interface ReturnReceiptData {
    returnNumber: string;
    originalOrderNumber?: string;
    date: Date;
    customer?: { name: string; phone?: string };
    items: ReturnItem[];
    returnType: 'exchange' | 'refund';
    refundAmount?: number;
    exchangeItems?: ReturnItem[];
    priceDifference?: number;
    notes?: string;
    createdBy: string;
    storeName: string;
    storeAddress: string;
    storePhone: string;
}

interface ReturnReceiptTemplateProps {
    data: ReturnReceiptData;
    config: ReturnReceiptConfig;
}

export const ReturnReceiptTemplate: React.FC<ReturnReceiptTemplateProps> = ({ data, config }) => {
    const { returnNumber, originalOrderNumber, date, customer, items, returnType, refundAmount, exchangeItems, priceDifference, notes, createdBy, storeName, storeAddress, storePhone } = data;

    const formattedDate = date.toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const totalReturnValue = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

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
                    <h3 className="font-bold uppercase text-red-600">{returnType === 'refund' ? 'Phiếu Trả Hàng' : 'Phiếu Đổi Hàng'}</h3>
                    <p className="text-[10px]">Số: {returnNumber}</p>
                    {originalOrderNumber && <p className="text-[10px]">HĐ gốc: {originalOrderNumber}</p>}
                </div>
                {customer && config.showCustomerInfo && (
                    <div className="border-b border-dashed pb-1 mb-2 text-[10px]">
                        KH: {customer.name} {customer.phone && `- ${customer.phone}`}
                    </div>
                )}
                <div className="mb-2">
                    <p className="font-bold text-[10px] uppercase mb-1">Hàng trả lại:</p>
                    {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-[10px]">
                            <span>{item.name} x{item.quantity}</span>
                            <span>{formatReceiptCurrency(item.unitPrice * item.quantity)}</span>
                        </div>
                    ))}
                </div>
                <div className="border-t border-black pt-1">
                    <div className="flex justify-between font-bold">
                        <span>Tổng trả:</span>
                        <span className="text-red-600">{formatReceiptCurrency(totalReturnValue)}</span>
                    </div>
                    {refundAmount !== undefined && returnType === 'refund' && (
                        <div className="flex justify-between font-bold text-green-600">
                            <span>Hoàn tiền:</span>
                            <span>{formatReceiptCurrency(refundAmount)}</span>
                        </div>
                    )}
                </div>
                <div className="text-center text-[10px] mt-2 pt-2 border-t border-dashed">
                    <p>NV: {createdBy}</p>
                    <p>{formattedDate}</p>
                </div>
            </div>
        );
    }

    // Large paper
    const containerClass = config.paperWidth === 'A4' ? 'w-[210mm] p-10' : 'w-[148mm] p-6';

    return (
        <div className={`${containerClass} bg-white text-slate-800 font-sans text-sm`}>
            <div className="flex justify-between items-start border-b-2 border-red-500 pb-4 mb-4">
                <div>
                    <h1 className="font-bold text-xl text-red-600 uppercase">{storeName}</h1>
                    <p className="text-xs text-slate-500">{storeAddress}</p>
                    <p className="text-xs text-slate-500">ĐT: {storePhone}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-red-600 uppercase">
                        {returnType === 'refund' ? 'Phiếu Trả Hàng' : 'Phiếu Đổi Hàng'}
                    </h2>
                    <p className="font-bold mt-1">{returnNumber}</p>
                    {originalOrderNumber && <p className="text-xs">HĐ gốc: {originalOrderNumber}</p>}
                    <p className="text-xs">{formattedDate}</p>
                </div>
            </div>

            {customer && config.showCustomerInfo && (
                <div className="bg-red-50 p-3 rounded-lg mb-4">
                    <span className="font-semibold">Khách hàng:</span> {customer.name}
                    {customer.phone && <span className="ml-4">📱 {customer.phone}</span>}
                </div>
            )}

            <div className="mb-4">
                <h3 className="font-bold text-red-700 uppercase text-xs mb-2">📦 Hàng trả lại</h3>
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-red-50 text-red-800 uppercase text-xs">
                            <th className="border-y border-red-200 p-2 text-left">Sản phẩm</th>
                            <th className="border-y border-red-200 p-2 text-center w-16">SL</th>
                            <th className="border-y border-red-200 p-2 text-right">Đơn giá</th>
                            <th className="border-y border-red-200 p-2 text-right">T.Tiền</th>
                            {config.showReturnReason && <th className="border-y border-red-200 p-2 text-left">Lý do</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx} className="border-b">
                                <td className="p-2 font-medium">{item.name}</td>
                                <td className="p-2 text-center font-bold">{item.quantity} {item.unitName}</td>
                                <td className="p-2 text-right">{formatReceiptCurrency(item.unitPrice)}</td>
                                <td className="p-2 text-right font-bold">{formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
                                {config.showReturnReason && <td className="p-2 text-xs text-gray-600">{item.reason || '-'}</td>}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-red-100">
                            <td colSpan={3} className="p-2 text-right font-bold uppercase">Tổng giá trị trả</td>
                            <td className="p-2 text-right font-bold text-red-600 text-lg">{formatReceiptCurrency(totalReturnValue)}</td>
                            {config.showReturnReason && <td></td>}
                        </tr>
                    </tfoot>
                </table>
            </div>

            {exchangeItems && exchangeItems.length > 0 && (
                <div className="mb-4">
                    <h3 className="font-bold text-green-700 uppercase text-xs mb-2">📦 Hàng đổi</h3>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-green-50 text-green-800 uppercase text-xs">
                                <th className="border-y border-green-200 p-2 text-left">Sản phẩm</th>
                                <th className="border-y border-green-200 p-2 text-center w-16">SL</th>
                                <th className="border-y border-green-200 p-2 text-right">Đơn giá</th>
                                <th className="border-y border-green-200 p-2 text-right">T.Tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exchangeItems.map((item, idx) => (
                                <tr key={idx} className="border-b">
                                    <td className="p-2 font-medium">{item.name}</td>
                                    <td className="p-2 text-center font-bold">{item.quantity} {item.unitName}</td>
                                    <td className="p-2 text-right">{formatReceiptCurrency(item.unitPrice)}</td>
                                    <td className="p-2 text-right font-bold">{formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {(refundAmount !== undefined || priceDifference !== undefined) && (
                <div className="flex justify-end mb-4">
                    <div className="bg-gray-50 p-4 rounded-lg w-1/3">
                        {priceDifference !== undefined && priceDifference !== 0 && (
                            <div className="flex justify-between py-1">
                                <span>Chênh lệch:</span>
                                <span className={`font-bold ${priceDifference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {priceDifference > 0 ? '+' : ''}{formatReceiptCurrency(priceDifference)}
                                </span>
                            </div>
                        )}
                        {refundAmount !== undefined && (
                            <div className="flex justify-between py-1 border-t font-bold">
                                <span>{returnType === 'refund' ? 'Hoàn tiền:' : 'Khách trả thêm:'}</span>
                                <span className="text-green-600">{formatReceiptCurrency(refundAmount)}</span>
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
                    <p className="font-medium">{customer?.name || ''}</p>
                </div>
            </div>
        </div>
    );
};

export function generateReturnReceiptHTML(data: ReturnReceiptData, config: ReturnReceiptConfig): string {
    const { returnNumber, date, items, returnType, refundAmount, createdBy, storeName, storeAddress } = data;
    const formattedDate = date.toLocaleDateString('vi-VN');
    const totalReturnValue = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const width = config.paperWidth === 'A4' ? '210mm' : config.paperWidth === 'A5' ? '148mm' : config.paperWidth;

    let itemsHtml = items.map(item => `
        <tr style="border-bottom:1px solid #fecaca;">
            <td style="padding:8px;">${item.name}</td>
            <td style="padding:8px;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;text-align:right;">${formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
        </tr>
    `).join('');

    return `
        <div style="width:${width};font-family:sans-serif;font-size:12px;padding:40px;background:white;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #dc2626;padding-bottom:16px;margin-bottom:16px;">
                <div>
                    <div style="font-weight:bold;font-size:18px;color:#dc2626;text-transform:uppercase;">${storeName}</div>
                    <div style="font-size:11px;color:#64748b;">${storeAddress}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:20px;font-weight:bold;color:#dc2626;text-transform:uppercase;">
                        ${returnType === 'refund' ? 'Phiếu Trả Hàng' : 'Phiếu Đổi Hàng'}
                    </div>
                    <div style="font-weight:bold;">${returnNumber}</div>
                    <div>${formattedDate}</div>
                </div>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead><tr style="background:#fef2f2;text-transform:uppercase;font-size:10px;color:#991b1b;">
                    <th style="border-bottom:1px solid #fecaca;padding:8px;text-align:left;">Sản phẩm</th>
                    <th style="border-bottom:1px solid #fecaca;padding:8px;">SL</th>
                    <th style="border-bottom:1px solid #fecaca;padding:8px;text-align:right;">T.Tiền</th>
                </tr></thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot><tr style="background:#fee2e2;">
                    <td colspan="2" style="padding:8px;text-align:right;font-weight:bold;">Tổng:</td>
                    <td style="padding:8px;text-align:right;font-weight:bold;color:#dc2626;">${formatReceiptCurrency(totalReturnValue)}</td>
                </tr></tfoot>
            </table>
            ${refundAmount !== undefined ? `<div style="text-align:right;font-size:16px;font-weight:bold;color:#16a34a;">Hoàn tiền: ${formatReceiptCurrency(refundAmount)}</div>` : ''}
            <div style="text-align:center;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:32px;">
                NV: ${createdBy} • ${formattedDate}
            </div>
        </div>
    `;
}

export default ReturnReceiptTemplate;
