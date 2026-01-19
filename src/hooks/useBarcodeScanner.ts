// =============================================================================
// BARCODE SCANNER HOOK
// Handles keyboard-based barcode scanners and camera scanning
// =============================================================================

import { useEffect, useCallback, useRef, useState } from 'react';

interface UseBarcodeSccannerOptions {
    onScan: (barcode: string) => void;
    minLength?: number;
    maxLength?: number;
    timeout?: number; // Max time between keystrokes
    enabled?: boolean;
    scannerPrefix?: string; // Some scanners add prefix
    scannerSuffix?: string; // Most add Enter at end
}

interface ScannerState {
    buffer: string;
    lastKeyTime: number;
}

/**
 * Hook for detecting barcode scanner input
 * Barcode scanners typically type very fast and end with Enter
 */
export function useBarcodeScanner({
    onScan,
    minLength = 3, // Allow short codes
    maxLength = 256, // Allow QR codes / URLs
    timeout = 50, // 50ms between keystrokes is typical for scanners
    enabled = true,
    scannerPrefix = '',
    scannerSuffix = 'Enter',
}: UseBarcodeSccannerOptions) {
    const stateRef = useRef<ScannerState>({ buffer: '', lastKeyTime: 0 });
    const [isScanning, setIsScanning] = useState(false);

    const processBarcode = useCallback(
        (barcode: string) => {
            // Remove prefix/suffix if present
            let cleaned = barcode.trim();
            if (scannerPrefix && cleaned.startsWith(scannerPrefix)) {
                cleaned = cleaned.slice(scannerPrefix.length);
            }

            // Validate length
            if (cleaned.length >= minLength && cleaned.length <= maxLength) {
                // Relaxed validation: Allow alphanumeric + standard symbols
                // QR codes often contain: - . _ : / ? = &
                if (/^[A-Za-z0-9\-\.\_\:\/\?\=\&\s]+$/.test(cleaned)) {
                    console.log('🔊 Barcode scanned:', cleaned);
                    onScan(cleaned);
                    return true;
                }
            }
            return false;
        },
        [onScan, minLength, maxLength, scannerPrefix]
    );

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const now = Date.now();
            const state = stateRef.current;
            const timeSinceLastKey = now - state.lastKeyTime;

            // Check if we're typing in an input field
            const target = event.target as HTMLElement;

            // NEVER intercept clicks on buttons or elements inside buttons
            if (target.tagName === 'BUTTON' || target.closest('button')) {
                state.buffer = '';
                return;
            }

            const isInputField =
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable;

            // IMPORTANT: For barcode scanners, keys come very fast (< 50ms apart)
            // If this is a slow input (> 100ms), it's likely manual typing - ignore if in input
            // But if this is rapid input, it might be a scanner - capture it
            const isRapidInput = timeSinceLastKey <= timeout && state.buffer.length > 0;
            // Only consider likely scanner when BOTH rapid AND has meaningful buffer
            const isLikelyScanner = isRapidInput && state.buffer.length >= 3;

            // If in input field AND not rapid scanner input, skip
            // But allow passthrough on special attribute
            if (isInputField && !isLikelyScanner && target.getAttribute('data-barcode-passthrough') !== 'true') {
                // Reset buffer when manually typing (slow)
                if (timeSinceLastKey > timeout) {
                    state.buffer = '';
                }
                return;
            }

            // Check time gap - if too long, reset buffer
            if (timeSinceLastKey > timeout && state.buffer.length > 0) {
                state.buffer = '';
            }

            // Handle Enter key (scanner typically sends Enter at end)
            if (event.key === 'Enter' || event.key === scannerSuffix) {
                if (state.buffer.length >= minLength) {
                    // ALWAYS prevent default when we have a barcode buffer
                    // This prevents Enter from triggering other actions like form submits
                    // Use stopImmediatePropagation to completely block ALL other listeners
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    setIsScanning(true);
                    processBarcode(state.buffer);
                    setIsScanning(false);
                }
                state.buffer = '';
                state.lastKeyTime = now;
                return;
            }

            // Only accept printable characters
            if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
                state.buffer += event.key;
                state.lastKeyTime = now;

                // Check if buffer looks like rapid scanner input
                if (state.buffer.length >= 2 && isRapidInput) {
                    setIsScanning(true);
                }
            }
        };

        // Add listener at document level to catch all keystrokes (capture phase)
        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [enabled, timeout, minLength, processBarcode, scannerSuffix]);

    return { isScanning };
}

/**
 * Beep sound for successful scan
 */
function playBeep() {
    try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 1000;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        // Ignore audio errors
    }
}

// =============================================================================
// CAMERA BARCODE SCANNER (Optional - requires BarcodeDetector API)
// =============================================================================

interface UseCameraSccannerOptions {
    onScan: (barcode: string) => void;
    enabled?: boolean;
}

export function useCameraScanner({ onScan, enabled = false }: UseCameraSccannerOptions) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isSupported, setIsSupported] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check if BarcodeDetector API is available
        if ('BarcodeDetector' in window) {
            setIsSupported(true);
        }
    }, []);

    const startCamera = useCallback(async () => {
        if (!isSupported || !enabled) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setIsActive(true);
                setError(null);

                // Start detection
                const detector = new (window as unknown as {
                    BarcodeDetector: new (options?: { formats?: string[] }) => {
                        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
                    }
                }).BarcodeDetector({
                    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
                });

                const detectBarcodes = async () => {
                    if (!videoRef.current || !isActive) return;

                    try {
                        const barcodes = await detector.detect(videoRef.current);
                        if (barcodes.length > 0) {
                            onScan(barcodes[0].rawValue);
                            playBeep();
                        }
                    } catch (e) {
                        // Ignore detection errors
                    }

                    if (isActive) {
                        requestAnimationFrame(detectBarcodes);
                    }
                };

                detectBarcodes();
            }
        } catch (err) {
            setError('Không thể truy cập camera');
            console.error('Camera error:', err);
        }
    }, [isSupported, enabled, onScan, isActive]);

    const stopCamera = useCallback(() => {
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsActive(false);
    }, []);

    return {
        videoRef,
        isSupported,
        isActive,
        error,
        startCamera,
        stopCamera,
    };
}

export default useBarcodeScanner;
