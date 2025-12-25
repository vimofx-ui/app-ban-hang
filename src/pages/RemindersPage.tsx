import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReminderManager } from '@/components/pos/ReminderComponents';
import { useReminderStore } from '@/stores/reminderStore';
import { Trash2, Clock, RotateCw, AlertCircle, Plus, Check } from 'lucide-react';

export function RemindersPage() {
    return (
        <div className="w-full p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Quản lý Lời nhắc</h1>
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <p className="text-gray-500 mb-6">
                    Tại đây bạn có thể cấu hình các lời nhắc tự động cho hệ thống POS.
                    Các lời nhắc này sẽ hiển thị dưới dạng thông báo bật lên (popup) trên màn hình bán hàng.
                </p>

                {/* We reuse the manager component but force it open/embedded */}
                <div className="relative w-full" style={{ minHeight: '500px' }}>
                    {/* 
                        Reuse the internal logic of ReminderManager? 
                        Actually ReminderManager is a Modal. Let's make a wrapper or just use it.
                        Since ReminderManager is designed as a Modal, we might want to refactor it or wrap it.
                        For now, let's create a specific view that uses the store directly, or refactor ReminderManager to be more flexible.
                        
                        However, to save time and ensure consistency, I will REUSE the store logic but build a page view.
                     */}
                    <ReminderPageContent />
                </div>
            </div>
        </div>
    );
}

// ... (imports remain the same, just keeping them for context if I were doing a full file write, but this is replace_content)

function ReminderPageContent() {
    const { reminders, fetchReminders, addReminder, deleteReminder, updateReminder } = useReminderStore();
    const [isAddMode, setIsAddMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    useEffect(() => {
        fetchReminders();
    }, []);

    // Form State
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'shift_elapsed' | 'scheduled'>('shift_elapsed');
    const [elapsedMinutes, setElapsedMinutes] = useState('30');
    const [scheduleTime, setScheduleTime] = useState('09:00');
    const [repeatInterval, setRepeatInterval] = useState('0');
    const [maxRepeats, setMaxRepeats] = useState('1');
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);

    // Initialize edit form
    const startEdit = (reminder: any) => {
        setEditingId(reminder.id);
        setTitle(reminder.title);
        setMessage(reminder.message || '');
        setType(reminder.type);
        setElapsedMinutes(reminder.elapsed_minutes?.toString() || '30');
        setScheduleTime(reminder.schedule_time || '09:00');
        setRepeatInterval(reminder.repeat_interval?.toString() || '0');
        setMaxRepeats(reminder.max_repeats?.toString() || '1');
        setIsAddMode(true);
    };

    const resetForm = () => {
        setIsAddMode(false);
        setEditingId(null);
        setTitle('');
        setMessage('');
        setElapsedMinutes('30');
        setRepeatInterval('0');
        setMaxRepeats('1');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                title,
                message,
                type,
                elapsed_minutes: type === 'shift_elapsed' ? parseInt(elapsedMinutes) : undefined,
                schedule_time: type === 'scheduled' ? scheduleTime : undefined,
                repeat_interval: parseInt(repeatInterval) || 0,
                max_repeats: parseInt(maxRepeats) || 1,
                days_of_week: daysOfWeek,
                is_active: true
            };

            if (editingId) {
                await updateReminder(editingId, data);
            } else {
                await addReminder(data);
            }
            resetForm();
        } catch (error) {
            console.error(error);
            alert('Lỗi lưu nhắc nhở');
        }
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setDeleteConfirmId(id);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            await deleteReminder(deleteConfirmId);
            setDeleteConfirmId(null);
        } catch (error: any) {
            console.error("Failed to delete:", error);
            alert('Lỗi xóa nhắc nhở: ' + (error.message || 'Lỗi không xác định'));
        }
    };

    return (
        <div className="w-full">
            {/* Toolbar */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Danh sách nhắc nhở ({reminders.length})</h2>
                    <p className="text-sm text-gray-500 mt-1">Quản lý các thông báo tự động hiển thị trên POS</p>
                </div>
                {!isAddMode && (
                    <button
                        onClick={() => setIsAddMode(true)}
                        className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                    >
                        <span className="text-xl">+</span> Thêm nhắc nhở
                    </button>
                )}
            </div>

            {/* Form (Add/Edit) */}
            {isAddMode && (
                <div className="mb-8 bg-white p-6 rounded-2xl border border-primary/20 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
                    <h3 className="font-bold text-gray-800 mb-6 text-lg flex items-center gap-2">
                        {editingId ? '✏️ Chỉnh sửa lời nhắc' : '✨ Tạo lời nhắc mới'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Tiêu đề nhắc nhở <span className="text-red-500">*</span></label>
                                <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Ví dụ: Kiểm tra tủ mát" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Loại kích hoạt</label>
                                <div className="flex p-1 bg-gray-100 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setType('shift_elapsed')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === 'shift_elapsed' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        ⏱️ Sau khi vào ca
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('scheduled')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === 'scheduled' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        📅 Giờ cố định
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Nội dung hiển thị</label>
                            <textarea required value={message} onChange={e => setMessage(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" rows={3} placeholder="Nội dung chi tiết sẽ hiện to trên màn hình..." />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {type === 'shift_elapsed' ? (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Số phút sau vào ca</label>
                                    <div className="relative">
                                        <input type="number" required value={elapsedMinutes} onChange={e => setElapsedMinutes(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" />
                                        <span className="absolute right-4 top-3 text-gray-400 text-sm">phút</span>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Giờ nhắc (HH:MM)</label>
                                    <input type="time" required value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Lặp lại sau (0 = Không)</label>
                                <div className="relative">
                                    <input type="number" value={repeatInterval} onChange={e => setRepeatInterval(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" />
                                    <span className="absolute right-4 top-3 text-gray-400 text-sm">phút</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Số lần lặp tối đa</label>
                                <input type="number" value={maxRepeats} onChange={e => setMaxRepeats(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button type="button" onClick={resetForm} className="px-6 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">Hủy bỏ</button>
                            <button type="submit" className="px-8 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 shadow-md transition-all active:scale-95">
                                {editingId ? 'Cập nhật' : 'Lưu lại'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reminders.map(reminder => (
                    <div
                        key={reminder.id}
                        onClick={() => startEdit(reminder)}
                        className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden"
                    >
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${reminder.is_active ? 'bg-primary' : 'bg-gray-300'}`}></div>

                        <div className="flex justify-between items-start mb-3 pl-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${reminder.type === 'shift_elapsed' ? 'bg-primary/10 text-primary' : 'bg-purple-50 text-purple-600'}`}>
                                    {reminder.type === 'shift_elapsed' ? '⏱️' : '⏰'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg leading-tight">{reminder.title}</h3>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${reminder.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {reminder.is_active ? 'Đang bật' : 'Đã tắt'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={(e) => handleDelete(reminder.id, e)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                title="Xóa"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="pl-3">
                            <p className="text-gray-600 mb-4 line-clamp-2 min-h-[40px] text-sm">{reminder.message}</p>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                    <span>🕒</span>
                                    {reminder.type === 'shift_elapsed' ? (
                                        <span>Sau khi vào ca <b className="text-blue-600">{reminder.elapsed_minutes} phút</b></span>
                                    ) : (
                                        <span>Lúc <b className="text-purple-600">{reminder.schedule_time?.slice(0, 5)}</b> hàng ngày</span>
                                    )}
                                </div>
                                {reminder.repeat_interval && reminder.repeat_interval > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded-lg border border-orange-100">
                                        <span>🔁</span>
                                        <span>Lặp lại mỗi {reminder.repeat_interval}p (tối đa {reminder.max_repeats} lần)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {reminders.length === 0 && !isAddMode && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 16px', textAlign: 'center', width: '100%', minHeight: '400px' }}>
                    <div className="w-20 h-20 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center text-4xl mb-4">🔔</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có nhắc nhở nào</h3>
                    <p style={{ color: '#6b7280', maxWidth: '28rem', textAlign: 'center', marginBottom: '24px', padding: '0 16px', width: '100%' }}>Tạo nhắc nhở để hệ thống tự động thông báo công việc cho nhân viên.</p>
                    <button
                        onClick={() => setIsAddMode(true)}
                        className="bg-primary text-white px-6 py-2.5 rounded-xl font-medium shadow hover:bg-primary/90 whitespace-nowrap"
                    >
                        Tạo nhắc nhở ngay
                    </button>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {deleteConfirmId && createPortal(
                <div className="fixed inset-0 top-0 left-0 w-screen h-screen z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-2 border-red-100 min-w-[300px] mx-4 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-sm">
                            🗑️
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Xóa nhắc nhở?</h3>
                        <p className="text-gray-600 mb-8 text-lg">Hành động này không thể hoàn tác.<br />Bạn có chắc chắn muốn xóa?</p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold text-lg rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3.5 bg-red-600 text-white font-bold text-lg rounded-xl hover:bg-red-700 shadow-lg transition-all active:scale-95"
                            >
                                Xóa ngay
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default RemindersPage;
