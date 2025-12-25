
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useShiftStore } from '@/stores/shiftStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createEmptyCashDetails } from '@/lib/cashReconciliation';
import type { CashDetails } from '@/types';
import { useUserStore } from '@/stores/userStore';
import { StepInit, StepMoney, StepConfirm } from '@/components/shift/StartShiftWizard';
import { ActiveShiftDashboard } from '@/components/shift/ActiveShiftDashboard';
import { ShiftReconciliationView } from '@/components/shift/ShiftReconciliationView';

interface ShiftControlModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type WizardStep = 'init' | 'money' | 'confirm';
type EntryMode = 'new' | 'handover';

export function ShiftControlModal({ isOpen, onClose }: ShiftControlModalProps) {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200">
                <ShiftControlContent onClose={onClose} />
            </div>
        </div>,
        document.body
    );
}

function ShiftControlContent({ onClose }: { onClose: () => void }) {
    // Stores
    const { currentShift, clockIn, isClockingIn, fetchHistory, history } = useShiftStore();
    const { user: authUser } = useAuthStore();
    const { shift: shiftSettings } = useSettingsStore();
    const { users, fetchUsers } = useUserStore();

    // Local State
    const [wizardStep, setWizardStep] = useState<WizardStep>('init');
    const [isEndingShift, setIsEndingShift] = useState(false);

    // Form State (Start Shift)
    const [staffName, setStaffName] = useState('');
    const [entryMode, setEntryMode] = useState<EntryMode>('new');
    const [manualStartTime, setManualStartTime] = useState<string>('');
    const [openingCashDetails, setOpeningCashDetails] = useState<CashDetails>(createEmptyCashDetails());
    const [openingBankBalance, setOpeningBankBalance] = useState<number>(0);
    const [startNote, setStartNote] = useState('');
    const [handoverPerson, setHandoverPerson] = useState('');
    const [selectedPrevShiftId, setSelectedPrevShiftId] = useState<string>('');

    // Fetch Helper Data
    useEffect(() => {
        fetchHistory();
        fetchUsers();
        if (authUser) {
            setStaffName(authUser.name || authUser.email || '');
        }
    }, [fetchHistory, fetchUsers, authUser]);

    // Derived Logic (Similar to ShiftPage)
    const closedShifts = useMemo(() => {
        return history
            .filter(s => s.status === 'reconciled' || s.status === 'closed')
            .sort((a, b) => new Date(b.clock_out || 0).getTime() - new Date(a.clock_out || 0).getTime());
    }, [history]);

    useEffect(() => {
        if (closedShifts.length > 0 && !selectedPrevShiftId) {
            setSelectedPrevShiftId(closedShifts[0].id);
        }
    }, [closedShifts, selectedPrevShiftId]);

    const selectedPrevShift = useMemo(() =>
        closedShifts.find(s => s.id === selectedPrevShiftId) || null
        , [closedShifts, selectedPrevShiftId]);

    useEffect(() => {
        if (entryMode === 'handover' && selectedPrevShift) {
            setHandoverPerson(selectedPrevShift.user_id || '');
        }
    }, [entryMode, selectedPrevShift]);

    // Set default time
    useEffect(() => {
        if (!manualStartTime) {
            const now = new Date();
            const iso = now.toLocaleString('sv').replace(' ', 'T').slice(0, 16);
            setManualStartTime(iso);
        }
    }, [shiftSettings?.mode]);

    // --- HANDLERS ---
    const handleInitNext = () => {
        if (entryMode === 'handover' && selectedPrevShift) {
            if (selectedPrevShift.closing_cash_details) setOpeningCashDetails(selectedPrevShift.closing_cash_details);
            if (selectedPrevShift.closing_bank_balance) setOpeningBankBalance(selectedPrevShift.closing_bank_balance);
        } else if (entryMode === 'new') {
            setOpeningCashDetails(createEmptyCashDetails());
            setOpeningBankBalance(0);
        }
        setWizardStep('money');
    };

    const handleConfirmStart = async () => {
        if (!staffName.trim()) return;
        const userId = authUser?.id || crypto.randomUUID();
        const role = authUser?.role || 'staff';
        const finalStartTime = manualStartTime ? new Date(manualStartTime).toISOString() : new Date().toISOString();

        await clockIn(
            userId, staffName, role,
            openingCashDetails.total, openingCashDetails,
            openingBankBalance, finalStartTime,
            startNote, handoverPerson
        );
        // After clock in, we automatically show the Dashboard (since currentShift is now valid)
    };

    // --- RENDER ---

    // 1. RECONCILIATION VIEW (If Ending Shift)
    if (isEndingShift) {
        return (
            <ShiftReconciliationView
                onSuccess={onClose}
                onCancel={() => setIsEndingShift(false)}
            />
        );
    }

    // 2. ACTIVE SHIFT DASHBOARD
    if (currentShift) {
        return (
            <div className="h-full flex flex-col relative text-sm">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <ActiveShiftDashboard
                    shift={currentShift}
                    onEndShift={() => setIsEndingShift(true)}
                />
            </div>
        );
    }

    // 3. START SHIFT WIZARD
    return (
        <div className="flex flex-col h-full bg-gray-50 text-sm">
            {/* Header */}
            <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-lg font-bold">Bắt đầu ca làm việc</h1>
                    <p className="text-gray-400 text-xs mt-0.5">
                        {wizardStep === 'init' && 'Bước 1: Thiết lập'}
                        {wizardStep === 'money' && 'Bước 2: Kiểm kê tiền'}
                        {wizardStep === 'confirm' && 'Bước 3: Xác nhận'}
                    </p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-y-auto">
                {wizardStep === 'init' && (
                    <StepInit
                        staffName={staffName} setStaffName={setStaffName}
                        manualStartTime={manualStartTime} setManualStartTime={setManualStartTime}
                        entryMode={entryMode} setEntryMode={setEntryMode}
                        closedShifts={closedShifts}
                        selectedPrevShiftId={selectedPrevShiftId} setSelectedPrevShiftId={setSelectedPrevShiftId}
                        prevShift={selectedPrevShift}
                        settings={shiftSettings}
                        onNext={handleInitNext}
                    />
                )}
                {wizardStep === 'money' && (
                    <StepMoney
                        entryMode={entryMode}
                        details={openingCashDetails} setDetails={setOpeningCashDetails}
                        bankBalance={openingBankBalance} setBankBalance={setOpeningBankBalance}
                        handoverPerson={handoverPerson} setHandoverPerson={setHandoverPerson}
                        prevShift={selectedPrevShift}
                        users={users}
                        onBack={() => setWizardStep('init')}
                        onNext={() => setWizardStep('confirm')}
                    />
                )}
                {wizardStep === 'confirm' && (
                    <StepConfirm
                        staffName={staffName}
                        startTime={new Date(manualStartTime).toLocaleString('vi-VN')}
                        details={openingCashDetails}
                        bankBalance={openingBankBalance}
                        handoverPerson={handoverPerson}
                        onBack={() => setWizardStep('money')}
                        onConfirm={handleConfirmStart}
                        isProcessing={isClockingIn}
                    />
                )}
            </div>
        </div>
    );
}
