import { JSON } from "json-as/assembly";

// @ts-ignore
@serializable
export enum InterpreterStatus {
  NotStarted = 0,
  Running = 1,
  Stopped = 2
}

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

// export type StateInfoEvents<
// TContext extends Map<string,string>,
// TEvent extends EventObject,
// > = Map<string,Array<StateMachine.Transition<TContext, TEvent, string>>>

export type StateInfoEvents<
TContext extends Map<string,string>,
TEvent extends EventObject,
> = Map<string,StateMachine.Transition<TContext, TEvent, string>>

export type StateTimers<
TContext extends Map<string,string>,
TEvent extends EventObject,
> = Map<string,StateMachine.Transition<TContext, TEvent, string>>

export interface StateInfo<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
> {
  after: StateTimers<TContext, TEvent> | null;
  on: StateInfoEvents<TContext, TEvent>;
  // exit: Array<StateMachine.Action<TContext, TEvent>>;
  // entry: Array<StateMachine.Action<TContext, TEvent>>;
  exit: Array<ActionClass<TContext, TEvent>>;
  entry: Array<ActionClass<TContext, TEvent>>;
  initial: string;
  states: States<TContext, TEvent>;
}

export type States<
TContext extends Map<string,string>,
TEvent extends EventObject,
> = Map<string,StateInfo<TContext, TEvent>>

export namespace StateMachine {
  export interface Action<
    TContext extends Map<string,string>,
    TEvent extends EventObject
  > {
    value: string;
    action: ActionObject<TContext, TEvent> | null;
    actionFn: ActionFunction<TContext, TEvent> | null;
    assignAction: AssignActionObject<TContext, TEvent> | null;
  }

  // export interface ActionMap<
  //   TContext extends Map<string,string>,
  //   TEvent extends EventObject
  // > {
  //   // Record<string, Exclude<Action<TContext, TEvent>, string>>
  //   [key: string]: Exclude<Action<TContext, TEvent>, string>
  // }

  export type ActionMap<
    TContext extends Map<string,string>,
    TEvent extends EventObject
  > = Map<string, string>
  // > = Map<string, Exclude<Action<TContext, TEvent>, string>>

  export interface ActionObject<
    TContext extends Map<string,string>,
    TEvent extends EventObject
  > {
    // type: string;
    // exec: ActionFunction<TContext, TEvent> | null;
    // assignment: PropertyAssigner<TContext> | null;
    // assignmentFn: PropertyAssignerFn<TContext, TEvent> | null;
    // properties: Map<string,string>
    type: string;
    params: Array<ActionParam>;
    // event: TEvent | null;
    event: EventClassExternal | null
  }

  export type ActionFunction<
    TContext extends Map<string,string>,
    TEvent extends EventObject
  > = (context: TContext, event: TEvent) => void;

  export type AssignAction = 'xstate.assign';

  export interface AssignActionObject<
    TContext extends Map<string,string>,
    TEvent extends EventObject
  > extends ActionObject<TContext, TEvent> {
    type: AssignAction;
    // assignment: PropertyAssigner<TContext> | null;
    assignment: Map<string, string> | null;
    // assignmentFn: PropertyAssignerFn<TContext, TEvent> | null;
    assignmentFn: ((context: TContext, event: TEvent) => string) | null;
  }

  export interface Transition<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TStateValue extends string = string
  > {
    target: TStateValue;
    actions: Array<ActionObject<TContext, TEvent>>;
    guard: string;
    cond: ((context: TContext, event: TEvent) => boolean) | null;
    // TODO meta {}
  }

  export interface State<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>
  > {
    value: string;
    context: TContext;
    actions: Array<ActionObject<TContext, TEvent>>;
    changed: boolean;
    // matches: (value: string) => (stateValue: string) => boolean;
  }

  export type AnyMachine = StateMachine.Machine<any, any, any>;

  export type AnyService = StateMachine.Service<any, any, any>;

  export type AnyState = State<any, any, any>;

  export interface Config<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext> = Typestate<TContext>
  > {
    id: string;
    initial: string;
    context: TContext;
    states: States<TContext, TEvent>;
  }

  export interface Machine<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>
  > {
    id: i32;
    config: StateMachine.Config<TContext, TEvent, TState>;
    initialState: State<TContext, TEvent, TState>;
    transition(
      state: State<TContext, TEvent, TState>,
      event: TEvent
    ): State<TContext, TEvent, TState>;
    applyTransition(
      state: StateMachine.State<TContext, TEvent, TState>,
      transition: StateMachine.Transition<TContext, TEvent, string>
    ): StateMachine.State<TContext, TEvent, TState>;
  }

  export type StateListener<T extends AnyState> = (state: T) => void;

  export interface Service<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>,
  > {
    send(event: TEvent): void;
    subscribe(listener: StateListener<State<TContext, TEvent, TState>>): UnsubscribeReturnValue;
    start(
      initialState: TState | null,
    ): Service<TContext, TEvent, TState>;
    stop (): Service<TContext, TEvent, TState>;
    readonly status: InterpreterStatus;
    readonly state: State<TContext, TEvent, TState>;
  }

  // export type Assigner<TContext extends Map<string,string>, TEvent extends EventObject> = (
  //   context: TContext,
  //   event: TEvent
  // ) => Partial<TContext>;

  export type PropertyAssigner<
    TContext extends Map<string,string>,
  > = Map<string, string>

  export type PropertyAssignerFnMap<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
  > = Map<string,((context: TContext, event: TEvent) => string)>

  export type PropertyAssignerFn<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
  > = ((context: TContext, event: TEvent) => string)
}

export interface Typestate<TContext extends Map<string,string>> {
  value: string;
  context: TContext;
}

// export type ExtractEvent<
//   TEvent extends EventObject,
//   TEventType extends string
// > = TEvent extends { type: TEventType } ? TEvent : never;

export class HandledActions<
  TContext extends Map<string,string>,
  TEvent extends EventObject = EventObject
> {
  actions: Array<StateMachine.ActionObject<TContext, TEvent>> = [];
  ctx: Map<string,string> = new Map<string,string>();
  assigned: boolean = false;

  constructor(
    actions: Array<StateMachine.ActionObject<TContext, TEvent>>,
    ctx: TContext,
    assigned: boolean
  ) {
    this.actions = actions;
    this.ctx = ctx;
    this.assigned = assigned;
  }
}

export class Implementations<
  TContext extends Map<string,string>,
  TEvent extends EventObject
> {
  actions: StateMachine.ActionMap<TContext, TEvent>;

  constructor() {
    this.actions = new Map<string,string>();
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
export class ActionObject<
  TContext extends Map<string,string>,
  TEvent extends EventObject
> implements StateMachine.ActionObject<TContext, TEvent>{
  type: string;
  params: Array<ActionParam>
  event: EventClassExternal | null

  constructor(type: string, params: Array<ActionParam>, event: EventClassExternal | null) {
    this.type = type;
    this.params = params;
    this.event = event;
  }
}

export const RaiseActionType = "xstate.raise";

// @ts-ignore
@serializable
export class RaiseAction<
TContext extends Map<string,string>,
TEvent extends EventObject
> extends ActionObject<TContext, TEvent>{
  type: string = RaiseActionType;
  params: Array<ActionParam> = [];
  event: EventClassExternal;

  constructor(type: string, params: Array<ActionParam>, event: EventClassExternal) {
    super(type, params, null);
    this.event = event;
  }
}

export class State<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>
> implements StateMachine.State<TContext, TEvent, TState> {
  value: string;
  context: TContext;
  actions: Array<StateMachine.ActionObject<TContext, TEvent>>;
  changed: boolean;
  // matches: (value: string) => (stateValue: string) => boolean;

  constructor(
    value: string,
    context: TContext,
    actions: Array<StateMachine.ActionObject<TContext, TEvent>>,
    changed: boolean,
    // matches: (value: string) => (stateValue: string) => boolean,
  ) {
    this.value = value;
    this.context = context;
    this.actions = actions;
    this.changed = changed;
    // this.matches = matches;
  }
}

export class StateClass<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>
> implements StateMachine.State<TContext, TEvent, TState> {
  value: string;
  context: TContext;
  actions: Array<StateMachine.ActionObject<TContext, TEvent>>;
  changed: boolean;
  // matches: (value: string) => (stateValue: string) => boolean;

  constructor(
    value: string,
    context: TContext,
    actions: Array<StateMachine.ActionObject<TContext, TEvent>>,
    changed: boolean,
    // matches: (value: string) => (stateValue: string) => boolean,
  ) {
    this.value = value;
    this.context = context;
    this.actions = actions;
    this.changed = changed;
    // this.matches = matches;
  }
}

// @ts-ignore
@serializable
export class StateClassExternal<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>
> {
  value: string;
  context: Array<ContextParam>;
  actions: Array<ActionObject<TContext, TEvent>>;
  changed: boolean;
  // matches: (value: string) => (stateValue: string) => boolean;

  constructor(
    value: string,
    context: Array<ContextParam>,
    actions: Array<ActionObject<TContext, TEvent>>,
    changed: boolean,
  ) {
    this.value = value;
    this.context = context;
    this.actions = actions;
    this.changed = changed;
  }
}

// @ts-ignore
@serializable
export class AssignActionObject<
  TContext extends Map<string,string>,
  TEvent extends EventObject
> extends ActionObject<TContext, TEvent> implements StateMachine.AssignActionObject<TContext, TEvent> {
  type: StateMachine.AssignAction;
  assignment: Map<string, string> | null;
  assignmentFn: ((context: TContext, event: TEvent) => string) | null;

  constructor(
    type: StateMachine.AssignAction,
    assignment: Map<string, string> | null,
    assignmentFn: ((context: TContext, event: TEvent) => string) | null,
  ) {
    super(type, [], null);
    this.type = type;
    this.assignment = assignment;
    this.assignmentFn = assignmentFn;
  }
}

// @ts-ignore
@serializable
export class ActionClass<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
> implements StateMachine.Action<TContext, TEvent> {
  value: string;
  action: ActionObject<TContext, TEvent> | null;
  actionFn: StateMachine.ActionFunction<TContext, TEvent> | null;
  assignAction: AssignActionObject<TContext, TEvent> | null;

  constructor(
    value: string,
    action: ActionObject<TContext, TEvent> | null,
    actionFn: StateMachine.ActionFunction<TContext, TEvent> | null,
    assignAction: AssignActionObject<TContext, TEvent> | null,
  ) {
    this.value = value;
    this.action = action;
    this.actionFn = actionFn;
    this.assignAction = assignAction;
  }
}

export class Transition<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TStateValue extends string = string
> implements StateMachine.Transition<TContext, TEvent, string>{
  target: TStateValue;
  actions: Array<StateMachine.ActionObject<TContext, TEvent>>;
  guard: string;
  cond: ((context: TContext, event: TEvent) => boolean) | null;

  constructor(
    target: TStateValue,
    actions: Array<StateMachine.ActionObject<TContext, TEvent>>,
    guard: string,
    cond: ((context: TContext, event: TEvent) => boolean) | null,
  ) {
    this.target = target;
    this.actions = actions;
    this.guard = guard;
    this.cond = cond;
  }
}

// @ts-ignore
@serializable
export class TransitionExternal<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TStateValue extends string = string
> {
  name: string;
  target: TStateValue;
  actions: Array<ActionObject<TContext, TEvent>>;
  guard: string;
  cond: ((context: TContext, event: TEvent) => boolean) | null;

  constructor(
    name: string,
    target: TStateValue,
    actions: Array<ActionObject<TContext, TEvent>>,
    guard: string,
    cond: ((context: TContext, event: TEvent) => boolean) | null,
  ) {
    this.name = name;
    this.target = target;
    this.actions = actions;
    this.guard = guard;
    this.cond = cond;
  }
}

export class Config<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
> implements StateMachine.Config<TContext, TEvent, TState>{
  id: string;
  initial: string;
  context: TContext;
  states: States<TContext, TEvent>;

  constructor(
    id: string,
    initial: string,
    context: TContext,
    states: States<TContext, TEvent>,
  ) {
    this.id = id;
    this.initial = initial;
    this.context = context;
    this.states = states;
  }
}

export class StateInfoClass<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
> implements StateInfo<TContext, TEvent> {
  after: StateTimers<TContext, TEvent> | null;
  on: StateInfoEvents<TContext, TEvent>;
  exit: Array<ActionClass<TContext, TEvent>>;
  entry: Array<ActionClass<TContext, TEvent>>;
  initial: string;
  states: States<TContext, TEvent>;

  constructor(
    after: StateTimers<TContext, TEvent> | null,
    on: StateInfoEvents<TContext, TEvent>,
    exit: Array<ActionClass<TContext, TEvent>>,
    entry: Array<ActionClass<TContext, TEvent>>,
    // exit: Array<StateMachine.Action<TContext, TEvent>>,
    // entry: Array<StateMachine.Action<TContext, TEvent>>,
    initial: string,
    childstates: States<TContext, TEvent>,
  ) {
    this.after = after
    this.on = on;
    this.exit = exit;
    this.entry = entry;
    this.initial = initial;
    this.states = childstates;
  }
}

// @ts-ignore
@serializable
export class StateInfoClassExternal<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
> {
  name: string;
  after: Array<TransitionExternal<TContext, TEvent, string>>;
  on: Array<TransitionExternal<TContext, TEvent, string>>;
  exit: Array<ActionClass<TContext, TEvent>>;
  entry: Array<ActionClass<TContext, TEvent>>;
  initial: string;
  states: Array<StateInfoClassExternal<TContext, TEvent>>;

  constructor(
    name: string,
    after: Array<TransitionExternal<TContext, TEvent, string>>,
    on: Array<TransitionExternal<TContext, TEvent, string>>,
    exit: Array<ActionClass<TContext, TEvent>>,
    entry: Array<ActionClass<TContext, TEvent>>,
    initial: string,
    childstates: Array<StateInfoClassExternal<TContext, TEvent>>,
  ) {
    this.name = name;
    this.after = after;
    this.on = on;
    this.exit = exit;
    this.entry = entry;
    this.initial = initial;
    this.states = childstates;
  }

  static fromInternalStatesMap(
    states: States<ContextGeneral<string>,EventObject>,
  ): Array<StateInfoClassExternal<ContextGeneral<string>,EventObject>> {
    const estates: Array<StateInfoClassExternal<ContextGeneral<string>,EventObject>> = [];
    const statesKeys = states.keys();
    for (let i = 0; i < statesKeys.length; i++) {
      const estate = StateInfoClassExternal.fromInternal(states.get(statesKeys[i]), statesKeys[i]);
      estates.push(estate);
    }
    return estates;
  }

  static fromInternal(
    stateInfo: StateInfo<ContextGeneral<string>,EventObject>,
    stateName: string,
  ): StateInfoClassExternal<ContextGeneral<string>,EventObject> {
    const onevents: Array<TransitionExternal<ContextGeneral<string>,EventObject, string>> = [];
    const stateInfoOn = stateInfo.on.keys();
    for (let j = 0; j < stateInfoOn.length; j++) {
        const evInfo = stateInfo.on.get(stateInfoOn[j]);
        const evActions: Array<ActionObject<ContextGeneral<string>,EventObject>> = [];
        for (let k = 0; k < evInfo.actions.length; k++) {
            const actionobj = evInfo.actions[k];
            const _ev = actionobj.event;
            let ev: EventClassExternal | null = null;
            if (_ev !== null) {
              ev = new EventClassExternal(_ev.type, _ev.params);
            }
            evActions.push(new ActionObject<ContextGeneral<string>,EventObject>(actionobj.type, actionobj.params, ev));
        }
        onevents.push(new TransitionExternal<ContextGeneral<string>,EventObject>(
            stateInfoOn[j],
            evInfo.target,
            evActions,
            evInfo.guard,
            null,
        ));
    }
    let afterTimers: Array<TransitionExternal<ContextGeneral<string>,EventObject>> = [];
    const afterT = stateInfo.after;
    if (afterT != null) {
      const keys = afterT.keys();
      for (let i = 0; i < keys.length; i++) {
        const delay = keys[i];
        const delayedTransition = afterT.get(delay);

        const dActions: Array<ActionObject<ContextGeneral<string>,EventObject>> = [];
        for (let k = 0; k < delayedTransition.actions.length; k++) {
            const actionobj = delayedTransition.actions[k];
            const _ev = actionobj.event;
            let ev: EventClassExternal | null = null;
            if (_ev !== null) {
              ev = new EventClassExternal(_ev.type, _ev.params);
            }
            dActions.push(new ActionObject<ContextGeneral<string>,EventObject>(actionobj.type, actionobj.params, ev));
        }

        const afterTimer = new TransitionExternal<ContextGeneral<string>,EventObject>(
          delay,
          delayedTransition.target,
          dActions,
          "",
          null,
        );
        afterTimers.push(afterTimer);
      }
    }
    return new StateInfoClassExternal(
      stateName,
      afterTimers,
      onevents,
      [], // TODO stateInfo.exit
      [], // TODO stateInfo.entry
      stateInfo.initial,
      StateInfoClassExternal.fromInternalStatesMap(stateInfo.states),
    );
  }

  static toInternalFromArray<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
  >(ostates: Array<StateInfoClassExternal<TContext,TEvent>>): States<TContext,TEvent> {
    const states = new Map<string,StateInfo<TContext,TEvent>>();
    for (let i = 0; i < ostates.length; i++) {
      const state = ostates[i].toInternal();
      states.set(ostates[i].name, state);
    }
    return states;
  }

  toInternal(): StateInfo<TContext,TEvent> {
    const stateon: StateInfoEvents<TContext, TEvent> = new Map<string,StateMachine.Transition<TContext, TEvent, string>>();
    for (let j = 0; j < this.on.length; j++) {
        const onev = this.on[j];
        const actions: Array<StateMachine.ActionObject<TContext, TEvent>> = [];
        for (let k = 0; k < onev.actions.length; k++) {
            const action = onev.actions[k];
            actions.push(new ActionObject<TContext, TEvent>(action.type, action.params, action.event));
        }
        stateon.set(onev.name, new Transition<TContext, TEvent, string>(
            onev.target,
            actions,
            onev.guard,
            null,
        ))
    }
    let afterTimers: StateTimers<TContext, TEvent> | null = null;
    if (this.after.length > 0) {
      afterTimers = new Map();
      for (let i = 0; i < this.after.length; i++) {
        const aft = this.after[i];
        const actions: Array<StateMachine.ActionObject<TContext, TEvent>> = [];
        for (let k = 0; k < aft.actions.length; k++) {
            const action = aft.actions[k];
            actions.push(new ActionObject<TContext, TEvent>(action.type, action.params, action.event));
        }
        const transition = new Transition<TContext, TEvent, string>(aft.target, actions, "", null);
        afterTimers.set(aft.name, transition);
      }
    }

    const childstates = StateInfoClassExternal.toInternalFromArray(this.states);
    return new StateInfoClass<TContext, TEvent>(
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

// @ts-ignore
@serializable
export class ConfigExternal<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
> {
  id: string;
  initial: string;
  context: Array<ContextParam>;
  states: Array<StateInfoClassExternal<TContext, TEvent>>;

  constructor(
    id: string,
    initial: string,
    context: Array<ContextParam>,
    states: Array<StateInfoClassExternal<TContext, TEvent>>,
  ) {
    this.id = id;
    this.initial = initial;
    this.context = context;
    this.states = states;
  }
}

// @ts-ignore
@serializable
export class TimerArgs {
  delay: string;
  serviceId: i32;
  state: string;
  constructor(delay: string, serviceId: i32, state: string) {
    this.delay = delay;
    this.serviceId = serviceId;
    this.state = state;
  }
}

// @ts-ignore
@serializable
export class EventualArgs {
  intervalId: i32;
  args: Uint8Array;
  constructor(intervalId: i32, args: Uint8Array) {
    this.intervalId = intervalId;
    this.args = args;
  }
}
