import {
  create as _create,
  getCurrentState as _getCurrentState,
  getContextValue as _getContextValue,
  transition as _transition,
  run as _run,
  runInternal,
  createInternal,
  getContextValueInternal,
} from './machine';
import * as wasmx from './wasmx';
import * as wasmxwrap from './wasmx_wrap';
import {arrayBufferToU8Array} from './utils';
import {
  ContextGeneral,
  EventObject,
  Typestate,
} from './types';

export function wasmx_env_2(): void {}

export function instantiate_(): void {}

export function main(): u8[] {
    console.log("===main===")
    let result: ArrayBuffer;
    const calldata = wasmxwrap.getCallDataWrap<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>();
    if (calldata.run !== null) {
      result = runInternal(calldata.run!.id, calldata.run!.eventName);
    } else if (calldata.create !== null) {
      result = createInternal<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>(calldata.create!, null);
    } else if (calldata.getCurrentState !== null) {
      result = getCurrentState(calldata.getCurrentState!.id);
    } else if (calldata.getContextValue !== null) {
      result = getContextValueInternal(calldata.getContextValue!.id, calldata.getContextValue!.key);
    } else {
      wasmx.revert(String.UTF8.encode("invalid function call data"));
      throw new Error("invalid function call data");
    }
    wasmx.finish(result);
    return arrayBufferToU8Array(result);
}

export function create(
  _fsmConfig: ArrayBuffer,
  _implementations: ArrayBuffer,
): ArrayBuffer {
  return _create(_fsmConfig, _implementations);
}

export function getCurrentState(id: i32): ArrayBuffer {
  return _getCurrentState(id);
}

export function getContextValue(id: i32, keyBuf: ArrayBuffer): ArrayBuffer {
  return _getContextValue(id, keyBuf);
}

// TODO remove this
export function transition(id: i32, stateValueBuf: ArrayBuffer, eventNameBuf: ArrayBuffer): ArrayBuffer {
  return _transition(id, stateValueBuf, eventNameBuf);
}

export function run(
  id: i32,
  eventNameBuf: ArrayBuffer,
): void {
  return _run(id, eventNameBuf);
}
