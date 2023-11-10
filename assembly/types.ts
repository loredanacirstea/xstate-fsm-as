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
}

export class EventClass implements EventObject {
  type: string;

  constructor(type: string) {
    this.type = type;
  }
}

export class InitEvent implements EventObject {
  type: string = 'xstate.init';
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

export interface StateInfo<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
> {
  on: StateInfoEvents<TContext, TEvent>;
  // exit: Array<StateMachine.Action<TContext, TEvent>>;
  // entry: Array<StateMachine.Action<TContext, TEvent>>;
  exit: Array<ActionClass<TContext, TEvent>>;
  entry: Array<ActionClass<TContext, TEvent>>;
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
    params: Array<ActionParam>
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
    cond: ((context: TContext, event: TEvent) => boolean) | null;
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
    config: StateMachine.Config<TContext, TEvent, TState>;
    initialState: State<TContext, TEvent, TState>;
    transition(
      state: State<TContext, TEvent, TState>,
      event: TEvent
    ): State<TContext, TEvent, TState>;
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

  constructor(type: string, params: Array<ActionParam>) {
    this.type = type;
    this.params = params;
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
    super(type, []);
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
  cond: ((context: TContext, event: TEvent) => boolean) | null;

  constructor(
    target: TStateValue,
    actions: Array<StateMachine.ActionObject<TContext, TEvent>>,
    cond: ((context: TContext, event: TEvent) => boolean) | null,
  ) {
    this.target = target;
    this.actions = actions;
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
  cond: ((context: TContext, event: TEvent) => boolean) | null;

  constructor(
    name: string,
    target: TStateValue,
    actions: Array<ActionObject<TContext, TEvent>>,
    cond: ((context: TContext, event: TEvent) => boolean) | null,
  ) {
    this.name = name;
    this.target = target;
    this.actions = actions;
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
  on: StateInfoEvents<TContext, TEvent>;
  exit: Array<ActionClass<TContext, TEvent>>;
  entry: Array<ActionClass<TContext, TEvent>>;

  constructor(
    on: StateInfoEvents<TContext, TEvent>,
    exit: Array<ActionClass<TContext, TEvent>>,
    entry: Array<ActionClass<TContext, TEvent>>,
    // exit: Array<StateMachine.Action<TContext, TEvent>>,
    // entry: Array<StateMachine.Action<TContext, TEvent>>,
  ) {
    this.on = on;
    this.exit = exit;
    this.entry = entry;
  }
}

// @ts-ignore
@serializable
export class StateInfoClassExternal<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
> {
  name: string;
  on: Array<TransitionExternal<TContext, TEvent, string>>;
  exit: Array<ActionClass<TContext, TEvent>>;
  entry: Array<ActionClass<TContext, TEvent>>;

  constructor(
    name: string,
    on: Array<TransitionExternal<TContext, TEvent, string>>,
    exit: Array<ActionClass<TContext, TEvent>>,
    entry: Array<ActionClass<TContext, TEvent>>,
  ) {
    this.name = name;
    this.on = on;
    this.exit = exit;
    this.entry = entry;
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
