// =============================================================================
// SHIPPING LABEL TEMPLATE - Template for shipping labels (GHN, GHTK, VNPost)
// =============================================================================

import React from 'react';
import type { Order } from '@/types';
import { formatVND } from '@/lib/cashReconciliation';

export type CarrierType = 'GHN' | 'GHTK' | 'VNPost' | 'generic';

export interface ShippingLabelConfig {
    carrier: CarrierType;
    showSender: boolean;
    showReceiver: boolean;
    showItems: boolean;
    showCOD: boolean;
    showWeight: boolean;
    showNote: boolean;
    paperSize: 'A5' | 'A6' | '10x15';
}

export interface ShippingLabelData {
    order: Order;
    trackingNumber?: string;
    weight?: number;
    carrier: CarrierType;
    senderInfo: {
        name: string;
        phone: string;
        address: string;
    };
}

interface ShippingLabelTemplateProps {
    data: ShippingLabelData;
    config: ShippingLabelConfig;
}

const carrierLogos: Record<CarrierType, { name: string; color: string }> = {
    'GHN': { name: 'Giao Hàng Nhanh', color: '#EA5504' },
    'GHTK': { name: 'Giao Hàng Tiết Kiệm', color: '#0FA958' },
    'VNPost': { name: 'VNPost', color: '#0066B3' },
    'generic': { name: 'Vận chuyển', color: '#374151' }
};

export const ShippingLabelTemplate: React.FC<ShippingLabelTemplateProps> = ({
    data,
    config
}) => {
    const { order, trackingNumber, weight, senderInfo, carrier } = data;
    const { showSender, showReceiver, showItems, showCOD, showWeight, showNote } = config;
    const carrierInfo = carrierLogos[carrier] || carrierLogos.generic;

    // Calculate paper size
    const getPaperStyle = (): React.CSSProperties => {
        switch (config.paperSize) {
            case 'A5':
                return { width: '148mm', minHeight: '210mm' };
            case 'A6':
                return { width: '105mm', minHeight: '148mm' };
            case '10x15':
                return { width: '100mm', minHeight: '150mm' };
            default:
                return { width: '105mm', minHeight: '148mm' };
        }
    };

    return (
        <div style={{
            ...getPaperStyle(),
            fontFamily: 'Inter, system-ui, sans-serif',
            backgroundColor: 'white',
            padding: '12px',
            boxSizing: 'border-box',
            border: '2px solid #e5e7eb',
            borderRadius: '8px'
        }}>
            {/* Header with Carrier Logo */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '10px',
                borderBottom: `3px solid ${carrierInfo.color}`,
                marginBottom: '12px'
            }}>
                <div>
                    <div style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: carrierInfo.color
                    }}>
                        {carrierInfo.name}
                    </div>
                    {trackingNumber && (
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                            Mã vận đơn: {trackingNumber}
                        </div>
                    )}
                </div>
                <div style={{
                    padding: '6px 12px',
                    backgroundColor: carrierInfo.color,
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600
                }}>
                    {String(order.payment_method) === 'cod' || (order.debt_amount || 0) > 0 ? 'COD' : 'ĐÃ THANH TOÁN'}
                </div>
            </div>

            {/* Barcode placeholder */}
            <div style={{
                textAlign: 'center',
                padding: '12px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                marginBottom: '12px'
            }}>
                <div style={{
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    letterSpacing: '2px',
                    marginBottom: '4px'
                }}>
                    ||||| |||| ||||| |||| |||||
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>
                    {trackingNumber || order.order_number}
                </div>
            </div>

            {/* Sender Info */}
            {showSender && (
                <div style={{
                    padding: '10px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    border: '1px solid #bbf7d0'
                }}>
                    <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginBottom: '4px' }}>
                        📤 NGƯỜI GỬI
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{senderInfo.name}</div>
                    <div style={{ fontSize: '12px', color: '#4b5563' }}>{senderInfo.phone}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{senderInfo.address}</div>
                </div>
            )}

            {/* Receiver Info */}
            {showReceiver && (
                <div style={{
                    padding: '10px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    border: '1px solid #bfdbfe'
                }}>
                    <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, marginBottom: '4px' }}>
                        📥 NGƯỜI NHẬN
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>
                        {order.customer?.name || 'Khách lẻ'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#1f2937', fontWeight: 600 }}>
                        {order.customer?.phone || 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px' }}>
                        {order.customer?.address || 'Không có địa chỉ'}
                    </div>
                </div>
            )}

            {/* Items List */}
            {showItems && order.order_items && order.order_items.length > 0 && (
                <div style={{
                    padding: '8px',
                    backgroundColor: '#fafafa',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    border: '1px solid #e5e7eb'
                }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginBottom: '6px' }}>
                        📦 DANH SÁCH SẢN PHẨM ({order.order_items.length})
                    </div>
                    <div style={{ maxHeight: '80px', overflow: 'hidden' }}>
                        {order.order_items.slice(0, 3).map((item: any, idx: number) => (
                            <div key={idx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '11px',
                                padding: '2px 0',
                                borderBottom: idx < 2 ? '1px dashed #e5e7eb' : 'none'
                            }}>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.product?.name || 'Sản phẩm'}
                                </span>
                                <span style={{ marginLeft: '8px', fontWeight: 600 }}>x{item.quantity}</span>
                            </div>
                        ))}
                        {order.order_items.length > 3 && (
                            <div style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', marginTop: '4px' }}>
                                ... và {order.order_items.length - 3} sản phẩm khác
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* COD & Weight Row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {showCOD && (
                    <div style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>💰 TIỀN THU HỘ</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
                            {formatVND(order.debt_amount || order.total_amount || 0)}
                        </div>
                    </div>
                )}
                {showWeight && weight && (
                    <div style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: '#fefce8',
                        borderRadius: '6px',
                        border: '1px solid #fef08a',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '10px', color: '#ca8a04', fontWeight: 600 }}>⚖️ KHỐI LƯỢNG</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#ca8a04' }}>
                            {weight >= 1000 ? `${(weight / 1000).toFixed(1)} kg` : `${weight} g`}
                        </div>
                    </div>
                )}
            </div>

            {/* Note */}
            {showNote && order.notes && (
                <div style={{
                    padding: '8px',
                    backgroundColor: '#fff7ed',
                    borderRadius: '6px',
                    border: '1px solid #fed7aa'
                }}>
                    <div style={{ fontSize: '10px', color: '#c2410c', fontWeight: 600, marginBottom: '2px' }}>📝 GHI CHÚ</div>
                    <div style={{ fontSize: '11px', color: '#9a3412' }}>{order.notes}</div>
                </div>
            )}

            {/* Footer */}
            <div style={{
                marginTop: '12px',
                paddingTop: '8px',
                borderTop: '1px dashed #d1d5db',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#9ca3af'
            }}>
                <span>Đơn #{order.order_number}</span>
                <span>{new Date(order.created_at).toLocaleString('vi-VN')}</span>
            </div>
        </div>
    );
};

export const DEFAULT_SHIPPING_LABEL_CONFIG: ShippingLabelConfig = {
    carrier: 'generic',
    showSender: true,
    showReceiver: true,
    showItems: true,
    showCOD: true,
    showWeight: true,
    showNote: true,
    paperSize: 'A6'
};

export default ShippingLabelTemplate;
