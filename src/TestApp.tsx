
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DomainProvider } from './contexts/DomainContext';
import { BrandGuard } from './components/auth/BrandGuard';

export default function TestApp() {
    return (
        <BrowserRouter>
            <DomainProvider>
                <BrandGuard>
                    <div style={{ padding: 20 }}>
                        <h1>Test App Working + BrandGuard</h1>
                        <p>If you can see this, BrandGuard has successfully validated the brand.</p>
                    </div>
                </BrandGuard>
            </DomainProvider>
        </BrowserRouter>
    );
}
