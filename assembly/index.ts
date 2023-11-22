import { JSON } from "json-as/assembly";
import {
  create as _create,
  getCurrentState as _getCurrentState,
  getContextValue as _getContextValue,
  run as _run,
  eventual as _eventual,
  runInternal,
  createInternal,
  getContextValueInternal,
} from './machine';
import * as wasmx from './wasmx';
import * as wasmxwrap from './wasmx_wrap';
import {arrayBufferToU8Array, parseUint8ArrayToI32BigEndian} from './utils';
import {
  ContextGeneral,
  EventObject,
  Typestate,
  EventClass,
  ConfigExternal,
  TimerArgs,
  EventualArgs,
} from './types';
import * as data from './data';
import { Console } from "as-wasi/assembly";

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

export function eventual(): void {
  console.log("* eventual");
  const calld = wasmx.getCallData();
  console.log("* eventual: calld: " + calld.byteLength.toString());
  const intervalId = parseUint8ArrayToI32BigEndian(Uint8Array.wrap(calld.slice(0, 4)));

  const argsStr = String.UTF8.decode(calld.slice(4));
  console.log("* eventual: args: " + argsStr);
  const _args = JSON.parse<TimerArgs>(argsStr);
  console.log("* eventual: parsed args");
  _eventual(intervalId, _args);


  // const calldStr = String.UTF8.decode(wasmx.getCallData());
  // console.log("* eventual: " + calldStr);
  // const calld = JSON.parse<EventualArgs>(calldStr);
  // const intervalId = calld.intervalId;
  // console.log("* eventual: " + intervalId.toString())
  // const argsStr = String.UTF8.decode(calld.args.buffer);
  // console.log("* eventual: args: " + argsStr);
  // const _args = JSON.parse<TimerArgs>(argsStr);
  // console.log("* eventual: parsed args");
  // _eventual(intervalId, _args);
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

