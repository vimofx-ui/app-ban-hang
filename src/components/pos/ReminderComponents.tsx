import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useReminderStore } from '@/stores/reminderStore';
import { useShiftStore } from '@/stores/shiftStore';
import type { Reminder } from '@/types';
import { cn } from '@/lib/utils';

// =============================================================================
// REMINDER MANAGER MODAL
// =============================================================================

interface ReminderManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ReminderManager({ isOpen, onClose }: ReminderManagerProps) {
    const { reminders, fetchReminders, addReminder, deleteReminder, updateReminder } = useReminderStore();
    const [view, setView] = useState<'list' | 'add'>('list');

    // Form State
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'shift_elapsed' | 'scheduled'>('shift_elapsed');
    const [elapsedMinutes, setElapsedMinutes] = useState('30');
    const [scheduleTime, setScheduleTime] = useState('09:00');
    const [repeatInterval, setRepeatInterval] = useState('0');
    const [maxRepeats, setMaxRepeats] = useState('1');

    useEffect(() => {
        if (isOpen) {
            fetchReminders();
        }
    }, [isOpen]);

    const handleAdd = async () => {
        if (!title) return alert('Vui lòng nhập tiêu đề');

        await addReminder({
            title,
            message,
            type,
            elapsed_minutes: type === 'shift_elapsed' ? parseInt(elapsedMinutes) : undefined,
            schedule_time: type === 'scheduled' ? scheduleTime : undefined,
            days_of_week: undefined, // Default to everyday for now
            is_active: true,
            repeat_interval: parseInt(repeatInterval) || undefined,
            max_repeats: parseInt(maxRepeats) || 1
        });

        setView('list');
        // Reset form
        setTitle('');
        setMessage('');
    };

    const handleDelete = async (id: string) => {
        if (confirm('Xóa nhắc nhở này?')) {
            await deleteReminder(id);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm w-screen h-screen">
            <div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl flex flex-col shadow-2xl relative isolate"
                style={{ width: '90%', maxWidth: '600px', maxHeight: '85vh', minHeight: '400px' }}
            >
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h2 className="text-xl font-bold text-gray-800">⏰ Quản lý Nhắc nhở</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="flex-1 w-full overflow-y-auto p-6">
                    {view === 'list' ? (
                        <div className="space-y-4 w-full">
                            <button
                                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                            >
                                <span>➕</span> Thêm nhắc nhở mới
                            </button>

                            {reminders.length === 0 && (
                                <p className="text-center text-gray-500 py-8">Chưa có nhắc nhở nào.</p>
                            )}

                            {reminders.map(r => (
                                <div key={r.id} className="bg-white border rounded-lg p-4 flex justify-between items-start shadow-sm hover:shadow-md transition-shadow">
                                    <div>
                                        <h3 className="font-bold text-gray-900">{r.title}</h3>
                                        {r.message && <p className="text-sm text-gray-600 mt-1">{r.message}</p>}
                                        <div className="flex items-center gap-2 mt-2 text-xs font-medium text-primary bg-primary/10 rounded px-2 py-1 w-fit">
                                            {r.type === 'shift_elapsed' ? (
                                                <>⏱️ Sau khi vào ca {r.elapsed_minutes} phút</>
                                            ) : (
                                                <>📅 Hằng ngày lúc {r.schedule_time}</>
                                            )}
                                            {r.repeat_interval && r.repeat_interval > 0 && (
                                                <span className="text-orange-600 border-l border-orange-200 pl-2 ml-2">
                                                    🔁 Lặp lại mỗi {r.repeat_interval}p ({r.max_repeats} lần)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateReminder(r.id, { is_active: !r.is_active })}
                                            className={cn("px-2 py-1 text-xs rounded border font-medium",
                                                r.is_active ? "text-green-600 bg-green-50 border-green-200" : "text-gray-500 bg-gray-50"
                                            )}
                                        >
                                            {r.is_active ? 'Bật' : 'Tắt'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(r.id)}
                                            className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                                        >
                                            Xóa
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4 w-full">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Ví dụ: Kiểm tra tủ lạnh"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tin nhắn (Tùy chọn)</label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none h-20 resize-none"
                                    placeholder="Nội dung nhắc nhở..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Loại nhắc nhở</label>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                checked={type === 'shift_elapsed'}
                                                onChange={() => setType('shift_elapsed')}
                                                className="w-4 h-4 text-primary"
                                            />
                                            <span className="text-sm">Sau thời gian vào ca</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                checked={type === 'scheduled'}
                                                onChange={() => setType('scheduled')}
                                                className="w-4 h-4 text-primary"
                                            />
                                            <span className="text-sm">Cố định theo giờ</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    {type === 'shift_elapsed' ? (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Số phút sau khi vào ca</label>
                                            <input
                                                type="number"
                                                value={elapsedMinutes}
                                                onChange={e => setElapsedMinutes(e.target.value)}
                                                className="w-full p-2 border rounded-lg"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Giờ nhắc (HH:MM)</label>
                                            <input
                                                type="time"
                                                value={scheduleTime}
                                                onChange={e => setScheduleTime(e.target.value)}
                                                className="w-full p-2 border rounded-lg"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lặp lại sau (phút)</label>
                                    <input
                                        type="number"
                                        value={repeatInterval}
                                        onChange={e => setRepeatInterval(e.target.value)}
                                        placeholder="0 = Không lặp lại"
                                        className="w-full p-2 border rounded-lg"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">0 = Chỉ nhắc 1 lần</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Số lần lặp</label>
                                    <input
                                        type="number"
                                        value={maxRepeats}
                                        onChange={e => setMaxRepeats(e.target.value)}
                                        className="w-full p-2 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button
                                    onClick={() => setView('list')}
                                    className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleAdd}
                                    className="flex-1 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 shadow-md"
                                >
                                    Lưu Nhắc Nhở
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

// =============================================================================
// REMINDER POPUP (ALERTS)
// =============================================================================

export function ReminderPopup() {
    const { reminders, fetchReminders, acknowledgedReminders, acknowledgeReminder } = useReminderStore();
    const { currentShift } = useShiftStore();
    const [activeAlert, setActiveAlert] = useState<Reminder | null>(null);

    // Initial Fetch
    useEffect(() => {
        fetchReminders();
        const interval = setInterval(fetchReminders, 60000); // Sync every minute
        return () => clearInterval(interval);
    }, []);

    // Check Logic
    useEffect(() => {
        const checkReminders = () => {
            if (activeAlert) return; // Don't overwrite current alert

            const now = new Date();
            const nowTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); // HH:MM

            for (const r of reminders) {
                if (!r.is_active) continue;

                let shouldTrigger = false;

                // 1. Shift Elapsed Logic
                if (r.type === 'shift_elapsed' && currentShift && r.elapsed_minutes) {
                    const clockInTime = new Date(currentShift.clock_in).getTime();
                    const diffMinutes = Math.floor((now.getTime() - clockInTime) / 60000);

                    if (Math.abs(diffMinutes - r.elapsed_minutes) < 1) {
                        const lastAck = acknowledgedReminders[r.id] || 0;
                        if (now.getTime() - lastAck > 60000) { // If not ack'd in last minute
                            shouldTrigger = true;
                        }
                    }

                    // Loop logic (repeat_interval)
                    if (!shouldTrigger && r.repeat_interval && r.repeat_interval > 0 && diffMinutes > r.elapsed_minutes) {
                        const minutesSinceFirstTrigger = diffMinutes - r.elapsed_minutes;
                        // Check if it matches an interval step
                        if (minutesSinceFirstTrigger % r.repeat_interval === 0) {
                            const occurrences = Math.floor(minutesSinceFirstTrigger / r.repeat_interval);
                            if (occurrences <= r.max_repeats) {
                                const lastAck = acknowledgedReminders[r.id] || 0;
                                if (now.getTime() - lastAck > 60000) {
                                    shouldTrigger = true;
                                }
                            }
                        }
                    }
                }

                // 2. Scheduled Logic
                if (r.type === 'scheduled' && r.schedule_time) {
                    if (r.schedule_time.startsWith(nowTime)) {
                        const lastAck = acknowledgedReminders[r.id] || 0;
                        if (now.getTime() - lastAck > 60000) {
                            shouldTrigger = true;
                        }
                    }
                }

                if (shouldTrigger) {
                    setActiveAlert(r);
                    return; // Show one at a time
                }
            }
        };

        const timer = setInterval(checkReminders, 10000); // Check every 10s
        checkReminders(); // Run immediately
        return () => clearInterval(timer);
    }, [reminders, currentShift, activeAlert, acknowledgedReminders]);

    const handleConfirm = () => {
        if (activeAlert) {
            acknowledgeReminder(activeAlert.id);
            setActiveAlert(null);
        }
    };

    if (!activeAlert) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <style>
                {`
                @keyframes pulse-border {
                    0% { box-shadow: 0 0 0 0 #dc2626; }
                    70% { box-shadow: 0 0 0 20px transparent; }
                    100% { box-shadow: 0 0 0 0 transparent; }
                }
                .reminder-pulse {
                    animation: pulse-border 2s infinite;
                }
                `}
            </style>
            <div
                className="bg-white rounded-3xl overflow-hidden relative isolate reminder-pulse flex flex-col border-4 border-red-600"
                style={{ width: '100%', maxWidth: '640px', minHeight: '320px' }}
            >
                {/* Header */}
                <div className="bg-red-600 px-8 py-5 flex items-center justify-center gap-4 text-white text-center">
                    <span className="text-4xl animate-bounce">⏰</span>
                    <div className="flex flex-col items-center">
                        <h3 className="text-2xl font-extrabold mb-1 tracking-wide uppercase">{activeAlert.title}</h3>
                        <p className="text-red-100 text-base font-medium opacity-90">Nhắc nhở tự động</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 flex-1 flex flex-col justify-center items-center text-center w-full bg-white">
                    <p className="text-[#f97316] text-3xl font-bold leading-relaxed tracking-tight py-2 drop-shadow-sm">
                        {activeAlert.message || activeAlert.title}
                    </p>
                    {activeAlert.type === 'shift_elapsed' && (
                        <p className="mt-4 text-lg text-gray-500 font-medium bg-gray-100 px-4 py-2 rounded-full">
                            (Đã vào ca được {activeAlert.elapsed_minutes} phút)
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-center">
                    <button
                        onClick={handleConfirm}
                        className="w-auto min-w-[200px] bg-red-600 hover:bg-red-700 text-white font-bold text-lg py-3 px-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 whitespace-nowrap"
                    >
                        <span>✅</span> Đã Hiểu / Đóng
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
