import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';

import {
  InterpreterStatus,
  State,
  StateClassExternal,
  StatusMap,
} from './types';

const STORAGEKEY_STATE = "state"
const STORAGEKEY_STATUS = "status"
const STORAGEKEY_CTX = "context_"
const STORAGEKEY_OWNER = "owner"

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

export function setCurrentState(value: State): void {
    const valueObj = StateClassExternal.fromInternal(value);
    return wasmxwrap.sstore(STORAGEKEY_STATE, JSON.stringify<StateClassExternal>(valueObj));
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


export function storeOwner(owner: string): void {
    wasmxwrap.sstore(STORAGEKEY_OWNER, owner);
}

export function loadOwner(): string {
    return wasmxwrap.sload(STORAGEKEY_OWNER);
}
