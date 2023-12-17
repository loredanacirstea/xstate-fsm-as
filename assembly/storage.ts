import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';

import {
  InterpreterStatus,
  State,
  StateClassExternal,
  StatusMap,
  ContextParam,
} from './types';

const STORAGEKEY_STATE = "state"
const STORAGEKEY_STATUS = "status"
const STORAGEKEY_CTX = "context_"
const STORAGEKEY_OWNER = "owner"

export function storeContextParams(params: Array<ContextParam>): void {
    for (let i = 0; i < params.length; i++) {
        // storeBase64(params[i].key, params[i].value);
        setContextValue(params[i].key, params[i].value);
    }
}

export function storeBase64(key: string, value: string): void {
    const keybuf = decodeBase64(key);
    const valuebuf = decodeBase64(value);
    wasmx.storageStore(keybuf.buffer, valuebuf.buffer);
}

export function getCurrentStatus(): InterpreterStatus {
    const value = wasmxwrap.sload(STORAGEKEY_STATUS);
    return StatusMap.get(value);
}

export function setCurrentStatus(status: InterpreterStatus): void {
    const value = status.toString();
    return wasmxwrap.sstore(STORAGEKEY_STATUS, value);
}

export function getCurrentState(): State {
    const valuestr = wasmxwrap.sload(STORAGEKEY_STATE);
    const value = JSON.parse<StateClassExternal>(valuestr);
    return value.toInternal();
}

// TODO we dont really use this state but load the full state from config each
// time we transition an event
export function setCurrentState(value: State): void {
    const valueObj = StateClassExternal.fromInternal(value);
    return wasmxwrap.sstore(STORAGEKEY_STATE, JSON.stringify<StateClassExternal>(valueObj));
}

export function hasContextValue(key: string): boolean {
    const value = String.UTF8.decode(getContextValueInternal(key));
    return value != "";
}

export function getContextValue(key: string): string {
    return String.UTF8.decode(getContextValueInternal(key));
}

export function getContextValueInternal(key: string): ArrayBuffer {
    return wasmx.storageLoad(String.UTF8.encode(STORAGEKEY_CTX + key));
}

export function setContextValue(key: string, value: string): void {
    return setContextValueInternal(key, String.UTF8.encode(value));
}

export function setContextValueInternal(key: string, value: ArrayBuffer): void {
    return wasmx.storageStore(String.UTF8.encode(STORAGEKEY_CTX + key), value);
}

export function storeOwner(owner: ArrayBuffer): void {
    setContextValueInternal(STORAGEKEY_OWNER, owner);
}

export function loadOwner(): ArrayBuffer {
    return getContextValueInternal(STORAGEKEY_OWNER);
}
