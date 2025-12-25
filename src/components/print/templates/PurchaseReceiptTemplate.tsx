// =============================================================================
// PURCHASE RECEIPT TEMPLATE - Phiếu nhập hàng
// =============================================================================

import React from 'react';
import type { PurchaseReceiptConfig } from '@/stores/settingsStore';
import { formatReceiptCurrency } from '@/lib/printService';

export interface PurchaseItem {
    name: string;
    sku?: string;
    quantity: number;
    unitName: string;
    unitPrice: number;
}

export interface PurchaseReceiptData {
    receiptNumber: string;
    date: Date;
    supplier: {
        name: string;
        phone?: string;
        address?: string;
    };
    items: PurchaseItem[];
    totalAmount: number;
    paidAmount: number;
    debtAmount: number;
    notes?: string;
    createdBy: string;
    storeName: string;
    storeAddress: string;
}

interface PurchaseReceiptTemplateProps {
    data: PurchaseReceiptData;
    config: PurchaseReceiptConfig;
}

/**
 * Purchase Receipt Template Component
 */
export const PurchaseReceiptTemplate: React.FC<PurchaseReceiptTemplateProps> = ({ data, config }) => {
    const { receiptNumber, date, supplier, items, totalAmount, paidAmount, debtAmount, notes, createdBy, storeName, storeAddress } = data;

    const formattedDate = date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const isSmallPaper = config.paperWidth === '58mm' || config.paperWidth === '80mm';

    if (isSmallPaper) {
        const widthClass = config.paperWidth === '58mm' ? 'w-[58mm]' : 'w-[80mm]';

        return (
            <div className={`${widthClass} bg-white px-2 py-3 text-black font-mono text-xs leading-tight`}>
                {/* Header */}
                <div className="text-center border-b border-black pb-2 mb-2">
                    <h2 className="font-bold text-sm uppercase">{storeName}</h2>
                    <p className="text-[10px]">{storeAddress}</p>
                </div>

                <div className="text-center mb-2">
                    <h3 className="font-bold uppercase">Phiếu Nhập Hàng</h3>
                    <p className="text-[10px]">Số: {receiptNumber}</p>
                </div>

                {/* Supplier Info */}
                {config.showSupplierInfo && (
                    <div className="border-b border-dashed border-black pb-2 mb-2">
                        <p className="font-bold">NCC: {supplier.name}</p>
                        {supplier.phone && <p>ĐT: {supplier.phone}</p>}
                    </div>
                )}

                {/* Items */}
                <table className="w-full mb-2">
                    <thead>
                        <tr className="border-b border-black text-[9px]">
                            <th className="text-left py-1">Tên hàng</th>
                            <th className="text-center w-6">SL</th>
                            <th className="text-right">Tiền</th>
                        </tr>
                    </thead>
                    <tbody className="text-[10px]">
                        {items.map((item, idx) => (
                            <React.Fragment key={idx}>
                                <tr>
                                    <td colSpan={3} className="pt-1 font-medium">{item.name}</td>
                                </tr>
                                <tr>
                                    <td className="pb-1 text-[9px] text-gray-600">{formatReceiptCurrency(item.unitPrice)}/{item.unitName}</td>
                                    <td className="pb-1 text-center">{item.quantity}</td>
                                    <td className="pb-1 text-right font-bold">{formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="border-t border-black pt-1 mb-2">
                    <div className="flex justify-between font-bold">
                        <span>Tổng cộng:</span>
                        <span>{formatReceiptCurrency(totalAmount)}</span>
                    </div>
                    {config.showPaymentStatus && (
                        <>
                            <div className="flex justify-between">
                                <span>Đã thanh toán:</span>
                                <span>{formatReceiptCurrency(paidAmount)}</span>
                            </div>
                            {debtAmount > 0 && (
                                <div className="flex justify-between text-red-600 font-bold">
                                    <span>Còn nợ:</span>
                                    <span>{formatReceiptCurrency(debtAmount)}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center text-[10px] mt-2 pt-2 border-t border-dashed border-black">
                    <p>Người nhập: {createdBy}</p>
                    <p>{formattedDate}</p>
                </div>
            </div>
        );
    }

    // Large paper (A4/A5)
    const containerClass = config.paperWidth === 'A4'
        ? 'w-[210mm] min-h-[297mm] p-10 text-sm'
        : 'w-[148mm] min-h-[210mm] p-6 text-xs';

    return (
        <div className={`${containerClass} bg-white text-slate-800 font-sans`}>
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-blue-800 pb-4 mb-4">
                <div>
                    <h1 className="font-bold text-xl text-blue-900 uppercase">{storeName}</h1>
                    <p className="text-xs text-slate-500">{storeAddress}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-slate-400 uppercase">Phiếu Nhập</h2>
                    <p className="text-xs font-bold mt-1">{receiptNumber}</p>
                    <p className="text-xs">{formattedDate}</p>
                </div>
            </div>

            {/* Supplier Info */}
            {config.showSupplierInfo && (
                <div className="bg-slate-50 p-4 rounded-lg mb-4">
                    <h3 className="font-bold text-gray-500 uppercase text-xs mb-2">Nhà cung cấp</h3>
                    <p className="font-bold text-lg">{supplier.name}</p>
                    {supplier.phone && <p>SĐT: {supplier.phone}</p>}
                    {supplier.address && <p>Địa chỉ: {supplier.address}</p>}
                </div>
            )}

            {/* Items Table */}
            <table className="w-full mb-4 border-collapse">
                <thead>
                    <tr className="bg-gray-100 text-gray-700 uppercase text-xs">
                        <th className="border-y p-2 text-left w-10">STT</th>
                        <th className="border-y p-2 text-left">Tên hàng hóa</th>
                        <th className="border-y p-2 text-left w-24">Mã SKU</th>
                        <th className="border-y p-2 text-center w-16">ĐVT</th>
                        <th className="border-y p-2 text-center w-16">SL</th>
                        <th className="border-y p-2 text-right">Đơn giá</th>
                        <th className="border-y p-2 text-right">Thành tiền</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                            <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-medium">{item.name}</td>
                            <td className="p-2 text-gray-500 text-xs">{item.sku || '-'}</td>
                            <td className="p-2 text-center">{item.unitName}</td>
                            <td className="p-2 text-center font-bold">{item.quantity}</td>
                            <td className="p-2 text-right">{formatReceiptCurrency(item.unitPrice)}</td>
                            <td className="p-2 text-right font-bold">{formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-blue-50">
                        <td colSpan={6} className="p-2 text-right font-bold uppercase text-blue-900">Tổng cộng</td>
                        <td className="p-2 text-right font-bold text-blue-900 text-lg">{formatReceiptCurrency(totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>

            {/* Payment Status */}
            {config.showPaymentStatus && (
                <div className="flex justify-end mb-4">
                    <div className="w-1/3 text-sm">
                        <div className="flex justify-between py-1 border-b">
                            <span>Đã thanh toán:</span>
                            <span className="font-semibold text-green-600">{formatReceiptCurrency(paidAmount)}</span>
                        </div>
                        {debtAmount > 0 && (
                            <div className="flex justify-between py-1 font-bold text-red-600">
                                <span>Còn nợ NCC:</span>
                                <span>{formatReceiptCurrency(debtAmount)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Notes */}
            {notes && (
                <div className="bg-amber-50 p-3 rounded-lg mb-4 text-sm">
                    <span className="font-bold">Ghi chú:</span> {notes}
                </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-4 text-center mt-12">
                <div>
                    <p className="font-bold text-xs uppercase">Người giao hàng</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                </div>
                <div>
                    <p className="font-bold text-xs uppercase">Người nhận hàng</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-medium">{createdBy}</p>
                </div>
                <div>
                    <p className="font-bold text-xs uppercase">Thủ kho</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                </div>
            </div>
        </div>
    );
};

/**
 * Generate HTML string for printing
 */
export function generatePurchaseReceiptHTML(data: PurchaseReceiptData, config: PurchaseReceiptConfig): string {
    const { receiptNumber, date, supplier, items, totalAmount, paidAmount, debtAmount, createdBy, storeName, storeAddress } = data;
    const formattedDate = date.toLocaleDateString('vi-VN');

    const isSmallPaper = config.paperWidth === '58mm' || config.paperWidth === '80mm';
    const width = config.paperWidth === '58mm' ? '58mm' : config.paperWidth === '80mm' ? '80mm' : '210mm';

    let itemsHtml = '';
    items.forEach((item, idx) => {
        if (isSmallPaper) {
            itemsHtml += `
                <tr><td colspan="3" style="padding-top:4px;font-weight:500;">${item.name}</td></tr>
                <tr>
                    <td style="font-size:9px;color:#666;">${formatReceiptCurrency(item.unitPrice)}/${item.unitName}</td>
                    <td style="text-align:center;">${item.quantity}</td>
                    <td style="text-align:right;font-weight:bold;">${formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
                </tr>
            `;
        } else {
            itemsHtml += `
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td style="padding:8px;text-align:center;color:#666;">${idx + 1}</td>
                    <td style="padding:8px;font-weight:500;">${item.name}</td>
                    <td style="padding:8px;color:#666;font-size:11px;">${item.sku || '-'}</td>
                    <td style="padding:8px;text-align:center;">${item.unitName}</td>
                    <td style="padding:8px;text-align:center;font-weight:bold;">${item.quantity}</td>
                    <td style="padding:8px;text-align:right;">${formatReceiptCurrency(item.unitPrice)}</td>
                    <td style="padding:8px;text-align:right;font-weight:bold;">${formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
                </tr>
            `;
        }
    });

    if (isSmallPaper) {
        return `
            <div style="width:${width};font-family:'Courier New',monospace;font-size:11px;padding:8px;background:white;">
                <div style="text-align:center;border-bottom:1px solid #000;padding-bottom:8px;margin-bottom:8px;">
                    <div style="font-weight:bold;font-size:13px;text-transform:uppercase;">${storeName}</div>
                </div>
                <div style="text-align:center;margin-bottom:8px;">
                    <div style="font-weight:bold;text-transform:uppercase;">Phiếu Nhập Hàng</div>
                    <div style="font-size:10px;">Số: ${receiptNumber}</div>
                </div>
                ${config.showSupplierInfo ? `
                    <div style="border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
                        <div style="font-weight:bold;">NCC: ${supplier.name}</div>
                        ${supplier.phone ? `<div>ĐT: ${supplier.phone}</div>` : ''}
                    </div>
                ` : ''}
                <table style="width:100%;">
                    <thead><tr style="border-bottom:1px solid #000;font-size:9px;"><th style="text-align:left;">Tên hàng</th><th style="width:24px;">SL</th><th style="text-align:right;">Tiền</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div style="border-top:1px solid #000;padding-top:4px;margin-top:4px;">
                    <div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Tổng cộng:</span><span>${formatReceiptCurrency(totalAmount)}</span></div>
                    ${config.showPaymentStatus ? `
                        <div style="display:flex;justify-content:space-between;"><span>Đã TT:</span><span>${formatReceiptCurrency(paidAmount)}</span></div>
                        ${debtAmount > 0 ? `<div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Còn nợ:</span><span>${formatReceiptCurrency(debtAmount)}</span></div>` : ''}
                    ` : ''}
                </div>
                <div style="text-align:center;font-size:10px;margin-top:8px;border-top:1px dashed #000;padding-top:8px;">
                    <div>Người nhập: ${createdBy}</div>
                    <div>${formattedDate}</div>
                </div>
            </div>
        `;
    }

    return `
        <div style="width:${width};font-family:sans-serif;font-size:12px;padding:40px;background:white;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #1e40af;padding-bottom:16px;margin-bottom:16px;">
                <div>
                    <div style="font-weight:bold;font-size:18px;color:#1e40af;text-transform:uppercase;">${storeName}</div>
                    <div style="font-size:11px;color:#64748b;">${storeAddress}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:20px;font-weight:bold;color:#9ca3af;text-transform:uppercase;">Phiếu Nhập</div>
                    <div style="font-weight:bold;margin-top:4px;">${receiptNumber}</div>
                    <div>${formattedDate}</div>
                </div>
            </div>
            ${config.showSupplierInfo ? `
                <div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:16px;">
                    <div style="font-weight:bold;color:#64748b;text-transform:uppercase;font-size:10px;margin-bottom:8px;">Nhà cung cấp</div>
                    <div style="font-weight:bold;font-size:16px;">${supplier.name}</div>
                    ${supplier.phone ? `<div>SĐT: ${supplier.phone}</div>` : ''}
                </div>
            ` : ''}
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead><tr style="background:#f3f4f6;text-transform:uppercase;font-size:10px;">
                    <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;width:32px;">STT</th>
                    <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;">Tên hàng</th>
                    <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;">SKU</th>
                    <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:center;">ĐVT</th>
                    <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:center;">SL</th>
                    <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:right;">Đơn giá</th>
                    <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:right;">Thành tiền</th>
                </tr></thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot><tr style="background:#eff6ff;">
                    <td colspan="6" style="padding:8px;text-align:right;font-weight:bold;text-transform:uppercase;color:#1e40af;">Tổng cộng</td>
                    <td style="padding:8px;text-align:right;font-weight:bold;color:#1e40af;font-size:16px;">${formatReceiptCurrency(totalAmount)}</td>
                </tr></tfoot>
            </table>
            <div style="text-align:center;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:32px;">
                Người nhập: ${createdBy} • ${formattedDate}
            </div>
        </div>
    `;
}

export default PurchaseReceiptTemplate;
