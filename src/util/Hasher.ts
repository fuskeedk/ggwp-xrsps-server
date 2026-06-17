import { xxHash32 } from "js-xxhash";

import { isIos } from "./DeviceUtil";

type XXHashAPI = {
    h32Raw(data: Uint8Array): number;
    h64Raw(data: Uint8Array): bigint;
};

export class Hasher {
    static hashApi: XXHashAPI | undefined;

    static async init(): Promise<void> {
        if (isIos) {
            return;
        }
        const xxhash = (await import("xxhash-wasm")).default;
        Hasher.hashApi = await xxhash();
    }

    static hash32Int(n: number): number {
        const buf = new Int32Array([n]);
        return this.hash32(new Uint8Array(buf.buffer));
    }

    static hash32(data: Uint8Array): number {
        if (Hasher.hashApi) {
            return Hasher.hashApi.h32Raw(data);
        }
        return Hasher.hash32js(data);
    }

    static hash32js(data: Uint8Array): number {
        return xxHash32(data);
    }

    static hash64(data: Uint8Array): bigint {
        if (Hasher.hashApi) {
            return Hasher.hashApi.h64Raw(data);
        }
        return Hasher.hash64js(data);
    }

    static hash64js(data: Uint8Array): bigint {
        const v0 = xxHash32(data, Math.random() * 0xffffff);
        const v1 = xxHash32(data, Math.random() * 0xffffff);
        return (BigInt(v0) << 32n) | BigInt(v1);
    }

    static bufToBigInt(data: Uint8Array): bigint {
        let bits = 8n;

        let ret = 0n;
        for (const i of data.values()) {
            const bi = BigInt(i);
            ret = (ret << bits) + bi;
        }
        return ret;
    }
}
