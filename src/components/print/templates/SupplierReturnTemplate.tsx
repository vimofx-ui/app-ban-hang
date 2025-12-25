// =============================================================================
// SUPPLIER RETURN TEMPLATE - Đơn trả hàng cho NCC
// =============================================================================

import React from 'react';
import type { SupplierReturnConfig } from '@/stores/settingsStore';
import { formatReceiptCurrency } from '@/lib/printService';

export interface SupplierReturnItem {
    name: string;
    sku?: string;
    quantity: number;
    unitName: string;
    unitPrice: number;
    reason?: string;
}

export interface SupplierReturnData {
    returnNumber: string;
    originalPONumber?: string;
    date: Date;
    supplier: { name: string; phone?: string; address?: string };
    items: SupplierReturnItem[];
    totalAmount: number;
    refundExpected?: number;
    notes?: string;
    createdBy: string;
    storeName: string;
    storeAddress: string;
}

interface SupplierReturnTemplateProps {
    data: SupplierReturnData;
    config: SupplierReturnConfig;
}

export const SupplierReturnTemplate: React.FC<SupplierReturnTemplateProps> = ({ data, config }) => {
    const { returnNumber, originalPONumber, date, supplier, items, totalAmount, refundExpected, notes, createdBy, storeName, storeAddress } = data;

    const formattedDate = date.toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const isSmallPaper = config.paperWidth === '58mm' || config.paperWidth === '80mm';

    if (isSmallPaper) {
        const widthClass = config.paperWidth === '58mm' ? 'w-[58mm]' : 'w-[80mm]';

        return (
            <div className={`${widthClass} bg-white px-2 py-3 text-black font-mono text-xs leading-tight`}>
                <div className="text-center border-b border-black pb-2 mb-2">
                    <h2 className="font-bold text-sm uppercase">{storeName}</h2>
                </div>
                <div className="text-center mb-2">
                    <h3 className="font-bold uppercase text-orange-600">Đơn Trả NCC</h3>
                    <p className="text-[10px]">Số: {returnNumber}</p>
                    {originalPONumber && <p className="text-[10px]">PN gốc: {originalPONumber}</p>}
                </div>
                <div className="border-b border-dashed pb-1 mb-2 text-[10px]">
                    <p className="font-bold">NCC: {supplier.name}</p>
                    {supplier.phone && <p>ĐT: {supplier.phone}</p>}
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
                        <span>Tổng trả:</span>
                        <span className="text-orange-600">{formatReceiptCurrency(totalAmount)}</span>
                    </div>
                </div>
                <div className="text-center text-[10px] mt-2 pt-2 border-t border-dashed">
                    <p>{createdBy} • {formattedDate}</p>
                </div>
            </div>
        );
    }

    // Large paper
    const containerClass = config.paperWidth === 'A4' ? 'w-[210mm] p-10' : 'w-[148mm] p-6';

    return (
        <div className={`${containerClass} bg-white text-slate-800 font-sans text-sm`}>
            <div className="flex justify-between items-start border-b-2 border-orange-500 pb-4 mb-4">
                <div>
                    <h1 className="font-bold text-xl text-orange-600 uppercase">{storeName}</h1>
                    <p className="text-xs text-slate-500">{storeAddress}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-orange-600 uppercase">Đơn Trả Hàng NCC</h2>
                    <p className="font-bold mt-1">{returnNumber}</p>
                    {originalPONumber && <p className="text-xs">Phiếu nhập gốc: {originalPONumber}</p>}
                    <p className="text-xs">{formattedDate}</p>
                </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg mb-4">
                <h3 className="font-bold text-orange-700 uppercase text-xs mb-2">🏭 Nhà cung cấp</h3>
                <p className="font-semibold text-lg">{supplier.name}</p>
                {supplier.phone && <p>📱 {supplier.phone}</p>}
                {supplier.address && <p>📍 {supplier.address}</p>}
            </div>

            <table className="w-full mb-4 border-collapse">
                <thead>
                    <tr className="bg-orange-50 text-orange-800 uppercase text-xs">
                        <th className="border-y border-orange-200 p-2 text-left w-10">STT</th>
                        <th className="border-y border-orange-200 p-2 text-left">Sản phẩm</th>
                        <th className="border-y border-orange-200 p-2 text-left w-24">SKU</th>
                        <th className="border-y border-orange-200 p-2 text-center w-16">SL</th>
                        <th className="border-y border-orange-200 p-2 text-right">Đơn giá</th>
                        <th className="border-y border-orange-200 p-2 text-right">Thành tiền</th>
                        {config.showReturnReason && <th className="border-y border-orange-200 p-2 text-left">Lý do</th>}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={idx} className="border-b">
                            <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-medium">{item.name}</td>
                            <td className="p-2 text-gray-500 text-xs">{item.sku || '-'}</td>
                            <td className="p-2 text-center font-bold">{item.quantity} {item.unitName}</td>
                            <td className="p-2 text-right">{formatReceiptCurrency(item.unitPrice)}</td>
                            <td className="p-2 text-right font-bold">{formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
                            {config.showReturnReason && <td className="p-2 text-xs text-gray-600">{item.reason || '-'}</td>}
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-orange-100">
                        <td colSpan={5} className="p-2 text-right font-bold uppercase">Tổng giá trị trả</td>
                        <td className="p-2 text-right font-bold text-orange-600 text-lg">{formatReceiptCurrency(totalAmount)}</td>
                        {config.showReturnReason && <td></td>}
                    </tr>
                </tfoot>
            </table>

            {config.showRefundExpected && refundExpected !== undefined && (
                <div className="flex justify-end mb-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Hoàn tiền dự kiến:</p>
                        <p className="text-2xl font-bold text-green-600">{formatReceiptCurrency(refundExpected)}</p>
                    </div>
                </div>
            )}

            {notes && (
                <div className="bg-amber-50 p-3 rounded-lg mb-4">
                    <span className="font-bold">Ghi chú:</span> {notes}
                </div>
            )}

            <div className="grid grid-cols-3 gap-4 text-center mt-10">
                <div>
                    <p className="font-bold text-xs uppercase">Người lập phiếu</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-medium">{createdBy}</p>
                </div>
                <div>
                    <p className="font-bold text-xs uppercase">Thủ kho</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                </div>
                <div>
                    <p className="font-bold text-xs uppercase">Nhà cung cấp</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                </div>
            </div>
        </div>
    );
};

export function generateSupplierReturnHTML(data: SupplierReturnData, config: SupplierReturnConfig): string {
    const { returnNumber, date, supplier, items, totalAmount, createdBy, storeName, storeAddress } = data;
    const formattedDate = date.toLocaleDateString('vi-VN');
    const width = config.paperWidth === 'A4' ? '210mm' : config.paperWidth === 'A5' ? '148mm' : config.paperWidth;

    let itemsHtml = items.map((item, idx) => `
        <tr style="border-bottom:1px solid #fed7aa;">
            <td style="padding:8px;text-align:center;color:#666;">${idx + 1}</td>
            <td style="padding:8px;font-weight:500;">${item.name}</td>
            <td style="padding:8px;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;text-align:right;font-weight:bold;">${formatReceiptCurrency(item.unitPrice * item.quantity)}</td>
        </tr>
    `).join('');

    return `
        <div style="width:${width};font-family:sans-serif;font-size:12px;padding:40px;background:white;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #f97316;padding-bottom:16px;margin-bottom:16px;">
                <div>
                    <div style="font-weight:bold;font-size:18px;color:#f97316;text-transform:uppercase;">${storeName}</div>
                    <div style="font-size:11px;color:#64748b;">${storeAddress}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:20px;font-weight:bold;color:#f97316;text-transform:uppercase;">Đơn Trả NCC</div>
                    <div style="font-weight:bold;">${returnNumber}</div>
                    <div>${formattedDate}</div>
                </div>
            </div>
            <div style="background:#fff7ed;padding:12px;border-radius:8px;margin-bottom:16px;">
                <strong>🏭 NCC:</strong> ${supplier.name} ${supplier.phone ? `• 📱 ${supplier.phone}` : ''}
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead><tr style="background:#ffedd5;text-transform:uppercase;font-size:10px;color:#c2410c;">
                    <th style="border-bottom:1px solid #fed7aa;padding:8px;width:32px;">STT</th>
                    <th style="border-bottom:1px solid #fed7aa;padding:8px;text-align:left;">Sản phẩm</th>
                    <th style="border-bottom:1px solid #fed7aa;padding:8px;">SL</th>
                    <th style="border-bottom:1px solid #fed7aa;padding:8px;text-align:right;">T.Tiền</th>
                </tr></thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot><tr style="background:#fed7aa;">
                    <td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">Tổng:</td>
                    <td style="padding:8px;text-align:right;font-weight:bold;color:#c2410c;font-size:16px;">${formatReceiptCurrency(totalAmount)}</td>
                </tr></tfoot>
            </table>
            <div style="text-align:center;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:32px;">
                Người lập: ${createdBy} • ${formattedDate}
            </div>
        </div>
    `;
}

export default SupplierReturnTemplate;
