// =============================================================================
// CASH VOUCHER TEMPLATE - Phiếu chi tiền mặt
// =============================================================================

import React from 'react';
import type { CashVoucherConfig } from '@/stores/settingsStore';
import { formatReceiptCurrency } from '@/lib/printService';

export interface CashVoucherData {
    voucherNumber: string;
    date: Date;
    recipient: string;
    reason: string;
    amount: number;
    amountInWords?: string;
    approver?: string;
    createdBy: string;
    storeName: string;
    storeAddress: string;
}

interface CashVoucherTemplateProps {
    data: CashVoucherData;
    config: CashVoucherConfig;
}

// Helper function to convert number to Vietnamese words
function numberToVietnameseWords(num: number): string {
    const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];

    if (num === 0) return 'không đồng';
    if (num < 0) return 'âm ' + numberToVietnameseWords(-num);

    let result = '';

    if (num >= 1000000000) {
        result += ones[Math.floor(num / 1000000000)] + ' tỷ ';
        num %= 1000000000;
    }

    if (num >= 1000000) {
        result += ones[Math.floor(num / 1000000)] + ' triệu ';
        num %= 1000000;
    }

    if (num >= 1000) {
        const thousands = Math.floor(num / 1000);
        if (thousands >= 10) {
            result += tens[Math.floor(thousands / 10)];
            if (thousands % 10 > 0) result += ' ' + ones[thousands % 10];
            result += ' nghìn ';
        } else {
            result += ones[thousands] + ' nghìn ';
        }
        num %= 1000;
    }

    if (num >= 100) {
        result += ones[Math.floor(num / 100)] + ' trăm ';
        num %= 100;
    }

    if (num >= 10) {
        result += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
    }

    if (num > 0) {
        result += ones[num];
    }

    return result.trim() + ' đồng';
}

/**
 * Cash Voucher Template Component
 */
export const CashVoucherTemplate: React.FC<CashVoucherTemplateProps> = ({ data, config }) => {
    const { voucherNumber, date, recipient, reason, amount, approver, createdBy, storeName, storeAddress } = data;
    const amountInWords = data.amountInWords || numberToVietnameseWords(amount);

    const formattedDate = date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const isA4 = config.paperWidth === 'A4';
    const containerClass = isA4
        ? 'w-[210mm] min-h-[148mm] p-10 text-sm'
        : 'w-[148mm] min-h-[105mm] p-6 text-xs';

    return (
        <div className={`${containerClass} bg-white text-slate-800 font-sans`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="font-bold text-lg text-blue-900 uppercase">{storeName}</h1>
                    <p className="text-xs text-slate-500">{storeAddress}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-500">Số: <span className="font-bold text-slate-800">{voucherNumber}</span></p>
                    <p className="text-xs text-slate-500">Ngày: {formattedDate}</p>
                </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-red-600 uppercase tracking-wider">Phiếu Chi</h2>
                <p className="text-xs text-slate-400 italic">(Cash Payment Voucher)</p>
            </div>

            {/* Content */}
            <div className="space-y-3 mb-6">
                <div className="flex">
                    <span className="w-32 font-medium text-slate-600">Họ tên người nhận:</span>
                    <span className="flex-1 font-bold border-b border-dotted border-slate-300">{recipient}</span>
                </div>

                {config.showReason && (
                    <div className="flex">
                        <span className="w-32 font-medium text-slate-600">Lý do chi:</span>
                        <span className="flex-1 border-b border-dotted border-slate-300">{reason}</span>
                    </div>
                )}

                <div className="flex">
                    <span className="w-32 font-medium text-slate-600">Số tiền:</span>
                    <span className="flex-1 font-bold text-lg text-red-600">{formatReceiptCurrency(amount)} VNĐ</span>
                </div>

                <div className="flex">
                    <span className="w-32 font-medium text-slate-600">Bằng chữ:</span>
                    <span className="flex-1 italic capitalize border-b border-dotted border-slate-300">{amountInWords}</span>
                </div>
            </div>

            {/* Signatures */}
            <div className={`grid ${config.showApprover ? 'grid-cols-3' : 'grid-cols-2'} gap-4 text-center mt-10`}>
                {config.showApprover && (
                    <div>
                        <p className="font-bold text-xs uppercase mb-1">Giám đốc</p>
                        <p className="text-[10px] italic text-slate-400">(Ký, họ tên)</p>
                        <div className="h-16"></div>
                        <p className="font-medium">{approver || ''}</p>
                    </div>
                )}
                <div>
                    <p className="font-bold text-xs uppercase mb-1">Người lập phiếu</p>
                    <p className="text-[10px] italic text-slate-400">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-medium">{createdBy}</p>
                </div>
                <div>
                    <p className="font-bold text-xs uppercase mb-1">Người nhận tiền</p>
                    <p className="text-[10px] italic text-slate-400">(Ký, họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-medium">{recipient}</p>
                </div>
            </div>
        </div>
    );
};

/**
 * Generate HTML string for printing
 */
export function generateCashVoucherHTML(data: CashVoucherData, config: CashVoucherConfig): string {
    const { voucherNumber, date, recipient, reason, amount, approver, createdBy, storeName, storeAddress } = data;
    const amountInWords = data.amountInWords || numberToVietnameseWords(amount);

    const formattedDate = date.toLocaleDateString('vi-VN');
    const isA4 = config.paperWidth === 'A4';
    const width = isA4 ? '210mm' : '148mm';

    return `
        <div style="width:${width};font-family:sans-serif;font-size:12px;padding:40px;background:white;">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
                <div>
                    <div style="font-weight:bold;font-size:16px;color:#1e40af;text-transform:uppercase;">${storeName}</div>
                    <div style="font-size:11px;color:#64748b;">${storeAddress}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:11px;color:#64748b;">Số: <strong>${voucherNumber}</strong></div>
                    <div style="font-size:11px;color:#64748b;">Ngày: ${formattedDate}</div>
                </div>
            </div>

            <!-- Title -->
            <div style="text-align:center;margin-bottom:24px;">
                <h2 style="font-size:24px;font-weight:bold;color:#dc2626;text-transform:uppercase;letter-spacing:2px;margin:0;">Phiếu Chi</h2>
                <p style="font-size:11px;color:#94a3b8;font-style:italic;margin:4px 0 0;">(Cash Payment Voucher)</p>
            </div>

            <!-- Content -->
            <div style="margin-bottom:24px;">
                <div style="display:flex;margin-bottom:12px;">
                    <span style="width:120px;font-weight:500;color:#475569;">Họ tên người nhận:</span>
                    <span style="flex:1;font-weight:bold;border-bottom:1px dotted #cbd5e1;">${recipient}</span>
                </div>
                ${config.showReason ? `
                <div style="display:flex;margin-bottom:12px;">
                    <span style="width:120px;font-weight:500;color:#475569;">Lý do chi:</span>
                    <span style="flex:1;border-bottom:1px dotted #cbd5e1;">${reason}</span>
                </div>
                ` : ''}
                <div style="display:flex;margin-bottom:12px;">
                    <span style="width:120px;font-weight:500;color:#475569;">Số tiền:</span>
                    <span style="flex:1;font-weight:bold;font-size:16px;color:#dc2626;">${formatReceiptCurrency(amount)} VNĐ</span>
                </div>
                <div style="display:flex;margin-bottom:12px;">
                    <span style="width:120px;font-weight:500;color:#475569;">Bằng chữ:</span>
                    <span style="flex:1;font-style:italic;text-transform:capitalize;border-bottom:1px dotted #cbd5e1;">${amountInWords}</span>
                </div>
            </div>

            <!-- Signatures -->
            <div style="display:grid;grid-template-columns:${config.showApprover ? '1fr 1fr 1fr' : '1fr 1fr'};gap:16px;text-align:center;margin-top:40px;">
                ${config.showApprover ? `
                <div>
                    <p style="font-weight:bold;font-size:11px;text-transform:uppercase;margin-bottom:4px;">Giám đốc</p>
                    <p style="font-size:10px;font-style:italic;color:#94a3b8;">(Ký, họ tên)</p>
                    <div style="height:64px;"></div>
                    <p style="font-weight:500;">${approver || ''}</p>
                </div>
                ` : ''}
                <div>
                    <p style="font-weight:bold;font-size:11px;text-transform:uppercase;margin-bottom:4px;">Người lập phiếu</p>
                    <p style="font-size:10px;font-style:italic;color:#94a3b8;">(Ký, họ tên)</p>
                    <div style="height:64px;"></div>
                    <p style="font-weight:500;">${createdBy}</p>
                </div>
                <div>
                    <p style="font-weight:bold;font-size:11px;text-transform:uppercase;margin-bottom:4px;">Người nhận tiền</p>
                    <p style="font-size:10px;font-style:italic;color:#94a3b8;">(Ký, họ tên)</p>
                    <div style="height:64px;"></div>
                    <p style="font-weight:500;">${recipient}</p>
                </div>
            </div>
        </div>
    `;
}

export default CashVoucherTemplate;
