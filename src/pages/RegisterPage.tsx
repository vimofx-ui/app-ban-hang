// =============================================================================
// REGISTER PAGE - Create New Account
// =============================================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function RegisterPage() {
    const navigate = useNavigate();
    const { register, loading, error, clearError } = useAuthStore();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [validationError, setValidationError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setValidationError('');
    };

    const validateForm = () => {
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

        const success = await register(formData.email, formData.password, formData.name);
        if (success) {
            navigate('/');
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
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Tạo tài khoản</h1>
                    <p style={{ color: '#6B7280', marginTop: '4px' }}>Đăng ký để sử dụng Grocery POS</p>
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

                        {/* Name */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Họ và tên</label>
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
                            <label style={labelStyle}>Email</label>
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

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '12px',
                                fontWeight: '600',
                                color: 'white',
                                background: loading ? '#9ca3af' : 'linear-gradient(to right, #22c55e, #16a34a)',
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
                        </button>
                    </form>

                    {/* Login Link */}
                    <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#4b5563' }}>
                        Đã có tài khoản?{' '}
                        <Link to="/login" style={{ color: '#16a34a', fontWeight: '500', textDecoration: 'none' }}>
                            Đăng nhập
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;
