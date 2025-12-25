// =============================================================================
// PRINT SERVICE - Handles printing for all document types
// =============================================================================

import type { PrintSettings, PrinterSettings, PrintTemplateType } from '@/stores/settingsStore';

// =============================================================================
// USB DEVICE MANAGEMENT
// =============================================================================

// WebUSB type declarations (for browsers that support WebUSB API)
declare global {
    interface Navigator {
        usb?: {
            requestDevice(options: { filters: unknown[] }): Promise<USBDeviceType>;
            getDevices(): Promise<USBDeviceType[]>;
        };
    }
}

interface USBDeviceType {
    productName?: string;
    manufacturerName?: string;
    configuration: {
        interfaces?: Array<{
            alternate?: {
                endpoints?: Array<{ endpointNumber: number; direction: string }>;
            };
        }>;
    } | null;
    opened?: boolean;
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(configurationValue: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    releaseInterface(interfaceNumber: number): Promise<void>;
    transferOut(endpointNumber: number, data: BufferSource): Promise<unknown>;
}

let usbDevice: USBDeviceType | null = null;

/**
 * Check if WebUSB is supported in the browser
 */
export function isWebUSBSupported(): boolean {
    return 'usb' in navigator;
}

/**
 * Connect to a USB printer using WebUSB
 */
export async function connectUSBPrinter(): Promise<{ success: boolean; deviceName: string | null; error?: string }> {
    try {
        if (!isWebUSBSupported()) {
            return { success: false, deviceName: null, error: 'Trình duyệt không hỗ trợ WebUSB' };
        }

        // Request USB device - filters can be added for specific printers
        const device = await navigator.usb!.requestDevice({ filters: [] });

        await device.open();

        // Select configuration (most printers use configuration 1)
        if (device.configuration === null) {
            await device.selectConfiguration(1);
        }

        // Claim the first interface
        await device.claimInterface(0);

        usbDevice = device;

        return {
            success: true,
            deviceName: device.productName || device.manufacturerName || 'Máy in USB'
        };
    } catch (error) {
        console.error('[PrintService] USB connection error:', error);
        return {
            success: false,
            deviceName: null,
            error: error instanceof Error ? error.message : 'Không thể kết nối máy in USB'
        };
    }
}

/**
 * Disconnect from USB printer
 */
export async function disconnectUSBPrinter(): Promise<void> {
    if (usbDevice) {
        try {
            await usbDevice.close();
        } catch (error) {
            console.error('[PrintService] USB disconnect error:', error);
        }
        usbDevice = null;
    }
}

/**
 * Check if USB printer is connected
 */
export function isUSBConnected(): boolean {
    return usbDevice !== null && Boolean(usbDevice.opened);
}

/**
 * Get connected USB device name
 */
export function getUSBDeviceName(): string | null {
    return usbDevice?.productName || usbDevice?.manufacturerName || null;
}

// =============================================================================
// ESC/POS COMMANDS (for thermal printers)
// =============================================================================

const ESC = 0x1B;
const GS = 0x1D;

const ESC_POS = {
    // Initialize printer
    INIT: new Uint8Array([ESC, 0x40]),

    // Text alignment
    ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
    ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
    ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),

    // Text formatting
    BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
    BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
    DOUBLE_HEIGHT_ON: new Uint8Array([GS, 0x21, 0x10]),
    DOUBLE_WIDTH_ON: new Uint8Array([GS, 0x21, 0x20]),
    DOUBLE_SIZE_ON: new Uint8Array([GS, 0x21, 0x30]),
    NORMAL_SIZE: new Uint8Array([GS, 0x21, 0x00]),

    // Paper operations
    CUT_PAPER: new Uint8Array([GS, 0x56, 0x00]),
    FEED_LINE: new Uint8Array([ESC, 0x64, 0x02]),
    FEED_LINES: (n: number) => new Uint8Array([ESC, 0x64, n]),
};

/**
 * Convert text to Uint8Array for USB printing
 */
function textToBytes(text: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(text);
}

// =============================================================================
// PRINT FUNCTIONS
// =============================================================================

/**
 * Print via USB using raw ESC/POS commands
 */
async function printViaUSB(data: Uint8Array): Promise<boolean> {
    if (!usbDevice || !usbDevice.opened) {
        console.error('[PrintService] USB device not connected');
        return false;
    }

    try {
        // Find the OUT endpoint
        const configuration = usbDevice.configuration;
        if (!configuration) {
            throw new Error('No USB configuration');
        }

        // Use any type for WebUSB interface traversal (browser-specific API types)
        const configAny = configuration as { interfaces?: unknown[] };
        const iface = (configAny.interfaces as unknown[])?.[0] as { alternates?: unknown[] } | undefined;
        const alternate = (iface?.alternates as unknown[])?.[0] as { endpoints?: Array<{ endpointNumber: number; direction: string }> } | undefined;
        const endpoint = alternate?.endpoints?.find((ep) => ep.direction === 'out');

        if (!endpoint) {
            throw new Error('No OUT endpoint found');
        }

        await usbDevice.transferOut(endpoint.endpointNumber, data.buffer as ArrayBuffer);
        return true;
    } catch (error) {
        console.error('[PrintService] USB print error:', error);
        return false;
    }
}

/**
 * Print via browser's print dialog (Driver method)
 */
export function printViaDriver(contentHtml: string): void {
    // Create a hidden iframe for printing
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const printDocument = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!printDocument) {
        console.error('[PrintService] Could not access print frame document');
        return;
    }

    // Write content to iframe
    printDocument.open();
    printDocument.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Print</title>
            <style>
                @media print {
                    @page { margin: 0; size: auto; }
                    body { margin: 0; padding: 10px; }
                }
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    line-height: 1.4;
                }
                .receipt { max-width: 80mm; margin: 0 auto; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .border-top { border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px; }
                .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; }
                td { padding: 2px 0; }
                .item-name { max-width: 120px; word-wrap: break-word; }
            </style>
        </head>
        <body>
            ${contentHtml}
        </body>
        </html>
    `);
    printDocument.close();

    // Wait for content to load, then print
    printFrame.onload = () => {
        setTimeout(() => {
            printFrame.contentWindow?.print();
            // Remove iframe after printing
            setTimeout(() => {
                document.body.removeChild(printFrame);
            }, 1000);
        }, 100);
    };
}

/**
 * Print via LAN/Network (placeholder - requires backend service)
 */
export async function printViaLAN(content: string, ip: string, port: string): Promise<boolean> {
    // Note: Direct socket connection from browser is not possible due to security restrictions
    // This would require a local bridge service or backend API
    console.log(`[PrintService] LAN print to ${ip}:${port}`);
    console.warn('[PrintService] LAN printing requires a backend service');

    // For now, fall back to driver printing
    printViaDriver(content);
    return true;
}

// =============================================================================
// MAIN PRINT FUNCTION
// =============================================================================

export interface PrintOptions {
    templateType: PrintTemplateType;
    content: string;
    settings: PrintSettings;
}

/**
 * Main print function - routes to appropriate print method
 */
export async function print(options: PrintOptions): Promise<boolean> {
    const { content, settings } = options;
    const { printer } = settings;

    console.log(`[PrintService] Printing via ${printer.method}...`);

    switch (printer.method) {
        case 'usb':
            if (!isUSBConnected()) {
                console.error('[PrintService] USB printer not connected');
                // Fall back to driver
                printViaDriver(content);
                return true;
            }
            // For USB, we need to convert HTML to ESC/POS commands
            // For simplicity, we'll use driver printing for complex HTML
            printViaDriver(content);
            return true;

        case 'lan':
            return await printViaLAN(content, printer.lanIp, printer.lanPort);

        case 'driver':
        default:
            printViaDriver(content);
            return true;
    }
}

/**
 * Test print - prints a test page
 */
export async function testPrint(settings: PrintSettings): Promise<boolean> {
    const testContent = `
        <div class="receipt text-center">
            <h2>🖨️ TEST PRINT</h2>
            <div class="border-bottom">
                <p><strong>${settings.storeName}</strong></p>
                <p>${settings.storeAddress}</p>
                <p>ĐT: ${settings.storePhone}</p>
            </div>
            <p>Phương thức: ${settings.printer.method.toUpperCase()}</p>
            <p>Thời gian: ${new Date().toLocaleString('vi-VN')}</p>
            <div class="border-top">
                <p>✅ Máy in hoạt động bình thường!</p>
            </div>
            <p style="margin-top: 20px;">${settings.footerText}</p>
        </div>
    `;

    return await print({
        templateType: 'sales_receipt',
        content: testContent,
        settings
    });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency for receipts
 */
export function formatReceiptCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN');
}

/**
 * Generate barcode HTML (simple Code128-like display)
 * @param code - Barcode value
 * @param height - Height in pixels (default 30)
 * @param widthMm - Width in mm (optional)
 */
export function generateBarcodeHTML(code: string, height: number = 30, widthMm?: number): string {
    // Seed random from code to get consistent bars
    let seed = 0;
    for (let i = 0; i < code.length; i++) {
        seed = ((seed << 5) - seed) + code.charCodeAt(i);
        seed = seed & seed;
    }
    const seededRandom = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };

    // Generate bar pattern - alternating black and white bars
    const barPattern: { isBlack: boolean; width: number }[] = [];
    const numBars = code.length * 3 + 6; // More bars for realistic look

    for (let i = 0; i < numBars; i++) {
        barPattern.push({
            isBlack: i % 2 === 0, // Alternate black and white
            width: Math.floor(seededRandom() * 2) + 1 // 1-2 units wide
        });
    }

    // Calculate total units
    const totalUnits = barPattern.reduce((sum, bar) => sum + bar.width, 0);

    // Calculate pixel per unit based on desired width
    const totalWidthPx = widthMm ? widthMm * 3.78 : 100; // Default 100px if no width specified
    const pxPerUnit = totalWidthPx / totalUnits;

    // Generate bars HTML
    const barsHtml = barPattern.map(bar => {
        const barWidthPx = Math.max(1, Math.round(bar.width * pxPerUnit));
        const color = bar.isBlack ? '#000' : '#fff';
        return `<div style="display:inline-block;width:${barWidthPx}px;height:${height}px;background:${color};"></div>`;
    }).join('');

    return `
        <div style="text-align:center;margin:2px 0;">
            <div style="display:inline-block;background:#fff;padding:0 2px;">${barsHtml}</div>
        </div>
    `;
}

