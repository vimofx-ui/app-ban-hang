import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
    return crypto.randomUUID();
}

/**
 * Formats a date to Vietnamese locale
 */
export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

/**
 * Formats a datetime to Vietnamese locale
 */
export function formatDateTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Formats time only
 */
export function formatTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Debounce function for input handlers
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;

    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Checks if running on mobile device
 */
export function isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
}

/**
 * Generates order number in format: PREFIX + YYMMDD + 4-digit random
 */
export function generateOrderNumber(sequence: number | string = 1, prefix = 'HD'): string {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // If sequence is a string, use it as prefix and generate random sequence
    if (typeof sequence === 'string') {
        prefix = sequence;
        const randomSeq = Math.floor(Math.random() * 9999) + 1;
        return `${prefix}${year}${month}${day}${String(randomSeq).padStart(4, '0')}`;
    }

    const seq = String(sequence).padStart(4, '0');
    return `${prefix}${year}${month}${day}${seq}`;
}

/**
 * Keyboard shortcut helper
 */
export function isShortcut(e: KeyboardEvent, key: string, modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
}): boolean {
    const ctrl = modifiers?.ctrl ?? false;
    const shift = modifiers?.shift ?? false;
    const alt = modifiers?.alt ?? false;

    return (
        e.key.toLowerCase() === key.toLowerCase() &&
        e.ctrlKey === ctrl &&
        e.shiftKey === shift &&
        e.altKey === alt
    );
}

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
