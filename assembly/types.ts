import { JSON } from "json-as/assembly";

export type HexString = string;
export type Base64String = string;
export type Bech32String = string;

// @ts-ignore
@serializable
export enum InterpreterStatus {
  NotStarted = 0,
  Running = 1,
  Stopped = 2
}

export var StatusMap = new Map<string, InterpreterStatus>();
StatusMap.set("0", InterpreterStatus.NotStarted);
StatusMap.set("1", InterpreterStatus.Running);
StatusMap.set("2", InterpreterStatus.Stopped);

export interface EventObject {
  type: string;
  params: ActionParam[];
}

export class EventClass implements EventObject {
  type: string;
  params: ActionParam[];

  constructor(type: string, params: ActionParam[]) {
    this.type = type;
    this.params = params;
  }
}

// @ts-ignore
@serializable
export class EventClassExternal {
  type: string;
  params: ActionParam[];

  constructor(type: string, params: ActionParam[]) {
    this.type = type;
    this.params = params;
  }
}

export class InitEvent implements EventObject {
  type: string = 'initialize';
  params: ActionParam[] = [];
}

export type ContextGeneral<T> =  Map<string,T>
export type ContextGeneralString =  Map<string,string>

export type StateInfoEvents = Map<string,Transition>

export type StateTimers = Map<string,Transition>

export interface StateInfo {
  always: Array<Transition>;
  after: StateTimers | null;
  on: StateInfoEvents;
  exit: Array<ActionObject>;
  entry: Array<ActionObject>;
  initial: string;
  states: States;
}

export type States = Map<string,StateInfo>

export type ActionFunction = (event: EventObject) => void;
export type AssignAction = 'xstate.assign';

export namespace StateMachine {
  export interface Machine {
    id: string;
    states: States;
    transition(
      state: State,
      event: EventObject
    ): State | null;
    applyTransition(
      state: State,
      transition: Transition,
      event: EventObject,
    ): State | null;
  }

  export type StateListener = (state: State) => void;

  export interface Service {
    send(event: EventObject): void;
    subscribe(listener: StateListener): UnsubscribeReturnValue;
    start(): Service;
    stop (): Service;
    readonly status: InterpreterStatus;
  }

  // export type Assigner = (
  //   context: TContext,
  //   event: EventObject
  // ) => Partial<TContext>;

  export type PropertyAssigner = Map<string, string>

  export type PropertyAssignerFnMap = Map<string,((context: ContextGeneralString, event: EventObject) => string)>

  export type PropertyAssignerFn = ((context: ContextGeneralString, event: EventObject) => string)
}

export interface Typestate {
  value: string;
  context: ContextGeneralString;
}

// export type ExtractEvent<
//   TEvent extends EventObject,
//   TEventType extends string
// > = TEvent extends { type: TEventType } ? TEvent : never;

export class HandledActions {
  actions: Array<ActionObject> = [];
  assigned: boolean = false;

  constructor(
    actions: Array<ActionObject>,
    assigned: boolean
  ) {
    this.actions = actions;
    this.assigned = assigned;
  }
}

export interface UnsubscribeReturnValue {
  unsubscribe: () => void;
}

// @ts-ignore
@serializable
export class ActionParam {
  key: string;
  value: string;

  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
}

// @ts-ignore
@serializable
export class ActionObject {
  type: string;
  params: Array<ActionParam>
  event: EventClassExternal | null
  // exec: ActionFunction | null;
  // assignment: PropertyAssigner<ContextGeneralString> | null;
  // assignmentFn: PropertyAssignerFn | null;
  // properties: Map<string,string>

  constructor(type: string, params: Array<ActionParam>, event: EventClassExternal | null) {
    this.type = type;
    this.params = params;
    this.event = event;
  }
}

export const RaiseActionType = "xstate.raise";

// @ts-ignore
@serializable
export class RaiseAction extends ActionObject{
  type: string = RaiseActionType;
  params: Array<ActionParam> = [];
  event: EventClassExternal;

  constructor(type: string, params: Array<ActionParam>, event: EventClassExternal) {
    super(type, params, null);
    this.event = event;
  }
}

export class State {
  value: string;
  actions: Array<ActionObject>;
  changed: boolean;
  // matches: (value: string) => (stateValue: string) => boolean;

  constructor(
    value: string,
    actions: Array<ActionObject>,
    changed: boolean,
    // matches: (value: string) => (stateValue: string) => boolean,
  ) {
    this.value = value;
    this.actions = actions;
    this.changed = changed;
    // this.matches = matches;
  }
}

// @ts-ignore
@serializable
export class StateClassExternal {
  value: string;
  actions: Array<ActionObject>;
  changed: boolean;
  // matches: (value: string) => (stateValue: string) => boolean;

  constructor(
    value: string,
    actions: Array<ActionObject>,
    changed: boolean,
  ) {
    this.value = value;
    this.actions = actions;
    this.changed = changed;
  }

  toInternal(): State {
    const stateactions: Array<ActionObject> = [];
    for (let i = 0; i < this.actions.length; i++) {
        const act = this.actions[i];
        stateactions.push(new ActionObject(act.type, act.params, act.event));
    }
    return new State(this.value, stateactions, this.changed);
  }

  static fromInternal(state: State): StateClassExternal {
    const iniactions: Array<ActionObject> = [];
    for (let i = 0; i < state.actions.length; i++) {
        const act = state.actions[i];
        const _ev = act.event;
        let ev: EventClassExternal | null = null;
        if (_ev !== null) {
            ev = new EventClassExternal(_ev.type, _ev.params);
        }
        iniactions.push(new ActionObject(act.type, act.params, ev));
    }
    return new StateClassExternal(
        state.value,
        iniactions,
        state.changed,
    );
  }
}

// @ts-ignore
@serializable
export class AssignActionObject extends ActionObject {
  type: AssignAction;
   // assignment: PropertyAssigner<ContextGeneralString> | null;
  assignment: Map<string, string> | null;
  // assignmentFn: PropertyAssignerFn | null;
  assignmentFn: ((event: EventObject) => string) | null;

  constructor(
    type: AssignAction,
    assignment: Map<string, string> | null,
    assignmentFn: ((event: EventObject) => string) | null,
  ) {
    super(type, [], null);
    this.type = type;
    this.assignment = assignment;
    this.assignmentFn = assignmentFn;
  }
}

// @ts-ignore
@serializable
export class ActionClass {
  value: string;
  action: ActionObject | null;
  // actionFn: StateMachine.ActionFunction | null;
  // assignAction: AssignActionObject | null;

  constructor(
    value: string,
    action: ActionObject | null,
    // actionFn: StateMachine.ActionFunction | null,
    // assignAction: AssignActionObject | null,
  ) {
    this.value = value;
    this.action = action;
    // this.actionFn = actionFn;
    // this.assignAction = assignAction;
  }
}

export class Transition {
  target: string;
  actions: Array<ActionObject>;
  guard: string;
  cond: ((event: EventObject) => boolean) | null;
  // TODO meta {}

  constructor(
    target: string,
    actions: Array<ActionObject>,
    guard: string,
    cond: ((event: EventObject) => boolean) | null,
  ) {
    this.target = target;
    this.actions = actions;
    this.guard = guard;
    this.cond = cond;
  }
}

// @ts-ignore
@serializable
export class TransitionExternal {
  name: string;
  target: string;
  actions: Array<ActionObject>;
  guard: string;
  cond: ((context: ContextGeneralString, event: EventObject) => boolean) | null;

  constructor(
    name: string,
    target: string,
    actions: Array<ActionObject>,
    guard: string,
    cond: ((context: ContextGeneralString, event: EventObject) => boolean) | null,
  ) {
    this.name = name;
    this.target = target;
    this.actions = actions;
    this.guard = guard;
    this.cond = cond;
  }
}

export class StateInfoClass implements StateInfo {
  always: Array<Transition>;
  after: StateTimers | null;
  on: StateInfoEvents;
  exit: Array<ActionObject>;
  entry: Array<ActionObject>;
  initial: string;
  states: States;

  constructor(
    always: Array<Transition>,
    after: StateTimers | null,
    on: StateInfoEvents,
    exit: Array<ActionObject>,
    entry: Array<ActionObject>,
    initial: string,
    childstates: States,
  ) {
    this.always = always;
    this.after = after;
    this.on = on;
    this.exit = exit;
    this.entry = entry;
    this.initial = initial;
    this.states = childstates;
  }
}

// @ts-ignore
@serializable
export class StateInfoClassExternal {
  name: string;
  always: Array<TransitionExternal>;
  after: Array<TransitionExternal>;
  on: Array<TransitionExternal>;
  exit: Array<ActionObject>;
  entry: Array<ActionObject>;
  initial: string;
  states: Array<StateInfoClassExternal>;

  constructor(
    name: string,
    always: Array<TransitionExternal>,
    after: Array<TransitionExternal>,
    on: Array<TransitionExternal>,
    exit: Array<ActionObject>,
    entry: Array<ActionObject>,
    initial: string,
    childstates: Array<StateInfoClassExternal>,
  ) {
    this.name = name;
    this.always = always;
    this.after = after;
    this.on = on;
    this.exit = exit;
    this.entry = entry;
    this.initial = initial;
    this.states = childstates;
  }

  static fromInternalStatesMap(
    states: States,
  ): Array<StateInfoClassExternal> {
    const estates: Array<StateInfoClassExternal> = [];
    const statesKeys = states.keys();
    for (let i = 0; i < statesKeys.length; i++) {
      const estate = StateInfoClassExternal.fromInternal(states.get(statesKeys[i]), statesKeys[i]);
      estates.push(estate);
    }
    return estates;
  }

  static fromInternal(
    stateInfo: StateInfo,
    stateName: string,
  ): StateInfoClassExternal {
    const onevents: Array<TransitionExternal> = [];
    const stateInfoOn = stateInfo.on.keys();
    for (let j = 0; j < stateInfoOn.length; j++) {
        const evInfo = stateInfo.on.get(stateInfoOn[j]);
        const evActions: Array<ActionObject> = [];
        for (let k = 0; k < evInfo.actions.length; k++) {
            const actionobj = evInfo.actions[k];
            const _ev = actionobj.event;
            let ev: EventClassExternal | null = null;
            if (_ev !== null) {
              ev = new EventClassExternal(_ev.type, _ev.params);
            }
            evActions.push(new ActionObject(actionobj.type, actionobj.params, ev));
        }
        onevents.push(new TransitionExternal(
            stateInfoOn[j],
            evInfo.target,
            evActions,
            evInfo.guard,
            null,
        ));
    }
    let afterTimers: Array<TransitionExternal> = [];
    const afterT = stateInfo.after;
    if (afterT != null) {
      const keys = afterT.keys();
      for (let i = 0; i < keys.length; i++) {
        const delay = keys[i];
        const delayedTransition = afterT.get(delay);

        const dActions: Array<ActionObject> = [];
        for (let k = 0; k < delayedTransition.actions.length; k++) {
            const actionobj = delayedTransition.actions[k];
            const _ev = actionobj.event;
            let ev: EventClassExternal | null = null;
            if (_ev !== null) {
              ev = new EventClassExternal(_ev.type, _ev.params);
            }
            dActions.push(new ActionObject(actionobj.type, actionobj.params, ev));
        }

        const afterTimer = new TransitionExternal(
          delay,
          delayedTransition.target,
          dActions,
          delayedTransition.guard,
          null,
        );
        afterTimers.push(afterTimer);
      }
    }

    let alwaysTransitions = new Array<TransitionExternal>(stateInfo.always.length);
    for (let i = 0; i < stateInfo.always.length; i++) {
      const tr = stateInfo.always[i];
      const alwaysActions: Array<ActionObject> = [];
      for (let k = 0; k < tr.actions.length; k++) {
        const actionobj = tr.actions[k];
        const _ev = actionobj.event;
        let ev: EventClassExternal | null = null;
        if (_ev !== null) {
          ev = new EventClassExternal(_ev.type, _ev.params);
        }
        alwaysActions.push(new ActionObject(actionobj.type, actionobj.params, ev));
      }
      alwaysTransitions[i] = new TransitionExternal(
        "always",
        tr.target,
        alwaysActions,
        tr.guard,
        null,
      );
    }

    return new StateInfoClassExternal(
      stateName,
      alwaysTransitions,
      afterTimers,
      onevents,
      [], // TODO stateInfo.exit
      [], // TODO stateInfo.entry
      stateInfo.initial,
      StateInfoClassExternal.fromInternalStatesMap(stateInfo.states),
    );
  }

  static toInternalFromArray(ostates: Array<StateInfoClassExternal>): States {
    const states = new Map<string,StateInfo>();
    for (let i = 0; i < ostates.length; i++) {
      const state = ostates[i].toInternal();
      states.set(ostates[i].name, state);
    }
    return states;
  }

  toInternal(): StateInfo {
    const stateon: StateInfoEvents = new Map<string,Transition>();
    for (let j = 0; j < this.on.length; j++) {
        const onev = this.on[j];
        const actions: Array<ActionObject> = [];
        for (let k = 0; k < onev.actions.length; k++) {
            const action = onev.actions[k];
            actions.push(new ActionObject(action.type, action.params, action.event));
        }
        stateon.set(onev.name, new Transition(
            onev.target,
            actions,
            onev.guard,
            null,
        ))
    }
    let afterTimers: StateTimers | null = null;
    if (this.after.length > 0) {
      afterTimers = new Map();
      for (let i = 0; i < this.after.length; i++) {
        const aft = this.after[i];
        const actions: Array<ActionObject> = [];
        for (let k = 0; k < aft.actions.length; k++) {
            const action = aft.actions[k];
            actions.push(new ActionObject(action.type, action.params, action.event));
        }
        const transition = new Transition(aft.target, actions, aft.guard, null);
        afterTimers.set(aft.name, transition);
      }
    }
    let alwaysTransitions = new Array<Transition>(this.always.length);
    for (let i = 0; i < this.always.length; i++) {
      const tr = this.always[i];
      alwaysTransitions[i] = new Transition(
        tr.target,
        tr.actions,
        tr.guard,
        null,
      );
    }

    const childstates = StateInfoClassExternal.toInternalFromArray(this.states);
    return new StateInfoClass(
      alwaysTransitions,
      afterTimers,
      stateon,
      this.exit,
      this.entry,
      this.initial,
      childstates,
    )
  }
}

// @ts-ignore
@serializable
export class ContextParam {
  key: string;
  value: string;

  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
}

export class ContextParamRaw {
  key: ArrayBuffer;
  value: ArrayBuffer;

  constructor(key: ArrayBuffer, value: ArrayBuffer) {
    this.key = key;
    this.value = value;
  }
}

// @ts-ignore
@serializable
export class TimerArgs {
  delay: string;
  state: string;
  intervalId: i64;
  constructor(delay: string, state: string, intervalId: i64) {
    this.delay = delay;
    this.state = state;
    this.intervalId = intervalId;
  }
}

// @ts-ignore
@serializable
export class CallRequest {
  to: string;
  calldata: string;
  isQuery: boolean;
  constructor(to: string, calldata: string, isQuery: boolean) {
    this.to = to;
    this.calldata = calldata;
    this.isQuery = isQuery;
  }
}

// @ts-ignore
@serializable
export class CallResponse {
  success: boolean;
  data: string;
  constructor(success: boolean, data: string) {
    this.success = success;
    this.data = data;
  }
}

