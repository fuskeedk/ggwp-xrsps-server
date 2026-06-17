export function registerServiceWorker(): void {
    const isProd = typeof process !== "undefined" && process.env?.NODE_ENV === "production";
    if (!isProd) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Never register a service worker — legacy SW caused iOS cache/stream failures.
    navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
        .catch(() => {});
}

export function unregisterServiceWorker(): void {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => registration.unregister()).catch(() => {});
}
