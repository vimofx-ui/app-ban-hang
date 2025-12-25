// =============================================================================
// BARCODE PRINTING UTILITY
// Generates barcode labels for products
// =============================================================================

import type { Product } from '@/types';
import { formatVND } from '@/lib/cashReconciliation';

export interface BarcodeLabel {
    product: Product;
    quantity: number;
}

/**
 * Generates printable barcode labels HTML
 */
export function generateBarcodeLabelHTML(labels: BarcodeLabel[]): string {
    const labelStyles = `
        <style>
            @page {
                size: 50mm 30mm;
                margin: 0;
            }
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            body {
                font-family: Arial, sans-serif;
            }
            .label {
                width: 50mm;
                height: 30mm;
                padding: 2mm;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                border: 0.5mm solid #ccc;
                page-break-after: always;
            }
            .label:last-child {
                page-break-after: avoid;
            }
            .product-name {
                font-size: 8pt;
                font-weight: bold;
                text-align: center;
                line-height: 1.2;
                max-height: 7mm;
                overflow: hidden;
            }
            .barcode-container {
                text-align: center;
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .barcode {
                font-family: 'Libre Barcode 128', 'Libre Barcode EAN13 Text', monospace;
                font-size: 32pt;
                letter-spacing: -1px;
            }
            .barcode-text {
                font-size: 7pt;
                text-align: center;
                font-family: monospace;
            }
            .price {
                font-size: 12pt;
                font-weight: bold;
                text-align: center;
                color: #000;
            }
        </style>
    `;

    const labelHTML = labels.flatMap(({ product, quantity }) =>
        Array(quantity).fill(null).map(() => `
            <div class="label">
                <div class="product-name">${product.name}</div>
                <div class="barcode-container">
                    <div>
                        <div class="barcode">*${product.barcode || product.sku}*</div>
                        <div class="barcode-text">${product.barcode || product.sku || 'N/A'}</div>
                    </div>
                </div>
                <div class="price">${formatVND(product.selling_price)}</div>
            </div>
        `)
    ).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Barcode Labels</title>
            <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128+Text&display=swap" rel="stylesheet">
            ${labelStyles}
        </head>
        <body>
            ${labelHTML}
        </body>
        </html>
    `;
}

/**
 * Opens a print dialog with barcode labels
 */
export function printBarcodeLabels(labels: BarcodeLabel[]): void {
    const html = generateBarcodeLabelHTML(labels);
    const printWindow = window.open('', '_blank');

    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();

        // Wait for fonts to load, then print
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }
}

/**
 * Generates barcode as SVG (Code 128 simplified)
 */
export function generateBarcodeSVG(value: string, width = 200, height = 60): string {
    // This is a simplified barcode visualization
    // For production, use a proper library like JsBarcode

    const barWidth = width / (value.length * 11 + 35); // Rough estimate
    let x = 10;
    let bars = '';

    // Start pattern
    bars += `<rect x="${x}" y="5" width="${barWidth * 2}" height="${height - 15}" fill="black"/>`;
    x += barWidth * 3;
    bars += `<rect x="${x}" y="5" width="${barWidth}" height="${height - 15}" fill="black"/>`;
    x += barWidth * 2;
    bars += `<rect x="${x}" y="5" width="${barWidth}" height="${height - 15}" fill="black"/>`;
    x += barWidth * 4;

    // Data bars (simplified - alternating pattern based on char code)
    for (const char of value) {
        const code = char.charCodeAt(0);
        for (let i = 0; i < 6; i++) {
            if ((code >> i) & 1) {
                bars += `<rect x="${x}" y="5" width="${barWidth}" height="${height - 15}" fill="black"/>`;
            }
            x += barWidth;
        }
        x += barWidth;
    }

    // End pattern
    bars += `<rect x="${x}" y="5" width="${barWidth * 2}" height="${height - 15}" fill="black"/>`;
    x += barWidth * 3;
    bars += `<rect x="${x}" y="5" width="${barWidth}" height="${height - 15}" fill="black"/>`;

    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <rect width="100%" height="100%" fill="white"/>
            ${bars}
            <text x="${width / 2}" y="${height - 3}" text-anchor="middle" font-family="monospace" font-size="10">${value}</text>
        </svg>
    `;
}
