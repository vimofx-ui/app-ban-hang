// =============================================================================
// CSV IMPORT/EXPORT UTILITY
// Supports Sapo and KiotViet formats
// =============================================================================

import type { Product, Customer, Supplier } from '@/types';
import { generateId } from '@/lib/utils';

// ============= SAPO FORMAT =============
// Sapo product CSV columns:
// Mã SKU, Tên sản phẩm, Barcode, Giá bán, Giá vốn, Tồn kho, Danh mục, Mô tả

export interface SapoProduct {
    'Mã SKU': string;
    'Tên sản phẩm': string;
    'Barcode': string;
    'Giá bán': string;
    'Giá vốn': string;
    'Tồn kho': string;
    'Danh mục': string;
    'Mô tả': string;
}

// ============= KIOTVIET FORMAT =============
// KiotViet product CSV columns:
// Mã hàng, Tên hàng, Mã vạch, Giá bán lẻ, Giá nhập, Tồn kho, Nhóm hàng, Ghi chú

export interface KiotVietProduct {
    'Mã hàng': string;
    'Tên hàng': string;
    'Mã vạch': string;
    'Giá bán lẻ': string;
    'Giá nhập': string;
    'Tồn kho': string;
    'Nhóm hàng': string;
    'Ghi chú': string;
}

export type CSVFormat = 'sapo' | 'kiotviet' | 'auto';

/**
 * Parse CSV text into array of objects
 */
function parseCSV(csvText: string): Record<string, string>[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse header - handle BOM and quotes
    const headerLine = lines[0].replace(/^\uFEFF/, '').trim();
    const headers = parseCSVLine(headerLine);

    const results: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i].trim());
        if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        results.push(row);
    }

    return results;
}

/**
 * Parse a single CSV line (handles quoted values with commas)
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

/**
 * Detect CSV format (Sapo or KiotViet)
 */
export function detectCSVFormat(csvText: string): CSVFormat {
    const firstLine = csvText.split('\n')[0].toLowerCase();

    if (firstLine.includes('mã sku') || firstLine.includes('giá vốn')) {
        return 'sapo';
    } else if (firstLine.includes('mã hàng') || firstLine.includes('giá bán lẻ')) {
        return 'kiotviet';
    }

    return 'sapo'; // Default to Sapo
}

/**
 * Parse price string to number
 */
function parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    // Remove currency symbols, dots, commas and parse
    const cleaned = priceStr.replace(/[^\d]/g, '');
    return parseInt(cleaned, 10) || 0;
}

/**
 * Import products from CSV (supports Sapo and KiotViet formats)
 */
export function importProductsFromCSV(csvText: string, format: CSVFormat = 'auto'): Partial<Product>[] {
    if (format === 'auto') {
        format = detectCSVFormat(csvText);
    }

    const rows = parseCSV(csvText);

    return rows.map(row => {
        if (format === 'sapo') {
            return {
                id: generateId(),
                sku: row['Mã SKU'] || null,
                name: row['Tên sản phẩm'] || 'Unnamed Product',
                barcode: row['Barcode'] || null,
                selling_price: parsePrice(row['Giá bán']),
                cost_price: parsePrice(row['Giá vốn']),
                current_stock: parseInt(row['Tồn kho'], 10) || 0,
                description: row['Mô tả'] || null,
                unit: 'cái',
                min_stock: 10,
                is_active: true,
                allow_negative_stock: false,
                created_at: new Date().toISOString(),
            };
        } else { // kiotviet
            return {
                id: generateId(),
                sku: row['Mã hàng'] || null,
                name: row['Tên hàng'] || 'Unnamed Product',
                barcode: row['Mã vạch'] || null,
                selling_price: parsePrice(row['Giá bán lẻ']),
                cost_price: parsePrice(row['Giá nhập']),
                current_stock: parseInt(row['Tồn kho'], 10) || 0,
                description: row['Ghi chú'] || null,
                unit: 'cái',
                min_stock: 10,
                is_active: true,
                allow_negative_stock: false,
                created_at: new Date().toISOString(),
            };
        }
    });
}

/**
 * Export products to CSV (Sapo format)
 */
export function exportProductsToCSV(products: Product[], format: CSVFormat = 'sapo'): string {
    if (format === 'sapo') {
        const headers = ['Mã SKU', 'Tên sản phẩm', 'Barcode', 'Giá bán', 'Giá vốn', 'Tồn kho', 'Danh mục', 'Mô tả'];
        const rows = products.map(p => [
            p.sku || '',
            p.name,
            p.barcode || '',
            p.selling_price.toString(),
            p.cost_price.toString(),
            p.current_stock.toString(),
            '', // Category
            p.description || ''
        ]);
        return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    } else {
        const headers = ['Mã hàng', 'Tên hàng', 'Mã vạch', 'Giá bán lẻ', 'Giá nhập', 'Tồn kho', 'Nhóm hàng', 'Ghi chú'];
        const rows = products.map(p => [
            p.sku || '',
            p.name,
            p.barcode || '',
            p.selling_price.toString(),
            p.cost_price.toString(),
            p.current_stock.toString(),
            '', // Category
            p.description || ''
        ]);
        return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    }
}

/**
 * Import customers from CSV
 */
export function importCustomersFromCSV(csvText: string): Partial<Customer>[] {
    const rows = parseCSV(csvText);

    return rows.map(row => ({
        id: generateId(),
        code: row['Mã KH'] || row['Mã khách hàng'] || undefined,
        name: row['Tên khách hàng'] || row['Tên'] || 'Unknown',
        phone: row['Số điện thoại'] || row['SĐT'] || undefined,
        email: row['Email'] || undefined,
        address: row['Địa chỉ'] || undefined,
        points_balance: 0,
        total_spent: 0,
        total_orders: 0,
        debt_balance: parsePrice(row['Công nợ'] || '0'),
        is_active: true,
        created_at: new Date().toISOString(),
    }));
}

/**
 * Export customers to CSV
 */
export function exportCustomersToCSV(customers: Customer[]): string {
    const headers = ['Mã KH', 'Tên khách hàng', 'Số điện thoại', 'Email', 'Địa chỉ', 'Điểm tích lũy', 'Công nợ'];
    const rows = customers.map(c => [
        c.code || '',
        c.name,
        c.phone || '',
        c.email || '',
        c.address || '',
        c.points_balance.toString(),
        c.debt_balance.toString()
    ]);
    return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
}

/**
 * Import suppliers from CSV
 */
export function importSuppliersFromCSV(csvText: string): Partial<Supplier>[] {
    const rows = parseCSV(csvText);

    return rows.map(row => ({
        id: generateId(),
        code: row['Mã NCC'] || undefined,
        name: row['Tên nhà cung cấp'] || row['Tên'] || 'Unknown',
        contact_person: row['Người liên hệ'] || undefined,
        phone: row['Số điện thoại'] || row['SĐT'] || undefined,
        email: row['Email'] || undefined,
        address: row['Địa chỉ'] || undefined,
        payment_terms: parseInt(row['Công nợ (ngày)'] || '30', 10),
        is_active: true,
        created_at: new Date().toISOString(),
    }));
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}
