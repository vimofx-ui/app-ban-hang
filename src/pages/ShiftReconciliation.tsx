// =============================================================================
// SHIFT RECONCILIATION PAGE
// Wrapper for ShiftReconciliationView
// =============================================================================

import { useNavigate } from 'react-router-dom';
import { ShiftReconciliationView } from '@/components/shift/ShiftReconciliationView';

export function ShiftReconciliation() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <ShiftReconciliationView
                onSuccess={() => {
                    // After success (clock out), we redirect to Shift Page (which will show Start Shift Hero)
                    navigate('/shift');
                }}
                onCancel={() => {
                    // If canceled, go back to Shift Page (which shows Active Dashboard)
                    navigate('/shift');
                }}
            />
        </div>
    );
}

export default ShiftReconciliation;
