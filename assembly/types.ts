export enum InterpreterStatus {
  NotStarted = 0,
  Running = 1,
  Stopped = 2
}

export interface EventObject {
  type: string;
}

export class InitEvent {
  type: string = 'xstate.init';
}

export interface ContextGeneral {
  [key: string]: any;
}

export interface StateInfoEvents<
TContext extends object,
TEvent extends EventObject,
> {
  [key: string]: Array<StateMachine.Transition<TContext, TEvent, string>>;
}

export interface StateInfo<
  TContext extends object,
  TEvent extends EventObject,
> {
  on: StateInfoEvents<TContext, TEvent>;
  exit: Array<StateMachine.Action<TContext, TEvent>>;
  entry: Array<StateMachine.Action<TContext, TEvent>>;
}

export interface States<
TContext extends object,
TEvent extends EventObject,
> {
  [key: string]: StateInfo<TContext, TEvent>;
}

export namespace StateMachine {
  export interface Action<TContext extends object, TEvent extends EventObject> {
    value: string;
    action: ActionObject<TContext, TEvent> | null;
    actionFn: ActionFunction<TContext, TEvent> | null;
    assignAction: AssignActionObject<TContext, TEvent> | null;
  }

  export type ActionMap<
    TContext extends object,
    TEvent extends EventObject
  > = Record<string, Exclude<Action<TContext, TEvent>, string>>;

  export interface ActionObject<
    TContext extends object,
    TEvent extends EventObject
  > {
    type: string;
    exec: ActionFunction<TContext, TEvent> | null;
    [key: string]: any;
  }

  export type ActionFunction<
    TContext extends object,
    TEvent extends EventObject
  > = (context: TContext, event: TEvent) => void;

  export type AssignAction = 'xstate.assign';

  export interface AssignActionObject<
    TContext extends object,
    TEvent extends EventObject
  > extends ActionObject<TContext, TEvent> {
    type: AssignAction;
    assignment: PropertyAssigner<TContext> | null;
    assignmentFn: PropertyAssignerFn<TContext, TEvent> | null;
  }

  export interface Transition<
    TContext extends object,
    TEvent extends EventObject,
    TStateValue extends string = string
  > {
    target: TStateValue;
    actions: Array<Action<TContext, TEvent>>;
    cond: (context: TContext, event: TEvent) => boolean;
  }

  export interface State<
    TContext extends object,
    TEvent extends EventObject,
    TState extends Typestate<TContext>
  > {
    value: string;
    context: TContext;
    actions: Array<ActionObject<TContext, TEvent>>;
    changed: boolean;
    matches: (value: string) => (stateValue: string) => boolean;
  }

  export type AnyMachine = StateMachine.Machine<any, any, any>;

  export type AnyService = StateMachine.Service<any, any, any>;

  export type AnyState = State<any, any, any>;

  export interface Config<
    TContext extends object,
    TEvent extends EventObject,
    TState extends Typestate<TContext> = Typestate<TContext>
  > {
    id: string;
    initial: string;
    context: TContext | null;
    states: States<TContext, TEvent>;
  }

  export interface Machine<
    TContext extends object,
    TEvent extends EventObject,
    TState extends Typestate<TContext>
  > {
    config: StateMachine.Config<TContext, TEvent, TState>;
    initialState: State<TContext, TEvent, TState>;
    transition: (
      state: State<TContext, TEvent, TState>,
      event: TEvent
    ) => State<TContext, TEvent, TState>;
  }

  export type StateListener<T extends AnyState> = (state: T) => void;

  export interface Service<
    TContext extends object,
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

  // export type Assigner<TContext extends object, TEvent extends EventObject> = (
  //   context: TContext,
  //   event: TEvent
  // ) => Partial<TContext>;

  export type PropertyAssigner<
    TContext extends object,
    ValueType,
  > = Map<string, ValueType>

  export type PropertyAssignerFn<
    TContext extends object,
    TEvent extends EventObject,
    ValueType,
  > = Map<string,((context: TContext, event: TEvent) => ValueType)>
}

export interface Typestate<TContext extends object> {
  value: string;
  context: TContext;
}

// export type ExtractEvent<
//   TEvent extends EventObject,
//   TEventType extends string
// > = TEvent extends { type: TEventType } ? TEvent : never;

export interface HandledActions<
  TContext extends object,
  TEvent extends EventObject = EventObject
> {
  actions: Array<StateMachine.ActionObject<TContext, TEvent>>;
  ctx: TContext;
  assigned: boolean;
}

export interface Implementations<
  TContext extends object,
  TEvent extends EventObject
> {
  actions: StateMachine.ActionMap<TContext, TEvent>;
}

export interface UnsubscribeReturnValue {
  unsubscribe: () => void;
}
