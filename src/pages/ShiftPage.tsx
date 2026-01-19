// =============================================================================
// SHIFT MANAGEMENT PAGE
// Enhanced to support Employee Selection + Time Adjustment
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { useShiftStore } from '@/stores/shiftStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createEmptyCashDetails } from '@/lib/cashReconciliation';
import type { CashDetails } from '@/types';
import { useUserStore } from '@/stores/userStore';
import { StartShiftHero, StepInit, StepMoney, StepConfirm } from '@/components/shift/StartShiftWizard';
import { ActiveShiftDashboard } from '@/components/shift/ActiveShiftDashboard';

type WizardStep = 'init' | 'money' | 'confirm';
type EntryMode = 'new' | 'handover';

export function ShiftPage() {
    // Stores
    const { currentShift, clockIn, isClockingIn, fetchHistory, history } = useShiftStore();
    const { user: authUser } = useAuthStore();
    const { shift: shiftSettings } = useSettingsStore();
    const { users, fetchUsers } = useUserStore();

    // Local State
    const [wizardStep, setWizardStep] = useState<WizardStep>('init');
    const [showClockIn, setShowClockIn] = useState(false);

    // Form State
    const [staffName, setStaffName] = useState('');
    const [entryMode, setEntryMode] = useState<EntryMode>('new');
    const [manualStartTime, setManualStartTime] = useState<string>('');
    // Removed isTimeAdjustEnabled as per user request to always show picker

    // Money State
    const [openingCashDetails, setOpeningCashDetails] = useState<CashDetails>(createEmptyCashDetails());
    const [openingBankBalance, setOpeningBankBalance] = useState<number>(0);
    const [startNote, setStartNote] = useState('');
    const [handoverPerson, setHandoverPerson] = useState('');

    // Previous Shift Data (for handover)
    const [selectedPrevShiftId, setSelectedPrevShiftId] = useState<string>('');

    // Initial Load
    useEffect(() => {
        fetchHistory();
        fetchUsers();
        if (authUser) {
            setStaffName(authUser.name || authUser.email || '');
        }
    }, [fetchHistory, fetchUsers, authUser]);

    // Get list of closed shifts for handover
    const closedShifts = useMemo(() => {
        return history
            .filter(s => s.status === 'reconciled' || s.status === 'closed')
            .sort((a, b) => new Date(b.clock_out || 0).getTime() - new Date(a.clock_out || 0).getTime());
    }, [history]);

    // Auto-select latest shift
    useEffect(() => {
        if (closedShifts.length > 0 && !selectedPrevShiftId) {
            setSelectedPrevShiftId(closedShifts[0].id);
        }
    }, [closedShifts, selectedPrevShiftId]);

    // Derived selected previous shift
    const selectedPrevShift = useMemo(() =>
        closedShifts.find(s => s.id === selectedPrevShiftId) || null
        , [closedShifts, selectedPrevShiftId]);

    // Update handover person when prev shift is selected
    useEffect(() => {
        if (entryMode === 'handover' && selectedPrevShift) {
            setHandoverPerson(selectedPrevShift.user_id || '');
        }
    }, [entryMode, selectedPrevShift]);

    // Set default time logic
    useEffect(() => {
        // Always initialize with current time if empty
        if (!manualStartTime) {
            const now = new Date();
            // Format for datetime-local input: YYYY-MM-DDTHH:mm
            const iso = now.toLocaleString('sv').replace(' ', 'T').slice(0, 16);
            setManualStartTime(iso);
        }
    }, [shiftSettings?.mode]);

    // Auto-advance for Automatic Mode
    useEffect(() => {
        if (shiftSettings?.mode === 'auto' && wizardStep === 'init' && showClockIn) {
            setEntryMode('new');
            // Force start time to now just in case
            const now = new Date();
            const iso = now.toLocaleString('sv').replace(' ', 'T').slice(0, 16);
            setManualStartTime(iso);
            setWizardStep('money');
        }
    }, [shiftSettings?.mode, wizardStep, showClockIn]);

    // Handlers
    const handleInitNext = () => {
        if (entryMode === 'handover' && selectedPrevShift) {
            // Pre-fill from selected previous shift
            if (selectedPrevShift.closing_cash_details) {
                setOpeningCashDetails(selectedPrevShift.closing_cash_details);
            }
            if (selectedPrevShift.closing_bank_balance) {
                setOpeningBankBalance(selectedPrevShift.closing_bank_balance);
            } else {
                setOpeningBankBalance(0);
            }
        } else {
            // Reset for new
            if (entryMode === 'new') {
                setOpeningCashDetails(createEmptyCashDetails());
                setOpeningBankBalance(0);
            }
        }
        setWizardStep('money');
    };

    const handleMoneyNext = () => {
        setWizardStep('confirm');
    };

    const handleConfirm = async () => {
        if (!staffName.trim()) return;

        const userId = authUser?.id || crypto.randomUUID();
        const role = authUser?.role || 'staff';

        let finalStartTime = new Date().toISOString();
        if (manualStartTime) {
            finalStartTime = new Date(manualStartTime).toISOString();
        }

        await clockIn(
            userId,
            staffName,
            role,
            openingCashDetails.total,
            openingCashDetails,
            openingBankBalance,
            finalStartTime,
            startNote,
            handoverPerson
        );

        // Reset
        setShowClockIn(false);
        setWizardStep('init');
    };

    // Render Active Shift Dashboard
    if (currentShift) {
        return <ActiveShiftDashboard shift={currentShift} onEndShift={() => window.location.href = '/doi-soat'} />;
    }

    // Render Start Shift Wizard
    if (!showClockIn) {
        return <StartShiftHero onStart={() => setShowClockIn(true)} />;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
            <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                {/* Wizard Header */}
                <div className="bg-gray-900 text-white p-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold">Bắt đầu ca làm việc</h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {wizardStep === 'init' && 'Bước 1: Thiết lập'}
                            {wizardStep === 'money' && 'Bước 2: Kiểm kê tiền'}
                            {wizardStep === 'confirm' && 'Bước 3: Xác nhận'}
                        </p>
                    </div>
                    <button onClick={() => setShowClockIn(false)} className="text-gray-400 hover:text-white">✕</button>
                </div>

                {/* Wizard Content */}
                <div className="flex-1 p-6 overflow-y-auto">
                    {wizardStep === 'init' && (
                        <StepInit
                            staffName={staffName}
                            setStaffName={setStaffName}
                            manualStartTime={manualStartTime}
                            setManualStartTime={setManualStartTime}
                            entryMode={entryMode}
                            setEntryMode={setEntryMode}
                            closedShifts={closedShifts}
                            selectedPrevShiftId={selectedPrevShiftId}
                            setSelectedPrevShiftId={setSelectedPrevShiftId}
                            prevShift={selectedPrevShift}
                            settings={shiftSettings}
                            onNext={handleInitNext}
                        />
                    )}

                    {wizardStep === 'money' && (
                        <StepMoney
                            entryMode={entryMode}
                            details={openingCashDetails}
                            setDetails={setOpeningCashDetails}
                            bankBalance={openingBankBalance}
                            setBankBalance={setOpeningBankBalance}
                            handoverPerson={handoverPerson}
                            setHandoverPerson={setHandoverPerson}
                            prevShift={selectedPrevShift}
                            users={users}
                            onBack={() => {
                                if (shiftSettings?.mode === 'auto') {
                                    setShowClockIn(false);
                                } else {
                                    setWizardStep('init');
                                }
                            }}
                            onNext={handleMoneyNext}
                        />
                    )}

                    {wizardStep === 'confirm' && (
                        <StepConfirm
                            staffName={staffName}
                            startTime={new Date(manualStartTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                            details={openingCashDetails}
                            bankBalance={openingBankBalance}
                            handoverPerson={handoverPerson}
                            onBack={() => setWizardStep('money')}
                            onConfirm={handleConfirm}
                            isProcessing={isClockingIn}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
