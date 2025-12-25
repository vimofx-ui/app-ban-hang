// =============================================================================
// PRINT PREVIEW MODAL - Preview and print documents
// =============================================================================

import React, { useState, useRef } from 'react';
import { X, Printer, Download, ZoomIn, ZoomOut, Settings } from 'lucide-react';
import { print } from '@/lib/printService';
import { useSettingsStore } from '@/stores/settingsStore';
import type { PrintTemplateType } from '@/stores/settingsStore';

interface PrintPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    templateType: PrintTemplateType;
    title: string;
    children: React.ReactNode;  // The rendered template
    contentHtml?: string;       // HTML string for printing
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
    isOpen,
    onClose,
    templateType,
    title,
    children,
    contentHtml
}) => {
    const [zoom, setZoom] = useState(100);
    const [isPrinting, setIsPrinting] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const printSettings = useSettingsStore(state => state.printSettings);

    if (!isOpen) return null;

    const handlePrint = async () => {
        if (!contentHtml && !contentRef.current) return;

        setIsPrinting(true);
        try {
            const html = contentHtml || contentRef.current?.innerHTML || '';
            await print({
                templateType,
                content: html,
                settings: printSettings
            });
        } catch (error) {
            console.error('Print error:', error);
            alert('Có lỗi khi in. Vui lòng thử lại.');
        } finally {
            setIsPrinting(false);
        }
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

    const templateConfig = printSettings.templates[templateType as keyof typeof printSettings.templates];
    const copies = templateConfig?.copies || 1;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <div className="flex items-center gap-3">
                        <Printer className="w-5 h-5" />
                        <h2 className="font-bold text-lg">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                    <div className="flex items-center gap-2">
                        {/* Zoom controls */}
                        <div className="flex items-center gap-1 bg-white rounded-lg border px-2 py-1">
                            <button
                                onClick={handleZoomOut}
                                className="p-1 hover:bg-gray-100 rounded"
                                disabled={zoom <= 50}
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
                            <button
                                onClick={handleZoomIn}
                                className="p-1 hover:bg-gray-100 rounded"
                                disabled={zoom >= 200}
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Paper size indicator */}
                        <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                            📄 {templateConfig?.paperWidth || '80mm'}
                        </div>

                        {/* Copies indicator */}
                        {copies > 1 && (
                            <div className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium">
                                📋 {copies} bản
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Print method indicator */}
                        <div className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm flex items-center gap-1">
                            {printSettings.printer.method === 'usb' && '🔌 USB'}
                            {printSettings.printer.method === 'lan' && '🌐 LAN'}
                            {printSettings.printer.method === 'driver' && '🖨️ Driver'}
                        </div>
                    </div>
                </div>

                {/* Preview Area */}
                <div className="flex-1 overflow-auto bg-slate-500 p-8">
                    <div
                        ref={contentRef}
                        className="mx-auto bg-white shadow-2xl transition-transform duration-200"
                        style={{
                            transform: `scale(${zoom / 100})`,
                            transformOrigin: 'top center'
                        }}
                    >
                        {children}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        {templateConfig?.autoPrint && (
                            <span className="flex items-center gap-1 text-green-600">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Tự động in khi hoàn tất
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 font-medium transition-colors"
                        >
                            Đóng
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <Printer className="w-5 h-5" />
                            {isPrinting ? 'Đang in...' : `In ${copies > 1 ? `(${copies} bản)` : ''}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPreviewModal;
