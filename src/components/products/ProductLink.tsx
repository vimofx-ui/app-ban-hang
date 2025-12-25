// =============================================================================
// PRODUCT LINK COMPONENT - Clickable product name with modal
// =============================================================================

import { useState, useEffect } from 'react';
import { useProductStore } from '@/stores/productStore';
import { ProductDetailsModal } from '@/components/products/ProductDetailsModal';
import type { Product } from '@/types';

interface ProductLinkProps {
    productId?: string;
    productName: string;
    showImage?: boolean;
    imageUrl?: string;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Clickable product name that opens ProductDetailsModal
 * Use this component anywhere a product name appears to make it interactive
 */
export function ProductLink({
    productId,
    productName,
    showImage = false,
    imageUrl,
    className,
    style
}: ProductLinkProps) {
    const { products } = useProductStore();
    const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (productId) {
            const product = products.find(p => p.id === productId);
            if (product) {
                setViewingProduct(product);
            }
        }
    };

    const handleEdit = (product: Product) => {
        // Navigate to product page for editing - for now just close modal
        setViewingProduct(null);
        // Could use: window.location.href = `/products?edit=${product.id}`;
    };

    const defaultStyle: React.CSSProperties = {
        color: '#2563eb',
        cursor: 'pointer',
        textDecoration: 'none',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        ...style
    };

    return (
        <>
            <span
                onClick={handleClick}
                className={className}
                style={defaultStyle}
                title="Nhấn để xem chi tiết sản phẩm"
            >
                {showImage && imageUrl && (
                    <img
                        src={imageUrl}
                        alt=""
                        style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            objectFit: 'cover'
                        }}
                    />
                )}
                {productName}
            </span>

            {viewingProduct && (
                <ProductDetailsModal
                    product={viewingProduct}
                    onClose={() => setViewingProduct(null)}
                    onEdit={handleEdit}
                />
            )}
        </>
    );
}

// =============================================================================
// IMAGE UPLOADER COMPONENT - File, URL, Camera
// =============================================================================

interface ImageUploaderProps {
    value?: string;
    onChange: (imageUrl: string) => void;
    showCamera?: boolean;
    style?: React.CSSProperties;
    multiple?: boolean;
}

export function ImageUploader({ value, onChange, showCamera = true, style, multiple = false }: ImageUploaderProps) {
    const [previewUrl, setPreviewUrl] = useState(value || '');
    const [showOptions, setShowOptions] = useState(false);

    useEffect(() => {
        setPreviewUrl(value || '');
    }, [value]);

    // Handle file upload and convert to base64
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            if (file.size > 5 * 1024 * 1024) {
                // Skip large files silently or alert once? 
                // For now, simple check
                return;
            }
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                if (base64) {
                    // For single mode, this might trigger multiple updates if user hacks multiple selection
                    // But usually input is restricted. 
                    // We rely on parent to handle it.
                    onChange(base64);
                    if (!multiple) setPreviewUrl(base64);
                }
            };
            reader.readAsDataURL(file);
        });

        setShowOptions(false);
    };

    // Handle camera capture with live preview
    const handleCameraCapture = async () => {
        setShowOptions(false);

        // Create fullscreen modal for camera
        const modal = document.createElement('div');
        modal.id = 'camera-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;';
        modal.innerHTML = `
            <video id="camera-video" style="flex:1;object-fit:cover;" autoplay playsinline></video>
            <div style="padding:20px;display:flex;gap:12px;justify-content:center;background:#000;">
                <button id="camera-cancel" style="padding:12px 24px;border-radius:50px;background:#374151;color:white;border:none;font-size:16px;cursor:pointer;">✕ Hủy</button>
                <button id="camera-capture" style="padding:16px 32px;border-radius:50px;background:#22c55e;color:white;border:none;font-size:16px;font-weight:600;cursor:pointer;">📷 Chụp</button>
            </div>
        `;
        document.body.appendChild(modal);

        const video = document.getElementById('camera-video') as HTMLVideoElement;
        const captureBtn = document.getElementById('camera-capture') as HTMLButtonElement;
        const cancelBtn = document.getElementById('camera-cancel') as HTMLButtonElement;

        let stream: MediaStream | null = null;

        const cleanup = () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            modal.remove();
        };

        cancelBtn.onclick = cleanup;

        captureBtn.onclick = () => {
            // Create canvas and capture frame
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg', 0.85);
            setPreviewUrl(base64);
            onChange(base64);
            cleanup();
        };

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            video.srcObject = stream;
        } catch (err) {
            cleanup();
            alert('Không thể mở camera. Vui lòng thử tải ảnh từ máy.');
        }
    };

    // Remove image
    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        setPreviewUrl('');
        onChange('');
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* Main clickable area */}
            <div
                onClick={() => {
                    if (!previewUrl) {
                        setShowOptions(true);
                    }
                }}
                style={{
                    border: '2px dashed #d1d5db',
                    borderRadius: '12px',
                    padding: previewUrl ? '0' : (style?.height ? '4px' : '24px'),
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#fafafa',
                    minHeight: style?.height ? undefined : '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                    ...style
                }}
            >
                {previewUrl ? (
                    <>
                        <img
                            src={previewUrl}
                            alt="Preview"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                            onError={() => {
                                setPreviewUrl('');
                                alert('Không thể tải ảnh');
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleRemove}
                            style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: 'rgba(239,68,68,0.9)',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            ✕
                        </button>
                    </>
                ) : (
                    <>
                        {/* Compact icon only when container is small */}
                        <div style={{ fontSize: style?.height ? '20px' : '40px', opacity: 0.5 }}>📷</div>
                        {!style?.height && (
                            <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
                                Nhấn để chụp hoặc chọn ảnh
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Options popup */}
            {showOptions && (
                <div
                    onClick={() => setShowOptions(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9998,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        padding: '16px'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'white',
                            borderRadius: '16px',
                            padding: '8px',
                            width: '100%',
                            maxWidth: '360px',
                            marginBottom: '20px'
                        }}
                    >
                        {showCamera && navigator.mediaDevices && (
                            <button
                                type="button"
                                onClick={handleCameraCapture}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    border: 'none',
                                    background: 'none',
                                    fontSize: '16px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    borderBottom: '1px solid #e5e7eb'
                                }}
                            >
                                <span style={{ fontSize: '24px' }}>📷</span>
                                Chụp ảnh
                            </button>
                        )}
                        <label style={{
                            display: 'flex',
                            width: '100%',
                            padding: '16px',
                            border: 'none',
                            background: 'none',
                            fontSize: '16px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <span style={{ fontSize: '24px' }}>📁</span>
                            Chọn từ thư viện
                            <input
                                type="file"
                                accept="image/*"
                                multiple={multiple}
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowOptions(false)}
                            style={{
                                width: '100%',
                                padding: '16px',
                                border: 'none',
                                background: '#f3f4f6',
                                borderRadius: '8px',
                                marginTop: '8px',
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#374151',
                                cursor: 'pointer'
                            }}
                        >
                            Hủy
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProductLink;
