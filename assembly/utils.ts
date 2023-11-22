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

export function hexToU8(value: string): u8[] {
    const arr: u8[] = [];
    if (value.length % 2 == 1) value = "0" + value;
    value = value.padStart(64, '0');

    for (let i = 0; i < value.length / 2; i++) {
        arr[i] = u8(parseInt(value.substr(2*i, 2), 16))
    }
    return arr;
}

export function hexToUint8Array(value: string): Uint8Array {
    if (value.length % 2 == 1) value = "0" + value;
    value = value.padStart(64, '0');
    const arr: Uint8Array = new Uint8Array(value.length / 2);

    for (let i = 0; i < value.length / 2; i++) {
        const item = u8(parseInt(value.substr(2*i, 2), 16));
        arr.set([item], i);
    }
    return arr;
}

export function parseUint8ArrayToI32BigEndian(bytes: Uint8Array): i32 {
    if (bytes.length < 4) {
        throw new Error("Uint8Array is too small to contain an i32.");
    }
    return (
        (bytes[0] << 24) |
        (bytes[1] << 16) |
        (bytes[2] << 8) |
        (bytes[3] << 0)
    );
}
