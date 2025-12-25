// =============================================================================
// BARCODE SELECTION MODAL - Shows products/units matching a barcode
// =============================================================================

import { useState } from 'react';
import { formatVND } from '@/lib/cashReconciliation';
import type { Product, ProductUnit } from '@/types';

export interface BarcodeMatch {
    product: Product;
    unit: ProductUnit | null; // null = base unit
    displayName: string;
    displayUnit: string;
    price: number;
    stock: number;
    barcode: string;
}

interface BarcodeSelectionModalProps {
    matches: BarcodeMatch[];
    onSelect: (match: BarcodeMatch) => void;
    onClose: () => void;
}

export function BarcodeSelectionModal({ matches, onSelect, onClose }: BarcodeSelectionModalProps) {
    // Inline styles for maximum compatibility
    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px'
    };

    const modalStyle: React.CSSProperties = {
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    };

    const headerStyle: React.CSSProperties = {
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f9fafb'
    };

    const listStyle: React.CSSProperties = {
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
    };

    const itemStyle: React.CSSProperties = {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        marginBottom: '8px',
        borderRadius: '12px',
        border: '2px solid #e5e7eb',
        backgroundColor: 'white',
        cursor: 'pointer',
        textAlign: 'left'
    };

    const footerStyle: React.CSSProperties = {
        padding: '16px 20px',
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
    };

    return (
        <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={headerStyle}>
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827' }}>
                            Chọn sản phẩm
                        </h2>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
                            Tìm thấy {matches.length} sản phẩm có cùng mã vạch
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: '#f3f4f6',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 600
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Product List */}
                <div style={listStyle}>
                    {matches.map((match, idx) => (
                        <button
                            key={`${match.product.id}-${match.unit?.id || 'base'}`}
                            onClick={() => onSelect(match)}
                            style={itemStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#3b82f6';
                                e.currentTarget.style.backgroundColor = '#eff6ff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                                e.currentTarget.style.backgroundColor = 'white';
                            }}
                        >
                            {/* Product Image */}
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '8px',
                                backgroundColor: '#f3f4f6',
                                border: '1px solid #e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                flexShrink: 0
                            }}>
                                {match.product.image_url ? (
                                    <img
                                        src={match.product.image_url}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <span style={{ color: '#9ca3af', fontSize: '10px' }}>IMG</span>
                                )}
                            </div>

                            {/* Product Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontWeight: 600,
                                    color: '#111827',
                                    fontSize: '15px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {match.displayName}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <span style={{
                                        padding: '2px 8px',
                                        backgroundColor: '#dbeafe',
                                        color: '#1d4ed8',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 600
                                    }}>
                                        {match.displayUnit}
                                    </span>
                                    {match.unit && (
                                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                            (= {match.unit.conversion_rate} {match.product.base_unit})
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                                    SKU: {match.product.sku || '---'} • Mã: {match.barcode}
                                </div>
                            </div>

                            {/* Price & Stock */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontWeight: 700, color: '#2563eb', fontSize: '15px' }}>
                                    {formatVND(match.price)}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                    Tồn: <span style={{ color: match.stock <= 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                                        {match.stock}
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div style={footerStyle}>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            color: '#374151',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '15px'
                        }}
                    >
                        Hủy
                    </button>
                </div>
            </div>
        </div>
    );
}

// Helper function to find all products/units matching a barcode
export function findProductsByBarcode(products: Product[], barcode: string): BarcodeMatch[] {
    const matches: BarcodeMatch[] = [];

    for (const product of products) {
        // Check main product barcode
        if (product.barcode === barcode) {
            matches.push({
                product,
                unit: null,
                displayName: product.name,
                displayUnit: product.base_unit || 'Cái',
                price: product.selling_price,
                stock: product.current_stock,
                barcode: product.barcode,
            });
        }

        // Check unit barcodes
        if (product.units && product.units.length > 0) {
            for (const unit of product.units) {
                if (unit.barcode === barcode) {
                    // Calculate stock in this unit
                    const stockInUnit = Math.floor(product.current_stock / unit.conversion_rate);
                    matches.push({
                        product,
                        unit,
                        displayName: product.name,
                        displayUnit: unit.unit_name,
                        price: unit.selling_price || product.selling_price * unit.conversion_rate,
                        stock: stockInUnit,
                        barcode: unit.barcode,
                    });
                }
            }
        }
    }

    return matches;
}

// Check if a barcode already exists in any product or unit
export function checkBarcodeExists(products: Product[], barcode: string, excludeProductId?: string): {
    exists: boolean;
    existingProduct?: Product;
    existingUnit?: ProductUnit;
} {
    if (!barcode) return { exists: false };

    for (const product of products) {
        // Skip the product being edited
        if (excludeProductId && product.id === excludeProductId) continue;

        // Check main barcode
        if (product.barcode === barcode) {
            return { exists: true, existingProduct: product };
        }

        // Check unit barcodes
        if (product.units) {
            for (const unit of product.units) {
                if (unit.barcode === barcode) {
                    return { exists: true, existingProduct: product, existingUnit: unit };
                }
            }
        }
    }

    return { exists: false };
}
