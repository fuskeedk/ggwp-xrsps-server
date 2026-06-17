import { isIos } from "../../util/DeviceUtil";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bzip2 = require("bzip2");

type WasmBzipInstance = {
    decompress(
        data: Uint8Array,
        expectedSize: number,
        opts?: { small?: boolean },
    ): Uint8Array;
};

export class Bzip2 {
    static bzip2Header = new Uint8Array("BZh1".split("").map((char) => char.charCodeAt(0)));

    static wasmBzip: WasmBzipInstance | null = null;
    static readonly isIOS = isIos;

    static async initWasm(): Promise<void> {
        if (Bzip2.isIOS) {
            console.log("[Bzip2] iOS: using JS decompressor");
            return;
        }
        const WasmBzip2 = (await import("@foxglove/wasm-bz2")).default;
        Bzip2.wasmBzip = await WasmBzip2.init();
    }

    static decompress(compressed: Uint8Array, actualSize: number): Int8Array {
        const compressedBzip = new Uint8Array(compressed.length + 4);
        compressedBzip.set(Bzip2.bzip2Header, 0);
        compressedBzip.set(compressed, 4);

        if (Bzip2.isIOS || !Bzip2.wasmBzip) {
            const result = bzip2.simple(bzip2.array(compressedBzip));
            return new Int8Array(result.buffer, result.byteOffset, result.byteLength);
        }

        const decompressed = Bzip2.wasmBzip.decompress(compressedBzip, actualSize, {
            small: false,
        });
        return new Int8Array(
            decompressed.buffer.slice(
                decompressed.byteOffset,
                decompressed.byteOffset + decompressed.byteLength,
            ),
        );
    }
}
