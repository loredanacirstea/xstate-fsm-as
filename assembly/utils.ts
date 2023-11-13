export function arrayBufferToU8Array(buffer: ArrayBuffer): u8[] {
    const length = buffer.byteLength;
    const uint8View = Uint8Array.wrap(buffer);
    const u8Array: u8[] = [];

    for (let i = 0; i < length; i++) {
        u8Array[i] =  uint8View[i];
    }
    return u8Array;
}

export function uint8ArrayToHex(arr: Uint8Array): string {
    return arr.reduce((accum: string, v: u8) => accum + v.toString(16).padStart(2, '0'), "");
}
