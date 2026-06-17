import fs from "fs";
import path from "path";

import { USER_AGENT, ensureDir } from "./config";

export async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return (await response.json()) as T;
}

export async function downloadFile(
    url: string,
    destPath: string,
    opts?: { maxAgeMs?: number },
): Promise<boolean> {
    ensureDir(path.dirname(destPath));
    if (opts?.maxAgeMs && fs.existsSync(destPath)) {
        const age = Date.now() - fs.statSync(destPath).mtimeMs;
        if (age < opts.maxAgeMs) {
            console.log(`[skip] ${destPath} (fresh, ${Math.round(age / 3600000)}h old)`);
            return false;
        }
    }
    console.log(`[download] ${url}`);
    const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} downloading ${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
    console.log(`[saved] ${destPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
    return true;
}
