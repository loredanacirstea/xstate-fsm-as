import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';

import {
  EventObject,
  InitEvent,
  InterpreterStatus,
  StateMachine,
  HandledActions,
  UnsubscribeReturnValue,
  ActionObject,
  State,
  States,
  StateInfo,
  EventClass,
  ActionParam,
  ContextParam,
  StateInfoClassExternal,
  RaiseActionType,
  TimerArgs,
  CallRequest,
  AssignAction,
  Transition,
} from './types';
import { hexToUint8Array, revert, getAddressHex, parseInt32, parseInt64 } from "./utils";
import * as storage from './storage';
import * as actionsCounter from "./actions_counter";
import * as actionsErc20 from "./actions_erc20";
import * as actionsRaft from "./actions_raft";
import { LoggerDebug } from "./consensus_wrap";

const REVERT_IF_UNEXPECTED_STATE = false;

const INIT_EVENT = new InitEvent();
const ASSIGN_ACTION: AssignAction = 'xstate.assign';
const WILDCARD = '*';
const INTERVAL_ID_KEY = "intervalIdKey";

export function instantiate(
  config: MachineExternal,
  initialState: string,
  params: ContextParam[],
): void {
  storage.storeContextParams(params);
  storage.setCurrentStatus(InterpreterStatus.NotStarted);
  storage.storeOwner(wasmx.getCaller());

  // TODO see if there are initial actions to perform (e.g. entry actions)
  // const stateConfig = findStateInfo(service.machine.states, initialState);
  const iniactions:  ActionObject[] = [];
  const res = handleActions(
    iniactions,
    INIT_EVENT as EventObject
  );
  const initialActions = res.actions;
  if (initialState.at(0) != "#") {
    initialState = `#${config.id}.${initialState}`
  }
  const newstate = new State(initialState, initialActions, false);
  storage.setCurrentState(newstate);

  const service = new ServiceExternal(config , InterpreterStatus.NotStarted).toInternal();
  // TODO start endpoint?
  service.start();
}

function createUnchangedState(value: string): State {
  return new State(value, [], false);
  // matches: createMatcher(value)
}

function handleActions(
  actions: Array<ActionObject>,
  eventObject: EventObject
): HandledActions {
  let assigned = false;
  const nonAssignActions: ActionObject[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
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
    LoggerDebug("execute guard", ["guard", guard]);
    if (guard === "isAdmin") return isAdmin([]);
    if (guard === "hasEnoughBalance") return actionsErc20.hasEnoughBalance([], event);
    if (guard === "hasEnoughAllowance") return actionsErc20.hasEnoughAllowance([], event);
    if (guard === "elapsedNotReset") return actionsRaft.elapsedNotReset([], event);
    if (guard === "isVotedLeader") return actionsRaft.isVotedLeader([], event);
    if (guard === "ifIntervalActive") return ifIntervalActive([], event);

    // TODO processExternalCall

    return true;
}

function executeStateActions(
    service: Service,
    state: State,
    event: EventObject
): void {
  console.debug("* executeStateActions: " + state.actions.length.toString())
  for (let i = 0; i < state.actions.length; i++) {
    const action = state.actions[i];
    executeStateAction(service, state, event, action);
  }
  console.debug("* executeStateActions after actions for: " + state.value)

  // timed actions from the new target state
  const newstateconfig = findStateInfo(service.machine.states, state.value);
  if (!newstateconfig) {
    return revert("could not find state config for " + state.value);
  }

  if (newstateconfig.always.length > 0) {
    const newstate = applyAlwaysIfElse(service, state, newstateconfig.always)
    if (newstate != null) {
      // Set new state before executing actions
      storage.setCurrentState(newstate);
      executeStateActions(service, newstate, new EventClass("", []));
    }
  }

  const afterTimers = newstateconfig.after;
  // console.log("===executeStateActions afterTimers===")
  if (afterTimers == null) {
    return;
  }
  const delayKeys = afterTimers.keys();
  console.debug("* setting timed actions for " + state.value);
  console.debug("* setting timed actions... " + delayKeys.join(","));

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
    const intervalId = getLastIntervalId() + 1;
    setLastIntervalId(intervalId);
    registerIntervalId(state.value, delayKeys[i], intervalId);
    const args = new TimerArgs(delayKeys[i], state.value, intervalId);
    const argsStr = JSON.stringify<TimerArgs>(args);
    wasmx.startTimeout(delay, String.UTF8.encode(argsStr));
    console.debug("started timeout - intervalId: " + intervalId.toString());
  }
}

function applyAlwaysIfElse(
  service: Service,
  state: State,
  alwaysTransitions: Transition[],
): State | null {
  if (alwaysTransitions.length == 0) return null;
  const emptyEvent = new EventClass("", [])
  console.debug(`apply if/else - ${alwaysTransitions[0].target}`);
  const newstate = service.machine.applyTransition(state, alwaysTransitions[0], emptyEvent);
  if (newstate != null) return newstate;
  alwaysTransitions.shift();
  return applyAlwaysIfElse(service, state, alwaysTransitions);
}

function executeStateAction(
    service: Service,
    state: State,
    event: EventObject,
    action:  ActionObject,
): void {
    const actionType = action.type;
    console.debug("* execute action: " + actionType);

    if (actionType === RaiseActionType) {
        const ev = action.event;
        console.debug("* raise: " + ev!.type);
        if (ev === null) {
            return revert("raise action is missing event");
        }
        const _event: EventObject = new EventClass(ev.type, ev.params);
        service.send(_event);
        return;
    }
    const actionParams = action.params;
    for (let i = 0; i < actionParams.length; i++) {
      if (actionParams[i].value.length > 0 && actionParams[i].value.at(0) == "$") {
        const value = storage.getContextValue(actionParams[i].value.slice(1));
        actionParams[i].value = value;
      }
    }

    if (actionType === "mint") {
        actionsErc20.mint(actionParams, event);
        return;
    }
    if (actionType === "move") {
        actionsErc20.move(actionParams, event);
        return;
    }
    if (actionType === "approve") {
        actionsErc20.approve(actionParams, event);
        return;
    }
    if (actionType === "sendRequest") {
      sendRequest(actionParams, event);
      return;
    }
    if (actionType === "logTransfer") {
        actionsErc20.logTransfer(actionParams, event);
        return;
    }
    if (actionType === "increment") {
      actionsCounter.increment(actionParams);
      return;
    }
    if (actionType === "log") {
        log(actionParams);
        return
    }
    if (actionType === "setupNode") {
      actionsRaft.setupNode(actionParams, event);
      return;
    }
    if (actionType === "processAppendEntries") {
      actionsRaft.processAppendEntries(actionParams, event);
      return;
    }
    if (actionType === "sendHeartbeatResponse") {
      actionsRaft.sendHeartbeatResponse(actionParams, event);
      return;
    }
    if (actionType === "sendAppendEntries") {
      actionsRaft.sendAppendEntries(actionParams, event);
      return;
    }
    if (actionType === "sendNewTransactionResponse") {
      actionsRaft.sendNewTransactionResponse(actionParams, event);
      return;
    }
    if (actionType === "addToMempool") {
      actionsRaft.addToMempool(actionParams, event);
      return;
    }
    if (actionType === "proposeBlock") {
      actionsRaft.proposeBlock(actionParams, event);
      return;
    }
    if (actionType === "commitBlocks") {
      actionsRaft.commitBlocks(actionParams, event);
      return;
    }
    if (actionType === "setRandomElectionTimeout") {
      actionsRaft.setRandomElectionTimeout(actionParams, event);
      return;
    }
    if (actionType === "initializeNextIndex") {
      actionsRaft.initializeNextIndex(actionParams, event);
      return;
    }
    if (actionType === "initializeMatchIndex") {
      actionsRaft.initializeMatchIndex(actionParams, event);
      return;
    }
    if (actionType === "incrementCurrentTerm") {
      actionsRaft.incrementCurrentTerm(actionParams, event);
      return;
    }
    if (actionType === "vote") {
      actionsRaft.vote(actionParams, event);
      return;
    }
    if (actionType === "sendVoteRequests") {
      actionsRaft.sendVoteRequests(actionParams, event);
      return;
    }
    if (actionType === "selfVote") {
      actionsRaft.selfVote(actionParams, event);
      return;
    }
    if (actionType === "forwardTxsToLeader") {
      actionsRaft.forwardTxsToLeader(actionParams, event);
      return;
    }
    if (actionType === "updateNodeAndReturn") {
      actionsRaft.updateNodeAndReturn(actionParams, event);
      return;
    }
    if (actionType === "registeredCheck") {
      actionsRaft.registeredCheck(actionParams, event);
      return;
    }
    if (actionType === "noaction") {
      noaction(actionParams, event);
      return;
    }
    if (actionType === "cancelActiveIntervals") {
      cancelActiveIntervals(state, actionParams, event);
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

function noaction(
  params: ActionParam[],
  event: EventObject,
): void {}

function processExternalCall(
    service: Service,
    state: State,
    event: EventObject,
    action:  ActionObject,
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
  const caller = wasmx.getCaller();
  const owner = storage.loadOwner();
  return getAddressHex(caller) === getAddressHex(owner);
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
  const contract = wasmx.getCaller();
  wasmxwrap.grpcRequest(address, Uint8Array.wrap(contract), data);
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
    this.status = status;
    this.listeners = new Set<StateMachine.StateListener>();
  }

  send(event: EventObject): void {
    console.debug("* send event: " + event.type);
    console.debug("* status: " + this.status.toString());
    if (this.status !== InterpreterStatus.Running) {
      return;
    }
    let state = storage.getCurrentState();
    const newstate = this.machine.transition(state, event);
    if (newstate == null) {
      return;
    }
    console.debug("* posttransition state: " + newstate.value);
    // Set new state before executing actions
    storage.setCurrentState(newstate);
    executeStateActions(this, newstate, event);

    const listeners = this.listeners.values();
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](newstate);
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
    this.status = InterpreterStatus.Running;
    storage.setCurrentStatus(InterpreterStatus.Running)
    let state = storage.getCurrentState();
    executeStateActions(this, state, INIT_EVENT);
    this.send(INIT_EVENT);
    return this;
  }

  stop(): Service {
    this.status = InterpreterStatus.Stopped;
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
    state: State,
    eventObject: EventObject
  ): State | null {
    const value = state.value;
    const stateConfig = findStateInfo(this.states, value);
    if (!stateConfig) {
        const message = "state not found: " + value;
        wasmx.revert(String.UTF8.encode(message));
        throw new Error(message);
    }
    let transition: Transition | null = null;

    if (stateConfig.on) {
      if (stateConfig.on.has(eventObject.type)) {
        transition = stateConfig.on.get(eventObject.type);
        console.debug("* transition next target: " + transition.target)
      } else {
        // search for transition in the parents
        transition = findTransitionInParents(this.states, value, eventObject);

        if (transition == null) {
          const message = `cannot apply "${eventObject.type}" event in current "${value}" state`;
          if (REVERT_IF_UNEXPECTED_STATE) {
            wasmx.revert(String.UTF8.encode(message));
            throw new Error(message);
          } else {
            LoggerDebug(message, []);
            return null;
          }

        }
      }
    }

    if (transition !== null) {
      return this.applyTransition(state, transition, eventObject);
    }

    // No transitions match
    return createUnchangedState(value);
  }

  applyTransition(
    state: State,
    transition: Transition,
    eventObject: EventObject,
  ): State | null {
    console.debug("* applyTransition: " + transition.target);
    const value = state.value;
    const stateConfig = findStateInfo(this.states, value);
    if (!stateConfig) {
        const message = "state not found: " + value;
        wasmx.revert(String.UTF8.encode(message));
        throw new Error(message);
    }

    const transitions: Array<Transition> = [transition];

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

        const isTargetless = target === null || target === "";

        let nextStateValue = target;
        if (isTargetless) {
          nextStateValue = value;
        }

        const nextStateConfig = findStateInfo(this.states, nextStateValue);
        // console.log("--findStateInfo--END=nextStateConfig-")
        if (!nextStateConfig) {
            const message = "state not found: " + nextStateValue;
            wasmx.revert(String.UTF8.encode(message));
            throw new Error(message);
        }

      if (guard && !executeGuard(guard, eventObject)) {
        const message = "cannot execute transition; guard: " + guard;
        if (REVERT_IF_UNEXPECTED_STATE) {
          wasmx.revert(String.UTF8.encode(message));
          throw new Error(message);
        } else {
          LoggerDebug(message, []);
          return null;
        }
    }

      // if (cond(eventObject)) {
      if (true) {
        let allActions: ActionObject[] = [];

        if (!isTargetless) {
          allActions = allActions.concat(processActions(stateConfig.exit, eventObject));
        }
        allActions = allActions.concat(processActions(actions, eventObject));
        if (!isTargetless) {
          allActions = allActions.concat(processActions(nextStateConfig.entry, eventObject));
        }

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

        let resolvedTarget = target;
        if (isTargetless) {
          resolvedTarget = value;
        }

         // child states! we choose the first one
        const stateConfigResolved = findStateInfo(this.states, resolvedTarget);
        // console.log("--findStateInfo--END=");
        if (!stateConfigResolved) {
          const message = "state not found: " + resolvedTarget;
          wasmx.revert(String.UTF8.encode(message));
          throw new Error(message);
        }
        // console.log("--findStateInfo--END1=");
        if (stateConfigResolved.states !== null && stateConfigResolved.states.keys().length > 0) {
          // initial key
          let initialState = stateConfigResolved.states.keys()[0];
          const initialStateObj = stateConfigResolved.states.get(initialState);
          if (initialState.at(0) != "#") {
            initialState = `${resolvedTarget}.${initialState}`
          }
          resolvedTarget = initialState;

          // add the action of this child state
          allActions = allActions.concat(processActions(initialStateObj.entry, eventObject));
        }
        // console.log("--findStateInfo--END2=");

        console.debug("* transition next target: " + resolvedTarget);



        console.debug(`allActions.length: ` + allActions.length.toString())

        const res = handleActions(
          // allActionObjects,
          allActions,
          eventObject
        );
        const nonAssignActions = res.actions;
        const assigned = res.assigned;

        return new State(resolvedTarget, nonAssignActions, target !== value || nonAssignActions.length > 0 || assigned);
        // matches: createMatcher(resolvedTarget)
      }
    }

    // No transitions match
    return createUnchangedState(value);
  }
}

function processActions(actions: ActionObject[], event: EventObject): ActionObject[] {
  let allActions: ActionObject[] = [];
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
                    act.event!.params[k].value = getAddressHex(wasmx.getCaller());
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
  return allActions;
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

function findTransitionInParents(states: States, stateName: string, eventObject: EventObject): Transition | null {
  // all state values must be absolute
  if (stateName.at(0) != "#") {
    revert("state must be absolute: " + stateName);
    return null;
  }
  let statePath = stateName.substring(1).split(".").slice(1);
  statePath.pop(); // remove current kid
  return findTransitionInternal(states, statePath, eventObject)
}

function findTransitionInternal(states: States, statePath: string[], eventObject: EventObject): Transition | null {
  const stateConfig = findStateInfoByPath(states, statePath);
  if (stateConfig != null && stateConfig.on.has(eventObject.type)) {
    return stateConfig.on.get(eventObject.type);
  }
  if (statePath.length == 0) {
    return null;
  }
  statePath.pop(); // remove current kid
  return findTransitionInternal(states, statePath, eventObject);
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

// TODO use only absolute paths for states
export function equalState(state1: string, state2: string): boolean {
  // const config1 = findStateInfo(states, state1);
  // const config2 = findStateInfo(states, state2);
  const st1 = state1.split(".").pop();
  const st2 = state2.split(".").pop();
  return st1 === st2;
}

export function eventual(config: MachineExternal, args: TimerArgs): void {
  console.debug("* eventual: " + args.state + "--" + args.delay);
  const service = loadServiceFromConfig(config);
  const currentState = storage.getCurrentState();
  console.debug("* eventual - finding state: " + currentState.value);
  const isEqual = equalState(currentState.value, args.state);

  if (!isEqual) {
    // we are in the wrong state, so the interval must be stopped
    console.debug("* eventual: we are in the wrong state");
    // wasmx.stopInterval(intervalId);
    return;
  }

  const newstateconfig = findStateInfo(service.machine.states, currentState.value);
  if (!newstateconfig) {
    return revert("could not find state config for " + currentState.value);
  }
  console.debug("* eventual - finding after");
  const afterTimers = newstateconfig.after;
  if (afterTimers == null || !afterTimers.has(args.delay)) {
    // we are in the wrong state, so the interval must be stopped
    // wasmx.stopInterval(intervalId);
    return;
  }
  console.debug("* execute delayed action... " + args.delay)
  // delay is in milliseconds
  const transition = afterTimers.get(args.delay);
  if (!transition) {
    revert("delayed transition not found: " + args.delay);
  }

  // just a copied transition
  let state = storage.getCurrentState();
  // we add the interval id in the event
  let intervalIdField = new ActionParam("intervalId", args.intervalId.toString())
  let stateField = new ActionParam("state", args.state)
  let delayField = new ActionParam("delay", args.delay)
  let emptyEvent = new EventClass("", [intervalIdField, stateField, delayField]);
  console.debug("* execute delayed action - guard: " + transition.guard)
  const newstate = service.machine.applyTransition(state, transition, emptyEvent);
  if (newstate == null) {
    return;
  }
  // Set new state before executing actions
  storage.setCurrentState(newstate);
  executeStateActions(service, newstate, emptyEvent);
  // TODO listeners?
}

function getLastIntervalId(): i64 {
  const value = storage.getContextValue(INTERVAL_ID_KEY);
  if (value === "") return i64(0);
  return parseInt32(value);
}

function setLastIntervalId(value: i64): void {
  storage.setContextValue(INTERVAL_ID_KEY, value.toString());
}

function registerIntervalIdKey(state: string, delay: string, intervalId: i64): string {
  return `${INTERVAL_ID_KEY}_${state}_${delay}_${intervalId.toString()}`
}

function registerLastIntervalIdKey(state: string, delay: string): string {
  return `${INTERVAL_ID_KEY}_${state}_${delay}`
}

function registerIntervalId(state: string, delay: string, intervalId: i64): void {
  storage.setContextValue(registerLastIntervalIdKey(state, delay), intervalId.toString());
  storage.setContextValue(registerIntervalIdKey(state, delay, intervalId), "1");
}

function getLastIntervalIdForState(state: string, delay: string): i64 {
  const lastIntervalId = storage.getContextValue(registerLastIntervalIdKey(state, delay))
  if (lastIntervalId == "") {
    return 0;
  }
  return parseInt64(lastIntervalId);
}

function isRegisteredIntervalActive(state: string, delay: string, intervalId: i64): boolean {
  const value = storage.getContextValue(registerIntervalIdKey(state, delay, intervalId));
  if (value == "1") return true;
  return false;
}

function cancelIntervals(state: string, delay: string): void {
  const lastIntervalId = getLastIntervalIdForState(state, delay)
  tryCancelIntervals(state, delay, lastIntervalId);
}

function tryCancelIntervals(state: string, delay: string, intervalId: i64): void {
  const active = isRegisteredIntervalActive(state, delay, intervalId);
  // remove the interval data
  storage.setContextValue(registerIntervalIdKey(state, delay, intervalId), "");
  if (active && intervalId > 0) {
    tryCancelIntervals(state, delay, intervalId - 1);
  }
}

function cancelActiveIntervals(
  state: State,
  params: ActionParam[],
  event: EventObject,
): void {
  if (params.length == 0) {
    params = event.params;
  }
  let delay = "";
  for (let i = 0; i < params.length; i++) {
    if (params[i].key === "after") {
      delay = params[i].value;
        continue;
    }
  }
  if (delay === "") {
    revert("no delay found");
}
  cancelIntervals(state.value, delay);
}

function ifIntervalActive(
  params: ActionParam[],
  event: EventObject,
): boolean {
  if (params.length == 0) {
    params = event.params;
  }
  let intervalIdStr = "";
  let state = "";
  let delay = "";
  for (let i = 0; i < params.length; i++) {
    if (params[i].key === "intervalId") {
      intervalIdStr = params[i].value;
        continue;
    }
    if (params[i].key === "state") {
      state = params[i].value;
        continue;
    }
    if (params[i].key === "delay") {
      delay = params[i].value;
        continue;
    }
  }
  if (intervalIdStr === "") {
      revert("no intervalId found");
  }
  if (state === "") {
      revert("no state found");
  }
  if (delay === "") {
      revert("no delay found");
  }
  const intervalId = parseInt64(intervalIdStr);
  const active = isRegisteredIntervalActive(state, delay, intervalId);

  // remove the interval data
  storage.setContextValue(registerIntervalIdKey(state, delay, intervalId), "");
  return active;
}
