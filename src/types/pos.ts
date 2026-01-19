import type { Customer } from '@/types';
import type { CartItem } from '@/stores/posStore';

export interface OrderTab {
    id: string;
    label: string;
    items: CartItem[];
    customer: Customer | null;
    note: string;
    lastPrintTime?: Date | null;
    switchCount?: number;
}
