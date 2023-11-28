import { JSON } from "json-as/assembly";
import { decode as decodeBase64 } from "as-base64/assembly";
import {
  eventual as _eventual,
  runInternal,
  storeContextParams,
  ServiceExternal,
} from './machine';
import * as wasmx from './wasmx';
import * as wasmxwrap from './wasmx_wrap';
import {arrayBufferToU8Array, parseUint8ArrayToI32BigEndian} from './utils';
import {
  EventClass,
  TimerArgs,
  InterpreterStatus,
} from './types';
import {
  getCurrentState,
  getContextValueInternal,
} from './storage';

export function wasmx_env_2(): void {}

export function instantiate(): void {
  const calldStr = String.UTF8.decode(wasmx.getCallData())
  const calld = JSON.parse<wasmxwrap.CallDataInstantiate>(calldStr);
  storeContextParams(calld.params);
  wasmx.storageStore(String.UTF8.encode("state"), decodeBase64(calld.initialState).buffer);
  wasmxwrap.sstore("interpreter_status", InterpreterStatus.NotStarted.toString());
  const service = new ServiceExternal(calld.config , InterpreterStatus.NotStarted).toInternal();
  // TODO start endpoint?
  service.start();
}

export function main(): u8[] {
    let result: ArrayBuffer;
    const calldata = wasmxwrap.getCallDataWrap();
    if (calldata.run !== null) {
      const event = calldata.run!.event;
      const _event = new EventClass(event.type, event.params);
      result = runInternal(calldata.run!.config, _event);
    } else if (calldata.getCurrentState !== null) {
      const state = getCurrentState();
      result = String.UTF8.encode(state.value);
    } else if (calldata.getContextValue !== null) {
      result = getContextValueInternal(calldata.getContextValue!.key);
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
  // TODO
  // _eventual(intervalId, _args);
}
