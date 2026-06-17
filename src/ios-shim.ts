/**
 * Must be the first import in browser entry points and web workers.
 * Prevents wasm chunk loaders from running on iOS Safari.
 */
import { isIos } from "./util/DeviceUtil";

if (typeof globalThis !== "undefined" && isIos) {
    (globalThis as { __IOS_SAFARI__?: boolean; __DISABLE_WASM__?: boolean }).__IOS_SAFARI__ =
        true;
    (globalThis as { __DISABLE_WASM__?: boolean }).__DISABLE_WASM__ = true;
    try {
        // Block wasm-bindgen style loaders from initializing.
        Object.defineProperty(globalThis, "WebAssembly", {
            configurable: true,
            value: undefined,
        });
    } catch {
        (globalThis as unknown as { WebAssembly?: undefined }).WebAssembly = undefined;
    }
    console.log("[ios-shim] iOS: WebAssembly disabled");
}
