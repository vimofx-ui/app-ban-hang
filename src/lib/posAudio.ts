/**
 * POS Audio Utility - Sound effects for barcode scanning
 * Uses Web Audio API - no external audio files needed
 */

export const POSAudio = {
    /**
     * Play error/warning sound - for incorrect or not found barcode
     * Uses sawtooth wave for a distinctive warning beep
     */
    playError: () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Sawtooth wave - harsh sound for warning
            oscillator.type = 'sawtooth';
            oscillator.frequency.value = 440; // A4 note

            // Quick beep effect
            gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);

            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.5);

            // Cleanup
            setTimeout(() => ctx.close(), 600);
        } catch (e) {
            console.warn('Audio error:', e);
        }
    },

    /**
     * Play double error beep - for more serious warnings
     */
    playDoubleError: () => {
        POSAudio.playError();
        setTimeout(() => POSAudio.playError(), 200);
    },

    /**
     * Play success sound - for successful barcode scan
     * Uses sine wave for a pleasant short beep
     */
    playSuccess: () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Sine wave - pleasant soft sound
            oscillator.type = 'sine';
            oscillator.frequency.value = 1000; // Higher pitch

            // Quick short beep
            gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);

            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.1);

            // Cleanup
            setTimeout(() => ctx.close(), 200);
        } catch (e) {
            console.warn('Audio error:', e);
        }
    },

    /**
     * Play add item sound - two quick ascending beeps
     */
    playAddItem: () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();

            // First beep (lower)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.type = 'sine';
            osc1.frequency.value = 800;
            gain1.gain.setValueAtTime(0.06, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.08);
            osc1.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 0.08);

            // Second beep (higher) - after 80ms
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.type = 'sine';
            osc2.frequency.value = 1200;
            gain2.gain.setValueAtTime(0.06, ctx.currentTime + 0.1);
            gain2.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.18);
            osc2.start(ctx.currentTime + 0.1);
            osc2.stop(ctx.currentTime + 0.18);

            // Cleanup
            setTimeout(() => ctx.close(), 300);
        } catch (e) {
            console.warn('Audio error:', e);
        }
    }
};

export default POSAudio;
