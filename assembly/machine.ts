import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';

import {
  // ContextFrom,
  // EventFrom,
  EventObject,
  InitEvent,
  InterpreterStatus,
  // MachineImplementationsFrom,
  // ServiceFrom,
  // StateFrom,
  StateMachine,
  Typestate,
  HandledActions,
  UnsubscribeReturnValue,
  ContextGeneral,
  ContextGeneralString,
  ActionObject,
  State,
  Config,
  ConfigExternal,
  States,
  StateInfo,
  StateInfoClass,
  StateInfoEvents,
  Transition,
  EventClass,
  ActionParam,
  ContextParam,
  StateClass,
  StateClassExternal,
  StateInfoClassExternal,
  TransitionExternal,
  EventClassExternal,
  RaiseActionType,
  TimerArgs,
  CallRequest,
  // ActionMap,
} from './types';
import { hexToUint8Array, revert } from "./utils";
import * as actionsCounter from "./actions_counter";
import * as actionsErc20 from "./actions_erc20";
import * as actionsRaft from "./actions_raft";

export {
  StateMachine,
  EventObject,
  InterpreterStatus,
  Typestate,
  // MachineImplementationsFrom,
  // StateFrom,
  // ServiceFrom,
  // EventFrom,
  // ContextFrom,
};

const INIT_EVENT = new InitEvent();
const ASSIGN_ACTION: StateMachine.AssignAction = 'xstate.assign';
const WILDCARD = '*';

export function storeContextParams(params: Array<ContextParam>): void {
  for (let i = 0; i < params.length; i++) {
    storeBase64(params[i].key, params[i].value);
  }
}

export function storeBase64(key: string, value: string): void {
  const keybuf = decodeBase64(key);
  const valuebuf = decodeBase64(value);
  wasmx.storageStore(keybuf, valuebuf);
}

function createUnchangedState(value: string, context: ContextGeneralString): StateMachine.State {
  return new State(value, context, [], false);
  // matches: createMatcher(value)
}

function handleActions(
  actions: Array<StateMachine.ActionObject>,
  context: ContextGeneralString,
  eventObject: EventObject
): HandledActions {
  // console.log("--handleActions--ctx-" + context.keys().join(","))
  let nextContext = context;
  let assigned = false;
  const nonAssignActions: StateMachine.ActionObject[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    console.log("* execute action: " + action.type);
    if (action.type === ASSIGN_ACTION) {
      assigned = true;
      let tmpContext: ContextGeneralString = mergeMap<string>(nextContext, new Map());
      // console.log("--handleActions--tmpContext-" + tmpContext.keys().join(","))

      // const aassign = action.assignment;

      // // TODO
      // if (action.assignmentFn) {
      //   // tmpContext = action.assignmentFn(nextContext, eventObject);
      // } else if (aassign) {
      //   const keys = aassign.keys();
      //   for (let i = 0; i < keys.length; i++) {
      //     const key = keys[i];
      //     const value = aassign.get(key);
      //     tmpContext.set(key, value);
      //   }
      //   // aassign.keys().forEach((key: string) => {
      //     // const value = typeof assign.get(key) === 'function'
      //     //     ? assign.get(key)(nextContext, eventObject)
      //     //     : assign.get(key);
      //   //   const value = aassign.get(key);
      //   //   tmpContext.set(key, value);
      //   // });
      // }

      nextContext = tmpContext;
      // return false;
      continue;
    }
    // return true;
    nonAssignActions.push(action);
  }
  // console.log("--handleActions--nextContext-" + nextContext.keys().join(","))

  // return {actions: nonAssignActions, ctx: nextContext, assigned};
  return new HandledActions(nonAssignActions, nextContext, assigned);
}

function executeGuard(
    id: i32,
    ctx: ContextGeneralString,
    guard: string,
    event: EventObject,
): boolean {
    if (guard === "isAdmin") return isAdmin(id, ctx, []);
    if (guard === "hasEnoughBalance") return actionsErc20.hasEnoughBalance(id, ctx, [], event);
    if (guard === "hasEnoughAllowance") return actionsErc20.hasEnoughAllowance(id, ctx, [], event);

    return true;
}

function toStateFromString(state: string, ctx: ContextGeneralString): StateMachine.State {
  return { value: state, context: ctx };
}

function _createMachine(
    id: i32,
  fsmConfig: Config,
): Machine {
  // const entries = fsmConfig.states.get(fsmConfig.initial).entry;
  const iniactions:  StateMachine.ActionObject[] = [];
  // for (let i = 0; i < entries.length; i++) {
  //   const action = entries[i];
  //   const actionfn = action.actionFn;
  //   if (actionfn !== null) {
  //     iniactions.push(
  //       toActionObject(actionfn, implementations.actions)
  //     );
  //   }
  // }
  const res = handleActions(
    // iniactions.map((action: StateMachine.Action) => {
    //   // return toActionObject(action, implementations.actions)
    //   return toActionObject(action.actionFn, implementations.actions)
    // }
    // ),
    iniactions,
    fsmConfig.context,
    INIT_EVENT as EventObject
  );
  const initialActions = res.actions;
  const initialContext = res.ctx;

  // const initialState: StateMachine.State = {
  //   value: fsmConfig.initial,
  //   actions: initialActions,
  //   context: initialContext,
  //   matches: createMatcher(fsmConfig.initial),
  //   changed: false,
  // }
  const initialState = new State(fsmConfig.initial, initialContext, initialActions, false);

  const machine = new Machine(id, fsmConfig, initialState)


  // = {
  //   config: fsmConfig,
  //   options: implementations,
  //   initialState: {
  //     value: fsmConfig.initial,
  //     actions: initialActions,
  //     context: initialContext,
  //     matches: createMatcher(fsmConfig.initial)
  //   },
  // };
  return machine;
}

function executeStateActions(
    service: Service,
    id: i32,
    state: StateMachine.State,
    event: EventObject
): void {
  console.log("* executeStateActions: ")
  for (let i = 0; i < state.actions.length; i++) {
    const action = state.actions[i];
    executeStateAction(service, id, state, event, action);
  }
  console.log("* executeStateActions after actions " + state.value)

  // timed actions from the new target state
  const newstateconfig = findStateInfo(service.machine.config.states, state.value);
  if (!newstateconfig) {
    return revert("could not find state config for " + state.value);
  }
  const afterTimers = newstateconfig.after;
  // console.log("===executeStateActions afterTimers===")
  if (afterTimers == null) {
    return;
  }
  const delayKeys = afterTimers.keys();
  console.log("* setting timed actions for " + state.value);
  console.log("* setting timed actions... " + delayKeys.join(","));

  saveService(service.id, service);

  for (let i = 0; i < delayKeys.length; i++) {
    // delay is in milliseconds
    let delay = u64(0);
    const delayKey = parseInt(delayKeys[i], 10);
    if (Number.isNaN(delayKey)) {
      // This should be a context variable
      if (!state.context.has(delayKeys[i])) {
        return revert("delay key not found in context: " + delayKeys[i]);
      }
      const value = state.context.get(delayKeys[i]);
      delay = u64(parseInt(value, 10));
    } else {
      delay = u64(delayKey);
    }
    console.log("===delay===" + delay.toString())
    const args = new TimerArgs(delayKeys[i], service.id, state.value);
    const argsStr = JSON.stringify<TimerArgs>(args);
    const intervalId = wasmx.startInterval(i32(1), delay, String.UTF8.encode(argsStr));
    console.log("===intervalId==" + intervalId.toString());
  }
}

function executeStateAction(
    service: Service,
    id: i32,
    state: StateMachine.State,
    event: EventObject,
    action:  StateMachine.ActionObject,
): void {
    const actionType = action.type;
    console.log("* execute action: " + actionType);

    if (actionType === RaiseActionType) {
        const ev = action.event;
        console.log("* raise: " + ev!.type);
        if (ev === null) {
            return revert("raise action is missing event");
        }
        const _event: EventObject = new EventClass(ev.type, ev.params);
        service.send(_event);
        return;
    }
    if (actionType === "mint") {
        const newctx = actionsErc20.mint(id, state.context, action.params, event);
        state.context = newctx;
        return;
    }
    if (actionType === "move") {
        const newctx = actionsErc20.move(id, state.context, action.params, event);
        state.context = newctx;
        return;
    }
    if (actionType === "approve") {
        const newctx = actionsErc20.approve(id, state.context, action.params, event);
        state.context = newctx;
        return;
    }
    if (actionType === "sendRequest") {
      const newctx = sendRequest(id, state.context, action.params, event);
      state.context = newctx;
      return;
    }
    if (actionType === "logTransfer") {
        const newctx = actionsErc20.logTransfer(id, state.context, action.params, event);
        state.context = newctx;
        return;
    }
    if (actionType === "increment") {
      const newctx = actionsCounter.increment(state.context, action.params);
      state.context = newctx;
      return;
    }
    if (actionType === "log") {
        const newctx = log(state.context, action.params);
        state.context = newctx;
        return
    }
    if (actionType === "processAppendEntries") {
      const newctx = actionsRaft.processAppendEntries(id, state.context, action.params, event);
      state.context = newctx;
      return;
    }
    if (actionType === "sendHeartbeatResponse") {
      const newctx = actionsRaft.sendHeartbeatResponse(id, state.context, action.params, event);
      state.context = newctx;
      return;
    }
    if (actionType === "sendAppendEntries") {
      const newctx = actionsRaft.sendAppendEntries(id, state.context, action.params, event);
      state.context = newctx;
      return;
    }
    if (actionType === "sendNewTransactionResponse") {
      const newctx = actionsRaft.sendNewTransactionResponse(id, state.context, action.params, event);
      state.context = newctx;
      return;
    }
    if (actionType === "appendLog") {
      const newctx = actionsRaft.appendLog(id, state.context, action.params, event);
      state.context = newctx;
      return;
    }
    // If action is not a local action, then it is an external action
    const success = processExternalCall(service, id, state, event, action);
    if (!success) {
      return revert("action not recognized: " + actionType);
    }

    // state.context
    // action.type
    // action.params
}

function processExternalCall(
    service: Service,
    id: i32,
    state: StateMachine.State,
    event: EventObject,
    action:  StateMachine.ActionObject,
): boolean {
  const actionType = action.type;
  // expect label.function;
  const parts = actionType.split(".")
  if (parts.length < 2) {
    return false;
  }
  // contract label => contractAddress
  if (!state.context.has(parts[0])) {
    revert("contract label not found in context: " + parts[0]);
  }
  const contractAddress = state.context.get(parts[0]);
  // TODO
  const calldata = ""
  const req = new CallRequest(contractAddress, calldata, false);
  const resp = wasmxwrap.call(req);
  if (!resp.success) {
    revert("contract call failed: " + actionType);
    return resp.success;
  }
  return true;
}

function isAdmin(
  id: i32,
  ctx: ContextGeneralString,
  params: ActionParam[],
): boolean {
  const caller = wasmxwrap.getCaller();
  const owner = wasmxwrap.loadOwner(id);
 return caller === owner;
}

function log(
  ctx: ContextGeneralString,
  params: ActionParam[],
): ContextGeneralString {
  for (let i = 0; i < params.length; i++) {
    const key = params[i].key;
    const message = params[i].value;
    const value = ctx.get(key);
    console.log(`${key}: ${value} - ${message}`);
  }
  return ctx;
}

function sendRequest(
  id: i32,
  ctx: ContextGeneralString,
  params: ActionParam[],
  event: EventObject,
): ContextGeneralString {
  let address: string = "";
  let data: string = "";
  for (let i = 0; i < event.params.length; i++) {
      if (event.params[i].key === "address") {
          address = event.params[i].value;
          continue;
      }
      if (event.params[i].key === "data") {
          data = event.params[i].value;
          continue;
      }
  }
  if (address === "") {
      revert("sendRequest empty IP address");
  }
  if (data === "") {
      revert("sendRequest empty data");
  }
  wasmxwrap.grpcRequest(address, data);
  return ctx;
}

export class Service implements StateMachine.Service {
  id: i32
  machine: StateMachine.Machine
  state: StateMachine.State
  status: InterpreterStatus
  listeners: Set<StateMachine.StateListener>

  constructor(
    id: i32,
    machine: StateMachine.Machine,
    state: StateMachine.State | null,
    status: InterpreterStatus,
  ) {
    this.id = id;
    this.machine = machine;
    this.state = state || machine.initialState;
    this.status = status || InterpreterStatus.NotStarted;
    this.listeners = new Set<StateMachine.StateListener>();
  }

  send(event: EventObject): void {
    console.log("* send event: " + event.type);
    if (this.status !== InterpreterStatus.Running) {
      return;
    }
    this.state = this.machine.transition(this.state, event);
    executeStateActions(this, this.id, this.state, event);

    const listeners = this.listeners.values();
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](this.state);
    }
  }

  subscribe(listener: StateMachine.StateListener): UnsubscribeReturnValue {
    this.listeners.add(listener);
    listener(this.state);

    return {
      unsubscribe: () => this.listeners.delete(listener)
    };
  }

  start(): Service {
    this.status = InterpreterStatus.Running;
    executeStateActions(this, this.id, this.state, INIT_EVENT);
    this.send(INIT_EVENT);
    return this;
  }

  stop(): Service {
    this.status = InterpreterStatus.Stopped;
    this.listeners.clear();
    return this;
  }
}

// @ts-ignore
@serializable
export class ServiceExternal {
    id: i32
  machine: MachineExternal
  state: StateClassExternal
  status: InterpreterStatus
  // TODO listeners can be addresses that should be announced about state changes

  constructor(
    id: i32,
    machine: MachineExternal,
    state: StateClassExternal,
    status: InterpreterStatus,
  ) {
    this.id = id;
    this.machine = machine;
    this.state = state;
    this.status = status;
  }

  static fromInternal(service: Service): ServiceExternal {
    const machine = MachineExternal.fromInternal(service.machine);
    const status = service.status;
    const context: Array<ContextParam> = [];
    const ctxKeys = service.state.context.keys();
    for (let i = 0; i < ctxKeys.length; i++) {
        context.push(new ContextParam(ctxKeys[i], service.state.context.get(ctxKeys[i])));
    }
    const stateactions: Array<ActionObject> = [];
    for (let i = 0; i < service.state.actions.length; i++) {
        const act = service.state.actions[i];
        const _ev = act.event;
        let ev: EventClassExternal | null = null;
        if (_ev !== null) {
            ev = new EventClassExternal(_ev.type, _ev.params);
        }
        stateactions.push(new ActionObject(act.type, act.params, ev));
    }
    const state = new StateClassExternal(
        service.state.value,
        context,
        stateactions,
        service.state.changed,
    );
    return new ServiceExternal(service.id, machine, state, status);
  }

  toInternal(): Service {
    // console.log("--service toInternal()--");
    const machine = this.machine.toInternal();
    const context: ContextGeneralString = new Map<string, string>();
    for (let i = 0; i < this.state.context.length; i++) {
        const param = this.state.context[i];
        context.set(param.key, param.value);
    }
    const stateactions: Array<StateMachine.ActionObject> = [];
    for (let i = 0; i < this.state.actions.length; i++) {
        const act = this.state.actions[i];
        stateactions.push(new ActionObject(act.type, act.params, act.event));
    }
    const state = new StateClass(
        this.state.value,
        context,
        stateactions,
        this.state.changed,
    )
    const status = this.status;
    // console.log("--service toInternal()-END-");
    return new Service(this.id, machine, state, status);
  }
}

// @ts-ignore
@serializable
export class MachineExternal {
    id: i32;
  config: ConfigExternal;
  initialState: StateClassExternal;
//   options: Implementations // TODO remove

  constructor(
    id: i32,
    config: ConfigExternal,
    initialState: StateClassExternal,
  ) {
    this.id = id;
    this.config = config;
    this.initialState = initialState;
  }

  static fromInternal(machine: StateMachine.Machine): MachineExternal {
    const ctx: Array<ContextParam> = [];
    const octx = machine.config.context;
    const octxKeys = octx.keys();
    for (let i = 0; i < octxKeys.length; i++) {
        ctx.push(new ContextParam(octxKeys[i], octx.get(octxKeys[i])));
    }
    const states = StateInfoClassExternal.fromInternalStatesMap(machine.config.states);

    const config = new ConfigExternal(
        machine.config.id,
        machine.config.initial,
        ctx,
        states,
    );
    const context: Array<ContextParam> = [];
    const ctxKeys = machine.initialState.context.keys();
    for (let i = 0; i < ctxKeys.length; i++) {
        context.push(new ContextParam(ctxKeys[i], machine.initialState.context.get(ctxKeys[i])));
    }
    const iniactions: Array<ActionObject> = [];
    for (let i = 0; i < machine.initialState.actions.length; i++) {
        const act = machine.initialState.actions[i];
        const _ev = act.event;
        let ev: EventClassExternal | null = null;
        if (_ev !== null) {
            ev = new EventClassExternal(_ev.type, _ev.params);
        }
        iniactions.push(new ActionObject(act.type, act.params, ev));
    }

    const initialState = new StateClassExternal(
        machine.initialState.value,
        context,
        iniactions,
        machine.initialState.changed,
    );

    // machine.initialState;
    return new MachineExternal(machine.id, config, initialState);
  }

  toInternal(): Machine {
    // console.log("-Machine toInternal--")
    const context: ContextGeneralString = new Map<string,string>();
    const ctxpairs = this.config.context;
    for (let i = 0; i < ctxpairs.length; i++) {
        context.set(ctxpairs[i].key, ctxpairs[i].value);
    }
    const states = StateInfoClassExternal.toInternalFromArray(this.config.states);
    const config = new Config(
        this.config.id,
        this.config.initial,
        context,
        states,
    )
    const inictx: ContextGeneralString = new Map<string,string>();
    const _inictx = this.initialState.context;
    for (let i = 0; i < _inictx.length; i++) {
        inictx.set(_inictx[i].key, _inictx[i].value);
    }
    const iniactions: Array<StateMachine.ActionObject> = [];
    for (let i = 0; i < this.initialState.actions.length; i++) {
        const act = this.initialState.actions[i];
        iniactions.push(new ActionObject(act.type, act.params, act.event));
    }
    const initialState = new StateClass(
        this.initialState.value,
        inictx,
        iniactions,
        this.initialState.changed,
    );
    // console.log("-Machine toInternal-END-")
    return new Machine(this.id, config, initialState);
  }
}

// Define a Map for services
class ServiceMap {
  counter: i32 = 0;
  private _keys: i32[] = [];
  private _values: Service[] = [];

  set(value: Service): i32 {
    const key = this.counter;
    this.counter += 1;
    const index = this._keys.indexOf(key);
    if (index > -1) {
      this._values[index] = value;
    } else {
      this._keys.push(key);
      this._values.push(value);
    }
    return key;
  }

  get(key: i32): Service | null {
    const index = this._keys.indexOf(key);
    if (index > -1) {
      return this._values[index];
    }
    return null;
  }
}

export class Machine implements StateMachine.Machine {
    id: i32;
  config: StateMachine.Config;
  initialState: StateMachine.State;

  constructor(
    id: i32,
    config: StateMachine.Config,
    initialState: StateMachine.State,
  ) {
    this.id = id;
    this.config = config;
    this.initialState = initialState;
  }

  transition(
    state: StateMachine.State,
    event: EventObject
  ): StateMachine.State {
    const value = state.value;
    const context = state.context;
    const eventObject = event;
    // console.log("----transition-config.states-" + this.config.states.keys().join(","));
    // const stateConfig = this.config.states.get(value);
    const stateConfig = findStateInfo(this.config.states, value);
    // console.log("--findStateInfo--END=stateConfig-")
    if (!stateConfig) {
        const message = "state not found: " + value;
        wasmx.revert(String.UTF8.encode(message));
        throw new Error(message);
    }
    // console.log("----transition-stateConfig-" + stateConfig.on.keys().join(","));
    // console.log("-transition-event--" + eventObject.type);

    if (stateConfig.on) {
      if (!stateConfig.on.has(eventObject.type)) {
        const message = `cannot apply "${eventObject.type}" event in current "${value}" state`;
        wasmx.revert(String.UTF8.encode(message));
        throw new Error(message);
      }
      const transition = stateConfig.on.get(eventObject.type);
      console.log("* transition next target: " + transition.target)

      const transitions: Array<StateMachine.Transition> = [transition];

      if (stateConfig.on.has(WILDCARD)) {
        const _trans = stateConfig.on.get(WILDCARD);
        transitions.push(_trans);
        // for (let i = 0; i < _trans.length; i++) {
        //   transitions.push(_trans[i]);
        // }
      }

      for (let i = 0; i < transitions.length; i++) {
        const transition = transitions[i];
        if (transition === null) {
          return createUnchangedState(value, context);
        }
        const target = transition.target;
        const actions = transition.actions || [];
        const guard = transition.guard;
        const cond = transition.cond || (() => true);

        const isTargetless = target === null;

        const nextStateValue = target || value;
        // console.log("----transition-nextStateValue--" + nextStateValue)
        // const nextStateConfig = this.config.states.get(nextStateValue);

        const nextStateConfig = findStateInfo(this.config.states, nextStateValue);
        // console.log("--findStateInfo--END=nextStateConfig-")
        if (!nextStateConfig) {
            const message = "state not found: " + nextStateValue;
            wasmx.revert(String.UTF8.encode(message));
            throw new Error(message);
        }

        // console.log("----transition-nextStateConfig--" + nextStateConfig.on.keys().join(","))

        if (guard && !executeGuard(this.id, context, guard, event)) {
            const message = "cannot execute transition; guard: " + guard;
            wasmx.revert(String.UTF8.encode(message));
            throw new Error(message);
        }

        // console.log("----transition-cond--" + cond.toString())
        if (cond(context, eventObject)) {
          // const allActions: StateMachine.Action[] = (
          //   isTargetless
          //     ? actions
          //     : stateConfig.exit
          //         .concat(actions)
          //         .concat(nextStateConfig.entry)
          //         // .filter((a) => a)
          // )
          let allActions: StateMachine.ActionObject[] = [];
          if (!isTargetless) {
            // for (let i = 0; i < stateConfig.exit.length; i++) {
            //   allActions.push(stateConfig.exit[i]);
            // }
            for (let i = 0; i < actions.length; i++) {
                const act = actions[i];
                if (act.type === RaiseActionType) {
                    // We are looking through parameters of the current event
                    // and adding them in the raised event if the key values match
                    // TODO - another way?
                    // console.log("--raise?0-" + act.type);
                    if (act.event === null) {
                        const message = "raise action is missing event";
                        wasmx.revert(String.UTF8.encode(message));
                        throw new Error(message);
                    }
                    // console.log("--raise?1-" + act.event!.type);
                    // console.log("--raise?11-" + act.event!.params.length.toString());
                    for (let k = 0; k < act.event!.params.length; k++) {
                        const key = act.event!.params[k].key;
                        const value = act.event!.params[k].value;
                        // console.log("--raise?2-param-" + key + "--" + value);
                        let found = false;
                        if (value.includes("()")) {
                            // TODO have a map with all provided functions and guards
                            if (value === "getCaller()") {
                                act.event!.params[k].value = wasmxwrap.getCaller();
                                found = true;
                            }
                        } else {
                            for (let x = 0; x < event.params.length; x++) {
                                if (event.params[x].key === value) {
                                    act.event!.params[k].value = event.params[x].value;
                                    found = true;
                                }
                            }
                            if (!found && context.has(value)) {
                              // look in context
                              act.event!.params[k].value = context.get(value);
                            }
                        }
                    }
                }
                // console.log("--raise add action!-" + act.type);
                allActions.push(act);
            }
            // for (let i = 0; i < stateConfig.exit.length; i++) {
            //   allActions.push(nextStateConfig.entry[i]);
            // }
            // allActions = allActions.concat(stateConfig.exit);
            // allActions = allActions.concat(nextStateConfig.entry);
          }

          // const allActionObjects: StateMachine.ActionObject[] = [];

          // for (let i = 0; i < allActions.length; i++) {
          //   const action = allActions[i];
          //   const actionFn = action.actionFn;
          //   if (actionFn) {
          //     const obj = toActionObject(actionFn, this.options.actions);
          //     allActionObjects.push(obj);
          //   }
          //   const obj = toActionObjectFromString(action.value, this.options.actions);
          //   allActionObjects.push(obj);
          // }

          const res = handleActions(
            // allActionObjects,
            allActions,
            context,
            eventObject
          );
          const nonAssignActions = res.actions;
          const nextContext = res.ctx;
          const assigned = res.assigned;

          let resolvedTarget = target || value;
          // console.log("--transition--resolvedTarget-" + resolvedTarget)

          // child states! we choose the first one
          const stateConfig = findStateInfo(this.config.states, resolvedTarget);
          // console.log("--findStateInfo--END=");
          if (!stateConfig) {
            const message = "state not found: " + resolvedTarget;
            wasmx.revert(String.UTF8.encode(message));
            throw new Error(message);
          }
          // console.log("--findStateInfo--END1=");
          if (stateConfig.states !== null && stateConfig.states.keys().length > 0) {
            resolvedTarget = stateConfig.states.keys()[0];
          }
          // console.log("--findStateInfo--END2=");

          console.log("* transition next target: " + resolvedTarget);

          return new State(resolvedTarget, nextContext, nonAssignActions, target !== value || nonAssignActions.length > 0 || assigned);
          // matches: createMatcher(resolvedTarget)
        }
      }
    }

    // No transitions match
    return createUnchangedState(value, context);
  }

  applyTransition(
    state: StateMachine.State,
    transition: StateMachine.Transition
  ): StateMachine.State {
    console.log("* applyTransition: " + transition.target);
    const value = state.value;
    const context = state.context;
    const stateConfig = findStateInfo(this.config.states, value);
    if (!stateConfig) {
        const message = "state not found: " + value;
        wasmx.revert(String.UTF8.encode(message));
        throw new Error(message);
    }

    const transitions: Array<StateMachine.Transition> = [transition];

    if (stateConfig.on.has(WILDCARD)) {
      const _trans = stateConfig.on.get(WILDCARD);
      transitions.push(_trans);
      // for (let i = 0; i < _trans.length; i++) {
      //   transitions.push(_trans[i]);
      // }
    }

    for (let i = 0; i < transitions.length; i++) {
      const transition = transitions[i];
      if (transition === null) {
        return createUnchangedState(value, context);
      }
      const target = transition.target;
      const actions = transition.actions || [];
      const guard = transition.guard;
      const cond = transition.cond || (() => true);

      const isTargetless = target === null;

      const nextStateValue = target || value;
      // console.log("----transition-nextStateValue--" + nextStateValue)
      // const nextStateConfig = this.config.states.get(nextStateValue);

      const nextStateConfig = findStateInfo(this.config.states, nextStateValue);
      // console.log("--findStateInfo--END=nextStateConfig-")
      if (!nextStateConfig) {
          const message = "state not found: " + nextStateValue;
          wasmx.revert(String.UTF8.encode(message));
          throw new Error(message);
      }

      // console.log("----transition-nextStateConfig--" + nextStateConfig.on.keys().join(","))

      // if (guard && !executeGuard(this.id, context, guard, event)) {
      //     wasmx.revert(String.UTF8.encode("cannot execute transition; guard: " + guard));
      //     throw new Error("cannot execute transition; guard: " + guard);
      // }

      // console.log("----transition-cond--" + cond.toString())
      if (true) {
        // const allActions: StateMachine.Action[] = (
        //   isTargetless
        //     ? actions
        //     : stateConfig.exit
        //         .concat(actions)
        //         .concat(nextStateConfig.entry)
        //         // .filter((a) => a)
        // )
        let allActions: StateMachine.ActionObject[] = [];
        if (!isTargetless) {
          // for (let i = 0; i < stateConfig.exit.length; i++) {
          //   allActions.push(stateConfig.exit[i]);
          // }
          for (let i = 0; i < actions.length; i++) {
              const act = actions[i];
              if (act.type === RaiseActionType) {
                  // We are looking through parameters of the current event
                  // and adding them in the raised event if the key values match
                  // TODO - another way?
                  // console.log("--raise?0-" + act.type);
                  if (act.event === null) {
                      const message = "raise action is missing event";
                      wasmx.revert(String.UTF8.encode(message));
                      throw new Error(message);
                  }
                  // console.log("--raise?1-" + act.event!.type);
                  // console.log("--raise?11-" + act.event!.params.length.toString());
                  for (let k = 0; k < act.event!.params.length; k++) {
                      const key = act.event!.params[k].key;
                      const value = act.event!.params[k].value;
                      // console.log("--raise?2-param-" + key + "--" + value);
                      let found = false;
                      if (value.includes("()")) {
                          // TODO have a map with all provided functions and guards
                          if (value === "getCaller()") {
                              act.event!.params[k].value = wasmxwrap.getCaller();
                              found = true;
                          }
                      } else {
                          // for (let x = 0; x < event.params.length; x++) {
                          //     if (event.params[x].key === value) {
                          //         act.event!.params[k].value = event.params[x].value;
                          //         found = true;
                          //     }
                          // }
                          if (!found && context.has(value)) {
                            // look in context
                            act.event!.params[k].value = context.get(value);
                          }
                      }
                  }
              }
              // console.log("--raise add action!-" + act.type);
              allActions.push(act);
          }
          // for (let i = 0; i < stateConfig.exit.length; i++) {
          //   allActions.push(nextStateConfig.entry[i]);
          // }
          // allActions = allActions.concat(stateConfig.exit);
          // allActions = allActions.concat(nextStateConfig.entry);
        }

        // const allActionObjects: StateMachine.ActionObject[] = [];

        // for (let i = 0; i < allActions.length; i++) {
        //   const action = allActions[i];
        //   const actionFn = action.actionFn;
        //   if (actionFn) {
        //     const obj = toActionObject(actionFn, this.options.actions);
        //     allActionObjects.push(obj);
        //   }
        //   const obj = toActionObjectFromString(action.value, this.options.actions);
        //   allActionObjects.push(obj);
        // }

        const eventObject: EventObject = new EventClass("", []);
        const res = handleActions(
          // allActionObjects,
          allActions,
          context,
          eventObject,
        );
        const nonAssignActions = res.actions;
        const nextContext = res.ctx;
        const assigned = res.assigned;

        let resolvedTarget = target || value;
        // console.log("--transition--resolvedTarget-" + resolvedTarget)

        // child states! we choose the first one
        const stateConfig = findStateInfo(this.config.states, resolvedTarget);
        // console.log("--findStateInfo--END=");
        if (!stateConfig) {
          const message = "state not found: " + resolvedTarget;
          wasmx.revert(String.UTF8.encode(message));
          throw new Error(message);
        }
        // console.log("--findStateInfo--END1=");
        if (stateConfig.states !== null && stateConfig.states.keys().length > 0) {
          resolvedTarget = stateConfig.states.keys()[0];
        }
        // console.log("--findStateInfo--END2=");

        console.log("* transition next target: " + resolvedTarget);

        return new State(resolvedTarget, nextContext, nonAssignActions, target !== value || nonAssignActions.length > 0 || assigned);
        // matches: createMatcher(resolvedTarget)
      }
    }

    // No transitions match
    return createUnchangedState(value, context);
  }
}

const map = new ServiceMap();

export function create(
  _fsmConfig: ArrayBuffer,
  _implementations: ArrayBuffer,
): ArrayBuffer {
  const fsmConfigStr = String.UTF8.decode(_fsmConfig);
  console.log("===create===" + fsmConfigStr);

  const fsmConfigExternal = JSON.parse<ConfigExternal>(fsmConfigStr);

  // let implementations = new Implementations<ContextGeneral<string>, EventObject>();
  // if (_implementations.byteLength > 0) {
  //   const implementationsStr = String.UTF8.decode(_implementations);
  //   console.log(implementationsStr);
  //   implementations = JSON.parse<Implementations<ContextGeneral<string>, EventObject>>(implementationsStr);
  // }

  return createInternal(fsmConfigExternal)
}

export function createInternal(
    fsmConfigExternal: ConfigExternal,
): ArrayBuffer {
  const ctx = new Map<string, string>();
  const states = StateInfoClassExternal.toInternalFromArray(fsmConfigExternal.states);

  // console.log("----config3-" + fsmConfigExternal.context.length.toString());

  for (let i = 0; i < fsmConfigExternal.context.length; i++) {
    const param = fsmConfigExternal.context[i];
    ctx.set(param.key, param.value);
  }

  const fsmConfig = new Config(
    fsmConfigExternal.id,
    fsmConfigExternal.initial,
    ctx,
    states,
  )

  // const fsmConfig = JSON.parse<StateMachine.Config>(fsmConfigStr);

  // let implementations: Implementations<ContextGeneral<string>, EventObject> = {actions: new ActionMap()};
  // let implementations: Implementations<ContextGeneral<string>, EventObject> = {actions: new Map<string, string>()};

  const expectedId = wasmxwrap.loadCounter();
  const machine = _createMachine(expectedId, fsmConfig);

  // console.log("--_createMachine--end--")

  const service = new Service(expectedId, machine, null , InterpreterStatus.NotStarted);

    // console.log("--service.start--start--")

    service.start();
    // console.log("--service.start--end--")

    const serviceJson = ServiceExternal.fromInternal(service);
    // console.log("--service external--");
    const data = JSON.stringify<ServiceExternal>(serviceJson);

    // console.log("--_createMachine--data-- " + data);

  // store service context
    const id = wasmxwrap.createService(data);
    if (id !== expectedId) {
        revert("id does not match expected");
    }
    // store owner
    // console.log("--store owner-- ");
    wasmxwrap.storeOwner(id, wasmxwrap.getCaller());
    // console.log("--_createMachine--id-- " + id.toString());
  return String.UTF8.encode(`{"id":${id}}`);
}

export function getCurrentState(id: i32): ArrayBuffer {
  const service = loadServiceFromId(id);
  // console.log("-getCurrentState-service-loaded-")
  if (!service) {
    revert("no service");
  }
  return String.UTF8.encode(service.state.value);
}

export function getContextValue(id: i32, keyBuf: ArrayBuffer): ArrayBuffer {
  const key = String.UTF8.decode(keyBuf);
  return getContextValueInternal(id, key);
}

export function getContextValueInternal(id: i32, key: string): ArrayBuffer {
    const service = loadServiceFromId(id);
    if (!service) {
        revert("no service");
    }
    const ctx = service.state.context;
    if (!ctx) {
        revert("no ctx");
    }
    // console.log("--getContext--" + ctx.keys().join(","));
    if (ctx.has(key)) {
        return String.UTF8.encode(ctx.get(key));
    }
    return new ArrayBuffer(0);
}

export function run(
  id: i32,
  eventBuf: ArrayBuffer,
): void {
  const event = JSON.parse<EventClassExternal>(String.UTF8.decode(eventBuf));
  const _event = new EventClass(event.type, event.params);
  runInternal(id, _event);
}

export function runInternal(id: i32, event: EventClass): ArrayBuffer {
    // console.log("--runInternal--" + id.toString() + "--" + event.type);
    const service = loadServiceFromId(id);
    if (!service) {
        revert("no service");
    }
    // console.log("--run--transition--" + event.type);
    service.send(event);
    // save service in storage again;
    saveService(id, service);
    return new ArrayBuffer(0);
}

function mergeMap<T>(original: Map<string,T>, additional: Map<string,T>): Map<string,T> {
  const result = new Map<string,T>();
  // Iterate over the keys of the original map
  const originalKeys = original.keys();
  for (let i = 0; i < originalKeys.length; i++) {
    let key = unchecked(originalKeys[i]);
    let value = original.get(key);
    result.set(key, value);
  }

  // Iterate over the keys of the additional map
  const additionalKeys = additional.keys();
  for (let i = 0; i < additionalKeys.length; i++) {
    let key = unchecked(additionalKeys[i]);
    let value = additional.get(key);
    result.set(key, value);
  }
  return result;
}

export function saveService(id: i32, service: Service): void {
    const serviceJson = ServiceExternal.fromInternal(service);
    const data = JSON.stringify<ServiceExternal>(serviceJson);
    wasmxwrap.storeService(id, data);
}

export function loadServiceFromId(id: i32): Service {
    const serviceData = wasmxwrap.loadService(id);
    const service = JSON.parse<ServiceExternal>(serviceData);
    return service.toInternal();
}

// TODO: nested state names as paths unlocked.active.
export function findStateInfo(
    states: States,
    stateName: string,
): StateInfo | null {
    if (stateName.at(0) === "#") {
        // "#ERC20.unlocked.active"
        // TODO support multiple machines
        const statePath = stateName.substring(1).split(".").slice(1)
        return findStateInfoByPath(states, statePath)
    }
    // TODO here, we should only look in the current state, not the machine states
    const keys = states.keys();
    // console.log("--findStateInfo--" + stateName + "---" + keys.join(","));
    for (let i = 0; i < keys.length; i++) {
        // console.log("--findStateInfo--" + keys[i]);
        const stateinfo = states.get(keys[i]);
        if (keys[i] === stateName) return stateinfo;
        if (stateinfo.states && stateinfo.states.keys().length > 0) {
            const info = findStateInfo(stateinfo.states, stateName);
            if (info !== null) return info;
        }
    }
    return null;
}

export function findStateInfoByPath(
    states: States,
    statePath: string[],
): StateInfo | null {
    let currentStates = states;
    let state: StateInfo | null = null;
    // console.log("--findStateInfoByPath--" + statePath.join("."));
    for (let k = 0; k < statePath.length; k++) {
        const currentStateName = statePath[k];
        state = currentStates.get(currentStateName);
        if (k < (statePath.length - 1)) {
            if (!state.states || state.states.keys().length === 0) {
                revert("findStateInfoByPath: state does not have childstates: " + statePath.join("."));
            }
            currentStates = state.states;
        }
    }
    return state;
}

export function eventual(intervalId: i32, args: TimerArgs): void {
  console.log("* eventual: " + args.serviceId.toString() + "--" + args.delay);
  const service = loadServiceFromId(args.serviceId);
  if (!service) {
    revert("no service");
  }
  console.log("* eventual - finding state: " + service.state.value);

  if (service.state.value !== args.state) {
    // we are in the wrong state, so the interval must be stopped
    // wasmx.stopInterval(intervalId);
    return;
  }

  const newstateconfig = findStateInfo(service.machine.config.states, service.state.value);
  if (!newstateconfig) {
    return revert("could not find state config for " + service.state.value);
  }
  console.log("* eventual - finding after");
  const afterTimers = newstateconfig.after;
  if (afterTimers == null || !afterTimers.has(args.delay)) {
    // we are in the wrong state, so the interval must be stopped
    wasmx.stopInterval(intervalId);
    return;
  }
  console.log("* execute delayed action... " + args.delay)
  // delay is in milliseconds
  const transition = afterTimers.get(args.delay);
  if (!transition) {
    revert("delayed transition not found: " + args.delay);
  }
  // just a copied transition
  service.state = service.machine.applyTransition(service.state, transition);
  executeStateActions(service, service.id, service.state, new EventClass("", []));
  // TODO listeners?

  saveService(args.serviceId, service);
}
