import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as wasmx from './wasmx';
import {
    EventClassExternal,
    CallRequest,
    CallResponse,
    ContextParam,
} from './types';
import { hexToU8, uint8ArrayToHex, hexToUint8Array, parseUint8ArrayToI32BigEndian } from "./utils";
import { MachineExternal } from './machine';

const MAX_LOGGED = 2000

export class InterpreterCallData {
    config: MachineExternal;
    calldata: CallData;
    constructor(config: MachineExternal, calldata: CallData) {
        this.config = config;
        this.calldata = calldata;
    }
}

// @ts-ignore
@serializable
export class CallData {
    // TODO - this should only be done in the interpreter storage; to remove
    // create: ConfigExternal | null = null;
    instantiate: CallDataInstantiate | null = null;
    getCurrentState: CallDataGetCurrentState | null = null;
    getContextValue: CallDataGetContextValue | null = null;
    run: CallDataRun | null = null;
}

// @ts-ignore
@serializable
export class CallDataInstantiate {
    initialState: string;
    context: Array<ContextParam>;
    constructor(state: string, context: Array<ContextParam>) {
        this.initialState = state;
        this.context = context;
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
    event: EventClassExternal;
    constructor(event: EventClassExternal) {
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

export function getCallDataWrap(): InterpreterCallData {
    const icalld = getInterpreterCalldata();
    const configBz = icalld[0];
    const calldBz = icalld[1];
    const config = JSON.parse<MachineExternal>(String.UTF8.decode(configBz));
    const calldata = JSON.parse<CallData>(String.UTF8.decode(calldBz));
    return new InterpreterCallData(config, calldata);
}

export function getInterpreterCalldata(): Array<ArrayBuffer> {
    // configBz length + configBz + calldata length + calldata
    const calldraw = wasmx.getCallData();
    const configlenraw = calldraw.slice(0, 32);
    const configlen = parseUint8ArrayToI32BigEndian(Uint8Array.wrap(configlenraw.slice(28, 32)))
    const configBz = calldraw.slice(32, 32 + configlen)
    const calldlenraw = calldraw.slice(32 + configlen, 64 + configlen)
    const calldlen = parseUint8ArrayToI32BigEndian(Uint8Array.wrap(calldlenraw.slice(28, 32)))
    const calldBz = calldraw.slice(64 + configlen, 64 + configlen + calldlen)
    return [configBz, calldBz]
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

// @ts-ignore
@serializable
class GrpcResponse {
    data: string // base64
    error: string
    constructor(data: string, error: string) {
        this.data = data;
        this.error = error;
    }
}

export function grpcRequest(ip: string, contract: Uint8Array, data: string): GrpcResponse {
    const contractAddress = encodeBase64(contract);
    const reqstr = `{"ip_address":"${ip}","contract":"${contractAddress}","data":"${data}"}`
    console.debug("grpc request: " + reqstr.slice(0, MAX_LOGGED) + " [...]");
    const req = String.UTF8.encode(reqstr);
    const result = wasmx.grpcRequest(req);
    console.debug("grpc response: " + String.UTF8.decode(result));
    const response = JSON.parse<GrpcResponse>(String.UTF8.decode(result));
    console.debug("grpc response data: " + response.data);
    if (response.error.length == 0) {
        response.data = String.UTF8.decode(decodeBase64(response.data).buffer);
    }
    return response;
}

export function call(req: CallRequest): CallResponse {
    const requestStr = JSON.stringify<CallRequest>(req);
    const responsebz = wasmx.call(String.UTF8.encode(requestStr));
    return JSON.parse<CallResponse>(String.UTF8.decode(responsebz));
}

// base64 encoded data
export function sha256(base64Data: string): string {
    const buf = decodeBase64(base64Data);
    const res = wasmx.sha256(buf.buffer);
    return encodeBase64(Uint8Array.wrap(res));
}
