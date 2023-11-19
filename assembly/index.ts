import { JSON } from "json-as/assembly";
import {
  create as _create,
  getCurrentState as _getCurrentState,
  getContextValue as _getContextValue,
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
  EventClass,
  ConfigExternal,
} from './types';
import * as data from './data';
import { Console } from "as-wasi/assembly";

Console.log("Hello World!");

// WASI
main()
// TODO uncomment
// export function wasmx_env_2(): void {}

// todo for reactor model
export function instantiate(): void {
  const calld = JSON.parse<ConfigExternal<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>>(data.networkState2);
  createInternal<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>(calld, null);
}

export function main(): u8[] {
  console.log("--main--")
  Console.log("--Console--main")
    let result: ArrayBuffer;
    const calldata = wasmxwrap.getCallDataWrap<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>();
    if (calldata.run !== null) {
      const event = calldata.run!.event;
      const _event = new EventClass(event.type, event.params);
      result = runInternal(calldata.run!.id, _event);
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

export function run(
  id: i32,
  eventNameBuf: ArrayBuffer,
): void {
  return _run(id, eventNameBuf);
}

export function getCurrentState(id: i32): ArrayBuffer {
  return _getCurrentState(id);
}

export function getContextValue(id: i32, keyBuf: ArrayBuffer): ArrayBuffer {
  return _getContextValue(id, keyBuf);
}

