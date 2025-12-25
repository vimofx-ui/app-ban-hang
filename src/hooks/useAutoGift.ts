import { useMemo, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import type { Promotion } from '../stores/settingsStore';
import type { CartItem } from '../stores/posStore';
import type { Product } from '../types';

export interface AutoGiftResult {
    giftItems: Array<{
        productId: string;
        productName: string;
        quantity: number;
        promotionId: string;
        promotionName: string;
    }>;
    triggeredPromotions: Promotion[];
}

interface UseAutoGiftProps {
    cartItems: CartItem[];
    products: Product[];
}

/**
 * Hook to calculate auto-gift products based on cart contents and active promotions
 */
export function useAutoGift({ cartItems, products }: UseAutoGiftProps) {
    const { promotionSettings, getActivePromotions } = useSettingsStore();

    const activeAutoGiftPromotions = useMemo(() => {
        return getActivePromotions().filter(
            promo => promo.autoGift?.enabled && promo.autoGift?.autoAdd
        );
    }, [getActivePromotions]);

    const calculateGifts = useCallback((): AutoGiftResult => {
        const giftItems: AutoGiftResult['giftItems'] = [];
        const triggeredPromotions: Promotion[] = [];

        activeAutoGiftPromotions.forEach(promo => {
            if (!promo.autoGift) return;

            const { triggerProducts, triggerQuantity, giftProducts, giftCondition } = promo.autoGift;

            // Check if trigger conditions are met
            let conditionMet = false;

            if (giftCondition === 'any') {
                // Any trigger product with sufficient quantity
                conditionMet = cartItems.some(item => {
                    return triggerProducts.includes(item.product_id) && item.quantity >= triggerQuantity;
                });
            } else {
                // All trigger products required
                conditionMet = triggerProducts.every(triggerPid => {
                    const cartItem = cartItems.find(item => item.product_id === triggerPid);
                    return cartItem && cartItem.quantity >= triggerQuantity;
                });
            }

            if (conditionMet) {
                triggeredPromotions.push(promo);

                // Calculate gift quantities
                giftProducts.forEach(gift => {
                    const product = products.find(p => p.id === gift.productId);
                    if (product) {
                        // Calculate how many times the trigger condition is met
                        let multiplier = 1;
                        if (giftCondition === 'any') {
                            const triggerItem = cartItems.find(
                                item => triggerProducts.includes(item.product_id) && item.quantity >= triggerQuantity
                            );
                            if (triggerItem) {
                                multiplier = Math.floor(triggerItem.quantity / triggerQuantity);
                            }
                        }

                        const giftQty = Math.min(
                            gift.quantity * multiplier,
                            gift.maxPerOrder || gift.quantity * multiplier
                        );

                        giftItems.push({
                            productId: gift.productId,
                            productName: product.name,
                            quantity: giftQty,
                            promotionId: promo.id,
                            promotionName: promo.name,
                        });
                    }
                });
            }
        });

        return { giftItems, triggeredPromotions };
    }, [activeAutoGiftPromotions, cartItems, products]);

    const { giftItems, triggeredPromotions } = useMemo(
        () => calculateGifts(),
        [calculateGifts]
    );

    // Check if an item is a gift item
    const isGiftItem = useCallback((productId: string): boolean => {
        return giftItems.some(gift => gift.productId === productId);
    }, [giftItems]);

    // Get gift info for a product
    const getGiftInfo = useCallback((productId: string) => {
        return giftItems.find(gift => gift.productId === productId) || null;
    }, [giftItems]);

    // Check if any promotion was triggered
    const hasActiveGifts = giftItems.length > 0;

    return {
        giftItems,
        triggeredPromotions,
        isGiftItem,
        getGiftInfo,
        hasActiveGifts,
        activeAutoGiftPromotions,
    };
}

export default useAutoGift;
