// =============================================================================
// SHIPPING LABEL TEMPLATE - Shipping/Courier Labels for Orders
// =============================================================================

import React from 'react';
import type { ShippingLabelConfig } from '@/stores/settingsStore';
import { formatVND } from '@/lib/cashReconciliation';
import { generateBarcodeHTML } from '@/lib/printService';

export interface ShippingLabelData {
    orderId: string;
    orderCode: string;

    // Sender Info
    senderName: string;
    senderPhone: string;
    senderAddress: string;

    // Recipient Info
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    recipientProvince?: string;
    recipientDistrict?: string;
    recipientWard?: string;

    // Order Details
    items: Array<{ name: string; quantity: number }>;
    totalItems: number;
    codAmount: number; // Cash on delivery

    // Notes
    note?: string;
    shippingNote?: string;

    // Metadata
    createdAt: string;
    weight?: number; // grams
}

interface ShippingLabelTemplateProps {
    data: ShippingLabelData;
    config: ShippingLabelConfig;
    storeName?: string;
    storeLogo?: string;
}

/**
 * Shipping Label Template Component
 * Renders a shipping label for courier/delivery
 */
export const ShippingLabelTemplate: React.FC<ShippingLabelTemplateProps> = ({
    data,
    config,
    storeName = 'Cửa hàng',
    storeLogo,
}) => {
    // Determine paper dimensions
    const getDimensions = () => {
        switch (config.paperSize) {
            case '100x150': return { width: '100mm', height: '150mm' };
            case '75x100': return { width: '75mm', height: '100mm' };
            case '50x50': return { width: '50mm', height: '50mm' };
            default: return { width: '100mm', height: '150mm' };
        }
    };

    const dimensions = getDimensions();
    const isSmall = config.paperSize === '50x50';

    return (
        <div
            className="bg-white border border-gray-300 text-black font-sans overflow-hidden"
            style={{ width: dimensions.width, height: dimensions.height }}
        >
            {/* Header with Logo & Store */}
            {config.showLogo && !isSmall && (
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
                    {storeLogo ? (
                        <img src={storeLogo} alt="" className="h-6 object-contain" />
                    ) : (
                        <span className="font-bold text-sm">{storeName}</span>
                    )}
                    <span className="text-xs text-gray-500">
                        {new Date(data.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                </div>
            )}

            {/* Order Barcode */}
            {config.showOrderBarcode && (
                <div className="px-3 py-2 text-center border-b border-dashed border-gray-300">
                    <div
                        dangerouslySetInnerHTML={{
                            __html: generateBarcodeHTML(data.orderCode, isSmall ? 20 : 35)
                        }}
                    />
                    <div className="text-xs font-mono tracking-wider mt-1">
                        {data.orderCode}
                    </div>
                </div>
            )}

            {/* Sender Info */}
            {config.showSender && !isSmall && (
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                    <div className="text-[10px] text-gray-500 uppercase">Từ:</div>
                    <div className="text-xs font-medium">{data.senderName}</div>
                    <div className="text-[10px] text-gray-600">{data.senderPhone}</div>
                    <div className="text-[10px] text-gray-600 line-clamp-1">{data.senderAddress}</div>
                </div>
            )}

            {/* Recipient Info - Main section */}
            {config.showRecipient && (
                <div className={`px-3 py-2 ${isSmall ? '' : 'border-b border-gray-200'}`}>
                    <div className="text-[10px] text-gray-500 uppercase">Đến:</div>
                    <div className={`font-bold ${isSmall ? 'text-xs' : 'text-sm'} text-blue-800`}>
                        {data.recipientName}
                    </div>
                    <div className={`font-bold ${isSmall ? 'text-xs' : 'text-sm'} text-green-700`}>
                        {data.recipientPhone}
                    </div>
                    {!isSmall && (
                        <div className="text-xs text-gray-700 mt-1 leading-tight">
                            {data.recipientAddress}
                            {data.recipientWard && `, ${data.recipientWard}`}
                            {data.recipientDistrict && `, ${data.recipientDistrict}`}
                            {data.recipientProvince && `, ${data.recipientProvince}`}
                        </div>
                    )}
                </div>
            )}

            {/* Items */}
            {config.showItems && !isSmall && data.items.length > 0 && (
                <div className="px-3 py-2 border-b border-gray-200">
                    <div className="text-[10px] text-gray-500 uppercase mb-1">Hàng hóa:</div>
                    <div className="text-xs space-y-0.5">
                        {data.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                                <span className="truncate mr-2">{item.name}</span>
                                <span className="font-medium">x{item.quantity}</span>
                            </div>
                        ))}
                        {data.items.length > 3 && (
                            <div className="text-gray-500 italic">
                                +{data.items.length - 3} sản phẩm khác
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* COD Amount */}
            {config.showCod && data.codAmount > 0 && (
                <div className={`px-3 py-2 bg-yellow-50 border-b border-yellow-200 ${isSmall ? 'text-center' : ''}`}>
                    <div className="text-[10px] text-yellow-700 uppercase">Thu hộ (COD):</div>
                    <div className={`font-bold text-red-600 ${isSmall ? 'text-sm' : 'text-lg'}`}>
                        {formatVND(data.codAmount)}
                    </div>
                </div>
            )}

            {/* Notes */}
            {config.showNote && (data.note || data.shippingNote || config.customNote) && !isSmall && (
                <div className="px-3 py-2 bg-orange-50">
                    <div className="text-[10px] text-orange-700 uppercase">Ghi chú:</div>
                    <div className="text-xs text-orange-800 font-medium">
                        {data.shippingNote || data.note || config.customNote}
                    </div>
                </div>
            )}

            {/* Weight & Total Items (footer) */}
            {!isSmall && (
                <div className="px-3 py-1 bg-gray-100 text-[10px] text-gray-500 flex justify-between mt-auto">
                    <span>Tổng: {data.totalItems} SP</span>
                    {data.weight && <span>KL: {data.weight}g</span>}
                </div>
            )}
        </div>
    );
};

/**
 * Generate HTML string for printing shipping labels
 */
export function generateShippingLabelHTML(
    data: ShippingLabelData,
    config: ShippingLabelConfig,
    storeName: string,
    storeLogo?: string
): string {
    const getDimensions = () => {
        switch (config.paperSize) {
            case '100x150': return { width: '100mm', height: '150mm' };
            case '75x100': return { width: '75mm', height: '100mm' };
            case '50x50': return { width: '50mm', height: '50mm' };
            default: return { width: '100mm', height: '150mm' };
        }
    };

    const dimensions = getDimensions();
    const isSmall = config.paperSize === '50x50';

    let html = `<div style="width: ${dimensions.width}; height: ${dimensions.height}; border: 1px solid #d1d5db; font-family: sans-serif; font-size: 12px; overflow: hidden; background: white;">`;

    // Header
    if (config.showLogo && !isSmall) {
        html += `<div style="display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; background: #f9fafb;">
            <span style="font-weight: bold;">${storeLogo ? `<img src="${storeLogo}" style="height: 24px;" />` : storeName}</span>
            <span style="font-size: 10px; color: #6b7280;">${new Date(data.createdAt).toLocaleDateString('vi-VN')}</span>
        </div>`;
    }

    // Barcode
    if (config.showOrderBarcode) {
        html += `<div style="padding: 8px; text-align: center; border-bottom: 1px dashed #d1d5db;">
            ${generateBarcodeHTML(data.orderCode, isSmall ? 20 : 35)}
            <div style="font-family: monospace; font-size: 11px; margin-top: 4px;">${data.orderCode}</div>
        </div>`;
    }

    // Sender
    if (config.showSender && !isSmall) {
        html += `<div style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; background: #f9fafb;">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase;">Từ:</div>
            <div style="font-weight: 500;">${data.senderName}</div>
            <div style="font-size: 10px; color: #4b5563;">${data.senderPhone}</div>
        </div>`;
    }

    // Recipient
    if (config.showRecipient) {
        html += `<div style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-size: 10px; color: #6b7280; text-transform: uppercase;">Đến:</div>
            <div style="font-weight: bold; color: #1e40af;">${data.recipientName}</div>
            <div style="font-weight: bold; color: #15803d;">${data.recipientPhone}</div>
            ${!isSmall ? `<div style="font-size: 11px; color: #374151; margin-top: 4px;">${data.recipientAddress}</div>` : ''}
        </div>`;
    }

    // COD
    if (config.showCod && data.codAmount > 0) {
        html += `<div style="padding: 8px 12px; background: #fef9c3; border-bottom: 1px solid #fde047;">
            <div style="font-size: 10px; color: #a16207; text-transform: uppercase;">Thu hộ (COD):</div>
            <div style="font-weight: bold; color: #dc2626; font-size: ${isSmall ? '14px' : '18px'};">${new Intl.NumberFormat('vi-VN').format(data.codAmount)}đ</div>
        </div>`;
    }

    // Note
    if (config.showNote && (data.note || config.customNote) && !isSmall) {
        html += `<div style="padding: 8px 12px; background: #fff7ed;">
            <div style="font-size: 10px; color: #c2410c; text-transform: uppercase;">Ghi chú:</div>
            <div style="font-size: 11px; color: #9a3412; font-weight: 500;">${data.shippingNote || data.note || config.customNote}</div>
        </div>`;
    }

    html += '</div>';

    return html;
}

export default ShippingLabelTemplate;
