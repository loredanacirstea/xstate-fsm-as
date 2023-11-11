import { JSON } from "json-as/assembly";
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
  ActionParam,
  ContextParam,
  StateClass,
  StateClassExternal,
  StateInfoClassExternal,
  TransitionExternal,
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

// export function assign<TC extends object, TE extends EventObject = EventObject>(
//   // assignment: StateMachine.Assigner<TC, TE>
//   assignment: StateMachine.PropertyAssigner<TC, TE>
// ): StateMachine.AssignActionObject<TC, TE> {
//   return {
//     type: ASSIGN_ACTION,
//     assignment
//   };
// }

// export function assign2<TC extends object, TE extends EventObject = EventObject>(
//   assignment: StateMachine.PropertyAssigner<TC, TE>
// ): StateMachine.AssignActionObject<TC, TE> {
//   return {
//     type: ASSIGN_ACTION,
//     assignment
//   };
// }

// function toActionObjectFromString<
//   TContext extends Map<string,string>,
//   TEvent extends EventObject
// >(
//   action: string,
//   actionMap: StateMachine.ActionMap<TContext, TEvent>
// ): StateMachine.ActionObject<TContext, TEvent> {
//   // TODO fixme
//   // const actionfn = (actionMap && actionMap.has(action)) ? actionMap.get(action): null;
//   const actionfn: StateMachine.ActionFunction<TContext, TEvent> | null = null;
//   return new ActionObject<TContext, TEvent>(action, actionfn, actionMap)
// }

// function toActionObject<
//   TContext extends Map<string,string>,
//   TEvent extends EventObject
// >(
//   action: StateMachine.ActionFunction<TContext, TEvent>,
//   actionMap: StateMachine.ActionMap<TContext, TEvent>
// ): ActionObject<TContext, TEvent> {
//   return new ActionObject<TContext, TEvent>(action.name, action, actionMap)
// }

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
  console.log("--handleActions--ctx-" + context.keys().join(","))
  let nextContext = context;
  let assigned = false;
  const nonAssignActions: StateMachine.ActionObject<TContext, TEvent>[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (action.type === ASSIGN_ACTION) {
      assigned = true;
      let tmpContext: TContext = mergeMap<string>(nextContext, new Map());
      console.log("--handleActions--tmpContext-" + tmpContext.keys().join(","))

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
  console.log("--handleActions--nextContext-" + nextContext.keys().join(","))

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
  // const entries = fsmConfig.states.get(fsmConfig.initial).entry;
  const iniactions:  StateMachine.ActionObject<TContext, TEvent>[] = [];
  // for (let i = 0; i < entries.length; i++) {
  //   const action = entries[i];
  //   const actionfn = action.actionFn;
  //   if (actionfn !== null) {
  //     iniactions.push(
  //       toActionObject<TContext, TEvent>(actionfn, implementations.actions)
  //     );
  //   }
  // }
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
  for (let i = 0; i < state.actions.length; i++) {
    const action = state.actions[i];
    // const exec = action.exec;
    // if (exec) {
    //   exec(state.context, event);
    // }
    if (event.type === "increment") {
      const newctx = increment<TContext, TEvent, TState>(state.context, action.params);
      state.context = newctx;
      return;
    }
    if (event.type === "log") {
        const newctx = log<TContext, TEvent, TState>(state.context, action.params);
        state.context = newctx;
    }
    // state.context
    // action.type
    // action.params
  }
}

function increment<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
>(
  ctx: TContext,
  params: ActionParam[],
): TContext {
  for (let i = 0; i < params.length; i++) {
    const value = parseInt(ctx.get(params[i].key), 10) + parseInt(params[i].value, 10);
    let vstr = value.toString(10);
    vstr = vstr.substring(0, vstr.length - 2);
    ctx.set(params[i].key,  vstr);
  }
  return ctx;
}

function log<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
>(
  ctx: TContext,
  params: ActionParam[],
): TContext {
  for (let i = 0; i < params.length; i++) {
    const key = params[i].key;
    const message = params[i].value;
    const value = ctx.get(key);
    console.log(`${key}: ${value} - ${message}`);
  }
  return ctx;
}

export class Service<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
> implements StateMachine.Service<TContext, TEvent, TState> {
  machine: StateMachine.Machine<TContext, TEvent, TState>
  state: StateMachine.State<TContext, TEvent, TState>
  status: InterpreterStatus
  listeners: Set<StateMachine.StateListener<StateMachine.State<TContext, TEvent, TState>>>

  constructor(
    machine: StateMachine.Machine<TContext, TEvent, TState>,
    state: StateMachine.State<TContext, TEvent, TState> | null,
    status: InterpreterStatus,
  ) {
    this.machine = machine;
    this.state = state || machine.initialState;
    this.status = status || InterpreterStatus.NotStarted;
    this.listeners = new Set<StateMachine.StateListener<StateMachine.State<TContext, TEvent, TState>>>();
  }

  send(event: TEvent): void {
    if (this.status !== InterpreterStatus.Running) {
      return;
    }
    this.state = this.machine.transition(this.state, event);
    executeStateActions<TContext, TEvent, TState>(this.state, event);

    const listeners = this.listeners.values();
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](this.state);
    }
  }

  subscribe(listener: StateMachine.StateListener<StateMachine.State<TContext, TEvent, TState>>): UnsubscribeReturnValue {
    this.listeners.add(listener);
    listener(this.state);

    return {
      unsubscribe: () => this.listeners.delete(listener)
    };
  }

  start(): Service<TContext, TEvent, TState> {
    this.status = InterpreterStatus.Running;
    executeStateActions<TContext, TEvent, TState>(this.state, INIT_EVENT);
    return this;
  }

  stop(): Service<TContext, TEvent, TState> {
    this.status = InterpreterStatus.Stopped;
    this.listeners.clear();
    return this;
  }
}

// @ts-ignore
@serializable
export class ServiceExternal<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
> {
  machine: MachineExternal<TContext, TEvent, TState>
  state: StateClassExternal<TContext, TEvent, TState>
  status: InterpreterStatus
  // TODO listeners can be addresses that should be announced about state changes

  constructor(
    machine: MachineExternal<TContext, TEvent, TState>,
    state: StateClassExternal<TContext, TEvent, TState>,
    status: InterpreterStatus,
  ) {
    this.machine = machine;
    this.state = state;
    this.status = status;
  }

  static fromInternal(service: Service<ContextGeneral<string>,EventObject,Typestate<ContextGeneral<string>>>): ServiceExternal<ContextGeneral<string>,EventObject,Typestate<ContextGeneral<string>>> {
    const machine = MachineExternal.fromInternal(service.machine);
    const status = service.status;
    const context: Array<ContextParam> = [];
    const ctxKeys = service.state.context.keys();
    for (let i = 0; i < ctxKeys.length; i++) {
        context.push(new ContextParam(ctxKeys[i], service.state.context.get(ctxKeys[i])));
    }
    const stateactions: Array<ActionObject<ContextGeneral<string>,EventObject>> = [];
    for (let i = 0; i < service.state.actions.length; i++) {
        const act = service.state.actions[i];
        stateactions.push(new ActionObject(act.type, act.params));
    }
    const state = new StateClassExternal<ContextGeneral<string>,EventObject, Typestate<ContextGeneral<string>>>(
        service.state.value,
        context,
        stateactions,
        service.state.changed,
    );
    return new ServiceExternal(machine, state, status);
  }

  toInternal(): Service<TContext, TEvent, TState> {
    const machine = this.machine.toInternal();
    const context: TContext = new Map<string, string>();
    for (let i = 0; i < this.state.context.length; i++) {
        const param = this.state.context[i];
        context.set(param.key, param.value);
    }
    const stateactions: Array<StateMachine.ActionObject<TContext, TEvent>> = [];
    for (let i = 0; i < this.state.actions.length; i++) {
        const act = this.state.actions[i];
        stateactions.push(new ActionObject<TContext, TEvent>(act.type, act.params));
    }
    const state = new StateClass<TContext, TEvent, TState>(
        this.state.value,
        context,
        stateactions,
        this.state.changed,
    )
    const status = this.status;
    return new Service(machine, state, status);
  }
}

// @ts-ignore
@serializable
export class MachineExternal<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>
> {
  config: ConfigExternal<TContext, TEvent, TState>;
  initialState: StateClassExternal<TContext, TEvent, TState>;
//   options: Implementations<TContext, TEvent> // TODO remove

  constructor(
    config: ConfigExternal<TContext, TEvent, TState>,
    initialState: StateClassExternal<TContext, TEvent, TState>,
  ) {
    this.config = config;
    this.initialState = initialState;
  }

  static fromInternal(machine: StateMachine.Machine<ContextGeneral<string>,EventObject, Typestate<ContextGeneral<string>>>): MachineExternal<ContextGeneral<string>,EventObject,Typestate<ContextGeneral<string>>> {
    const ctx: Array<ContextParam> = [];
    const states: Array<StateInfoClassExternal<ContextGeneral<string>,EventObject>> = [];
    const octx = machine.config.context;
    const octxKeys = octx.keys();
    for (let i = 0; i < octxKeys.length; i++) {
        ctx.push(new ContextParam(octxKeys[i], octx.get(octxKeys[i])));
    }
    const ostates = machine.config.states;
    const ostatesKeys = ostates.keys();
    for (let i = 0; i < ostatesKeys.length; i++) {
        const onevents: Array<TransitionExternal<ContextGeneral<string>,EventObject, string>> = [];
        const stateInfo = ostates.get(ostatesKeys[i]);
        const stateInfoOn = stateInfo.on.keys();
        for (let j = 0; j < stateInfoOn.length; j++) {
            const evInfo = stateInfo.on.get(stateInfoOn[j]);
            const evActions: Array<ActionObject<ContextGeneral<string>,EventObject>> = [];
            for (let k = 0; k < evInfo.actions.length; k++) {
                const actionobj = evInfo.actions[k];
                evActions.push(new ActionObject(actionobj.type, actionobj.params));
            }
            onevents.push(new TransitionExternal(
                stateInfoOn[j],
                evInfo.target,
                evActions,
                null,
            ));
        }
        states.push(new StateInfoClassExternal(
            ostatesKeys[i],
            onevents,
            [], // TODO stateInfo.exit
            [], // TODO stateInfo.entry
        ));
    }

    const config = new ConfigExternal<ContextGeneral<string>,EventObject, Typestate<ContextGeneral<string>>>(
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
    const iniactions: Array<ActionObject<ContextGeneral<string>,EventObject>> = [];
    for (let i = 0; i < machine.initialState.actions.length; i++) {
        const act = machine.initialState.actions[i];
        iniactions.push(new ActionObject(act.type, act.params));
    }

    const initialState = new StateClassExternal<ContextGeneral<string>,EventObject, Typestate<ContextGeneral<string>>>(
        machine.initialState.value,
        context,
        iniactions,
        machine.initialState.changed,
    );

    // machine.initialState;
    return new MachineExternal<ContextGeneral<string>,EventObject, Typestate<ContextGeneral<string>>>(config, initialState);
  }

  toInternal(): Machine<TContext, TEvent, TState> {
    const context: TContext = new Map<string,string>();
    const states = new Map<string,StateInfo<TContext, TEvent>>();
    const ctxpairs = this.config.context;
    for (let i = 0; i < ctxpairs.length; i++) {
        context.set(ctxpairs[i].key, ctxpairs[i].value);
    }
    const ostates = this.config.states;
    for (let i = 0; i < ostates.length; i++) {
        const stateon: StateInfoEvents<TContext, TEvent> = new Map<string,StateMachine.Transition<TContext, TEvent, string>>();
        for (let j = 0; j < ostates[i].on.length; j++) {
            const onev = ostates[i].on[j];
            const actions: Array<StateMachine.ActionObject<TContext, TEvent>> = [];
            for (let k = 0; k < onev.actions.length; k++) {
                const action = onev.actions[k];
                actions.push(new ActionObject<TContext, TEvent>(action.type, action.params));
            }
            stateon.set(onev.name, new Transition<TContext, TEvent, string>(
                onev.target,
                actions,
                null,
            ))
        }
        const state = new StateInfoClass<TContext, TEvent>(
            stateon,
            ostates[i].exit,
            ostates[i].entry,
        )
        states.set(ostates[i].name, state);
    }
    const config = new Config<TContext, TEvent, TState>(
        this.config.id,
        this.config.initial,
        context,
        states,
    )
    const inictx: TContext = new Map<string,string>();
    const _inictx = this.initialState.context;
    for (let i = 0; i < _inictx.length; i++) {
        inictx.set(_inictx[i].key, _inictx[i].value);
    }
    const iniactions: Array<StateMachine.ActionObject<TContext, TEvent>> = [];
    for (let i = 0; i < this.initialState.actions.length; i++) {
        const act = this.initialState.actions[i];
        iniactions.push(new ActionObject<TContext, TEvent>(act.type, act.params));
    }
    const initialState = new StateClass<TContext, TEvent, TState>(
        this.initialState.value,
        inictx,
        iniactions,
        this.initialState.changed,
    );
    return new Machine<TContext, TEvent, TState>(config, initialState);
  }
}

// Define a Map for services
class ServiceMap<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
> {
  counter: i32 = 0;
  private _keys: i32[] = [];
  private _values: Service<TContext, TEvent, TState>[] = [];

  set(value: Service<TContext, TEvent, TState>): i32 {
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

  get(key: i32): Service<TContext, TEvent, TState> | null {
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
    console.log("--eventObject.type--" + eventObject.type);

    if (stateConfig.on) {
      if (!stateConfig.on.has(eventObject.type)) {
        wasmx.revert(String.UTF8.encode("cannot apply event in current state"));
        throw new Error("cannot apply event in current state")
      }
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
          let allActions: StateMachine.ActionObject<TContext, TEvent>[] = [];
          if (!isTargetless) {
            // for (let i = 0; i < stateConfig.exit.length; i++) {
            //   allActions.push(stateConfig.exit[i]);
            // }
            for (let i = 0; i < actions.length; i++) {
              allActions.push(actions[i]);
            }
            // for (let i = 0; i < stateConfig.exit.length; i++) {
            //   allActions.push(nextStateConfig.entry[i]);
            // }
            // allActions = allActions.concat(stateConfig.exit);
            // allActions = allActions.concat(nextStateConfig.entry);
          }

          // const allActionObjects: StateMachine.ActionObject<TContext, TEvent>[] = [];

          // for (let i = 0; i < allActions.length; i++) {
          //   const action = allActions[i];
          //   const actionFn = action.actionFn;
          //   if (actionFn) {
          //     const obj = toActionObject<TContext, TEvent>(actionFn, this.options.actions);
          //     allActionObjects.push(obj);
          //   }
          //   const obj = toActionObjectFromString<TContext, TEvent>(action.value, this.options.actions);
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

const map = new ServiceMap<ContextGeneral<string>,EventObject,Typestate<ContextGeneral<string>>>();

export function create(
  _fsmConfig: ArrayBuffer,
  _implementations: ArrayBuffer,
): ArrayBuffer {
  const fsmConfigStr = String.UTF8.decode(_fsmConfig);
  console.log(fsmConfigStr);

  const fsmConfigExternal = JSON.parse<ConfigExternal<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>>(fsmConfigStr);

  let implementations = new Implementations<ContextGeneral<string>, EventObject>();
  // if (_implementations.byteLength > 0) {
  //   const implementationsStr = String.UTF8.decode(_implementations);
  //   console.log(implementationsStr);
  //   implementations = JSON.parse<Implementations<ContextGeneral<string>, EventObject>>(implementationsStr);
  // }

  return createInternal(fsmConfigExternal, implementations)
}

export function createInternal<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>
>(
    fsmConfigExternal: ConfigExternal<TContext, TEvent, TState>,
    implementations: Implementations<TContext, TEvent> | null,
): ArrayBuffer {
    if (!implementations) {
        implementations = new Implementations<ContextGeneral<string>, EventObject>();
    }
  const ctx = new Map<string, string>();
  const states: Map<string, StateInfo<ContextGeneral<string>, EventObject>> = new Map();
  for (let i = 0; i < fsmConfigExternal.states.length; i++) {
    const state = fsmConfigExternal.states[i];
    const stateOn: StateInfoEvents<ContextGeneral<string>, EventObject> = new Map<string,StateMachine.Transition<ContextGeneral<string>, EventObject, string>>();
    for (let j = 0; j < state.on.length; j++) {
      const onobj = state.on[j];
      console.log("----onobj--" + state.name);
      const onobjActions: StateMachine.ActionObject<ContextGeneral<string>, EventObject>[] = [];
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

  console.log("----config3-" + fsmConfigExternal.context.length.toString());

  for (let i = 0; i < fsmConfigExternal.context.length; i++) {
    const param = fsmConfigExternal.context[i];
    ctx.set(param.key, param.value);
  }

  const fsmConfig = new Config<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>(
    fsmConfigExternal.id,
    fsmConfigExternal.initial,
    ctx,
    states,
  )

  // const fsmConfig = JSON.parse<StateMachine.Config<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>>(fsmConfigStr);

  // let implementations: Implementations<ContextGeneral<string>, EventObject> = {actions: new ActionMap()};
  // let implementations: Implementations<ContextGeneral<string>, EventObject> = {actions: new Map<string, string>()};

  const machine = _createMachine<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>(fsmConfig, implementations);

  console.log("--_createMachine--end--")

  const service = new Service<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>(machine, null , InterpreterStatus.NotStarted);

  service.start();

  console.log("--_createMachine--service started--")

  // TODO extract context from service


//   const fsmConfigStr = JSON.stringify<ConfigExternal<TContext, TEvent, TState>>(fsmConfigExternal);
    const serviceJson = ServiceExternal.fromInternal(service);
    const data = JSON.stringify<ServiceExternal<TContext, TEvent, TState>>(serviceJson);

    console.log("--_createMachine--data-- " + data);

  // store service context
    const id = wasmxwrap.createService(data);
    console.log("--_createMachine--id-- " + id.toString());
  return String.UTF8.encode(`{"id":${id}}`);
}

export function getCurrentState(id: i32): ArrayBuffer {
  const service = loadServiceFromId<ContextGeneral<string>,EventObject,Typestate<ContextGeneral<string>>>(id);
  console.log("-getCurrentState-service-loaded-")
  if (!service) {
    wasmx.revert(String.UTF8.encode("no service"));
    throw new Error("no service");
  }
  return String.UTF8.encode(service.state.value);
}

export function getContextValue(id: i32, keyBuf: ArrayBuffer): ArrayBuffer {
  const key = String.UTF8.decode(keyBuf);
  return getContextValueInternal(id, key);
}

export function getContextValueInternal(id: i32, key: string): ArrayBuffer {
    const service = loadServiceFromId<ContextGeneral<string>,EventObject,Typestate<ContextGeneral<string>>>(id);
    if (!service) {
        wasmx.revert(String.UTF8.encode("no service"));
        throw new Error("no service");
    }
    const ctx = service.state.context;
    if (!ctx) {
        wasmx.revert(String.UTF8.encode("no ctx"));
        throw new Error("no ctx");
    }
    console.log("--getContext--" + ctx.keys().join(","));
    return String.UTF8.encode(ctx.get(key));
}

// TODO remove this
export function transition(id: i32, stateValueBuf: ArrayBuffer, eventNameBuf: ArrayBuffer): ArrayBuffer {
  const service = loadServiceFromId<ContextGeneral<string>,EventObject,Typestate<ContextGeneral<string>>>(id);
  if (!service) {
    wasmx.revert(String.UTF8.encode("no service"));
    throw new Error("no service");
  }

  const stateValue = String.UTF8.decode(stateValueBuf);
  const eventName = String.UTF8.decode(eventNameBuf);
  console.log("----transition--" + stateValue + " - " + eventName);
  const state = new State<ContextGeneral<string>, EventObject, Typestate<ContextGeneral<string>>>(stateValue, service.machine.config.context, [], false);
  const event: EventObject = new EventClass(eventName);
  const nextState = service.machine.transition(state, event);
  console.log("----nextState-" + nextState.value)
  return String.UTF8.encode(nextState.value);
}

export function run(
  id: i32,
  eventNameBuf: ArrayBuffer,
): void {
  const eventName = String.UTF8.decode(eventNameBuf);
  runInternal(id, eventName);
}

export function runInternal(id: i32, eventName: string): ArrayBuffer {
    const service = loadServiceFromId<ContextGeneral<string>,EventObject,Typestate<ContextGeneral<string>>>(id);
    if (!service) {
        wasmx.revert(String.UTF8.encode("no service"));
        throw new Error("no service");
    }
    console.log("--run--transition--" + eventName);
    const event: EventObject = new EventClass(eventName);
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

export function saveService<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>,
> (id: i32, service: Service<TContext, TEvent, TState>): void {
    const serviceJson = ServiceExternal.fromInternal(service);
    const data = JSON.stringify<ServiceExternal<TContext, TEvent, TState>>(serviceJson);
    wasmxwrap.storeService(id, data);
}

export function loadServiceFromId<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>,
> (id: i32): Service<TContext, TEvent, TState> {
    const serviceData = wasmxwrap.loadService(id);
    const service = JSON.parse<ServiceExternal<TContext, TEvent, TState>>(serviceData);
    return service.toInternal();
}
