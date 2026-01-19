import { useState, useCallback } from 'react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { findProductsByBarcode, type BarcodeMatch } from '@/components/common/BarcodeSelectionModal';
import { POSAudio } from '@/lib/posAudio';
import type { Product } from '@/types';

interface UsePOSScannerProps {
    products: Product[];
    addToCart: (product: Product) => void;
    addItemWithUnit: (product: Product, quantity: number, unitName: string, price: number, conversionRate: number, unitId?: string) => void;
    setSearchQuery: (query: string) => void;
    setShowSearchDropdown: (show: boolean) => void;
}

export function usePOSScanner({
    products,
    addToCart,
    addItemWithUnit,
    setSearchQuery,
    setShowSearchDropdown
}: UsePOSScannerProps) {
    const [barcodeMatches, setBarcodeMatches] = useState<BarcodeMatch[]>([]);
    const [barcodeError, setBarcodeError] = useState<string | null>(null);

    const handleBarcodeScan = useCallback((code: string) => {
        // FIRST: Blur any focused element to prevent accidental re-triggering
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        // Clear search input immediately when scanner detects a barcode
        setSearchQuery('');
        setShowSearchDropdown(false);

        // Find all products/units matching this barcode
        const matches = findProductsByBarcode(products, code);

        if (matches.length === 0) {
            // No match - play error sound and show notification only
            POSAudio.playError();
            setBarcodeError(`⚠️ Mã "${code}" không tồn tại!`);
            setTimeout(() => setBarcodeError(null), 3000); // Auto hide after 3s
            console.log(`[SCANNER] ❌ Not found: ${code}`);
        } else if (matches.length === 1) {
            // Single match - add directly to cart
            const match = matches[0];
            if (match.unit) {
                addItemWithUnit(
                    match.product,
                    1,
                    match.displayUnit,
                    match.price,
                    match.unit.conversion_rate,
                    match.unit.id
                );
            } else {
                addToCart(match.product);
            }
            // Play success sound
            POSAudio.playAddItem();
            console.log(`[SCANNER] ✅ Added: ${match.displayName} (${match.displayUnit})`);
        } else {
            // Multiple matches - show selection modal
            setBarcodeMatches(matches);
            console.log(`[SCANNER] 📌 Multiple matches (${matches.length}) for: ${code}`);
        }
    }, [products, addToCart, addItemWithUnit, setSearchQuery, setShowSearchDropdown]);

    // Handle barcode selection from modal
    const handleBarcodeSelect = useCallback((match: BarcodeMatch) => {
        if (match.unit) {
            addItemWithUnit(
                match.product,
                1,
                match.displayUnit,
                match.price,
                match.unit.conversion_rate,
                match.unit.id
            );
        } else {
            addToCart(match.product);
        }
        setBarcodeMatches([]);
        // Play success sound using POSAudio
        POSAudio.playAddItem();
    }, [addToCart, addItemWithUnit]);

    // Initialize generic scanner hook
    useBarcodeScanner({ onScan: handleBarcodeScan });

    return {
        barcodeMatches,
        setBarcodeMatches,
        barcodeError,
        setBarcodeError, // Expose setter for manual error handling (e.g. camera)
        handleBarcodeScan,
        handleBarcodeSelect
    };
}
