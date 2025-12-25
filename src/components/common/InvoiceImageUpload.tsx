// Invoice Image Upload Component for Purchase Orders
// Supports multiple image upload, camera capture, with 6-month auto-delete warning

import { useState, useRef, useCallback } from 'react';

interface InvoiceImage {
    id: string;
    url: string;
    file?: File;
    uploaded: boolean;
}

interface InvoiceImageUploadProps {
    images: InvoiceImage[];
    onImagesChange: (images: InvoiceImage[]) => void;
    maxImages?: number;
}

export function InvoiceImageUpload({ images, onImagesChange, maxImages = 10 }: InvoiceImageUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFiles = useCallback((files: FileList | null) => {
        if (!files) return;

        const newImages: InvoiceImage[] = [];
        const remainingSlots = maxImages - images.length;

        Array.from(files).slice(0, remainingSlots).forEach(file => {
            if (file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                newImages.push({
                    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    url,
                    file,
                    uploaded: false
                });
            }
        });

        if (newImages.length > 0) {
            onImagesChange([...images, ...newImages]);
        }
    }, [images, maxImages, onImagesChange]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const removeImage = (id: string) => {
        const updated = images.filter(img => img.id !== id);
        // Revoke object URLs to prevent memory leaks
        const removed = images.find(img => img.id === id);
        if (removed && removed.url.startsWith('blob:')) {
            URL.revokeObjectURL(removed.url);
        }
        onImagesChange(updated);
    };

    return (
        <div style={{ marginTop: '16px' }}>
            {/* Header with warning */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>📷 Ảnh hóa đơn</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>({images.length}/{maxImages})</span>
                </div>
            </div>

            {/* Auto-delete warning */}
            <div style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '6px',
                padding: '8px 12px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#92400e'
            }}>
                <span>⚠️</span>
                <span>Ảnh sẽ tự động xóa sau 6 tháng để giảm dung lượng lưu trữ</span>
            </div>

            {/* Image grid */}
            {images.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                    gap: '12px',
                    marginBottom: '12px'
                }}>
                    {images.map(img => (
                        <div
                            key={img.id}
                            style={{
                                position: 'relative',
                                aspectRatio: '1',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: '1px solid #e5e7eb'
                            }}
                        >
                            <img
                                src={img.url}
                                alt="Invoice"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                            {/* Remove button */}
                            <button
                                type="button"
                                onClick={() => removeImage(img.id)}
                                style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px'
                                }}
                            >
                                ✕
                            </button>
                            {/* Upload status indicator */}
                            {!img.uploaded && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '4px',
                                    left: '4px',
                                    right: '4px',
                                    backgroundColor: 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    fontSize: '10px',
                                    textAlign: 'center',
                                    padding: '2px',
                                    borderRadius: '4px'
                                }}>
                                    Chờ upload
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Upload area */}
            {images.length < maxImages && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    style={{
                        border: `2px dashed ${isDragging ? '#3b82f6' : '#d1d5db'}`,
                        borderRadius: '8px',
                        padding: '24px',
                        textAlign: 'center',
                        backgroundColor: isDragging ? '#eff6ff' : '#f9fafb',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
                    <p style={{ color: '#6b7280', marginBottom: '12px', fontSize: '14px' }}>
                        Kéo thả ảnh vào đây hoặc click để chọn
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                            }}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 500
                            }}
                        >
                            📂 Chọn ảnh
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                cameraInputRef.current?.click();
                            }}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 500
                            }}
                        >
                            📷 Chụp ảnh
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden file inputs */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
            />
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
            />
        </div>
    );
}

export type { InvoiceImage };
