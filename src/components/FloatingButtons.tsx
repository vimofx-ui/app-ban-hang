import React, { useState, useEffect } from 'react';

export function FloatingButtons() {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    const handleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .catch((err) => console.error('Fullscreen error:', err));
        } else {
            document.exitFullscreen()
                .catch((err) => console.error('Exit error:', err));
        }
    };

    const handleLogout = () => {
        console.log('handleLogout called');
        // Không dùng confirm vì bị đóng ngay
        // Redirect trực tiếp
        window.location.href = '/dang-nhap';
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: '70px',
                right: '15px',
                zIndex: 999999,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}
        >
            <button
                type="button"
                style={{
                    background: isFullscreen ? '#f59e0b' : '#16a34a',
                    color: 'white',
                    padding: '10px 14px',
                    fontWeight: '600',
                    fontSize: '12px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
                onClick={handleFullscreen}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {isFullscreen ? '📱 Thoát FS' : '🖥️ Toàn màn hình'}
            </button>
            <button
                type="button"
                style={{
                    background: '#dc2626',
                    color: 'white',
                    padding: '10px 14px',
                    fontWeight: '600',
                    fontSize: '12px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
                onClick={handleLogout}
                onMouseDown={(e) => e.stopPropagation()}
            >
                🚪 Đăng xuất
            </button>
        </div>
    );
}