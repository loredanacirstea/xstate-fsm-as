import { JSON } from "json-as/assembly";
import {
  eventual as _eventual,
  instantiate as _instantiate,
  runInternal,
  MachineExternal,
} from './machine';
import * as wasmx from './wasmx';
import * as wasmxwrap from './wasmx_wrap';
import {arrayBufferToU8Array, parseUint8ArrayToI32BigEndian} from './utils';
import {
  EventClass,
  TimerArgs,
} from './types';
import {
  getCurrentState,
  getContextValueInternal,
} from './storage';

export function wasmx_env_2(): void {}
export function wasmx_consensus_json_1(): void {}

export function instantiate(): void {}

export function main(): u8[] {
    let result: ArrayBuffer;
    const icalld = wasmxwrap.getCallDataWrap();
    const calldata = icalld.calldata;
    const config = icalld.config;
    if (calldata.run !== null) {
      const event = calldata.run!.event;
      const _event = new EventClass(event.type, event.params);
      runInternal(config, _event);
      // we may have set the return data during execution
      result = wasmx.getReturnData();
    } else if (calldata.instantiate !== null) {
      const calld = calldata.instantiate!;
      _instantiate(config, calld.initialState, calld.context);
      result = new ArrayBuffer(0)
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
  const icalld = wasmxwrap.getInterpreterCalldata();
  const configBz = icalld[0];
  const calld = icalld[1];
  const config = JSON.parse<MachineExternal>(String.UTF8.decode(configBz));
  const argsStr = String.UTF8.decode(calld);
  console.debug("* eventual: args: " + argsStr);
  const _args = JSON.parse<TimerArgs>(argsStr);
  _eventual(config, _args);
}
