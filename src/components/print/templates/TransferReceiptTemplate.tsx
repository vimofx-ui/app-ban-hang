// =============================================================================
// TRANSFER RECEIPT TEMPLATE - Phiếu chuyển kho
// =============================================================================

import React from 'react';
import type { TransferReceiptConfig } from '@/stores/settingsStore';
import { formatReceiptCurrency } from '@/lib/printService';

export interface TransferItem {
    name: string;
    sku?: string;
    quantity: number;
    unitName: string;
    value?: number;
}

export interface TransferReceiptData {
    transferNumber: string;
    date: Date;
    fromWarehouse: string;
    toWarehouse: string;
    items: TransferItem[];
    totalItems: number;
    totalValue?: number;
    notes?: string;
    createdBy: string;
    approvedBy?: string;
    storeName: string;
    storeAddress: string;
}

interface TransferReceiptTemplateProps {
    data: TransferReceiptData;
    config: TransferReceiptConfig;
}

export const TransferReceiptTemplate: React.FC<TransferReceiptTemplateProps> = ({ data, config }) => {
    const { transferNumber, date, fromWarehouse, toWarehouse, items, totalItems, totalValue, notes, createdBy, approvedBy, storeName, storeAddress } = data;

    const formattedDate = date.toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
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
                    <h3 className="font-bold uppercase text-purple-600">Phiếu Chuyển Kho</h3>
                    <p className="text-[10px]">Số: {transferNumber}</p>
                </div>
                <div className="border-b border-dashed pb-1 mb-2 text-[10px]">
                    <p>📤 Từ: <strong>{fromWarehouse}</strong></p>
                    <p>📥 Đến: <strong>{toWarehouse}</strong></p>
                </div>
                <table className="w-full mb-2 text-[10px]">
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td className="py-1">{item.name}</td>
                                <td className="text-right font-bold">{item.quantity} {item.unitName}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="border-t border-black pt-1 font-bold flex justify-between">
                    <span>Tổng SP:</span>
                    <span>{totalItems}</span>
                </div>
                <div className="text-center text-[10px] mt-2 pt-2 border-t border-dashed">
                    <p>Người chuyển: {createdBy}</p>
                    <p>{formattedDate}</p>
                </div>
            </div>
        );
    }

    // Large paper
    const containerClass = config.paperWidth === 'A4' ? 'w-[210mm] p-10' : 'w-[148mm] p-6';

    return (
        <div className={`${containerClass} bg-white text-slate-800 font-sans text-sm`}>
            <div className="flex justify-between items-start border-b-2 border-purple-500 pb-4 mb-4">
                <div>
                    <h1 className="font-bold text-xl text-purple-600 uppercase">{storeName}</h1>
                    <p className="text-xs text-slate-500">{storeAddress}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-purple-600 uppercase">Phiếu Chuyển Kho</h2>
                    <p className="font-bold mt-1">{transferNumber}</p>
                    <p className="text-xs">{formattedDate}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                {config.showFromWarehouse && (
                    <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
                        <h3 className="font-bold text-red-700 uppercase text-xs mb-2">📤 Kho Xuất</h3>
                        <p className="font-semibold text-lg">{fromWarehouse}</p>
                    </div>
                )}
                {config.showToWarehouse && (
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                        <h3 className="font-bold text-green-700 uppercase text-xs mb-2">📥 Kho Nhận</h3>
                        <p className="font-semibold text-lg">{toWarehouse}</p>
                    </div>
                )}
            </div>

            <table className="w-full mb-4 border-collapse">
                <thead>
                    <tr className="bg-purple-50 text-purple-800 uppercase text-xs">
                        <th className="border-y border-purple-200 p-2 text-left w-10">STT</th>
                        <th className="border-y border-purple-200 p-2 text-left">Sản phẩm</th>
                        <th className="border-y border-purple-200 p-2 text-left w-24">SKU</th>
                        <th className="border-y border-purple-200 p-2 text-center w-16">ĐVT</th>
                        <th className="border-y border-purple-200 p-2 text-center w-16">Số lượng</th>
                        {totalValue && <th className="border-y border-purple-200 p-2 text-right">Giá trị</th>}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={idx} className="border-b">
                            <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-medium">{item.name}</td>
                            <td className="p-2 text-gray-500 text-xs">{item.sku || '-'}</td>
                            <td className="p-2 text-center">{item.unitName}</td>
                            <td className="p-2 text-center font-bold">{item.quantity}</td>
                            {totalValue && <td className="p-2 text-right">{item.value ? formatReceiptCurrency(item.value) : '-'}</td>}
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-purple-100">
                        <td colSpan={4} className="p-2 text-right font-bold uppercase">Tổng cộng</td>
                        <td className="p-2 text-center font-bold text-purple-600 text-lg">{totalItems}</td>
                        {totalValue && <td className="p-2 text-right font-bold text-purple-600">{formatReceiptCurrency(totalValue)}</td>}
                    </tr>
                </tfoot>
            </table>

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
                    <p className="font-bold text-xs uppercase">Kho xuất</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                </div>
                <div>
                    <p className="font-bold text-xs uppercase">Kho nhận</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                </div>
            </div>
        </div>
    );
};

export function generateTransferReceiptHTML(data: TransferReceiptData, config: TransferReceiptConfig): string {
    const { transferNumber, date, fromWarehouse, toWarehouse, items, totalItems, createdBy, storeName, storeAddress } = data;
    const formattedDate = date.toLocaleDateString('vi-VN');
    const width = config.paperWidth === 'A4' ? '210mm' : config.paperWidth === 'A5' ? '148mm' : config.paperWidth;

    let itemsHtml = items.map((item, idx) => `
        <tr style="border-bottom:1px solid #e9d5ff;">
            <td style="padding:8px;text-align:center;color:#666;">${idx + 1}</td>
            <td style="padding:8px;font-weight:500;">${item.name}</td>
            <td style="padding:8px;text-align:center;font-weight:bold;">${item.quantity} ${item.unitName}</td>
        </tr>
    `).join('');

    return `
        <div style="width:${width};font-family:sans-serif;font-size:12px;padding:40px;background:white;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #a855f7;padding-bottom:16px;margin-bottom:16px;">
                <div>
                    <div style="font-weight:bold;font-size:18px;color:#a855f7;text-transform:uppercase;">${storeName}</div>
                    <div style="font-size:11px;color:#64748b;">${storeAddress}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:20px;font-weight:bold;color:#a855f7;text-transform:uppercase;">Phiếu Chuyển Kho</div>
                    <div style="font-weight:bold;">${transferNumber}</div>
                    <div>${formattedDate}</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                <div style="background:#fef2f2;padding:12px;border-radius:8px;border-left:4px solid #f87171;">
                    <strong>📤 Kho xuất:</strong> ${fromWarehouse}
                </div>
                <div style="background:#f0fdf4;padding:12px;border-radius:8px;border-left:4px solid #4ade80;">
                    <strong>📥 Kho nhận:</strong> ${toWarehouse}
                </div>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead><tr style="background:#faf5ff;text-transform:uppercase;font-size:10px;color:#7e22ce;">
                    <th style="border-bottom:1px solid #e9d5ff;padding:8px;width:32px;">STT</th>
                    <th style="border-bottom:1px solid #e9d5ff;padding:8px;text-align:left;">Sản phẩm</th>
                    <th style="border-bottom:1px solid #e9d5ff;padding:8px;">Số lượng</th>
                </tr></thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot><tr style="background:#f3e8ff;">
                    <td colspan="2" style="padding:8px;text-align:right;font-weight:bold;">Tổng:</td>
                    <td style="padding:8px;text-align:center;font-weight:bold;color:#7e22ce;font-size:16px;">${totalItems}</td>
                </tr></tfoot>
            </table>
            <div style="text-align:center;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:32px;">
                Người chuyển: ${createdBy} • ${formattedDate}
            </div>
        </div>
    `;
}

export default TransferReceiptTemplate;
