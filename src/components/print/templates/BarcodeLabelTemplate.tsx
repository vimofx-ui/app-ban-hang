// =============================================================================
// BARCODE LABEL TEMPLATE - Product Barcode Labels for Printing
// =============================================================================

import React from 'react';
import type { LabelConfig } from '@/stores/settingsStore';
import { formatVND } from '@/lib/cashReconciliation';
import { generateBarcodeHTML } from '@/lib/printService';

export interface LabelItem {
    id: string;
    name: string;
    barcode: string;
    price: number;
    quantity: number;  // Số lượng tem cần in
}

interface BarcodeLabelTemplateProps {
    items: LabelItem[];
    config: LabelConfig;
    storeName?: string;
}

/**
 * Barcode Label Template Component
 * Renders a grid of product labels with barcodes
 */
export const BarcodeLabelTemplate: React.FC<BarcodeLabelTemplateProps> = ({
    items,
    config,
    storeName = 'Cửa hàng',
}) => {
    // Expand items based on quantity
    const labelsToRender: LabelItem[] = [];
    items.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
            labelsToRender.push(item);
        }
    });

    // Grid class based on columns
    const gridClass = config.cols === 1 ? 'grid-cols-1' :
        config.cols === 2 ? 'grid-cols-2' : 'grid-cols-3';

    return (
        <div
            className="bg-white mx-auto print:shadow-none"
            style={{ width: `${config.paperWidth}mm` }}
        >
            <div
                className={`grid ${gridClass} p-1 content-start`}
                style={{
                    columnGap: `${config.colGap}mm`,
                    rowGap: `${config.rowGap}mm`,
                }}
            >
                {labelsToRender.map((item, idx) => (
                    <div
                        key={`${item.id}-${idx}`}
                        className="border border-gray-200 border-dashed rounded-sm flex flex-col justify-center overflow-hidden bg-white print:border-none px-1"
                        style={{
                            height: `${config.labelHeight}mm`,
                            fontSize: `${config.fontSize}px`,
                            textAlign: config.textAlign,
                        }}
                    >
                        {/* Store Name */}
                        {config.showShopName && (
                            <div
                                className="font-extrabold uppercase leading-none mb-0.5 truncate text-black"
                                style={{ fontSize: `${config.fontSize * 0.8}px` }}
                            >
                                {storeName}
                            </div>
                        )}

                        {/* Product Name */}
                        {config.showProductName && (
                            <div
                                className="font-bold leading-tight w-full line-clamp-2 mb-0.5"
                                style={{ fontSize: `${config.productFontSize || config.fontSize}px` }}
                            >
                                {item.name}
                            </div>
                        )}

                        {/* Barcode */}
                        {config.showBarcode && item.barcode && (
                            <div className="flex flex-col items-center w-full my-0.5">
                                <div
                                    className="w-full"
                                    dangerouslySetInnerHTML={{
                                        __html: generateBarcodeHTML(
                                            item.barcode,
                                            (config.barcodeHeight || 15) * 3.78,
                                            config.barcodeWidth || 40
                                        )
                                    }}
                                />
                                <div
                                    className="tracking-wider leading-none font-mono"
                                    style={{ fontSize: `${config.fontSize * 0.8}px` }}
                                >
                                    {item.barcode}
                                </div>
                            </div>
                        )}

                        {/* Price */}
                        {config.showPrice && (
                            <div
                                className="font-bold leading-none mt-0.5 text-red-600"
                                style={{ fontSize: `${config.priceFontSize || config.fontSize * 1.2}px` }}
                            >
                                {formatVND(item.price)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Generate HTML string for printing barcode labels
 */
export function generateBarcodeLabelHTML(
    items: LabelItem[],
    config: LabelConfig,
    storeName: string
): string {
    // Expand items based on quantity
    const labelsToRender: LabelItem[] = [];
    items.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
            labelsToRender.push(item);
        }
    });

    const gridClass = config.cols === 1 ? 'grid-template-columns: 1fr;' :
        config.cols === 2 ? 'grid-template-columns: 1fr 1fr;' :
            'grid-template-columns: 1fr 1fr 1fr;';

    let labelsHtml = '';
    labelsToRender.forEach((item, idx) => {
        labelsHtml += `
            <div style="
                height: ${config.labelHeight}mm;
                font-size: ${config.fontSize}px;
                text-align: ${config.textAlign};
                border: 1px dashed #e5e7eb;
                border-radius: 2px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                overflow: hidden;
                background: white;
                padding: 0 4px;
            ">
                ${config.showShopName ? `
                    <div style="font-weight: 900; text-transform: uppercase; font-size: ${config.fontSize * 0.8}px; color: #000; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${storeName}
                    </div>
                ` : ''}
                
                ${config.showProductName ? `
                    <div style="font-weight: bold; line-height: 1.2; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: ${config.productFontSize || config.fontSize}px;">
                        ${item.name}
                    </div>
                ` : ''}
                
                ${config.showBarcode && item.barcode ? `
                    <div style="display: flex; flex-direction: column; align-items: center; margin: 2px 0;">
                        ${generateBarcodeHTML(item.barcode, (config.barcodeHeight || 15) * 3.78, config.barcodeWidth || 40)}
                        <div style="font-family: monospace; letter-spacing: 0.05em; font-size: ${config.fontSize * 0.8}px;">
                            ${item.barcode}
                        </div>
                    </div>
                ` : ''}
                
                ${config.showPrice ? `
                    <div style="font-weight: bold; font-size: ${config.priceFontSize || config.fontSize * 1.2}px; color: #dc2626; margin-top: 2px;">
                        ${new Intl.NumberFormat('vi-VN').format(item.price)}đ
                    </div>
                ` : ''}
            </div>
        `;
    });

    return `
        <div style="width: ${config.paperWidth}mm; background: white; margin: 0 auto;">
            <div style="
                display: grid;
                ${gridClass}
                column-gap: ${config.colGap}mm;
                row-gap: ${config.rowGap}mm;
                padding: 4px;
                align-content: start;
            ">
                ${labelsHtml}
            </div>
        </div>
    `;
}

export default BarcodeLabelTemplate;
