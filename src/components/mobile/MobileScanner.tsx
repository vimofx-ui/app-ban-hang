import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, SwitchCamera, Zap, ZapOff } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this exists, or use class names directly

interface MobileScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
    isOpen: boolean;
}

export function MobileScanner({ onScan, onClose, isOpen }: MobileScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            if (scannerRef.current && isScanning) {
                scannerRef.current.stop().catch(console.error);
                setIsScanning(false);
            }
            return;
        }

        const startScanner = async () => {
            try {
                // Determine format based on needs. Common 1D barcodes + QR
                const formatsToSupport: Html5QrcodeSupportedFormats[] = [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
                ];

                const html5QrCode = new Html5Qrcode("reader", { formatsToSupport, verbose: false });
                scannerRef.current = html5QrCode;

                await html5QrCode.start(
                    { facingMode: facingMode },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0
                    },
                    (decodedText) => {
                        // Success callback
                        // Beep sound could be added here
                        const audio = new Audio('/beep.mp3'); // Optional: Add a beep sound if available
                        // audio.play().catch(() => {}); 
                        onScan(decodedText);
                    },
                    (errorMessage) => {
                        // Error callback (scanning in progress.. ignore mostly)
                    }
                );
                setIsScanning(true);
                setCameraError(null);
            } catch (err) {
                console.error("Error starting scanner", err);
                setCameraError("Không thể khởi động camera. Vui lòng cấp quyền.");
            }
        };

        // Small timeout to ensure DOM is ready
        const timer = setTimeout(() => {
            startScanner();
        }, 300);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(console.error);
            }
            scannerRef.current = null;
        };
    }, [isOpen, facingMode]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-4 z-10 text-white bg-black/50 backdrop-blur-sm">
                <h3 className="font-bold text-lg">Quét mã vạch</h3>
                <button onClick={onClose} className="p-2 rounded-full bg-white/20">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Camera Viewport */}
            <div className="flex-1 relative bg-black flex flex-col justify-center overflow-hidden">
                {cameraError ? (
                    <div className="text-white text-center p-6 bg-red-500/20 mx-4 rounded-xl border border-red-500/50">
                        <p className="mb-2">⚠️ {cameraError}</p>
                        <button onClick={onClose} className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold mt-2">
                            Đóng
                        </button>
                    </div>
                ) : (
                    <div id="reader" className="w-full h-full max-h-[80vh] overflow-hidden rounded-lg"></div>
                )}

                {/* Overlay Guidelines */}
                {!cameraError && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-64 h-64 border-2 border-emerald-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] z-0 relative">
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-500 -mt-0.5 -ml-0.5"></div>
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-500 -mt-0.5 -mr-0.5"></div>
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-500 -mb-0.5 -ml-0.5"></div>
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-500 -mb-0.5 -mr-0.5"></div>
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500/50 animate-pulse"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="p-6 bg-black z-10 flex justify-center gap-8 pb-10">
                <button
                    onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                    className="flex flex-col items-center gap-2 text-white/80 active:text-white"
                >
                    <div className="p-4 bg-white/10 rounded-full">
                        <SwitchCamera className="w-6 h-6" />
                    </div>
                    <span className="text-xs">Đổi camera</span>
                </button>
            </div>
        </div>
    );
}
