import * as wasmx from './wasmx';
import * as consensuswrap from './consensus_wrap';
import { Base64String, HexString } from './types';
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";

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

export function parseUint8ArrayToI32BigEndian(buff: Uint8Array): i32 {
    var view = new DataView(buff.buffer, 0);
    return view.getInt32(0, false);
}

export function i32ToUint8ArrayBE(value: i32): Uint8Array {
    const v = new ArrayBuffer(4);
    var view = new DataView(v, 0);
    view.setInt32(0, value, false);
    return Uint8Array.wrap(v);
}

export function i64ToUint8ArrayBE(value: i64): Uint8Array {
    const v = new ArrayBuffer(8);
    var view = new DataView(v, 0);
    view.setInt64(0, value, false);
    return Uint8Array.wrap(v);
}

export function revert(message: string): void {
    // console.debug(`Error: ${message}`);
    consensuswrap.LoggerError("revert", ["message", message])
    wasmx.revert(String.UTF8.encode(message));
    throw new Error(message);
}

export function parseInt32(value: string): i32 {
    return i32(parseInt(value));
}

export function parseInt64(value: string): i64 {
    return i64(parseInt(value));
}

export function getAddressHex(addrbuf: ArrayBuffer): string {
    return uint8ArrayToHex(Uint8Array.wrap(addrbuf));
}

export function base64ToHex(value: Base64String): HexString {
    return uint8ArrayToHex(decodeBase64(value))
}

export function hex64ToBase64(value: HexString): Base64String {
    return encodeBase64(hexToUint8Array(value))
}
