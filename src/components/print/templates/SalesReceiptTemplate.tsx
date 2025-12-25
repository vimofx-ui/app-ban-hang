// =============================================================================
// SALES RECEIPT TEMPLATE - POS Invoice Template
// =============================================================================

import React from 'react';
import type { SalesReceiptConfig } from '@/stores/settingsStore';
import type { Order } from '@/types';
import { formatReceiptCurrency, generateBarcodeHTML } from '@/lib/printService';

export interface SalesReceiptData {
    order: Order;
    storeName: string;
    storeAddress: string;
    storePhone: string;
    storeLogo?: string;
    logoSize?: number; // Logo width in pixels
    footerText: string;
    noteText?: string;
    cashierName: string;
    customerName?: string;
    customerPhone?: string;
    pointsEarned?: number;
    pointsTotal?: number;
    title?: string;
}

interface SalesReceiptTemplateProps {
    data: SalesReceiptData;
    config: SalesReceiptConfig;
}

/**
 * Sales Receipt Template Component
 * Supports K57, K80, A5, A4 paper sizes
 */
export const SalesReceiptTemplate: React.FC<SalesReceiptTemplateProps> = ({ data, config }) => {
    const { order, storeName, storeAddress, storePhone, storeLogo, logoSize, footerText, noteText, cashierName, title } = data;
    const { customerName, customerPhone, pointsEarned, pointsTotal } = data;

    const isSmallPaper = config.paperWidth === '58mm' || config.paperWidth === '80mm';
    const isK57 = config.paperWidth === '58mm';

    // Calculate payment info
    const totalAmount = order.total_amount || 0;
    const discount = order.discount_amount || 0;
    const finalTotal = totalAmount - discount;

    // Format date
    const orderDate = new Date(order.created_at || new Date()).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Logo size (default 60px for small paper, 80px for large)
    const logoSizePx = logoSize || (isSmallPaper ? 60 : 80);

    // Small paper template (K57/K80)
    if (isSmallPaper) {
        const widthClass = isK57 ? 'w-[58mm]' : 'w-[80mm]';
        const fontSize = isK57 ? 'text-[10px]' : 'text-xs';

        // Determine flex alignment based on logoPosition
        const logoPositionClass = config.logoPosition === 'center'
            ? 'flex-col items-center text-center'
            : config.logoPosition === 'right'
                ? 'flex-row-reverse items-start'
                : 'flex-row items-start';

        return (
            <div className={`${widthClass} ${fontSize} bg-white px-2 py-3 text-black leading-tight font-mono`}>
                {/* Header */}
                <div className={`mb-2 border-b border-black pb-2 flex ${logoPositionClass} gap-2`}>
                    {config.showLogo && storeLogo && (
                        <img
                            src={storeLogo}
                            alt="Logo"
                            style={{ width: `${logoSizePx}px`, height: 'auto' }}
                            className="object-contain grayscale flex-shrink-0"
                        />
                    )}
                    <div className={config.logoPosition === 'center' ? '' : 'flex-1'}>
                        <h2 className="font-bold text-sm uppercase leading-tight mb-1">{storeName}</h2>
                        <p className="text-[10px]">{storeAddress}</p>
                        <p className="text-[10px]">ĐT: {storePhone}</p>
                    </div>
                </div>

                {/* Title (for Provisional/Order type) */}
                {title && (
                    <div className="text-center font-bold text-lg uppercase mb-2">
                        {title}
                    </div>
                )}

                {/* Order Info */}
                <div className="mb-2 pb-1 border-b border-dashed border-black">
                    <div className="flex justify-between">
                        <span className="font-bold">Mã ĐH:</span>
                        <span className="font-bold">{order.order_number || order.id?.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Ngày:</span>
                        <span>{orderDate}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Thu ngân:</span>
                        <span>{cashierName}</span>
                    </div>
                </div>

                {/* Customer Info */}
                {config.showCustomerInfo && customerName && (
                    <div className="mb-2 pb-1 border-b border-dashed border-black">
                        <div className="font-bold">Khách: {customerName}</div>
                        {customerPhone && <div>ĐT: {customerPhone}</div>}
                    </div>
                )}

                {/* Items Table */}
                <table className="w-full mb-1">
                    <thead>
                        <tr className="border-b border-black text-[9px]">
                            <th className="text-left py-1">Tên hàng</th>
                            <th className="text-center w-6">SL</th>
                            <th className="text-right">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody className="text-[10px]">
                        {order.order_items?.map((item, idx) => (
                            <React.Fragment key={idx}>
                                <tr>
                                    <td colSpan={3} className="pt-1 font-medium">
                                        {item.product?.name || 'Sản phẩm'}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="pb-1 pl-2 text-gray-600 text-[9px]">
                                        {formatReceiptCurrency(item.unit_price || 0)}
                                    </td>
                                    <td className="pb-1 text-center align-top">{item.quantity}</td>
                                    <td className="pb-1 text-right align-top font-bold">
                                        {formatReceiptCurrency((item.unit_price || 0) * item.quantity)}
                                    </td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="border-t border-black pt-1 mb-1">
                    <div className="flex justify-between">
                        <span>Tổng tiền hàng:</span>
                        <span>{formatReceiptCurrency(totalAmount)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-red-600">
                            <span>Giảm giá:</span>
                            <span>-{formatReceiptCurrency(discount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-sm mt-1">
                        <span>THANH TOÁN:</span>
                        <span>{formatReceiptCurrency(finalTotal)}</span>
                    </div>
                </div>

                {/* Payment Details */}
                {config.showPaymentDetails && (
                    <div className="border-t border-dotted border-black mt-1 pt-1 text-[10px]">
                        <div className="flex justify-between">
                            <span>Hình thức TT:</span>
                            <span className="font-bold">{order.payment_method || 'Tiền mặt'}</span>
                        </div>
                        {order.cash_received && order.cash_received > finalTotal && (
                            <>
                                <div className="flex justify-between">
                                    <span>Tiền khách đưa:</span>
                                    <span>{formatReceiptCurrency(order.cash_received)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Tiền thừa:</span>
                                    <span>{formatReceiptCurrency(order.cash_received - finalTotal)}</span>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Points */}
                {(config.showPointsEarned || config.showPointsTotal) && (pointsEarned || pointsTotal) && (
                    <div className="border-t border-dashed border-black mt-2 pt-1 text-center bg-gray-50 p-1 rounded">
                        <p className="font-bold uppercase text-[9px] mb-1">Tích điểm thành viên</p>
                        {config.showPointsEarned && pointsEarned !== undefined && (
                            <div className="flex justify-between text-[10px]">
                                <span>Điểm đơn này:</span>
                                <span className="font-bold">+{pointsEarned}</span>
                            </div>
                        )}
                        {config.showPointsTotal && pointsTotal !== undefined && (
                            <div className="flex justify-between text-[10px]">
                                <span>Tổng tích lũy:</span>
                                <span className="font-bold">{pointsTotal.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Barcode */}
                {config.showBarcode && (
                    <div
                        className="my-2"
                        dangerouslySetInnerHTML={{
                            __html: generateBarcodeHTML(order.order_number || order.id?.slice(0, 8) || 'N/A')
                        }}
                    />
                )}

                {/* Footer */}
                <div className="text-center mt-3">
                    <p className="italic text-[10px] whitespace-pre-line">{footerText}</p>
                    {noteText && <p className="text-[9px] text-gray-500 mt-1">{noteText}</p>}
                </div>
            </div>
        );
    }

    // Large paper template (A5/A4)
    const isA4 = config.paperWidth === 'A4';
    const containerClass = isA4
        ? 'w-[210mm] min-h-[297mm] p-10 text-sm'
        : 'w-[148mm] min-h-[210mm] p-6 text-xs';

    return (
        <div className={`${containerClass} bg-white text-slate-800 font-sans relative flex flex-col`}>
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-blue-800 pb-4 mb-4">
                <div className="w-2/3 pr-4 flex gap-4">
                    {config.showLogo && storeLogo && (
                        <img src={storeLogo} alt="Logo" className="h-16 w-16 object-contain" />
                    )}
                    <div>
                        <h1 className="font-bold text-xl text-blue-900 uppercase leading-tight">{storeName}</h1>
                        <p className="text-xs text-slate-600 mt-1">{storeAddress}</p>
                        <p className="text-xs text-slate-600">Tel: {storePhone}</p>
                    </div>
                </div>
                <div className="text-right w-1/3">
                    <h2 className="text-2xl font-bold text-slate-400 uppercase">Hóa đơn</h2>
                    <p className="text-xs font-bold mt-1">{order.order_number || order.id?.slice(0, 8)}</p>
                    <p className="text-xs">{orderDate}</p>
                </div>
            </div>

            {/* Customer & Order Info */}
            <div className={`grid gap-4 mb-6 ${config.showCustomerInfo ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {config.showCustomerInfo && customerName && (
                    <div>
                        <h3 className="font-bold text-gray-500 uppercase text-xs mb-1">Khách hàng</h3>
                        <p className="font-bold">{customerName}</p>
                        {customerPhone && <p>SĐT: {customerPhone}</p>}
                    </div>
                )}
                <div className={!config.showCustomerInfo || !customerName ? 'col-span-2' : ''}>
                    <h3 className="font-bold text-gray-500 uppercase text-xs mb-1">Thông tin đơn</h3>
                    <p>Thu ngân: {cashierName}</p>
                    <p>Ngày tạo: {orderDate}</p>
                </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-4 border-collapse flex-1 h-auto">
                <thead>
                    <tr className="bg-gray-100 text-gray-700 uppercase text-xs">
                        <th className="border-y p-2 text-left w-10">STT</th>
                        <th className="border-y p-2 text-left">Tên hàng hóa</th>
                        <th className="border-y p-2 text-center w-16">ĐVT</th>
                        <th className="border-y p-2 text-center w-16">SL</th>
                        <th className="border-y p-2 text-right">Đơn giá</th>
                        <th className="border-y p-2 text-right">Thành tiền</th>
                    </tr>
                </thead>
                <tbody>
                    {order.order_items?.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-50">
                            <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-medium">{item.product?.name || 'Sản phẩm'}</td>
                            <td className="p-2 text-center">{item.unit?.unit_name || 'Cái'}</td>
                            <td className="p-2 text-center">{item.quantity}</td>
                            <td className="p-2 text-right">{formatReceiptCurrency(item.unit_price || 0)}</td>
                            <td className="p-2 text-right font-bold">
                                {formatReceiptCurrency((item.unit_price || 0) * item.quantity)}
                            </td>
                        </tr>
                    ))}
                    {isA4 && <tr><td colSpan={6} className="h-20"></td></tr>}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-50">
                        <td colSpan={5} className="p-2 text-right font-bold uppercase">Tổng cộng tiền hàng</td>
                        <td className="p-2 text-right font-bold">{formatReceiptCurrency(totalAmount)}</td>
                    </tr>
                    {discount > 0 && (
                        <tr>
                            <td colSpan={5} className="p-2 text-right">Giảm giá</td>
                            <td className="p-2 text-right text-red-600">-{formatReceiptCurrency(discount)}</td>
                        </tr>
                    )}
                    <tr className="bg-blue-50">
                        <td colSpan={5} className="p-2 text-right font-bold uppercase text-blue-900">Thành tiền</td>
                        <td className="p-2 text-right font-bold text-blue-900 text-lg">{formatReceiptCurrency(finalTotal)}</td>
                    </tr>
                </tfoot>
            </table>

            {/* Payment Details */}
            {config.showPaymentDetails && (
                <div className="mt-4 border-t pt-2 w-1/2 ml-auto text-sm">
                    <div className="flex justify-between py-1">
                        <span>Hình thức thanh toán:</span>
                        <span className="font-semibold">{order.payment_method || 'Tiền mặt'}</span>
                    </div>
                    {order.cash_received && (
                        <div className="flex justify-between py-1">
                            <span>Tiền khách đưa:</span>
                            <span>{formatReceiptCurrency(order.cash_received)}</span>
                        </div>
                    )}
                    <div className="flex justify-between py-1 font-bold text-blue-900">
                        <span>Cần thanh toán:</span>
                        <span>{formatReceiptCurrency(finalTotal)}</span>
                    </div>
                </div>
            )}

            {/* Points */}
            {(config.showPointsEarned || config.showPointsTotal) && (pointsEarned || pointsTotal) && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">⭐</span>
                        <span className="font-bold text-blue-900">Thông tin thành viên</span>
                    </div>
                    <div className="text-right flex gap-6">
                        {config.showPointsTotal && pointsTotal !== undefined && (
                            <p>Tổng điểm: <b className="text-blue-600 text-lg">{pointsTotal.toLocaleString()}</b></p>
                        )}
                        {config.showPointsEarned && pointsEarned !== undefined && (
                            <p className="flex items-center gap-1">
                                Điểm mới:
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">+{pointsEarned}</span>
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Signatures */}
            <div className="flex justify-between mt-12 text-center">
                <div>
                    <p className="font-bold text-xs uppercase">Người mua hàng</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, ghi rõ họ tên)</p>
                </div>
                <div>
                    <p className="font-bold text-xs uppercase">Người bán hàng</p>
                    <p className="text-[10px] italic text-gray-500">(Ký, ghi rõ họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-bold">{cashierName}</p>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-slate-400 text-xs mt-8 pt-4 border-t">
                {footerText}
                {noteText && <p className="text-[10px] text-gray-400 mt-1">{noteText}</p>}
            </div>
        </div>
    );
};

/**
 * Generate HTML string for printing
 */
export function generateSalesReceiptHTML(data: SalesReceiptData, config: SalesReceiptConfig): string {
    // This would render the component to string for printing
    // For now, return a simplified HTML version
    const { order, storeName, storeAddress, storePhone, storeLogo, logoSize, footerText, noteText, cashierName, title } = data;
    const { customerName, customerPhone, pointsEarned, pointsTotal } = data;

    const totalAmount = order.total_amount || 0;
    const discount = order.discount_amount || 0;
    const finalTotal = totalAmount - discount;

    const orderDate = new Date(order.created_at || new Date()).toLocaleString('vi-VN');

    const isSmallPaper = config.paperWidth === '58mm' || config.paperWidth === '80mm';
    const width = config.paperWidth === '58mm' ? '58mm' : config.paperWidth === '80mm' ? '80mm' : '210mm';

    let itemsHtml = '';
    order.order_items?.forEach((item, idx) => {
        const itemTotal = (item.unit_price || 0) * item.quantity;
        if (isSmallPaper) {
            itemsHtml += `
                <tr><td colspan="3" style="padding-top:4px;font-weight:500;">${item.product?.name || 'Sản phẩm'}</td></tr>
                <tr>
                    <td style="padding-left:8px;color:#666;font-size:9px;">${formatReceiptCurrency(item.unit_price || 0)}</td>
                    <td style="text-align:center;">${item.quantity}</td>
                    <td style="text-align:right;font-weight:bold;">${formatReceiptCurrency(itemTotal)}</td>
                </tr>
            `;
        } else {
            itemsHtml += `
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td style="padding:8px;text-align:center;color:#666;">${idx + 1}</td>
                    <td style="padding:8px;font-weight:500;">${item.product?.name || 'Sản phẩm'}</td>
                    <td style="padding:8px;text-align:center;">${item.unit?.unit_name || 'Cái'}</td>
                    <td style="padding:8px;text-align:center;">${item.quantity}</td>
                    <td style="padding:8px;text-align:right;">${formatReceiptCurrency(item.unit_price || 0)}</td>
                    <td style="padding:8px;text-align:right;font-weight:bold;">${formatReceiptCurrency(itemTotal)}</td>
                </tr>
            `;
        }
    });

    // Logo size for HTML (convert to pixels)
    const logoSizePx = logoSize || (isSmallPaper ? 60 : 80);

    if (isSmallPaper) {
        // Determine flex styles based on logoPosition to match React component
        let headerStyle = 'display:flex;border-bottom:1px solid #000;padding-bottom:8px;margin-bottom:8px;gap:8px;';
        let logoImgStyle = `width:${logoSizePx}px;height:auto;object-fit:contain;`;
        let textContainerStyle = '';

        if (config.logoPosition === 'center') {
            headerStyle += 'flex-direction:column;align-items:center;text-align:center;';
            logoImgStyle += 'margin-bottom:4px;';
        } else if (config.logoPosition === 'right') {
            headerStyle += 'flex-direction:row-reverse;align-items:flex-start;text-align:right;';
            textContainerStyle = 'flex:1;';
        } else {
            // Left (default)
            headerStyle += 'flex-direction:row;align-items:flex-start;text-align:left;';
            textContainerStyle = 'flex:1;';
        }

        return `
            <div style="width:${width};font-family:'Courier New',monospace;font-size:${config.paperWidth === '58mm' ? '10px' : '12px'};padding:8px;line-height:1.4;">
                <div style="${headerStyle}">
                    ${config.showLogo && storeLogo ? `<img src="${storeLogo}" style="${logoImgStyle}" />` : ''}
                    <div style="${textContainerStyle}">
                        <div style="font-weight:bold;font-size:14px;text-transform:uppercase;line-height:1.2;margin-bottom:4px;">${storeName}</div>
                        <div style="font-size:${config.paperWidth === '58mm' ? '9px' : '10px'};">${storeAddress}</div>
                        <div style="font-size:${config.paperWidth === '58mm' ? '9px' : '10px'};">ĐT: ${storePhone}</div>
                    </div>
                </div>
                
                <div style="border-bottom:1px dashed #000;padding-bottom:4px;margin-bottom:4px;">
                    ${title ? `<div style="text-align:center;font-weight:bold;font-size:16px;text-transform:uppercase;margin-bottom:8px;">${title}</div>` : ''}
                    <div style="display:flex;justify-content:space-between;"><span style="font-weight:bold;">Mã ĐH:</span><span style="font-weight:bold;">${order.order_number || order.id?.slice(0, 8)}</span></div>
                    <div style="display:flex;justify-content:space-between;"><span>Ngày:</span><span>${orderDate}</span></div>
                    <div style="display:flex;justify-content:space-between;"><span>Thu ngân:</span><span>${cashierName}</span></div>
                </div>
                
                ${config.showCustomerInfo && customerName ? `
                    <div style="border-bottom:1px dashed #000;padding-bottom:4px;margin-bottom:4px;">
                        <div style="font-weight:bold;">Khách: ${customerName}</div>
                        ${customerPhone ? `<div>ĐT: ${customerPhone}</div>` : ''}
                    </div>
                ` : ''}
                
                <table style="width:100%;">
                    <thead>
                        <tr style="border-bottom:1px solid #000;font-size:9px;">
                            <th style="text-align:left;padding:4px 0;">Tên hàng</th>
                            <th style="width:24px;text-align:center;">SL</th>
                            <th style="text-align:right;">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                
                <div style="border-top:1px solid #000;padding-top:4px;margin-top:4px;">
                    <div style="display:flex;justify-content:space-between;"><span>Tổng tiền hàng:</span><span>${formatReceiptCurrency(totalAmount)}</span></div>
                    ${discount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Giảm giá:</span><span>-${formatReceiptCurrency(discount)}</span></div>` : ''}
                    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:4px;"><span>THANH TOÁN:</span><span>${formatReceiptCurrency(finalTotal)}</span></div>
                </div>
                
                ${config.showPaymentDetails ? `
                    <div style="border-top:1px dotted #000;margin-top:4px;padding-top:4px;">
                        <div style="display:flex;justify-content:space-between;"><span>Hình thức TT:</span><span style="font-weight:bold;">${order.payment_method || 'Tiền mặt'}</span></div>
                    </div>
                ` : ''}
                
                ${(config.showPointsEarned || config.showPointsTotal) && (pointsEarned || pointsTotal) ? `
                    <div style="border-top:1px dashed #000;margin-top:8px;padding-top:4px;text-align:center;background:#f9f9f9;padding:4px;">
                        <div style="font-weight:bold;text-transform:uppercase;font-size:9px;">Tích điểm thành viên</div>
                        ${config.showPointsEarned && pointsEarned !== undefined ? `<div style="display:flex;justify-content:space-between;"><span>Điểm đơn này:</span><span style="font-weight:bold;">+${pointsEarned}</span></div>` : ''}
                        ${config.showPointsTotal && pointsTotal !== undefined ? `<div style="display:flex;justify-content:space-between;"><span>Tổng tích lũy:</span><span style="font-weight:bold;">${pointsTotal.toLocaleString()}</span></div>` : ''}
                    </div>
                ` : ''}
                
                ${config.showBarcode ? generateBarcodeHTML(order.order_number || order.id?.slice(0, 8) || 'N/A') : ''}
                
                <div style="text-align:center;margin-top:12px;font-style:italic;">${footerText}</div>
                ${noteText ? `<div style="text-align:center;font-size:9px;color:#666;margin-top:4px;">${noteText}</div>` : ''}
            </div>
        `;
    }

    // A4/A5 template
    return `
        <div style="width:${width};font-family:sans-serif;font-size:12px;padding:40px;line-height:1.6;">
            <div style="display:flex;justify-content:space-between;border-bottom:2px solid #1e40af;padding-bottom:16px;margin-bottom:16px;">
                <div>
                    <div style="font-weight:bold;font-size:20px;color:#1e40af;text-transform:uppercase;">${storeName}</div>
                    <div style="color:#666;margin-top:4px;">${storeAddress}</div>
                    <div style="color:#666;">Tel: ${storePhone}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:24px;font-weight:bold;color:#9ca3af;text-transform:uppercase;">Hóa đơn</div>
                    <div style="font-weight:bold;margin-top:4px;">${order.order_number || order.id?.slice(0, 8)}</div>
                    <div>${orderDate}</div>
                </div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
                ${config.showCustomerInfo && customerName ? `
                    <div>
                        <div style="font-weight:bold;color:#666;text-transform:uppercase;font-size:10px;margin-bottom:4px;">Khách hàng</div>
                        <div style="font-weight:bold;">${customerName}</div>
                        ${customerPhone ? `<div>SĐT: ${customerPhone}</div>` : ''}
                    </div>
                ` : ''}
                <div>
                    <div style="font-weight:bold;color:#666;text-transform:uppercase;font-size:10px;margin-bottom:4px;">Thông tin đơn</div>
                    <div>Thu ngân: ${cashierName}</div>
                    <div>Ngày tạo: ${orderDate}</div>
                </div>
            </div>
            
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead>
                    <tr style="background:#f3f4f6;text-transform:uppercase;font-size:11px;">
                        <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;width:40px;">STT</th>
                        <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;">Tên hàng hóa</th>
                        <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:center;width:60px;">ĐVT</th>
                        <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:center;width:60px;">SL</th>
                        <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:right;">Đơn giá</th>
                        <th style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px;text-align:right;">Thành tiền</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr style="background:#f3f4f6;">
                        <td colspan="5" style="padding:8px;text-align:right;font-weight:bold;text-transform:uppercase;">Tổng cộng tiền hàng</td>
                        <td style="padding:8px;text-align:right;font-weight:bold;">${formatReceiptCurrency(totalAmount)}</td>
                    </tr>
                    ${discount > 0 ? `
                        <tr>
                            <td colspan="5" style="padding:8px;text-align:right;">Giảm giá</td>
                            <td style="padding:8px;text-align:right;color:#dc2626;">-${formatReceiptCurrency(discount)}</td>
                        </tr>
                    ` : ''}
                    <tr style="background:#eff6ff;">
                        <td colspan="5" style="padding:8px;text-align:right;font-weight:bold;text-transform:uppercase;color:#1e40af;">Thành tiền</td>
                        <td style="padding:8px;text-align:right;font-weight:bold;color:#1e40af;font-size:18px;">${formatReceiptCurrency(finalTotal)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div style="text-align:center;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:32px;">
                ${footerText}
                ${noteText ? `<div style="font-size:10px;color:#9ca3af;margin-top:4px;">${noteText}</div>` : ''}
            </div>
        </div>
    `;
}

export default SalesReceiptTemplate;
