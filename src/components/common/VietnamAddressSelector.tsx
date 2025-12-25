/**
 * VietnamAddressSelector - Cascading Province/District/Ward selector
 * Uses provinces.open-api.vn API
 */
import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Province {
    code: number;
    name: string;
}

interface District {
    code: number;
    name: string;
    wards?: Ward[];
}

interface Ward {
    code: number;
    name: string;
}

interface VietnamAddressValue {
    province?: string;
    provinceCode?: number;
    district?: string;
    districtCode?: number;
    ward?: string;
    wardCode?: number;
    detail?: string;
}

interface VietnamAddressSelectorProps {
    value?: VietnamAddressValue;
    onChange: (value: VietnamAddressValue) => void;
    className?: string;
}

const API_BASE = 'https://provinces.open-api.vn/api';

export function VietnamAddressSelector({ value, onChange, className }: VietnamAddressSelectorProps) {
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);
    const [loading, setLoading] = useState({ provinces: false, districts: false, wards: false });

    // Load provinces on mount
    useEffect(() => {
        const loadProvinces = async () => {
            setLoading(prev => ({ ...prev, provinces: true }));
            try {
                // Correct endpoint: /api/ returns list of provinces
                const res = await fetch(`${API_BASE}/`);
                if (!res.ok) throw new Error('Failed to load provinces');
                const data = await res.json();
                setProvinces(data);
            } catch (err) {
                console.error('Failed to load provinces:', err);
            } finally {
                setLoading(prev => ({ ...prev, provinces: false }));
            }
        };
        loadProvinces();
    }, []);

    // Load districts when province changes
    useEffect(() => {
        if (!value?.provinceCode) {
            setDistricts([]);
            return;
        }
        const loadDistricts = async () => {
            setLoading(prev => ({ ...prev, districts: true }));
            try {
                // Correct endpoint: /api/p/CODE?depth=2 for province with districts
                const res = await fetch(`${API_BASE}/p/${value.provinceCode}?depth=2`);
                if (!res.ok) throw new Error('Failed to load districts');
                const data = await res.json();
                setDistricts(data.districts || []);
            } catch (err) {
                console.error('Failed to load districts:', err);
            } finally {
                setLoading(prev => ({ ...prev, districts: false }));
            }
        };
        loadDistricts();
    }, [value?.provinceCode]);

    // Load wards when district changes
    useEffect(() => {
        if (!value?.districtCode) {
            setWards([]);
            return;
        }
        const loadWards = async () => {
            setLoading(prev => ({ ...prev, wards: true }));
            try {
                // Correct endpoint: /api/d/CODE?depth=2 for district with wards
                const res = await fetch(`${API_BASE}/d/${value.districtCode}?depth=2`);
                if (!res.ok) throw new Error('Failed to load wards');
                const data = await res.json();
                setWards(data.wards || []);
            } catch (err) {
                console.error('Failed to load wards:', err);
            } finally {
                setLoading(prev => ({ ...prev, wards: false }));
            }
        };
        loadWards();
    }, [value?.districtCode]);

    const handleProvinceChange = (code: string) => {
        const province = provinces.find(p => p.code === Number(code));
        onChange({
            province: province?.name,
            provinceCode: province?.code,
            district: undefined,
            districtCode: undefined,
            ward: undefined,
            wardCode: undefined,
            detail: value?.detail
        });
    };

    const handleDistrictChange = (code: string) => {
        const district = districts.find(d => d.code === Number(code));
        onChange({
            ...value,
            district: district?.name,
            districtCode: district?.code,
            ward: undefined,
            wardCode: undefined
        });
    };

    const handleWardChange = (code: string) => {
        const ward = wards.find(w => w.code === Number(code));
        onChange({
            ...value,
            ward: ward?.name,
            wardCode: ward?.code
        });
    };

    const handleDetailChange = (detail: string) => {
        onChange({ ...value, detail });
    };

    const [error, setError] = useState<string | null>(null);

    const selectClasses = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white appearance-none cursor-pointer disabled:bg-gray-100 disabled:text-gray-500";

    return (
        <div className={cn("space-y-2", className)}>
            {error && (
                <div className="text-red-500 text-xs p-2 bg-red-50 rounded-lg border border-red-100">{error}</div>
            )}

            {/* Province */}
            <div className="relative">
                <select
                    value={value?.provinceCode || ''}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    className={selectClasses}
                    disabled={loading.provinces}
                >
                    <option value="">{loading.provinces ? 'Đang tải tỉnh/thành...' : '-- Chọn Tỉnh/Thành phố --'}</option>
                    {provinces.map(p => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {loading.provinces && <span className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent border-green-500 rounded-full animate-spin" />}
            </div>

            {/* District */}
            <div className="relative">
                <select
                    value={value?.districtCode || ''}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className={selectClasses}
                    disabled={!value?.provinceCode || loading.districts}
                >
                    <option value="">{loading.districts ? 'Đang tải quận/huyện...' : '-- Chọn Quận/Huyện --'}</option>
                    {districts.map(d => (
                        <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {loading.districts && <span className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent border-green-500 rounded-full animate-spin" />}
            </div>

            {/* Ward */}
            <div className="relative">
                <select
                    value={value?.wardCode || ''}
                    onChange={(e) => handleWardChange(e.target.value)}
                    className={selectClasses}
                    disabled={!value?.districtCode || loading.wards}
                >
                    <option value="">{loading.wards ? 'Đang tải phường/xã...' : '-- Chọn Phường/Xã --'}</option>
                    {wards.map(w => (
                        <option key={w.code} value={w.code}>{w.name}</option>
                    ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {loading.wards && <span className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent border-green-500 rounded-full animate-spin" />}
            </div>

            {/* Detail Address */}
            <input
                type="text"
                value={value?.detail || ''}
                onChange={(e) => handleDetailChange(e.target.value)}
                placeholder="Số nhà, đường, tòa nhà..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
        </div>
    );
}

/**
 * Utility to format full address from VietnamAddressValue
 */
export function formatVietnamAddress(addr: VietnamAddressValue | undefined): string {
    if (!addr) return '';
    const parts = [addr.detail, addr.ward, addr.district, addr.province].filter(Boolean);
    return parts.join(', ');
}
