import { JSON } from "json-as/assembly";
import * as wasmx from './wasmx';
import {
    ConfigExternal,
    EventClassExternal,
    EventObject,
    Typestate,
} from './types';
import { hexToU8, uint8ArrayToHex, hexToUint8Array } from "./utils";

// @ts-ignore
@serializable
export class CallData<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>,
> {
    create: ConfigExternal<TContext, TEvent, TState> | null = null;
    getCurrentState: CallDataGetCurrentState | null = null;
    getContextValue: CallDataGetContextValue | null = null;
    run: CallDataRun | null = null;
}

// @ts-ignore
@serializable
export class CallDataGetCurrentState {
    id: i32;
    constructor(id: i32) {
        this.id = id;
    }
}

// @ts-ignore
@serializable
export class CallDataGetContextValue {
    id: i32;
    key: string;
    constructor(id: i32, key: string) {
        this.id = id;
        this.key = key;
    }
}

// @ts-ignore
@serializable
export class CallDataRun {
    id: i32;
    event: EventClassExternal;
    constructor(id: i32, event: EventClassExternal) {
        this.id = id;
        this.event = event;
    }
}

// @ts-ignore
@serializable
export class WasmxLog {
    type: string = 'fsmvm';
    data: Uint8Array;
    topics: Array<Uint8Array>;
    constructor(data: Uint8Array, topics: Array<Uint8Array>) {
        this.data = data;
        this.topics = topics;
    }
}

export function getCallDataWrap<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>,
>(): CallData<TContext, TEvent, TState> {
    const calldStr = String.UTF8.decode(wasmx.getCallData())
    console.log("--getCallDataWrap--" + calldStr);
    const calld = JSON.parse<CallData<TContext, TEvent, TState>>(calldStr);
    return calld;
}

export function getCaller(): string {
    console.log("--getCaller--")
    const callerbuf = wasmx.getCaller();
    console.log("--callerbuf-- " + callerbuf.byteLength.toString());
    return uint8ArrayToHex(Uint8Array.wrap(callerbuf));
}

export function getBalance(address: string): i64 {
    // console.log("--getBalance--")
    // const addrbuf = hexToUint8Array(address);
    // const balancebuf = wasmx.getBalance(addrbuf.buffer);
    // console.log("--balancebuf-- " + balancebuf.byteLength.toString());
    // const balanceb = balancebuf.slice(20); // TODO fixme - bigint
    // const balancehex = uint8ArrayToHex(Uint8Array.wrap(balanceb));
    // const balance = parseInt(balancehex, 16);
    // return i64(balance);
    return i64(0)
}

export function sstore(key: string, value: string): void {
    wasmx.storageStore(String.UTF8.encode(key), String.UTF8.encode(value));
}

export function sload(key: string): string {
    const value = wasmx.storageLoad(String.UTF8.encode(key));
    return String.UTF8.decode(value);
}

export function intToString(value: i32): string {
    let vstr = value.toString(10);
    if (!vstr.includes(".")) return vstr;
    return vstr.substring(0, vstr.length - 2);
}

export function storeCounter(value: i32): void {
    sstore("counter", intToString(value));
}

export function storeOwner(id: i32, owner: string): void {
    sstore("owner" + id.toString(), owner);
}

export function loadOwner(id: i32): string {
    return sload("owner" + id.toString());
}

export function loadCounter(): i32 {
    const value = sload("counter");
    return I32.parseInt(value, 10);
}

export function createService(value: string): i32 {
    const counter = loadCounter();
    const key = counter;
    sstore(intToString(key), value);
    storeCounter(key + 1);
    return key;
}

export function storeService(id: i32, value: string): void {
    sstore(intToString(id), value);
}

export function loadService(id: i32): string {
    const value = sload(intToString(id));
    return value;
}

export function log_fsm(
    data: Uint8Array,
    topics: Array<Uint8Array>,
): void {
    const logs = new WasmxLog(data, topics)
    const logstr = JSON.stringify<WasmxLog>(logs);
    wasmx.log(String.UTF8.encode(logstr));
}

export function grpcRequest(ip: string, data: string): string {
    const req = String.UTF8.encode(`{"address":"${ip}","data":"${data}"}`);
    const result = wasmx.grpcRequest(req);
    console.log(String.UTF8.decode(result));
    return String.UTF8.decode(result);
}
