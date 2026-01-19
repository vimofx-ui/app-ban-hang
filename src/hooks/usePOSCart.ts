import { useState } from 'react';
import { usePOSStore, type CartItem } from '@/stores/posStore';
import type { DiscountType } from '@/types';

export const usePOSCart = () => {
    // Store Actions
    const {
        cartItems, addItemWithUnit, removeItem, updateItemQuantity, updateItemUnit,
        updateItemDiscount, updateItemNote
    } = usePOSStore();

    // Local State for Modals
    const [editingItem, setEditingItem] = useState<CartItem | null>(null);
    const [priceAdjustmentItem, setPriceAdjustmentItem] = useState<CartItem | null>(null);
    const [priceAdjust, setPriceAdjust] = useState({
        mode: 'percent' as 'percent' | 'amount' | 'custom',
        value: 0,
        reason: '',
        note: ''
    });
    const [itemDiscount, setItemDiscount] = useState<{ type: DiscountType, value: number }>({
        type: 'percent',
        value: 0
    });

    // Handlers
    const handleQuantityChange = (itemId: string, newQty: number) => {
        if (newQty <= 0) removeItem(itemId);
        else updateItemQuantity(itemId, newQty);
    };

    const handleUnitChange = (item: CartItem, selectedUnitName: string) => {
        const unit = item.product?.units?.find(u => u.unit_name === selectedUnitName);
        if (unit) {
            // If switching unit, we might need to "replace" the item to recalculate prices/ids?
            // The logic in POSPage was: add new item with unit, remove old.
            // But addItemWithUnit might merge if same?
            // "addItemWithUnit" usually generates a new ID or finds existing.
            // If we remove old one, we ensure no duplicate if ID changes.
            addItemWithUnit(item.product!, 1, unit.unit_name, unit.selling_price || item.product!.selling_price * unit.conversion_rate, unit.conversion_rate, unit.id);
            removeItem(item.id);
        } else {
            // Just update label if no unit definition found (fallback)
            updateItemUnit(item.id, selectedUnitName);
        }
    };

    const handlePriceAdjustmentRequest = (item: CartItem) => {
        setPriceAdjustmentItem(item);
        setPriceAdjust({ mode: 'percent', value: 0, reason: '', note: item.notes || '' });
    };

    const handleEditRequest = (item: CartItem) => {
        setEditingItem(item);
        // Initialize itemDiscount state from item?
        // Current POSPage logic didn't seem to init it from item, just default 0.
        // But maybe we should?
        // For now keep as is.
        setItemDiscount({ type: 'percent', value: 0 }); // Default
    };

    return {
        // State
        editingItem, setEditingItem,
        priceAdjustmentItem, setPriceAdjustmentItem,
        priceAdjust, setPriceAdjust,
        itemDiscount, setItemDiscount,

        // Handlers
        handleQuantityChange,
        handleUnitChange,
        handlePriceAdjustmentRequest,
        handleEditRequest,

        // Store helpers re-exported if needed
        removeItem,
        updateItemUnit,
        updateItemDiscount,
        updateItemNote
    };
};
