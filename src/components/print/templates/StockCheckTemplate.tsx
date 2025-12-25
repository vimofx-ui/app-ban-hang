// =============================================================================
// STOCK CHECK TEMPLATE - Phiếu kiểm kho
// =============================================================================

import React from 'react';
import type { StockCheckConfig } from '@/stores/settingsStore';
import { formatReceiptCurrency } from '@/lib/printService';

export interface StockCheckItem {
    name: string;
    sku?: string;
    unitName: string;
    systemQty: number;
    actualQty: number;
    difference: number;
    value?: number;
}

export interface StockCheckData {
    checkNumber: string;
    date: Date;
    warehouseName?: string;
    items: StockCheckItem[];
    totalDifference: {
        shortage: number;
        surplus: number;
    };
    notes?: string;
    createdBy: string;
    approvedBy?: string;
    storeName: string;
    storeAddress: string;
}

interface StockCheckTemplateProps {
    data: StockCheckData;
    config: StockCheckConfig;
}

export const StockCheckTemplate: React.FC<StockCheckTemplateProps> = ({ data, config }) => {
    const { checkNumber, date, warehouseName, items, totalDifference, notes, createdBy, approvedBy, storeName, storeAddress } = data;

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
                    <h3 className="font-bold uppercase">Phiếu Kiểm Kho</h3>
                    <p className="text-[10px]">Số: {checkNumber}</p>
                    <p className="text-[10px]">{formattedDate}</p>
                </div>
                {warehouseName && <p className="text-[10px] mb-2">Kho: {warehouseName}</p>}
                <table className="w-full mb-2 text-[9px]">
                    <thead>
                        <tr className="border-b border-black">
                            <th className="text-left py-1">Sản phẩm</th>
                            <th className="text-center w-8">HT</th>
                            <th className="text-center w-8">TT</th>
                            <th className="text-right w-10">CL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx} className={item.difference !== 0 ? 'bg-yellow-50' : ''}>
                                <td className="py-1">{item.name}</td>
                                <td className="text-center">{item.systemQty}</td>
                                <td className="text-center">{item.actualQty}</td>
                                <td className={`text-right font-bold ${item.difference < 0 ? 'text-red-600' : item.difference > 0 ? 'text-green-600' : ''}`}>
                                    {item.difference > 0 ? '+' : ''}{item.difference}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {config.showAdjustmentValue && (
                    <div className="border-t border-black pt-1 text-[10px]">
                        {totalDifference.shortage > 0 && <div className="text-red-600">Thiếu: {totalDifference.shortage} SP</div>}
                        {totalDifference.surplus > 0 && <div className="text-green-600">Thừa: {totalDifference.surplus} SP</div>}
                    </div>
                )}
                <div className="text-center text-[10px] mt-2 border-t border-dashed pt-2">
                    <p>Người kiểm: {createdBy}</p>
                </div>
            </div>
        );
    }

    // Large paper A4/A5
    const containerClass = config.paperWidth === 'A4' ? 'w-[210mm] p-10' : 'w-[148mm] p-6';

    return (
        <div className={`${containerClass} bg-white text-slate-800 font-sans text-sm`}>
            <div className="flex justify-between items-start border-b-2 border-orange-500 pb-4 mb-4">
                <div>
                    <h1 className="font-bold text-xl text-orange-600 uppercase">{storeName}</h1>
                    <p className="text-xs text-slate-500">{storeAddress}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-slate-400 uppercase">Phiếu Kiểm Kho</h2>
                    <p className="font-bold mt-1">{checkNumber}</p>
                    <p className="text-xs">{formattedDate}</p>
                </div>
            </div>

            {warehouseName && (
                <div className="bg-orange-50 p-3 rounded-lg mb-4">
                    <span className="font-semibold text-orange-700">📦 Kho kiểm tra:</span> {warehouseName}
                </div>
            )}

            <table className="w-full mb-4 border-collapse text-sm">
                <thead>
                    <tr className="bg-orange-100 text-orange-800 uppercase text-xs">
                        <th className="border-y border-orange-200 p-2 text-left w-10">STT</th>
                        <th className="border-y border-orange-200 p-2 text-left">Sản phẩm</th>
                        <th className="border-y border-orange-200 p-2 text-left w-20">SKU</th>
                        <th className="border-y border-orange-200 p-2 text-center w-16">ĐVT</th>
                        <th className="border-y border-orange-200 p-2 text-center w-16">Hệ thống</th>
                        <th className="border-y border-orange-200 p-2 text-center w-16">Thực tế</th>
                        <th className="border-y border-orange-200 p-2 text-center w-16">Chênh lệch</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={idx} className={`border-b ${item.difference !== 0 ? 'bg-yellow-50' : ''}`}>
                            <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-medium">{item.name}</td>
                            <td className="p-2 text-gray-500 text-xs">{item.sku || '-'}</td>
                            <td className="p-2 text-center">{item.unitName}</td>
                            <td className="p-2 text-center font-semibold">{item.systemQty}</td>
                            <td className="p-2 text-center font-semibold">{item.actualQty}</td>
                            <td className={`p-2 text-center font-bold ${item.difference < 0 ? 'text-red-600' : item.difference > 0 ? 'text-green-600' : ''}`}>
                                {item.difference > 0 ? '+' : ''}{item.difference}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {config.showAdjustmentValue && (
                <div className="flex justify-end mb-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Tổng hợp chênh lệch:</h4>
                        <div className="flex gap-6">
                            {totalDifference.shortage > 0 && (
                                <div className="text-red-600">
                                    <span className="text-2xl font-bold">-{totalDifference.shortage}</span>
                                    <span className="text-xs block">Thiếu</span>
                                </div>
                            )}
                            {totalDifference.surplus > 0 && (
                                <div className="text-green-600">
                                    <span className="text-2xl font-bold">+{totalDifference.surplus}</span>
                                    <span className="text-xs block">Thừa</span>
                                </div>
                            )}
                        </div>
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
                    <p className="font-bold text-xs uppercase">Người kiểm kho</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-medium">{createdBy}</p>
                </div>
                {approvedBy && (
                    <div>
                        <p className="font-bold text-xs uppercase">Quản lý kho</p>
                        <p className="text-[10px] italic text-gray-500">(Ký, họ tên)</p>
                        <div className="h-16"></div>
                        <p className="font-medium">{approvedBy}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export function generateStockCheckHTML(data: StockCheckData, config: StockCheckConfig): string {
    const { checkNumber, date, warehouseName, items, totalDifference, createdBy, storeName, storeAddress } = data;
    const formattedDate = date.toLocaleDateString('vi-VN');
    const width = config.paperWidth === 'A4' ? '210mm' : config.paperWidth === 'A5' ? '148mm' : config.paperWidth;

    let itemsHtml = items.map((item, idx) => `
        <tr style="border-bottom:1px solid #f0f0f0;${item.difference !== 0 ? 'background:#fefce8;' : ''}">
            <td style="padding:8px;text-align:center;color:#666;">${idx + 1}</td>
            <td style="padding:8px;font-weight:500;">${item.name}</td>
            <td style="padding:8px;text-align:center;">${item.unitName}</td>
            <td style="padding:8px;text-align:center;font-weight:600;">${item.systemQty}</td>
            <td style="padding:8px;text-align:center;font-weight:600;">${item.actualQty}</td>
            <td style="padding:8px;text-align:center;font-weight:bold;color:${item.difference < 0 ? '#dc2626' : item.difference > 0 ? '#16a34a' : '#000'};">
                ${item.difference > 0 ? '+' : ''}${item.difference}
            </td>
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
                    <div style="font-size:20px;font-weight:bold;color:#9ca3af;text-transform:uppercase;">Phiếu Kiểm Kho</div>
                    <div style="font-weight:bold;">${checkNumber}</div>
                    <div>${formattedDate}</div>
                </div>
            </div>
            ${warehouseName ? `<div style="background:#fff7ed;padding:12px;border-radius:8px;margin-bottom:16px;"><strong>📦 Kho:</strong> ${warehouseName}</div>` : ''}
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead><tr style="background:#ffedd5;text-transform:uppercase;font-size:10px;color:#c2410c;">
                    <th style="border-bottom:1px solid #fed7aa;padding:8px;width:32px;">STT</th>
                    <th style="border-bottom:1px solid #fed7aa;padding:8px;text-align:left;">Sản phẩm</th>
                    <th style="border-bottom:1px solid #fed7aa;padding:8px;">ĐVT</th>
                    <th style="border-bottom:1px solid #fed7aa;padding:8px;">Hệ thống</th>
                    <th style="border-bottom:1px solid #fed7aa;padding:8px;">Thực tế</th>
                    <th style="border-bottom:1px solid #fed7aa;padding:8px;">Chênh lệch</th>
                </tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div style="text-align:center;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:32px;">
                Người kiểm: ${createdBy} • ${formattedDate}
            </div>
        </div>
    `;
}

export default StockCheckTemplate;
