// iOS Safari Compatibility Layer
// Dette modul omgår alle WebAssembly-relaterede fejl på iOS Safari

// Detect iOS Safari
export function isIOSSafari(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && 
           /WebKit/.test(ua) && 
           !/(CriOS|FxiOS|OPiOS|mercury|EdgiOS)/.test(ua);
}

// Global iOS flag
export const IS_IOS_SAFARI = isIOSSafari();

// Wrapper til at disable WASM på iOS
export function disableWasmOnIOS(): void {
    if (IS_IOS_SAFARI) {
        console.log("[iOS Compatibility] WebAssembly disabled on iOS Safari");
        // Sæt en global flag som andre moduler kan tjekke
        (globalThis as any).__DISABLE_WASM__ = true;
    }
}

// Safe Uint8Array creation for iOS
export function safeUint8Array(data: ArrayLike<number> | ArrayBufferLike): Uint8Array {
    try {
        return new Uint8Array(data as ArrayBuffer | ArrayLike<number>);
    } catch (e) {
        console.warn("[iOS Compatibility] Uint8Array creation failed, trying fallback:", e);
        // På iOS: prøv at konvertere til array først
        if (Array.isArray(data)) {
            return new Uint8Array(data);
        }
        // Hvis det er en ArrayBuffer
        if (data instanceof ArrayBuffer) {
            return new Uint8Array(data.slice(0));
        }
        throw e;
    }
}
