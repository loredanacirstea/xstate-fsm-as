import { JSON } from "json-as/assembly";
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
  Implementations,
  UnsubscribeReturnValue,
  ContextGeneral,
  ActionObject,
  State,
  Config,
  ConfigExternal,
  StateInfo,
  StateInfoClass,
  StateInfoEvents,
  Transition,
  EventClass,
  // ActionMap,
} from './types';

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

// @external("env", "process.env.NODE_ENV")
// declare function nodeEnv(): string

function nodeEnv(): string {
  return "PRODUCTION";
}

// const INIT_EVENT: InitEvent = { type: 'xstate.init' };
const INIT_EVENT = new InitEvent();
const ASSIGN_ACTION: StateMachine.AssignAction = 'xstate.assign';
const WILDCARD = '*';

function toArray<T>(item: T | null): T[] {
  return item === null ? [] : ([] as T[]).concat(item);
}

export function assign<TC extends object, TE extends EventObject = EventObject>(
  // assignment: StateMachine.Assigner<TC, TE>
  assignment: StateMachine.PropertyAssigner<TC, TE>
): StateMachine.AssignActionObject<TC, TE> {
  return {
    type: ASSIGN_ACTION,
    assignment
  };
}

export function assign2<TC extends object, TE extends EventObject = EventObject>(
  assignment: StateMachine.PropertyAssigner<TC, TE>
): StateMachine.AssignActionObject<TC, TE> {
  return {
    type: ASSIGN_ACTION,
    assignment
  };
}

function toActionObjectFromString<
  TContext extends Map<string,string>,
  TEvent extends EventObject
>(
  action: string,
  actionMap: StateMachine.ActionMap<TContext, TEvent>
): StateMachine.ActionObject<TContext, TEvent> {
  // TODO fixme
  // const actionfn = (actionMap && actionMap.has(action)) ? actionMap.get(action): null;
  const actionfn: StateMachine.ActionFunction<TContext, TEvent> | null = null;
  return new ActionObject<TContext, TEvent>(action, actionfn, actionMap)
}

function toActionObject<
  TContext extends Map<string,string>,
  TEvent extends EventObject
>(
  action: StateMachine.ActionFunction<TContext, TEvent>,
  actionMap: StateMachine.ActionMap<TContext, TEvent>
): ActionObject<TContext, TEvent> {
  return new ActionObject<TContext, TEvent>(action.name, action, actionMap)
}

const IS_PRODUCTION = nodeEnv() === 'production';

// function createMatcher(value: string): (stateValue: string) => boolean {
//   return (stateValue: string) => value === stateValue;
// }

function toEventObject<TEvent extends EventObject>(
  eventName: string
): TEvent {
  return ({ type: eventName }) as TEvent;
}

function createUnchangedState<
  TC extends Map<string,string>,
  TE extends EventObject,
  TS extends Typestate<TC>
>(value: string, context: TC): StateMachine.State<TC, TE, TS> {
  return new State<TC, TE, TS>(value, context, [], false);
  // matches: createMatcher(value)
}

function handleActions<
  TContext extends Map<string,string>,
  TEvent extends EventObject = EventObject
>(
  actions: Array<StateMachine.ActionObject<TContext, TEvent>>,
  context: TContext,
  eventObject: TEvent
): HandledActions<TContext, TEvent> {
  let nextContext = context;
  let assigned = false;
  const nonAssignActions: StateMachine.ActionObject<TContext, TEvent>[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (action.type === ASSIGN_ACTION) {
      assigned = true;
      let tmpContext: TContext = mergeMap<string>(nextContext, new Map());

      const aassign = action.assignment;

      // TODO
      if (action.assignmentFn) {
        // tmpContext = action.assignmentFn(nextContext, eventObject);
      } else if (aassign) {
        const keys = aassign.keys();
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const value = aassign.get(key);
          tmpContext.set(key, value);
        }
        // aassign.keys().forEach((key: string) => {
          // const value = typeof assign.get(key) === 'function'
          //     ? assign.get(key)(nextContext, eventObject)
          //     : assign.get(key);
        //   const value = aassign.get(key);
        //   tmpContext.set(key, value);
        // });
      }

      nextContext = tmpContext;
      // return false;
      continue;
    }
    // return true;
    nonAssignActions.push(action);
  }

  // return {actions: nonAssignActions, ctx: nextContext, assigned};
  return new HandledActions(nonAssignActions, nextContext, assigned);
}

function toStateFromString<
  TContext extends Map<string,string>,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = Typestate<TContext>
>(state: string, ctx: TContext): StateMachine.State<TContext, TEvent, TState> {
  return { value: state, context: ctx };
}

function _createMachine<
  TContext extends Map<string,string>,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = Typestate<TContext>
>(
  // fsmConfig: StateMachine.Config<TContext, TEvent, TState>,
  fsmConfig: Config<TContext, TEvent, TState>,
  implementations: Implementations<TContext, TEvent>
): Machine<TContext, TEvent, TState> {
  const entries = fsmConfig.states.get(fsmConfig.initial).entry;
  const iniactions:  StateMachine.ActionObject<TContext, TEvent>[] = [];
  for (let i = 0; i < entries.length; i++) {
    const action = entries[i];
    const actionfn = action.actionFn;
    if (actionfn !== null) {
      iniactions.push(
        toActionObject<TContext, TEvent>(actionfn, implementations.actions)
      );
    }
  }
  const res = handleActions(
    // iniactions.map((action: StateMachine.Action<TContext, TEvent>) => {
    //   // return toActionObject(action, implementations.actions)
    //   return toActionObject(action.actionFn, implementations.actions)
    // }
    // ),
    iniactions,
    fsmConfig.context,
    INIT_EVENT as TEvent
  );
  const initialActions = res.actions;
  const initialContext = res.ctx;

  // const initialState: StateMachine.State<TContext, TEvent, TState> = {
  //   value: fsmConfig.initial,
  //   actions: initialActions,
  //   context: initialContext,
  //   matches: createMatcher(fsmConfig.initial),
  //   changed: false,
  // }
  const initialState = new State<TContext, TEvent, TState>(fsmConfig.initial, initialContext, initialActions, false);

  const machine = new Machine<TContext, TEvent, TState>(fsmConfig, initialState)


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

function executeStateActions<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
>(
  state: StateMachine.State<TContext, TEvent, TState>,
  event: TEvent
): void {
  state.actions.forEach((action: StateMachine.ActionObject<TContext, TEvent>) => {
    const exec = action.exec;
    exec && exec(state.context, event)
  });
}


export class Service<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
> implements StateMachine.Service<TContext, TEvent, TState> {
  _machine: StateMachine.Machine<TContext, TEvent, TState>
  state: StateMachine.State<TContext, TEvent, TState>
  status: InterpreterStatus
  listeners: Set<StateMachine.StateListener<StateMachine.State<TContext, TEvent, TState>>>

  constructor(
    machine: StateMachine.Machine<TContext, TEvent, TState>,
  ) {
    this._machine = machine;
    this.state = machine.initialState;;
    this.status = InterpreterStatus.NotStarted;
    this.listeners = new Set<StateMachine.StateListener<StateMachine.State<TContext, TEvent, TState>>>();
  }

  send(event: TEvent): void {
    if (this.status !== InterpreterStatus.Running) {
      return;
    }
    this.state = this._machine.transition(this.state, event);
    executeStateActions(this.state, event);
    this.listeners.values().forEach((listener: StateMachine.StateListener<StateMachine.State<TContext, TEvent, TState>>) => listener(this.state));
  }

  subscribe(listener: StateMachine.StateListener<StateMachine.State<TContext, TEvent, TState>>): UnsubscribeReturnValue {
    this.listeners.add(listener);
    listener(this.state);

    return {
      unsubscribe: () => this.listeners.delete(listener)
    };
  }

  start(
    initialState: TState | null,
  ): Service<TContext, TEvent, TState> {
    if (initialState) {
      const resolved =
        typeof initialState === 'object'
          ? initialState
          : { context: this._machine.config.context!, value: initialState };
      this.state = {
        value: resolved.value,
        actions: [],
        context: resolved.context,
        // matches: createMatcher(resolved.value),
        changed: false,
      };

      if (!IS_PRODUCTION) {
        if (!(this.state.value in this._machine.config.states)) {
          throw new Error(
            `Cannot start service in state '${
              this.state.value
            }'. The state is not found on machine${
              this._machine.config.id ? ` '${this._machine.config.id}'` : ''
            }.`
          );
        }
      }
    } else {
      this.state = this._machine.initialState;
    }
    this.status = InterpreterStatus.Running;
    executeStateActions(this.state, INIT_EVENT);
    return this;
  }

  stop(): Service<TContext, TEvent, TState> {
    this.status = InterpreterStatus.Stopped;
    this.listeners.clear();
    return this;
  }
}

export function interpret<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
>(
  machine: StateMachine.Machine<TContext, TEvent, TState>
): StateMachine.Service<TContext, TEvent, TState> {
  const service = new Service(machine);
  return service;
}


// Define a Map with number keys and GenericValue<T> values
class MachinesMap<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
> {
  counter: i32 = 0;
  private _keys: i32[] = [];
  private _values: StateMachine.Machine<TContext, TEvent, TState>[] = [];

  set(value: StateMachine.Machine<TContext, TEvent, TState>): i32 {
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

  get(key: i32): StateMachine.Machine<TContext, TEvent, TState> | null {
    const index = this._keys.indexOf(key);
    if (index > -1) {
      return this._values[index];
    }
    return null;
  }
}


export class Machine<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>
> implements StateMachine.Machine<TContext, TEvent, TState> {
  config: StateMachine.Config<TContext, TEvent, TState>;
  initialState: StateMachine.State<TContext, TEvent, TState>;
  options: Implementations<TContext, TEvent>

  constructor(
    config: StateMachine.Config<TContext, TEvent, TState>,
    initialState: StateMachine.State<TContext, TEvent, TState>,
  ) {
    this.config = config;
    this.initialState = initialState;
    this.options = new Implementations();
  }

  transition(
    state: StateMachine.State<TContext, TEvent, TState>,
    event: TEvent
  ): StateMachine.State<TContext, TEvent, TState> {
    const value = state.value;
    const context = state.context;
    const eventObject = event;
    console.log("----transition-config.states-" + this.config.states.keys().join(","));
    const stateConfig = this.config.states.get(value);
    console.log("----transition-stateConfig-" + stateConfig.on.keys().join(","));

    if (!IS_PRODUCTION && !stateConfig) {
      throw new Error(
        `State '${value}' not found on machine ${this.config.id || ''}`
      );
    }

    if (!IS_PRODUCTION && eventObject.type === WILDCARD) {
      throw new Error(
        `An event cannot have the wildcard type ('${WILDCARD}')`
      );
    }

    if (stateConfig.on) {
      const transition = stateConfig.on.get(eventObject.type);
      console.log("----transition-target--" + transition.target)
      const transitions: Array<
        StateMachine.Transition<TContext, TEvent, string>
      > = [transition];

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
          return createUnchangedState<TContext, TEvent, TState>(value, context);
        }
        const target = transition.target;
        const actions = transition.actions || [];
        const cond = transition.cond || (() => true);

        const isTargetless = target === null;

        const nextStateValue = target || value;
        console.log("----transition-nextStateValue--" + nextStateValue)
        const nextStateConfig = this.config.states.get(nextStateValue);

        console.log("----transition-nextStateConfig--" + nextStateConfig.on.keys().join(","))

        if (!IS_PRODUCTION && !nextStateConfig) {
          throw new Error(
            `State '${nextStateValue}' not found on machine ${
              this.config.id || ''
            }`
          );
        }
        console.log("----transition-cond--" + cond.toString())
        if (cond(context, eventObject)) {
          // const allActions: StateMachine.Action<TContext, TEvent>[] = (
          //   isTargetless
          //     ? actions
          //     : stateConfig.exit
          //         .concat(actions)
          //         .concat(nextStateConfig.entry)
          //         // .filter((a) => a)
          // )
          let allActions: StateMachine.Action<TContext, TEvent>[] = [];
          if (!isTargetless) {
            for (let i = 0; i < stateConfig.exit.length; i++) {
              allActions.push(stateConfig.exit[i]);
            }
            for (let i = 0; i < actions.length; i++) {
              allActions.push(actions[i]);
            }
            for (let i = 0; i < stateConfig.exit.length; i++) {
              allActions.push(nextStateConfig.entry[i]);
            }
            // allActions = allActions.concat(stateConfig.exit);
            // allActions = allActions.concat(nextStateConfig.entry);
          }

          const allActionObjects: StateMachine.ActionObject<TContext, TEvent>[] = [];

          for (let i = 0; i < allActions.length; i++) {
            const action = allActions[i];
            const actionFn = action.actionFn;
            if (actionFn) {
              const obj = toActionObject<TContext, TEvent>(actionFn, this.options.actions);
              allActionObjects.push(obj);
            }
            const obj = toActionObjectFromString<TContext, TEvent>(action.value, this.options.actions);
            allActionObjects.push(obj);
          }

          const res = handleActions(
            allActionObjects,
            context,
            eventObject
          );
          const nonAssignActions = res.actions;
          const nextContext = res.ctx;
          const assigned = res.assigned;

          const resolvedTarget = target || value;
          console.log("----resolvedTarget-" + resolvedTarget)

          return new State<TContext, TEvent, TState>(resolvedTarget, nextContext, nonAssignActions, target !== value || nonAssignActions.length > 0 || assigned);
          // matches: createMatcher(resolvedTarget)
        }
      }
    }

    // No transitions match
    return createUnchangedState<TContext, TEvent, TState>(value, context);
  }
}

const map = new MachinesMap<ContextGeneral<string>,EventObject,Typestate<ContextGeneral<string>>>();

export function createMachine(
  _fsmConfig: ArrayBuffer,
  _implementations: ArrayBuffer,
): i32 {
  const fsmConfigStr = String.UTF8.decode(_fsmConfig);
  console.log(fsmConfigStr);

  const fsmConfigExternal = JSON.parse<ConfigExternal<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>>(fsmConfigStr);

  console.log("----config2");

  const ctx = new Map<string, string>();
  const states: Map<string, StateInfo<ContextGeneral<string>, EventObject>> = new Map();
  for (let i = 0; i < fsmConfigExternal.states.length; i++) {
    const state = fsmConfigExternal.states[i];
    const stateOn: StateInfoEvents<ContextGeneral<string>, EventObject> = new Map<string,StateMachine.Transition<ContextGeneral<string>, EventObject, string>>();
    for (let j = 0; j < state.on.length; j++) {
      const onobj = state.on[j];
      console.log("----onobj--" + state.name);
      const onobjActions: StateMachine.Action<ContextGeneral<string>, EventObject>[] = [];
      if (onobj.actions) {
        for (let x = 0; x < onobj.actions.length; x++) {
          const act = onobj.actions[x];
          onobjActions.push(act);
        }
      }
      stateOn.set(onobj.name, new Transition<ContextGeneral<string>, EventObject>(onobj.target, onobjActions, onobj.cond));
    }
    states.set(state.name, new StateInfoClass<ContextGeneral<string>, EventObject>(stateOn, state.exit, state.entry));
  }

  console.log("----config3");

  const fsmConfig = new Config<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>(
    fsmConfigExternal.id,
    fsmConfigExternal.initial,
    ctx,
    states,
  )

  // const fsmConfig = JSON.parse<StateMachine.Config<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>>(fsmConfigStr);

  // let implementations: Implementations<ContextGeneral<string>, EventObject> = {actions: new ActionMap()};
  // let implementations: Implementations<ContextGeneral<string>, EventObject> = {actions: new Map<string, string>()};

  let implementations = new Implementations<ContextGeneral<string>, EventObject>();
  // if (_implementations.byteLength > 0) {
  //   const implementationsStr = String.UTF8.decode(_implementations);
  //   console.log(implementationsStr);
  //   implementations = JSON.parse<Implementations<ContextGeneral<string>, EventObject>>(implementationsStr);
  // }

  const machine = _createMachine<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>(fsmConfig, implementations);
  return map.set(machine);
}

export function getCurrentState(id: i32, keyBuf: ArrayBuffer): ArrayBuffer {
  const machine = map.get(id);
  if (!machine) return String.UTF8.encode("no machine");
  const ctx = machine.config.context;
  if (!ctx) return String.UTF8.encode("no ctx");
  const key = String.UTF8.decode(keyBuf);
  return String.UTF8.encode(ctx.get(key));
}

export function transition(id: i32, stateValueBuf: ArrayBuffer, eventNameBuf: ArrayBuffer): ArrayBuffer {
  const machine = map.get(id);
  if (!machine) return String.UTF8.encode("no machine");

  const stateValue = String.UTF8.decode(stateValueBuf);
  const eventName = String.UTF8.decode(eventNameBuf);
  console.log("----transition--" + stateValue + " - " + eventName);
  const state = new State<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>(stateValue, machine.config.context, [], false);
  const event: EventObject = new EventClass(eventName);
  const nextState = machine.transition(state, event);
  console.log("----nextState-" + nextState.value)
  return String.UTF8.encode(nextState.value);
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
