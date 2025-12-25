// =============================================================================
// USE PRINT HOOK - Unified Print Function Hook
// =============================================================================

import { useCallback } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { print } from '@/lib/printService';
import { generateSalesReceiptHTML } from '@/components/print/templates/SalesReceiptTemplate';
import { generatePurchaseReceiptHTML } from '@/components/print/templates/PurchaseReceiptTemplate';
import { generateReturnReceiptHTML } from '@/components/print/templates/ReturnReceiptTemplate';
import type { PurchaseOrderWithItems } from '@/stores/purchaseOrderStore';
import type { Supplier, Order } from '@/types';

export function usePrint() {
    const printSettings = useSettingsStore(state => state.printSettings);
    const receipt = useSettingsStore(state => state.receipt);

    /**
     * Print a sales receipt
     */
    const printSalesReceipt = useCallback(async (
        order: Order,
        cashierName: string = 'Admin'
    ) => {
        const config = printSettings.templates.sales_receipt;

        if (!config.enabled) {
            console.log('[usePrint] Sales receipt printing is disabled');
            return false;
        }

        const html = generateSalesReceiptHTML(
            {
                order,
                storeName: printSettings.storeName || receipt.storeName,
                storeAddress: printSettings.storeAddress || receipt.storeAddress,
                storePhone: printSettings.storePhone || receipt.storePhone,
                storeLogo: printSettings.storeLogo,
                logoSize: printSettings.logoSize,
                footerText: printSettings.footerText || receipt.footerText,
                noteText: printSettings.noteText,
                cashierName,
                customerName: order.customer?.name,
                customerPhone: order.customer?.phone,
                pointsEarned: (order as any).points_earned,
                pointsTotal: (order.customer as any)?.loyalty_points,
            },
            config
        );

        // Print specified number of copies
        const copies = config.copies || 1;
        for (let i = 0; i < copies; i++) {
            await print({
                templateType: 'sales_receipt',
                content: html,
                settings: printSettings
            });

            if (i < copies - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return true;
    }, [printSettings, receipt]);

    /**
     * Print a provisional receipt (Phieu tam tinh)
     */
    const printProvisionalReceipt = useCallback(async (
        order: Order,
        cashierName: string = 'Admin'
    ) => {
        const config = printSettings.templates.sales_receipt;

        if (!config.enabled) {
            console.log('[usePrint] Sales receipt printing is disabled');
            return false;
        }

        const html = generateSalesReceiptHTML(
            {
                order,
                storeName: printSettings.storeName || receipt.storeName,
                storeAddress: printSettings.storeAddress || receipt.storeAddress,
                storePhone: printSettings.storePhone || receipt.storePhone,
                storeLogo: printSettings.storeLogo,
                logoSize: printSettings.logoSize,
                footerText: printSettings.footerText || receipt.footerText,
                noteText: printSettings.noteText,
                cashierName,
                customerName: order.customer?.name,
                customerPhone: order.customer?.phone,
                pointsEarned: (order as any).points_earned,
                pointsTotal: (order.customer as any)?.loyalty_points,
                title: 'PHIẾU TẠM TÍNH'
            },
            config
        );

        // Print 1 copy for provisional
        await print({
            templateType: 'sales_receipt',
            content: html,
            settings: printSettings
        });

        return true;
    }, [printSettings, receipt]);

    /**
     * Print a purchase receipt
     */
    const printPurchaseReceipt = useCallback(async (
        order: PurchaseOrderWithItems,
        supplier?: Supplier
    ) => {
        const config = printSettings.templates.purchase_receipt;

        if (!config.enabled) {
            console.log('[usePrint] Purchase receipt printing is disabled');
            return false;
        }

        const html = generatePurchaseReceiptHTML(
            {
                receiptNumber: order.po_number,
                date: new Date(order.created_at),
                supplier: {
                    name: supplier?.name || order.supplier_name || 'Nhà cung cấp',
                    phone: supplier?.phone || '',
                    address: supplier?.address
                },
                items: (order.items as any[]).map(item => ({
                    name: item.product_name || item.product?.name || '',
                    sku: item.product_sku || item.product?.sku || '',
                    quantity: item.quantity,
                    unitName: item.unit_name || item.unit?.name || '',
                    unitPrice: item.unit_price
                })),
                totalAmount: order.total_amount,
                paidAmount: order.paid_amount || 0,
                debtAmount: (order.total_amount - (order.paid_amount || 0)),
                createdBy: order.assigned_to || 'Admin',
                storeName: printSettings.storeName || receipt.storeName,
                storeAddress: printSettings.storeAddress || receipt.storeAddress,
            },
            config
        );

        // Print specified number of copies
        const copies = config.copies || 1;
        for (let i = 0; i < copies; i++) {
            await print({
                templateType: 'purchase_receipt',
                content: html,
                settings: printSettings
            });

            if (i < copies - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return true;
    }, [printSettings, receipt]);

    /**
     * Print a return receipt
     */
    const printReturnReceipt = useCallback(async (
        order: Order,
        returnItems: any[], // Items being returned
        returnReason: string,
        refundAmount: number
    ) => {
        const config = printSettings.templates.return_receipt;

        if (!config.enabled) {
            console.log('[usePrint] Return receipt printing is disabled');
            return false;
        }

        const html = generateReturnReceiptHTML(
            {
                returnNumber: `RT-${order.order_number}`, // Generate a return number reference
                originalOrderNumber: order.order_number,
                date: new Date(),
                customer: { name: order.customer?.name || 'Khách lẻ', phone: order.customer?.phone },
                items: returnItems.map(item => ({
                    name: item.product?.name || 'Sản phẩm',
                    quantity: item.quantity,
                    unitName: item.unit_name || 'Cái',
                    unitPrice: item.unit_price,
                    reason: returnReason
                })),
                returnType: 'refund', // Defaulting to refund for now
                refundAmount: refundAmount,
                createdBy: 'Admin', // TODO: Get current user
                storeName: printSettings.storeName || receipt.storeName,
                storeAddress: printSettings.storeAddress || receipt.storeAddress,
                storePhone: printSettings.storePhone || receipt.storePhone
            },
            config
        );

        const copies = config.copies || 1;
        for (let i = 0; i < copies; i++) {
            await print({
                templateType: 'return_receipt',
                content: html,
                settings: printSettings
            });

            if (i < copies - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return true;
    }, [printSettings, receipt]);

    /**
     * Check if auto-print is enabled for a template type
     */
    const isAutoPrintEnabled = useCallback((templateType: string): boolean => {
        const template = printSettings.templates[templateType as keyof typeof printSettings.templates];
        return template ? (template as any).autoPrint === true : false;
    }, [printSettings]);

    /**
     * Check if a template is enabled
     */
    const isTemplateEnabled = useCallback((templateType: string): boolean => {
        const template = printSettings.templates[templateType as keyof typeof printSettings.templates];
        return template ? template.enabled === true : false;
    }, [printSettings]);

    /**
     * Get template config
     */
    const getTemplateConfig = useCallback((templateType: string) => {
        return printSettings.templates[templateType as keyof typeof printSettings.templates];
    }, [printSettings]);

    return {
        printSettings,
        printSalesReceipt,
        printProvisionalReceipt,
        printPurchaseReceipt,
        printReturnReceipt,
        isAutoPrintEnabled,
        isTemplateEnabled,
        getTemplateConfig,
    };
}

export default usePrint;
