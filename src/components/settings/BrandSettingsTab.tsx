import { useState, useRef } from 'react';
import { useBrandStore } from '@/stores/brandStore';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function BrandSettingsTab() {
    const { currentBrand, updateBrand, isLoading, fetchCurrentBrand } = useBrandStore();
    const { user } = useAuthStore();
    // Ideally check permissions here. Assuming only Owner/Admin reaches here.

    const [primaryColor, setPrimaryColor] = useState(currentBrand?.primary_color || '#16a34a');
    const [secondaryColor, setSecondaryColor] = useState(currentBrand?.secondary_color || '#16a34a');
    const [footerText, setFooterText] = useState(currentBrand?.receipt_footer_text || '');
    const [website, setWebsite] = useState(currentBrand?.website_url || '');
    const [isSaving, setIsSaving] = useState(false);

    const logoInputRef = useRef<HTMLInputElement>(null);

    const handleSave = async () => {
        if (!currentBrand) return;
        setIsSaving(true);
        try {
            await updateBrand(currentBrand.id, {
                primary_color: primaryColor,
                secondary_color: secondaryColor,
                receipt_footer_text: footerText,
                website_url: website
            });
            alert('Đã lưu cài đặt thương hiệu thành công!');

            // Reload page to apply new colors globally (simple way for now)
            if (confirm('Tải lại trang để áp dụng màu mới?')) {
                window.location.reload();
            }
        } catch (error) {
            console.error(error);
            alert('Có lỗi xảy ra khi lưu.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;
        if (!currentBrand) return;

        const file = event.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentBrand.id}/logo.${fileExt}`;
        const filePath = `${fileName}`;

        setIsSaving(true);
        try {
            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('brand-assets')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data } = supabase.storage
                .from('brand-assets')
                .getPublicUrl(filePath);

            const publicUrl = data.publicUrl;

            // 3. Update Brand Record
            await updateBrand(currentBrand.id, { logo_url: publicUrl });

            alert('Đã cập nhật Logo thành công!');
        } catch (error: any) {
            console.error('Upload Error:', error);
            alert('Lỗi upload ảnh: ' + error.message);
        } finally {
            setIsSaving(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    if (isLoading) return <div>Đang tải...</div>;
    if (!currentBrand) return <div>Không tìm thấy thông tin thương hiệu.</div>;

    return (
        <div className="space-y-8 max-w-3xl w-full">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🎨</span> Giao diện & Thương hiệu
                </h3>

                <div className="space-y-6">
                    {/* Logo Section */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Logo Cửa Hàng</label>
                        <div className="flex items-center gap-6">
                            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden relative group">
                                {currentBrand.logo_url ? (
                                    <img src={currentBrand.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                                ) : (
                                    <span className="text-gray-400 text-xs text-center px-1">Chưa có logo</span>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                        onClick={() => logoInputRef.current?.click()}
                                        className="text-white text-xs font-bold"
                                        disabled={isSaving}
                                    >
                                        Đổi ảnh
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-500 mb-3">
                                    Logo sẽ xuất hiện trên hóa đơn và góc trái màn hình.
                                    <br />Khuyên dùng ảnh PNG nền trong suốt, vuông hoặc chữ nhật.
                                </p>
                                <input
                                    type="file"
                                    ref={logoInputRef}
                                    onChange={handleLogoUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => logoInputRef.current?.click()}
                                    disabled={isSaving}
                                    className="px-4 py-2 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium transition-colors"
                                >
                                    📤 Tải lên Logo mới
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Primary Color */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Màu chủ đạo (Primary)</label>
                            <div className="flex gap-3 items-center">
                                <input
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-12 h-12 rounded-lg border border-gray-200 cursor-pointer p-1"
                                />
                                <input
                                    type="text"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase"
                                    placeholder="#000000"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Dùng cho nút bấm chính, tiêu đề, icon active.</p>
                        </div>

                        {/* Secondary Color */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Màu phụ (Secondary)</label>
                            <div className="flex gap-3 items-center">
                                <input
                                    type="color"
                                    value={secondaryColor}
                                    onChange={(e) => setSecondaryColor(e.target.value)}
                                    className="w-12 h-12 rounded-lg border border-gray-200 cursor-pointer p-1"
                                />
                                <input
                                    type="text"
                                    value={secondaryColor}
                                    onChange={(e) => setSecondaryColor(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase"
                                    placeholder="#000000"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Dùng cho các điểm nhấn phụ.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🧾</span> Thông tin trên Hóa đơn
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Website cửa hàng</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🌐</span>
                            <input
                                type="url"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lời chào cuối hóa đơn (Footer)</label>
                        <textarea
                            value={footerText}
                            onChange={(e) => setFooterText(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Ví dụ: Xin cảm ơn quý khách. Hẹn gặp lại!"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Đang lưu...
                        </>
                    ) : (
                        'Lưu thay đổi'
                    )}
                </button>
            </div>
        </div>
    );
}
