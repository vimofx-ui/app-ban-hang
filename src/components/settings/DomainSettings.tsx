import React, { useState, useEffect } from 'react';
import { Globe, Copy, Check, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { getBrandUrl, isValidSubdomain } from '@/hooks/useDomainResolver';

interface DomainInfo {
    slug: string;
    custom_domain: string | null;
    is_verified: boolean;
}

export function DomainSettings() {
    const { brandId } = useAuthStore();
    const [domainInfo, setDomainInfo] = useState<DomainInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [newSlug, setNewSlug] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDomainInfo();
    }, [brandId]);

    const fetchDomainInfo = async () => {
        if (!supabase || !brandId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        try {
            const { data, error } = await supabase
                .from('brands')
                .select('slug')
                .eq('id', brandId)
                .single();

            if (error) throw error;

            // Also check domains table for custom domain
            const { data: domainData } = await supabase
                .from('domains')
                .select('custom_domain, is_verified')
                .eq('brand_id', brandId)
                .single();

            setDomainInfo({
                slug: data.slug || '',
                custom_domain: domainData?.custom_domain || null,
                is_verified: domainData?.is_verified || false
            });
            setNewSlug(data.slug || '');
        } catch (err) {
            console.error('Error fetching domain info:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyUrl = () => {
        if (!domainInfo?.slug) return;
        const url = getBrandUrl(domainInfo.slug);
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveSlug = async () => {
        if (!supabase || !brandId || !newSlug) return;

        // Validate
        if (!isValidSubdomain(newSlug)) {
            setError('Subdomain chỉ được chứa chữ thường, số và dấu gạch ngang');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            // Check if slug already exists
            const { data: existing } = await supabase
                .from('brands')
                .select('id')
                .eq('slug', newSlug.toLowerCase())
                .neq('id', brandId)
                .single();

            if (existing) {
                setError('Subdomain này đã được sử dụng');
                setIsSaving(false);
                return;
            }

            // Update
            const { error } = await supabase
                .from('brands')
                .update({ slug: newSlug.toLowerCase() })
                .eq('id', brandId);

            if (error) throw error;

            setDomainInfo(prev => prev ? { ...prev, slug: newSlug.toLowerCase() } : null);
            setIsEditing(false);
        } catch (err) {
            setError('Không thể cập nhật subdomain');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-center py-8">
                    <RefreshCw className="animate-spin text-gray-400" size={24} />
                </div>
            </div>
        );
    }

    // Show message if no brand is selected
    if (!brandId) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="text-center py-8">
                    <Globe size={48} className="mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa chọn thương hiệu</h3>
                    <p className="text-gray-500 text-sm">
                        Vui lòng đăng nhập hoặc truy cập qua subdomain để xem cài đặt tên miền.
                    </p>
                </div>
            </div>
        );
    }

    const brandUrl = domainInfo?.slug ? getBrandUrl(domainInfo.slug) : '';

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Globe size={18} className="text-blue-600" />
                    Tên miền cửa hàng
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                    Địa chỉ URL để nhân viên và khách hàng truy cập cửa hàng
                </p>
            </div>

            <div className="p-6 space-y-6">
                {/* Current URL */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        URL cửa hàng
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                            <span className="px-3 py-2.5 bg-gray-100 text-gray-500 text-sm border-r border-gray-200">
                                https://
                            </span>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={newSlug}
                                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    className="flex-1 px-3 py-2.5 bg-white border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-r-lg"
                                    placeholder="ten-cua-hang"
                                />
                            ) : (
                                <span className="flex-1 px-3 py-2.5 text-gray-900 font-medium">
                                    {domainInfo?.slug || 'chua-co'}
                                </span>
                            )}
                            <span className="px-3 py-2.5 bg-gray-100 text-gray-500 text-sm border-l border-gray-200">
                                .bangopos.com
                            </span>
                        </div>

                        {!isEditing && (
                            <>
                                <button
                                    onClick={handleCopyUrl}
                                    className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                    title="Sao chép URL"
                                >
                                    {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-gray-500" />}
                                </button>
                                <a
                                    href={brandUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                    title="Mở trong tab mới"
                                >
                                    <ExternalLink size={18} className="text-gray-500" />
                                </a>
                            </>
                        )}
                    </div>

                    {error && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle size={14} />
                            {error}
                        </p>
                    )}
                </div>

                {/* Edit/Save buttons */}
                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setNewSlug(domainInfo?.slug || '');
                                    setError(null);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveSlug}
                                disabled={isSaving || newSlug === domainInfo?.slug}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                        >
                            Đổi subdomain
                        </button>
                    )}
                </div>

                {/* Info box */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Hướng dẫn</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Chia sẻ URL này cho nhân viên để họ truy cập nhanh</li>
                        <li>• Subdomain chỉ chứa chữ thường, số và dấu gạch ngang (-)</li>
                        <li>• Thay đổi subdomain sẽ làm URL cũ không còn hoạt động</li>
                    </ul>
                </div>

                {/* Custom Domain (Future feature) */}
                <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-gray-900">Tên miền riêng</h4>
                            <p className="text-sm text-gray-500">Sử dụng domain của riêng bạn (vd: pos.cuahang.vn)</p>
                        </div>
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                            Sắp ra mắt
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
