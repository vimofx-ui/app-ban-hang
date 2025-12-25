import { renderToString } from 'react-dom/server';
import { ShippingLabelTemplate, type ShippingLabelData, type ShippingLabelConfig } from '@/components/print/ShippingLabelTemplate';

export const generateShippingLabelHTML = (
    data: ShippingLabelData,
    config: ShippingLabelConfig
): string => {
    // Render the React component to static HTML markup
    const componentHtml = renderToString(
        <ShippingLabelTemplate data={data} config={config} />
    );

    // Calculate dimensions based on config
    let width = '105mm';
    let height = '148mm';

    if (config.paperSize === 'A5') {
        width = '148mm';
        height = '210mm';
    } else if (config.paperSize === '10x15') {
        width = '100mm';
        height = '150mm';
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>In Vận Đơn - ${data.order.order_number}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            
            body {
                margin: 0;
                padding: 0;
                background-color: white;
            }
            
            @page {
                size: ${width} ${height};
                margin: 0;
            }

            /* Ensure content fits nicely when printing */
            .print-container {
                width: ${width};
                height: ${height};
                box-sizing: border-box;
                padding: 5px; /* Small padding for safe area */
            }

            /* Hide browser default headers/footers if possible in CSS (often browser setting dependent) */
            @media print {
                body { 
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact;
                }
            }
        </style>
    </head>
    <body>
        <div class="print-container">
            ${componentHtml}
        </div>
        <script>
            // Auto close after print dialog is closed (works in some browsers)
            window.onload = function() {
                window.print();
                // Optional: window.close(); 
            }
        </script>
    </body>
    </html>
    `;
};
