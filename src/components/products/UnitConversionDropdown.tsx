import { useState, useRef, useEffect } from 'react';
import type { Product } from '@/types';
import { formatVND } from '@/lib/cashReconciliation';

interface UnitOption {
    id: string;
    name: string;
    conversionRate: number;
    price: number;
    costPrice: number;
    barcode?: string;
    isBase: boolean;
}

interface UnitConversionDropdownProps {
    product: Product;
    currentUnitId?: string;
    currentUnitName?: string;
    onUnitChange: (unit: UnitOption) => void;
    showPrice?: boolean;
    showArrow?: boolean;
}

export function UnitConversionDropdown({
    product,
    currentUnitId,
    currentUnitName,
    onUnitChange,
    showPrice = true,
    showArrow = true
}: UnitConversionDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Build unit options from product
    const unitOptions: UnitOption[] = [
        // Base unit
        {
            id: 'base',
            name: product.base_unit || 'Cái',
            conversionRate: 1,
            price: product.selling_price,
            costPrice: product.cost_price,
            barcode: product.barcode || undefined,
            isBase: true
        },
        // Conversion units
        ...(product.units || []).map(unit => ({
            id: unit.id || unit.unit_name,
            name: unit.unit_name,
            conversionRate: unit.conversion_rate,
            price: unit.selling_price || product.selling_price * unit.conversion_rate,
            costPrice: (product.cost_price || 0) * unit.conversion_rate,
            barcode: unit.barcode || undefined,
            isBase: false
        }))
    ];

    // Current selected unit
    const currentUnit = currentUnitId
        ? unitOptions.find(u => u.id === currentUnitId)
        : unitOptions.find(u => u.name === currentUnitName) || unitOptions[0];

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (unitOptions.length <= 1) {
        // No conversion units, just show label
        return (
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
                {currentUnit?.name || product.base_unit}
            </span>
        );
    }

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#0284c7',
                    fontWeight: 500
                }}
            >
                {currentUnit?.name || product.base_unit}
                {showArrow && (
                    <span style={{ fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
                )}
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        border: '1px solid #e5e7eb',
                        zIndex: 100,
                        minWidth: '200px',
                        overflow: 'hidden'
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '8px 12px',
                        backgroundColor: '#f9fafb',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '12px',
                        color: '#6b7280',
                        fontWeight: 500
                    }}>
                        Chọn đơn vị
                    </div>

                    {/* Options */}
                    {unitOptions.map((unit, idx) => (
                        <div
                            key={unit.id}
                            onClick={() => {
                                onUnitChange(unit);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: idx < unitOptions.length - 1 ? '1px solid #f3f4f6' : 'none',
                                backgroundColor: currentUnit?.id === unit.id ? '#eff6ff' : 'white'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = currentUnit?.id === unit.id ? '#eff6ff' : 'white')}
                        >
                            <div>
                                <div style={{ fontWeight: 500, fontSize: '14px' }}>
                                    {unit.name}
                                    {unit.isBase && (
                                        <span style={{
                                            marginLeft: '6px',
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            backgroundColor: '#dbeafe',
                                            color: '#1d4ed8',
                                            borderRadius: '4px'
                                        }}>
                                            Gốc
                                        </span>
                                    )}
                                </div>
                                {!unit.isBase && (
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                        = {unit.conversionRate} {product.base_unit}
                                    </div>
                                )}
                            </div>
                            {showPrice && (
                                <span style={{ fontWeight: 600, color: '#10b981', fontSize: '13px' }}>
                                    {formatVND(unit.price)}
                                </span>
                            )}
                        </div>
                    ))}

                    {/* View Original Link */}
                    <div
                        style={{
                            padding: '8px 12px',
                            borderTop: '1px solid #e5e7eb',
                            backgroundColor: '#f9fafb'
                        }}
                    >
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                // Could open ProductQuickViewModal here
                                setIsOpen(false);
                            }}
                            style={{
                                fontSize: '12px',
                                color: '#0284c7',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <span>▼</span> Xem sản phẩm gốc
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

export type { UnitOption };
