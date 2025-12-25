import { useState, useEffect } from 'react';
import type { Product } from '@/types';
import { formatVND } from '@/lib/cashReconciliation';

interface ProductQuickViewModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
    onSave?: (product: Product) => void;
    showEditButton?: boolean;
}

export function ProductQuickViewModal({
    product,
    isOpen,
    onClose,
    onSave,
    showEditButton = true
}: ProductQuickViewModalProps) {
    const [editedProduct, setEditedProduct] = useState<Product | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (product) {
            setEditedProduct({ ...product });
        }
    }, [product]);

    if (!isOpen || !product || !editedProduct) return null;

    const handleSave = () => {
        if (onSave && editedProduct) {
            onSave(editedProduct);
        }
        setIsEditing(false);
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    width: '500px',
                    maxHeight: '80vh',
                    overflow: 'auto',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                        {isEditing ? 'Chỉnh sửa sản phẩm' : 'Thông tin sản phẩm'}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#6b7280' }}
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '20px' }}>
                    {/* Product Image */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px'
                        }}>
                            {product.image_url ? (
                                <img src={product.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                            ) : '📦'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: '#0284c7' }}>
                                {product.name}
                            </h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                                SKU: {product.sku || '---'}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                                Barcode: {product.barcode || '---'}
                            </p>
                        </div>
                    </div>

                    {/* Product Details Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        fontSize: '14px'
                    }}>
                        <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Giá bán</span>
                            {isEditing ? (
                                <input
                                    type="number"
                                    value={editedProduct.selling_price}
                                    onChange={e => setEditedProduct({ ...editedProduct, selling_price: Number(e.target.value) })}
                                    style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                />
                            ) : (
                                <span style={{ fontWeight: 600, color: '#10b981' }}>{formatVND(product.selling_price)}</span>
                            )}
                        </div>
                        <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Giá vốn</span>
                            {isEditing ? (
                                <input
                                    type="number"
                                    value={editedProduct.cost_price}
                                    onChange={e => setEditedProduct({ ...editedProduct, cost_price: Number(e.target.value) })}
                                    style={{ width: '100%', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                />
                            ) : (
                                <span style={{ fontWeight: 600 }}>{formatVND(product.cost_price)}</span>
                            )}
                        </div>
                        <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Tồn kho</span>
                            <span style={{ fontWeight: 600 }}>{product.current_stock} {product.base_unit}</span>
                        </div>
                        <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Đơn vị</span>
                            <span style={{ fontWeight: 600 }}>{product.base_unit}</span>
                        </div>
                    </div>

                    {/* Unit Conversions */}
                    {product.units && product.units.length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>
                                Đơn vị quy đổi
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {product.units.map((unit, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: '12px',
                                            backgroundColor: '#f0f9ff',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            border: '1px solid #e0f2fe'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '14px', color: '#0369a1' }}>{unit.unit_name}</span>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    backgroundColor: '#dbeafe',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    color: '#1e40af'
                                                }}>
                                                    = {unit.conversion_rate} {product.base_unit}
                                                </span>
                                            </div>
                                            <span style={{ fontWeight: 600, color: '#059669', fontSize: '14px' }}>
                                                {formatVND(unit.selling_price || product.selling_price * unit.conversion_rate)}
                                            </span>
                                        </div>
                                        {unit.barcode && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '12px' }}>
                                                <span>📊</span>
                                                <span>Mã vạch: <code style={{ backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{unit.barcode}</code></span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                }}>
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(false)}
                                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                            >
                                Lưu
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}
                            >
                                Đóng
                            </button>
                            {showEditButton && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    Chỉnh sửa
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
