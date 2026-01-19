// =============================================================================
// REGISTER PAGE - Create New Account
// =============================================================================

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function RegisterPage() {
    const navigate = useNavigate();
    const { registerTenant, isLoading, error, clearError } = useAuthStore();
    const [searchParams] = useSearchParams();
    const refCode = searchParams.get('ref') || '';

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        brandName: '',
        brandSlug: '',
        referralCode: refCode,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [validationError, setValidationError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        if (name === 'brandName') {
            // Auto-generate slug from brand name if slug is empty or matches auto-generated pattern
            const slug = value.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
                .replace(/[^a-z0-9]/g, '-'); // replace non-alphanumeric with dash

            setFormData(prev => ({
                ...prev,
                brandName: value,
                brandSlug: prev.brandSlug === '' || prev.brandSlug === prev.brandName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-')
                    ? slug
                    : prev.brandSlug
            }));
        } else if (name === 'brandSlug') {
            // Allow manual slug edit but strictly format it
            const slug = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
            setFormData({ ...formData, brandSlug: slug });
        } else {
            setFormData({ ...formData, [name]: value });
        }
        setValidationError('');
    };

    const validateForm = () => {
        if (!formData.brandName.trim()) {
            setValidationError('Vui lòng nhập tên cửa hàng');
            return false;
        }
        if (!formData.brandSlug.trim()) {
            setValidationError('Vui lòng nhập đường dẫn cửa hàng');
            return false;
        }
        if (formData.password.length < 6) {
            setValidationError('Mật khẩu phải có ít nhất 6 ký tự');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setValidationError('Mật khẩu xác nhận không khớp');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        if (!validateForm()) return;

        const success = await registerTenant(
            formData.email,
            formData.password,
            formData.name,
            formData.brandName,
            formData.brandSlug,
            formData.phone,
            formData.referralCode
        );

        if (success) {
            // Redirect to the new subdomain
            const protocol = window.location.protocol;
            const host = window.location.host;
            // Handle localhost vs production (e.g., localhost:3000 -> slug.localhost:3000 seems odd but standard for local dev with hosts file, 
            // but for Vercel it's slug.domain.com)

            // Check if we are already on a subdomain? No, this is register page.

            // Construct new URL
            // If host starts with 'www.', remove it? Or just prepend slug?
            // Safer: slug + "." + host

            // However, for localhost without custom setup, subdomains don't work.
            // But we assume the user setup environment or requests this for Prod.
            // Let's assume standard subdomain logic.

            const newUrl = `${protocol}//${formData.brandSlug}.${host}`;
            window.location.href = newUrl;
        }
    };

    const displayError = validationError || error;

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        fontSize: '16px',
        outline: 'none',
        boxSizing: 'border-box' as const
    };

    const labelStyle = {
        display: 'block',
        fontSize: '14px',
        fontWeight: '500' as const,
        color: '#374151',
        marginBottom: '6px'
    };

    // Get current host for display
    const currentHost = window.location.host;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(to bottom right, #dcfce7, #ffffff, #dcfce7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
        }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(to bottom right, #22c55e, #16a34a)',
                        borderRadius: '16px',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        marginBottom: '16px'
                    }}>
                        <svg style={{ width: '32px', height: '32px', color: 'white' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Tạo cửa hàng mới</h1>
                    <p style={{ color: '#6B7280', marginTop: '4px' }}>Đăng ký Use Bango Pos</p>
                </div>

                {/* Register Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                    padding: '32px',
                    border: '1px solid #f3f4f6'
                }}>
                    <form onSubmit={handleSubmit}>
                        {/* Error Message */}
                        {displayError && (
                            <div style={{
                                padding: '12px',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '12px',
                                color: '#dc2626',
                                fontSize: '14px',
                                marginBottom: '20px'
                            }}>
                                {displayError}
                            </div>
                        )}

                        {/* Brand Name */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Tên cửa hàng</label>
                            <input
                                type="text"
                                name="brandName"
                                value={formData.brandName}
                                onChange={handleChange}
                                placeholder="Ví dụ: Tạp hóa Cô Ba"
                                required
                                style={inputStyle}
                            />
                        </div>

                        {/* Brand Slug */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Đường dẫn cửa hàng</label>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ color: '#6b7280', marginRight: '8px', fontSize: '14px' }}>{currentHost}/</span>
                                <input
                                    type="text"
                                    name="brandSlug"
                                    value={formData.brandSlug}
                                    onChange={handleChange}
                                    placeholder="taphoacoba"
                                    required
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {/* Name */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Họ và tên chủ cửa hàng</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Nguyễn Văn A"
                                required
                                style={inputStyle}
                            />
                        </div>

                        {/* Email */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Email đăng nhập</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="you@example.com"
                                required
                                style={inputStyle}
                            />
                        </div>

                        {/* Phone (optional for profile) */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Số điện thoại <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>(tùy chọn)</span></label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="0901234567"
                                style={inputStyle}
                            />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Mật khẩu</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Ít nhất 6 ký tự"
                                    required
                                    style={{ ...inputStyle, paddingRight: '48px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Xác nhận mật khẩu</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Nhập lại mật khẩu"
                                required
                                style={inputStyle}
                            />
                        </div>

                        {/* Referral Code */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Mã giới thiệu <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>(tùy chọn)</span></label>
                            <input
                                type="text"
                                name="referralCode"
                                value={formData.referralCode}
                                onChange={handleChange}
                                placeholder="Nhập mã CTV nếu có"
                                style={inputStyle}
                                readOnly={!!refCode}
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '12px',
                                fontWeight: '600',
                                color: 'white',
                                background: isLoading ? '#9ca3af' : 'linear-gradient(to right, #22c55e, #16a34a)',
                                border: 'none',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            {isLoading ? 'Đang khởi tạo...' : 'Đăng ký cửa hàng'}
                        </button>
                    </form>

                    {/* Login Link */}
                    <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#4b5563' }}>
                        Đã có tài khoản?{' '}
                        <Link to="/dang-nhap" style={{ color: '#16a34a', fontWeight: '500', textDecoration: 'none' }}>
                            Đăng nhập
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;
