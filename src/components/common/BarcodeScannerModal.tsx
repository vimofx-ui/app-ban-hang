import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Camera, RotateCcw } from 'lucide-react';

interface BarcodeScannerModalProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
    title?: string;
}

export function BarcodeScannerModal({ onScan, onClose, title = "Quét mã vạch" }: BarcodeScannerModalProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerRegionId = "html5qr-code-full-region";
    const [isScanning, setIsScanning] = useState(true);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState('');

    useEffect(() => {
        // Initialize scanner
        const initScanner = async () => {
            try {
                // Try to get cameras first
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length) {
                    setCameras(devices);
                    // Prefer back camera (environment)
                    const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('sau'));
                    setActiveCameraId(backCamera ? backCamera.id : devices[0].id);
                } else {
                    // No cameras enumerated, but might still work with generic constraints
                    console.warn("No cameras enumerated, attempting generic start");
                    startScanningWithConstraints({ facingMode: "environment" });
                }
            } catch (err) {
                console.error("Error getting cameras", err);
                // Fallback: Try to start directly with constraints even if enumeration failed
                // This often works on mobile browsers where enumeration requires double permission or is restricted
                startScanningWithConstraints({ facingMode: "environment" });
            }
        };

        if (isScanning) {
            initScanner();
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(err => console.error("Error stopping scanner", err));
            }
        };
    }, []);

    useEffect(() => {
        if (activeCameraId && isScanning && !scannerRef.current) {
            startScanning(activeCameraId);
        }
    }, [activeCameraId, isScanning]);

    const getScannerConfig = () => ({
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.ITF,
        ]
    });

    const startScanningWithConstraints = async (constraints: any) => {
        if (scannerRef.current) {
            await scannerRef.current.stop();
            scannerRef.current.clear();
        }

        const scanner = new Html5Qrcode(scannerRegionId);
        scannerRef.current = scanner;

        try {
            await scanner.start(
                constraints,
                getScannerConfig(),
                (decodedText) => {
                    scanner.stop().then(() => {
                        scanner.clear();
                        onScan(decodedText);
                    });
                },
                () => { }
            );
        } catch (err) {
            console.error("Error starting scanner with constraints", err);
            setCameraError("Không thể truy cập camera. Vui lòng cấp quyền hoặc sử dụng HTTPS.");
        }
    };

    const startScanning = async (cameraId: string) => {
        if (scannerRef.current) {
            await scannerRef.current.stop();
            scannerRef.current.clear();
        }

        const scanner = new Html5Qrcode(scannerRegionId);
        scannerRef.current = scanner;

        try {
            await scanner.start(
                cameraId,
                getScannerConfig(),
                (decodedText) => {
                    scanner.stop().then(() => {
                        scanner.clear();
                        onScan(decodedText);
                    });
                },
                () => { }
            );
        } catch (err) {
            console.error("Error starting scanner", err);
            setCameraError("Không thể khởi động camera.");
        }
    };

    const handleSwitchCamera = () => {
        if (cameras.length > 1) {
            const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
            const nextIndex = (currentIndex + 1) % cameras.length;
            setActiveCameraId(cameras[nextIndex].id);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualCode.trim()) {
            onScan(manualCode.trim());
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4">
            <div className="w-[90vw] md:w-full max-w-md min-w-[350px] relative bg-black rounded-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-4 text-white z-10">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Camera size={20} />
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scanner Area */}
                <div className="relative flex-1 bg-black w-full flex items-center justify-center overflow-hidden min-h-[300px]">
                    {cameraError ? (
                        <div className="text-center p-6 text-white/90 w-full max-w-[90%] z-20">
                            <div className="mb-4 flex justify-center">
                                <span className="bg-red-500/20 p-3 rounded-full text-red-500">
                                    <Camera size={32} />
                                </span>
                            </div>
                            <h4 className="text-lg font-bold text-white mb-2">Không tìm thấy camera</h4>
                            <p className="text-sm text-gray-300 mb-4 leading-relaxed">{cameraError}</p>
                            <p className="text-xs text-gray-500">Vui lòng nhập mã thủ công bên dưới.</p>
                        </div>
                    ) : (
                        <div id={scannerRegionId} className="w-full h-full"></div>
                    )}

                    {/* Scanning overlay frame */}
                    {!cameraError && (
                        <div className="absolute inset-0 pointer-events-none border-[50px] border-black/50">
                            <div className="w-full h-full border-2 border-green-500 relative">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500 -mt-0.5 -ml-0.5"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500 -mt-0.5 -mr-0.5"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500 -mb-0.5 -ml-0.5"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500 -mb-0.5 -mr-0.5"></div>
                                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-green-500/50 animate-pulse"></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="p-5 bg-black/80 space-y-4">
                    <p className="text-white/70 text-center text-sm">
                        Di chuyển camera đến mã vạch hoặc mã QR
                    </p>

                    {cameras.length > 1 && !cameraError && (
                        <button
                            onClick={handleSwitchCamera}
                            className="w-full py-2.5 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={16} />
                            Đổi camera ({cameras.length})
                        </button>
                    )}

                    {/* Manual Input */}
                    <form onSubmit={handleManualSubmit} className="relative">
                        <input
                            type="text"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            placeholder="Hoặc nhập mã thủ công..."
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            autoFocus={!!cameraError}
                        />
                        <button
                            type="submit"
                            disabled={!manualCode.trim()}
                            className="absolute right-2 top-2 bottom-2 px-4 bg-green-600 rounded-lg text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700"
                        >
                            OK
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
