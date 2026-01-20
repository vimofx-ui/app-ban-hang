// =============================================================================
// LOGIN PAGE - Clean, Modern Authentication
// =============================================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function LoginPage() {
    const navigate = useNavigate();
    const { login, isLoading, error, clearError } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        const success = await login(email, password);
        if (success) {
            navigate('/');
        }
    };

    // --- DIAGNOSTICS ---
    const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const rawSupabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const debugSupabaseUrl = rawSupabaseUrl ? rawSupabaseUrl.trim() : '';
    const [testResult, setTestResult] = useState<string | null>(null);

    const testConnection = async () => {
        setTestResult('Đang kiểm tra kết nối...');
        try {
            if (!debugSupabaseUrl) {
                setTestResult('LỖI: Không có URL Supabase');
                return;
            }
            console.log('Testing connection to:', debugSupabaseUrl);
            const res = await fetch(`${debugSupabaseUrl}/rest/v1/`, {
                headers: { 'apikey': rawSupabaseKey ? rawSupabaseKey.trim() : '' }
            });
            if (res.ok) {
                setTestResult(`✅ Kết nối OK! Status: ${res.status}`);
            } else {
                setTestResult(`❌ Lỗi HTTP: ${res.status} ${res.statusText}`);
            }
        } catch (err: any) {
            console.error('Connection failed:', err);
            setTestResult(`❌ Lỗi Mạng: ${err.message || err} (Xem F12 Console)`);
        }
    };
    // -------------------
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
                        <svg style={{ width: '32px', height: '32px', color: 'white' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Bango Pos</h1>
                    <p style={{ color: '#6B7280', marginTop: '4px' }}>Đăng nhập để tiếp tục</p>
                </div>

                {/* --- DEBUG: CONFIGURATION CHECK --- */}
                {(!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) && (
                    <div style={{
                        marginBottom: '24px',
                        padding: '16px',
                        backgroundColor: '#FEF2F2',
                        border: '2px solid #EF4444',
                        borderRadius: '12px',
                        color: '#B91C1C',
                        fontSize: '14px',
                        textAlign: 'left'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '16px' }}>⚠️ Lỗi Cấu Hình Hệ Thống</div>
                        <p style={{ margin: '0 0 8px 0' }}>Không tìm thấy thông tin kết nối Database. Vui lòng kiểm tra <strong>Variable Name</strong> trên Cloudflare:</p>
                        <ul style={{ paddingLeft: '20px', margin: 0 }}>
                            <li><code>VITE_SUPABASE_URL</code>: {import.meta.env.VITE_SUPABASE_URL ? '✅ Đã có' : '❌ Thiếu'}</li>
                            <li><code>VITE_SUPABASE_ANON_KEY</code>: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Đã có' : '❌ Thiếu'}</li>
                        </ul>
                    </div>
                )}
                {/* ---------------------------------- */}

                {/* Login Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                    padding: '32px',
                    border: '1px solid #f3f4f6'
                }}>
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

                        {/* Password */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                Mật khẩu
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 48px 12px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                        fontSize: '16px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
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
                                        color: '#9ca3af',
                                        cursor: 'pointer',
                                        padding: '4px'
                                    }}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        {/* Remember & Forgot */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" style={{ width: '16px', height: '16px' }} />
                                <span style={{ fontSize: '14px', color: '#4b5563' }}>Ghi nhớ đăng nhập</span>
                            </label>
                            <Link
                                to="/forgot-password"
                                style={{ fontSize: '14px', color: '#16a34a', fontWeight: '500', textDecoration: 'none' }}
                            >
                                Quên mật khẩu?
                            </Link>
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
                                fontSize: '16px',
                                boxShadow: isLoading ? 'none' : '0 10px 15px -3px rgba(34,197,94,0.3)'
                            }}
                        >
                            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </button>
                    </form>

                    {/* Register Link */}
                    <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#4b5563' }}>
                        Chưa có tài khoản?{' '}
                        <Link to="/register" style={{ color: '#16a34a', fontWeight: '500', textDecoration: 'none' }}>
                            Đăng ký ngay
                        </Link>
                    </div>


                </div>

                {/* --- DIAGNOSTICS UI (v1.3) --- */}
                <div style={{ marginTop: '30px', borderTop: '1px dashed #e5e7eb', paddingTop: '20px' }}>
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', textAlign: 'center' }}>
                        Debug Info (v1.3)
                    </p>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#6b7280', background: '#f9fafb', padding: '10px', borderRadius: '8px' }}>
                        <div><strong>URL Length:</strong> {rawSupabaseUrl ? rawSupabaseUrl.length : 0} ký tự (Cần kiểm tra khoảng trắng thừa)</div>
                        <div><strong>Clean URL:</strong> {debugSupabaseUrl ? debugSupabaseUrl.replace(/^(https?:\/\/[^.]+).+/, '$1...') : '(Trống)'}</div>
                        <div style={{ marginTop: '8px' }}>
                            <button
                                type="button"
                                onClick={testConnection}
                                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Kiểm tra kết nối Server (Có Trim)
                            </button>
                        </div>
                        {testResult && (
                            <div style={{ marginTop: '8px', fontWeight: 'bold', color: testResult.startsWith('✅') ? 'green' : 'red' }}>
                                {testResult}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

    );
}

export default LoginPage;
