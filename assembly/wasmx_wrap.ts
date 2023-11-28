import { JSON } from "json-as/assembly";
import * as wasmx from './wasmx';
import {
    EventClassExternal,
    CallRequest,
    CallResponse,
    ContextParam,
} from './types';
import { hexToU8, uint8ArrayToHex, hexToUint8Array } from "./utils";
import { MachineExternal } from './machine';

// @ts-ignore
@serializable
export class CallData {
    // TODO - this should only be done in the interpreter storage; to remove
    // create: ConfigExternal | null = null;
    getCurrentState: CallDataGetCurrentState | null = null;
    getContextValue: CallDataGetContextValue | null = null;
    run: CallDataRun | null = null;
}

// @ts-ignore
@serializable
export class CallDataInstantiate {
    config: MachineExternal;
    initialState: string;
    params: Array<ContextParam>;
    constructor(config: MachineExternal, state: string, params: Array<ContextParam>) {
        this.config = config;
        this.initialState = state;
        this.params = params;
    }
}

// @ts-ignore
@serializable
export class CallDataGetCurrentState {}

// @ts-ignore
@serializable
export class CallDataGetContextValue {
    key: string;
    constructor(key: string) {
        this.key = key;
    }
}

// @ts-ignore
@serializable
export class CallDataRun {
    config: MachineExternal;
    event: EventClassExternal;
    constructor(config: MachineExternal, event: EventClassExternal) {
        this.config = config;
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

export function getCallDataWrap(): CallData {
    const calldStr = String.UTF8.decode(wasmx.getCallData())
    // console.log("--getCallDataWrap--" + calldStr);
    const calld = JSON.parse<CallData>(calldStr);
    return calld;
}

export function getCaller(): string {
    // console.log("--getCaller--")
    const callerbuf = wasmx.getCaller();
    // console.log("--callerbuf-- " + callerbuf.byteLength.toString());
    return uint8ArrayToHex(Uint8Array.wrap(callerbuf));
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

export function call(req: CallRequest): CallResponse {
    const requestStr = JSON.stringify<CallRequest>(req);
    const responsebz = wasmx.call(String.UTF8.encode(requestStr));
    return JSON.parse<CallResponse>(String.UTF8.decode(responsebz));
}
