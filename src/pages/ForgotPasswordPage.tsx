// =============================================================================
// FORGOT PASSWORD PAGE
// =============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function ForgotPasswordPage() {
    const { resetPassword, loading, error, clearError } = useAuthStore();

    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        const success = await resetPassword(email);
        if (success) {
            setSubmitted(true);
        }
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
                        <svg style={{ width: '32px', height: '32px', color: 'white' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                        </svg>
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Quên mật khẩu?</h1>
                    <p style={{ color: '#6B7280', marginTop: '4px' }}>Nhập email để nhận link đặt lại mật khẩu</p>
                </div>

                {/* Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                    padding: '32px',
                    border: '1px solid #f3f4f6'
                }}>
                    {submitted ? (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                backgroundColor: '#dcfce7',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                <span style={{ fontSize: '32px' }}>✓</span>
                            </div>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>Email đã được gửi!</h2>
                            <p style={{ color: '#4b5563', marginBottom: '24px' }}>
                                Vui lòng kiểm tra hộp thư của bạn tại <strong>{email}</strong> để đặt lại mật khẩu.
                            </p>
                            <Link
                                to="/login"
                                style={{
                                    display: 'inline-block',
                                    padding: '12px 24px',
                                    backgroundColor: '#16a34a',
                                    color: 'white',
                                    fontWeight: '600',
                                    borderRadius: '12px',
                                    textDecoration: 'none'
                                }}
                            >
                                Quay lại đăng nhập
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {/* Error Message */}
                            {error && (
                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '12px',
                                    color: '#dc2626',
                                    fontSize: '14px',
                                    marginBottom: '20px'
                                }}>
                                    {error}
                                </div>
                            )}

                            {/* Email */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                        fontSize: '16px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
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
                                {loading ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
                            </button>

                            {/* Back to Login */}
                            <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                <Link to="/login" style={{ fontSize: '14px', color: '#16a34a', fontWeight: '500', textDecoration: 'none' }}>
                                    ← Quay lại đăng nhập
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ForgotPasswordPage;
