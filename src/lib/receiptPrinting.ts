// =============================================================================
// RECEIPT PRINTING UTILITY
// =============================================================================

import type { ReceiptSettings } from '@/stores/settingsStore';
import { formatVND } from '@/lib/cashReconciliation';

export interface ReceiptItem {
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export interface ReceiptData {
    orderNumber: string;
    cashierName: string;
    items: ReceiptItem[];
    subtotal: number;
    discount: number;
    pointsEarned: number;
    pointsUsed: number;
    total: number;
    cashReceived: number;
    change: number;
    paymentMethod: string;
    customerName?: string;
    date: Date;
    isPreview?: boolean;
}

/**
 * Generate receipt HTML for printing
 */
export function generateReceiptHTML(data: ReceiptData, settings: ReceiptSettings): string {
    const width = settings.paperWidth === '58mm' ? '58mm' : '80mm';
    const fontSize = settings.paperWidth === '58mm' ? '10px' : '12px';

    const itemsHTML = data.items.map(item => `
        <tr>
            <td style="text-align: left; padding: 2px 0;">${item.name}</td>
            <td style="text-align: center; padding: 2px 0;">${item.quantity}</td>
            <td style="text-align: right; padding: 2px 0;">${formatVND(item.totalPrice)}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Hóa đơn ${data.orderNumber}</title>
    <style>
        @page { 
            size: ${width} auto; 
            margin: 0; 
        }
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        body { 
            font-family: 'Courier New', monospace; 
            font-size: ${fontSize}; 
            width: ${width}; 
            padding: 5mm;
            color: #000;
        }
        .header { text-align: center; margin-bottom: 10px; }
        .logo { max-width: 40mm; max-height: 15mm; margin-bottom: 5px; }
        .store-name { font-size: 14px; font-weight: bold; }
        .store-info { font-size: 9px; color: #666; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .order-info { font-size: 10px; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 9px; border-bottom: 1px solid #000; padding: 3px 0; }
        .totals { margin-top: 8px; }
        .totals tr td { padding: 2px 0; }
        .totals .total-row { font-weight: bold; font-size: 14px; }
        .change-row { background: #f0f0f0; padding: 5px; margin: 5px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 10px; font-size: 9px; color: #666; }
        .preview-badge { 
            background: #ff6b6b; 
            color: white; 
            padding: 3px 8px; 
            text-align: center; 
            margin-bottom: 10px; 
            font-weight: bold;
        }
    </style>
</head>
<body>
    ${data.isPreview ? '<div class="preview-badge">HÓA ĐƠN TẠM TÍNH</div>' : ''}
    
    <div class="header">
        ${settings.storeLogo ? `<img src="${settings.storeLogo}" class="logo" alt="Logo">` : ''}
        <div class="store-name">${settings.storeName}</div>
        <div class="store-info">${settings.storeAddress}</div>
        <div class="store-info">ĐT: ${settings.storePhone}</div>
    </div>
    
    <div class="divider"></div>
    
    <div class="order-info">
        <div><strong>Số HĐ:</strong> ${data.orderNumber}</div>
        <div><strong>Ngày:</strong> ${data.date.toLocaleDateString('vi-VN')} ${data.date.toLocaleTimeString('vi-VN')}</div>
        <div><strong>NV:</strong> ${data.cashierName}</div>
        ${data.customerName ? `<div><strong>KH:</strong> ${data.customerName}</div>` : ''}
    </div>
    
    <div class="divider"></div>
    
    <table>
        <thead>
            <tr>
                <th>Sản phẩm</th>
                <th style="text-align: center;">SL</th>
                <th style="text-align: right;">T.Tiền</th>
            </tr>
        </thead>
        <tbody>
            ${itemsHTML}
        </tbody>
    </table>
    
    <div class="divider"></div>
    
    <table class="totals">
        <tr>
            <td>Tạm tính:</td>
            <td style="text-align: right;">${formatVND(data.subtotal)}</td>
        </tr>
        ${data.discount > 0 ? `
        <tr>
            <td>Giảm giá:</td>
            <td style="text-align: right; color: #e00;">-${formatVND(data.discount)}</td>
        </tr>
        ` : ''}
        ${data.pointsUsed > 0 ? `
        <tr>
            <td>Điểm sử dụng:</td>
            <td style="text-align: right;">-${data.pointsUsed} điểm</td>
        </tr>
        ` : ''}
        <tr class="total-row">
            <td>TỔNG CỘNG:</td>
            <td style="text-align: right;">${formatVND(data.total)}</td>
        </tr>
        <tr>
            <td>${data.paymentMethod}:</td>
            <td style="text-align: right;">${formatVND(data.cashReceived)}</td>
        </tr>
    </table>
    
    ${data.change > 0 ? `
    <div class="change-row">
        TIỀN THỪA: ${formatVND(data.change)}
    </div>
    ` : ''}
    
    ${data.pointsEarned > 0 ? `
    <div style="text-align: center; margin-top: 5px; font-size: 10px;">
        🎁 Bạn được tích <strong>+${data.pointsEarned} điểm</strong>
    </div>
    ` : ''}
    
    <div class="divider"></div>
    
    <div class="footer">
        ${settings.footerText}
    </div>
</body>
</html>
    `;
}

/**
 * Print receipt
 */
export function printReceipt(data: ReceiptData, settings: ReceiptSettings): void {
    const html = generateReceiptHTML(data, settings);
    const printWindow = window.open('', '_blank');

    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
            if (!data.isPreview) {
                printWindow.close();
            }
        }, 300);
    }
}

/**
 * Generate VND cash suggestions based on total
 */
export function generateCashSuggestions(total: number): number[] {
    // VND denominations
    const denominations = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];

    const suggestions: number[] = [];

    // Always include exact amount first if > 0
    if (total > 0) {
        suggestions.push(total);
    }

    // Add round numbers based on total
    for (const denom of denominations) {
        if (denom >= total) {
            // Single denomination that covers the amount
            if (!suggestions.includes(denom)) {
                suggestions.push(denom);
            }
        }

        // Round up to nearest multiple of this denomination
        const rounded = Math.ceil(total / denom) * denom;
        if (rounded >= total && rounded !== total && !suggestions.includes(rounded)) {
            suggestions.push(rounded);
        }
    }

    // Add common round amounts that might be given
    [10000, 20000, 50000, 100000, 200000, 500000, 1000000].forEach(amount => {
        if (amount >= total && !suggestions.includes(amount)) {
            suggestions.push(amount);
        }
    });

    // Sort and limit to top 8 suggestions
    return [...new Set(suggestions)]
        .filter(s => s >= total)
        .sort((a, b) => a - b)
        .slice(0, 8);
}
