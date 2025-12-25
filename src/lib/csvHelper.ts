
export function exportToCSV<T>(data: T[], columns: { key: keyof T | string; header: string; formatter?: (value: any) => string }[], filename: string) {
    if (!data.length) return;

    // 1. Create Header Row
    const headers = columns.map(c => c.header).join(',');

    // 2. Create Data Rows
    const rows = data.map(item => {
        return columns.map(col => {
            let value = (item as any)[col.key];

            // Handle nested keys (e.g., 'category.name')
            if (typeof col.key === 'string' && col.key.includes('.')) {
                const parts = col.key.split('.');
                value = item;
                for (const part of parts) {
                    value = value ? (value as any)[part] : '';
                }
            }

            if (col.formatter) {
                value = col.formatter(value);
            }

            // Escape quotes and wrap in quotes if necessary
            const stringValue = String(value === null || value === undefined ? '' : value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',');
    });

    // 3. Combine with UTF-8 BOM
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');

    // 4. Create Download Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();

    // Cleanup with timeout to ensure download starts
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

export function parseCSV(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) {
                resolve([]);
                return;
            }

            // Remove BOM if present
            const cleanText = text.startsWith('\uFEFF') ? text.slice(1) : text;

            const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                resolve([]);
                return;
            }

            const headers = parseCSVLine(lines[0]);
            const results = [];

            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (values.length === headers.length) {
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        obj[header.trim()] = values[index];
                    });
                    results.push(obj);
                }
            }
            resolve(results);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Helper to correctly parse a CSV line handling quotes
function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') {
                // Double quote inside quotes -> single quote literal
                current += '"';
                i++;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}
