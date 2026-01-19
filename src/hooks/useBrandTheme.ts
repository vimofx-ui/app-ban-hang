import { useEffect } from 'react';
import { useBrandStore } from '@/stores/brandStore';

export function useBrandTheme() {
    const { currentBrand } = useBrandStore();

    useEffect(() => {
        if (!currentBrand) return;

        const root = document.documentElement;

        // Apply Primary Color
        if (currentBrand.primary_color) {
            root.style.setProperty('--primary', currentBrand.primary_color);
            // Also set a darker shade for hover states if needed, or rely on opacity/filters
            // For Tailwind 'text-primary' to work with custom values, we usually set the RGB or HSL values if defined in config
            // But if 'primary' is defined as 'var(--primary)' in tailwind config, this works.

            // Assuming tailwind config uses: 
            // colors: { primary: 'var(--primary)' } or similar
            // If not, we might need to be more creative. 
            // Let's assume for now we set a CSS variable that the app might use.
            // If the app uses standard Tailwind colors (e.g. bg-emerald-600), this won't override them unless we change the config.

            // However, this task said "Apply CSS Variables dynamically".
            // Since the project seems to use standard Tailwind classes (bg-emerald-600), we can't easily override them via vars unless we refactored.
            // BUT, we can try to override specific utility classes if we wanted, or just set the vars and hope the codebase uses them.

            // Wait, looking at MainLayout.tsx, it uses 'bg-primary' in some places:
            // line 161: bg-gradient-to-br from-primary to-primary-dark
            // line 201: text-primary
            // line 225: bg-primary/10 text-primary

            // So 'primary' IS a custom color in Tailwind.
            // I need to check tailwind.config.js or index.css to see how 'primary' is defined.
        }

        // Apply Secondary Color
        if (currentBrand.secondary_color) {
            root.style.setProperty('--secondary', currentBrand.secondary_color);
        }

    }, [currentBrand]);
}
