import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';

import {
  EventObject,
  InitEvent,
  InterpreterStatus,
  StateMachine,
  Typestate,
  HandledActions,
  UnsubscribeReturnValue,
  ActionObject,
  State,
  States,
  StateInfo,
  EventClass,
  ActionParam,
  ContextParam,
  StateClass,
  StateClassExternal,
  StateInfoClassExternal,
  EventClassExternal,
  RaiseActionType,
  TimerArgs,
  CallRequest,
  StatusMap,
} from './types';
import { hexToUint8Array, revert } from "./utils";
import * as storage from './storage';
import * as actionsCounter from "./actions_counter";
import * as actionsErc20 from "./actions_erc20";
import * as actionsRaft from "./actions_raft";

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
  wasmx.storageStore(keybuf.buffer, valuebuf.buffer);
}

function createUnchangedState(value: string): StateMachine.State {
  return new State(value, [], false);
  // matches: createMatcher(value)
}

function handleActions(
  actions: Array<StateMachine.ActionObject>,
  eventObject: EventObject
): HandledActions {
  let assigned = false;
  const nonAssignActions: StateMachine.ActionObject[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    console.log("* execute action: " + action.type);
    if (action.type === ASSIGN_ACTION) {
      assigned = true;

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

      // return false;
      continue;
    }
    // return true;
    nonAssignActions.push(action);
  }
  // console.log("--handleActions--nextContext-" + nextContext.keys().join(","))

  // return {actions: nonAssignActions, ctx: nextContext, assigned};
  return new HandledActions(nonAssignActions, assigned);
}

function executeGuard(
    guard: string,
    event: EventObject,
): boolean {
    if (guard === "isAdmin") return isAdmin([]);
    if (guard === "hasEnoughBalance") return actionsErc20.hasEnoughBalance([], event);
    if (guard === "hasEnoughAllowance") return actionsErc20.hasEnoughAllowance([], event);

    // TODO processExternalCall

    return true;
}

function executeStateActions(
    service: Service,
    state: StateMachine.State,
    event: EventObject
): void {
  console.log("* executeStateActions: ")
  for (let i = 0; i < state.actions.length; i++) {
    const action = state.actions[i];
    executeStateAction(service, state, event, action);
  }
  console.log("* executeStateActions after actions " + state.value)

  // timed actions from the new target state
  const newstateconfig = findStateInfo(service.machine.states, state.value);
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

  for (let i = 0; i < delayKeys.length; i++) {
    // delay is in milliseconds
    let delay = u64(0);
    const delayKey = parseInt(delayKeys[i], 10);
    if (Number.isNaN(delayKey)) {
      // This should be a context variable
      const value = storage.getContextValue(delayKeys[i]);
      if (!value) {
        return revert("delay key not found in context: " + delayKeys[i]);
      }
      delay = u64(parseInt(value, 10));
    } else {
      delay = u64(delayKey);
    }
    console.log("===delay===" + delay.toString())
    const args = new TimerArgs(delayKeys[i], state.value);
    const argsStr = JSON.stringify<TimerArgs>(args);
    const intervalId = wasmx.startInterval(i32(1), delay, String.UTF8.encode(argsStr));
    console.log("===intervalId==" + intervalId.toString());
  }
}

function executeStateAction(
    service: Service,
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
        const newctx = actionsErc20.mint(action.params, event);
        return;
    }
    if (actionType === "move") {
        const newctx = actionsErc20.move(action.params, event);
        return;
    }
    if (actionType === "approve") {
        const newctx = actionsErc20.approve(action.params, event);
        return;
    }
    if (actionType === "sendRequest") {
      const newctx = sendRequest(action.params, event);
      return;
    }
    if (actionType === "logTransfer") {
        const newctx = actionsErc20.logTransfer(action.params, event);
        return;
    }
    if (actionType === "increment") {
      const newctx = actionsCounter.increment(action.params);
      return;
    }
    if (actionType === "log") {
        const newctx = log(action.params);
        return
    }
    if (actionType === "processAppendEntries") {
      const newctx = actionsRaft.processAppendEntries(action.params, event);
      return;
    }
    if (actionType === "sendHeartbeatResponse") {
      const newctx = actionsRaft.sendHeartbeatResponse(action.params, event);
      return;
    }
    if (actionType === "sendAppendEntries") {
      const newctx = actionsRaft.sendAppendEntries(action.params, event);
      return;
    }
    if (actionType === "sendNewTransactionResponse") {
      const newctx = actionsRaft.sendNewTransactionResponse(action.params, event);
      return;
    }
    if (actionType === "appendLog") {
      const newctx = actionsRaft.appendLog(action.params, event);
      return;
    }
    // If action is not a local action, then it is an external action
    const success = processExternalCall(service, state, event, action);
    if (!success) {
      return revert("action not recognized: " + actionType);
    }

    // state.context
    // action.type
    // action.params
}

function processExternalCall(
    service: Service,
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
  const contractAddress = storage.getContextValue(parts[0]);
  if (contractAddress === "") {
    revert("contract label not found in context: " + parts[0]);
  }

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
  params: ActionParam[],
): boolean {
  const caller = wasmxwrap.getCaller();
  const owner = storage.loadOwner();
 return caller === owner;
}

function log(
  params: ActionParam[],
): void {
  for (let i = 0; i < params.length; i++) {
    const key = params[i].key;
    const message = params[i].value;
    const value = storage.getContextValue(key);
    console.log(`${key}: ${value} - ${message}`);
  }
}

function sendRequest(
  params: ActionParam[],
  event: EventObject,
): void {
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
}

export class Service implements StateMachine.Service {
  machine: StateMachine.Machine
  status: InterpreterStatus
  listeners: Set<StateMachine.StateListener>

  constructor(
    machine: StateMachine.Machine,
    status: InterpreterStatus,
  ) {
    this.machine = machine;
    this.status = status || InterpreterStatus.NotStarted;
    this.listeners = new Set<StateMachine.StateListener>();
  }

  send(event: EventObject): void {
    console.log("* send event: " + event.type);
    if (this.status !== InterpreterStatus.Running) {
      return;
    }
    let state = storage.getCurrentState();
    state = this.machine.transition(state, event);
    executeStateActions(this, state, event);
    storage.setCurrentState(state);

    const listeners = this.listeners.values();
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](state);
    }
  }

  subscribe(listener: StateMachine.StateListener): UnsubscribeReturnValue {
    this.listeners.add(listener);
    let state = storage.getCurrentState();
    listener(state);

    return {
      unsubscribe: () => this.listeners.delete(listener)
    };
  }

  start(): Service {
    storage.setCurrentStatus(InterpreterStatus.Running)
    let state = storage.getCurrentState();
    executeStateActions(this, state, INIT_EVENT);
    this.send(INIT_EVENT);
    return this;
  }

  stop(): Service {
    storage.setCurrentStatus(InterpreterStatus.Stopped)
    this.listeners.clear();
    return this;
  }
}

// @ts-ignore
@serializable
export class ServiceExternal {
  machine: MachineExternal
  status: InterpreterStatus
  // TODO listeners can be addresses that should be announced about state changes

  constructor(
    machine: MachineExternal,
    status: InterpreterStatus,
  ) {
    this.machine = machine;
    this.status = status;
  }

  static fromInternal(service: Service): ServiceExternal {
    const machine = MachineExternal.fromInternal(service.machine);
    const status = service.status;
    return new ServiceExternal(machine, status);
  }

  toInternal(): Service {
    const machine = this.machine.toInternal();
    const status = this.status;
    return new Service(machine, status);
  }
}

export class Machine implements StateMachine.Machine {
  id: string;
  states: States;

  constructor(
    id: string,
    states: States,
  ) {
    this.id = id;
    this.states = states;
  }

  transition(
    state: StateMachine.State,
    event: EventObject
  ): StateMachine.State {
    const value = state.value;
    const eventObject = event;
    // console.log("----transition-config.states-" + this.config.states.keys().join(","));
    // const stateConfig = this.config.states.get(value);
    const stateConfig = findStateInfo(this.states, value);
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
          return createUnchangedState(value);
        }
        const target = transition.target;
        const actions = transition.actions || [];
        const guard = transition.guard;
        const cond = transition.cond || (() => true);

        const isTargetless = target === null;

        const nextStateValue = target || value;
        // console.log("----transition-nextStateValue--" + nextStateValue)
        // const nextStateConfig = this.config.states.get(nextStateValue);

        const nextStateConfig = findStateInfo(this.states, nextStateValue);
        // console.log("--findStateInfo--END=nextStateConfig-")
        if (!nextStateConfig) {
            const message = "state not found: " + nextStateValue;
            wasmx.revert(String.UTF8.encode(message));
            throw new Error(message);
        }

        // console.log("----transition-nextStateConfig--" + nextStateConfig.on.keys().join(","))

        if (guard && !executeGuard(guard, event)) {
            const message = "cannot execute transition; guard: " + guard;
            wasmx.revert(String.UTF8.encode(message));
            throw new Error(message);
        }

        // console.log("----transition-cond--" + cond.toString())
        if (cond(eventObject)) {
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
                            const v = storage.getContextValue(value);
                            if (!found && v) {
                              // look in context
                              act.event!.params[k].value = v;
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
            eventObject
          );
          const nonAssignActions = res.actions;
          const assigned = res.assigned;

          let resolvedTarget = target || value;
          // console.log("--transition--resolvedTarget-" + resolvedTarget)

          // child states! we choose the first one
          const stateConfig = findStateInfo(this.states, resolvedTarget);
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

          return new State(resolvedTarget, nonAssignActions, target !== value || nonAssignActions.length > 0 || assigned);
          // matches: createMatcher(resolvedTarget)
        }
      }
    }

    // No transitions match
    return createUnchangedState(value);
  }

  applyTransition(
    state: StateMachine.State,
    transition: StateMachine.Transition
  ): StateMachine.State {
    console.log("* applyTransition: " + transition.target);
    const value = state.value;
    const stateConfig = findStateInfo(this.states, value);
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
        return createUnchangedState(value);
      }
      const target = transition.target;
      const actions = transition.actions || [];
      const guard = transition.guard;
      const cond = transition.cond || (() => true);

      const isTargetless = target === null;

      const nextStateValue = target || value;
      // console.log("----transition-nextStateValue--" + nextStateValue)
      // const nextStateConfig = this.config.states.get(nextStateValue);

      const nextStateConfig = findStateInfo(this.states, nextStateValue);
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
                          const v = storage.getContextValue(value);
                          if (!found && v) {
                            // look in context
                            act.event!.params[k].value = v;
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
          eventObject,
        );
        const nonAssignActions = res.actions;
        const assigned = res.assigned;

        let resolvedTarget = target || value;
        // console.log("--transition--resolvedTarget-" + resolvedTarget)

        // child states! we choose the first one
        const stateConfig = findStateInfo(this.states, resolvedTarget);
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

        return new State(resolvedTarget, nonAssignActions, target !== value || nonAssignActions.length > 0 || assigned);
        // matches: createMatcher(resolvedTarget)
      }
    }

    // No transitions match
    return createUnchangedState(value);
  }
}


// @ts-ignore
@serializable
export class MachineExternal {
  id: string;
  states: Array<StateInfoClassExternal>;

  constructor(
    id: string,
    states: Array<StateInfoClassExternal>,
  ) {
    this.id = id;
    this.states = states;
  }

  static fromInternal(configInternal: StateMachine.Machine): MachineExternal {
    const states = StateInfoClassExternal.fromInternalStatesMap(configInternal.states);

    const config = new MachineExternal(
      configInternal.id,
      states,
    );

    // machine.initialState;
    return new MachineExternal(config.id, states);
  }

  toInternal(): Machine {
    const states = StateInfoClassExternal.toInternalFromArray(this.states);
    return new Machine(
        this.id,
        states,
    );
  }
}

export function runInternal(config: MachineExternal, event: EventClass): ArrayBuffer {
    const service = loadServiceFromConfig(config);
    service.send(event);
    return new ArrayBuffer(0);
}

export function loadServiceFromConfig(config: MachineExternal): Service {
    const status = storage.getCurrentStatus();
    return new ServiceExternal(config, status).toInternal();
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

export function eventual(config: MachineExternal, intervalId: i32, args: TimerArgs): void {
  console.log("* eventual: " + args.state + "--" + args.delay);
  const service = loadServiceFromConfig(config);
  const currentState = storage.getCurrentState();
  console.log("* eventual - finding state: " + currentState);

  if (currentState.value !== args.state) {
    // we are in the wrong state, so the interval must be stopped
    // wasmx.stopInterval(intervalId);
    return;
  }

  const newstateconfig = findStateInfo(service.machine.states, currentState.value);
  if (!newstateconfig) {
    return revert("could not find state config for " + currentState);
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
  let state = storage.getCurrentState();
  state = service.machine.applyTransition(state, transition);
  executeStateActions(service, state, new EventClass("", []));
  // TODO listeners?

  storage.setCurrentState(state);
}
