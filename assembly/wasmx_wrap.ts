import { JSON } from "json-as/assembly";
import * as wasmx from './wasmx';
import {
    ConfigExternal,
    EventObject,
    Typestate,
} from './types';

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
    eventName: string;
    constructor(id: i32, eventName: string) {
        this.id = id;
        this.eventName = eventName;
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
