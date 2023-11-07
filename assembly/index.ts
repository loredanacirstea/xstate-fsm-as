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

@external("env", "process.env.NODE_ENV")
declare function nodeEnv(): string

// const INIT_EVENT: InitEvent = { type: 'xstate.init' };
const INIT_EVENT = new InitEvent();
const ASSIGN_ACTION: StateMachine.AssignAction = 'xstate.assign';
const WILDCARD = '*';

function toArray<T>(item: T | null): T[] {
  return item === null ? [] : ([] as T[]).concat(item);
}

export function assign<TC extends object, TE extends EventObject = EventObject>(
  assignment: StateMachine.Assigner<TC, TE>
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

function toActionObjectFromString<TContext extends object, TEvent extends EventObject>(
  action: string,
  actionMap: StateMachine.ActionMap<TContext, TEvent> | null
): StateMachine.ActionObject<TContext, TEvent> {
  action = actionMap && actionMap[action] ? actionMap[action]: null;
  return {
    type: action
  }
}

function toActionObject<TContext extends object, TEvent extends EventObject>(
  action: StateMachine.ActionFunction<TContext, TEvent>,
  actionMap: StateMachine.ActionMap<TContext, TEvent> | null
): StateMachine.ActionObject<TContext, TEvent> {
  return {
    type: action.name,
    exec: action
  }
}

const IS_PRODUCTION = nodeEnv() === 'production';

function createMatcher(value: string): (stateValue: string) => boolean {
  return (stateValue: string) => value === stateValue;
}

function toEventObject<TEvent extends EventObject>(
  eventName: string
): TEvent {
  return ({ type: eventName }) as TEvent;
}

function createUnchangedState<
  TC extends object,
  TE extends EventObject,
  TS extends Typestate<TC>
>(value: string, context: TC): StateMachine.State<TC, TE, TS> {
  return {
    value,
    context,
    actions: [],
    changed: false,
    matches: createMatcher(value)
  };
}

function handleActions<
  TContext extends object,
  TEvent extends EventObject = EventObject
>(
  actions: Array<StateMachine.ActionObject<TContext, TEvent>>,
  context: TContext,
  eventObject: TEvent
): HandledActions<TContext, TEvent> {
  let nextContext = context;
  let assigned = false;

  const nonAssignActions = actions.filter((action) => {
    if (action.type === ASSIGN_ACTION) {
      assigned = true;
      let tmpContext = Object.assign({}, nextContext);

      if (typeof action.assignment === 'function') {
        tmpContext = action.assignment(nextContext, eventObject);
      } else {
        Object.keys(action.assignment).forEach((key) => {
          tmpContext[key] =
            typeof action.assignment[key] === 'function'
              ? action.assignment[key](nextContext, eventObject)
              : action.assignment[key];
        });
      }

      nextContext = tmpContext;
      return false;
    }
    return true;
  });

  return {actions: nonAssignActions, ctx: nextContext, assigned};
}

function toStateFromString<
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = Typestate<TContext>
>(state: string, ctx: TContext): StateMachine.State<TContext, TEvent, TState> {
  return { value: state, context: ctx };
}

export function createMachine<
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = Typestate<TContext>
>(
  fsmConfig: StateMachine.Config<TContext, TEvent, TState>,
  implementations: Implementations<TContext, TEvent> = {actions: []}
): StateMachine.Machine<TContext, TEvent, TState> {
  if (!IS_PRODUCTION) {
    Object.keys(fsmConfig.states).forEach((state) => {
      if (fsmConfig.states[state].states) {
        throw new Error(`Nested finite states not supported.
            Please check the configuration for the "${state}" state.`);
      }
    });
  }

  const res = handleActions(
    fsmConfig.states[fsmConfig.initial].entry.map((action: StateMachine.Action<TContext, TEvent>) =>
      toActionObject(action, implementations.actions)
    ),
    fsmConfig.context!,
    INIT_EVENT as TEvent
  );
  const initialActions = res.actions;
  const initialContext = res.ctx;

  const machine = {
    config: fsmConfig,
    _options: implementations,
    initialState: {
      value: fsmConfig.initial,
      actions: initialActions,
      context: initialContext,
      matches: createMatcher(fsmConfig.initial)
    },
    transition: (
      state:  StateMachine.State<TContext, TEvent, TState>, // string
      event: TEvent
    ): StateMachine.State<TContext, TEvent, TState> => {
      const res =
        typeof state === 'string'
          ? { value: state, context: fsmConfig.context! }
          : state;

      const value = res.value;
      const context = res.context;
      const eventObject = event; // toEventObject<TEvent>(event);
      const stateConfig = fsmConfig.states[value];

      if (!IS_PRODUCTION && !stateConfig) {
        throw new Error(
          `State '${value}' not found on machine ${fsmConfig.id || ''}`
        );
      }

      if (!IS_PRODUCTION && eventObject.type === WILDCARD) {
        throw new Error(
          `An event cannot have the wildcard type ('${WILDCARD}')`
        );
      }

      if (stateConfig.on) {
        const transitions: Array<
          StateMachine.Transition<TContext, TEvent, string>
        > = toArray(stateConfig.on[eventObject.type]);

        if (WILDCARD in stateConfig.on) {
          const _trans = stateConfig.on[WILDCARD];
          for (let i = 0; i < _trans.length; i++) {
            transitions.push(_trans[i]);
          }
        }

        for (const transition of transitions) {
          if (transition === undefined) {
            return createUnchangedState(value, context);
          }

          const res = typeof transition === 'string'
            ? { target: transition }
            : transition;
          const target = res.target;
          const actions = res.actions || [];
          const cond = res.cond || (() => true);

          const isTargetless = target === undefined;

          const nextStateValue = target || value;
          const nextStateConfig = fsmConfig.states[nextStateValue];

          if (!IS_PRODUCTION && !nextStateConfig) {
            throw new Error(
              `State '${nextStateValue}' not found on machine ${
                fsmConfig.id || ''
              }`
            );
          }

          if (cond(context, eventObject)) {
            const allActions = (
              isTargetless
                ? toArray(actions)
                : ([] as any[])
                    .concat(stateConfig.exit, actions, nextStateConfig.entry)
                    .filter((a) => a)
            ).map<StateMachine.ActionObject<TContext, TEvent>>((action) =>
              toActionObject(action, (machine as any)._options.actions)
            );

            const res = handleActions(
              allActions,
              context,
              eventObject
            );
            const nonAssignActions = res.actions;
            const nextContext = res.ctx;
            const assigned = res.assigned;

            const resolvedTarget = target || value;

            return {
              value: resolvedTarget,
              context: nextContext,
              actions: nonAssignActions,
              changed:
                target !== value || nonAssignActions.length > 0 || assigned,
              matches: createMatcher(resolvedTarget)
            };
          }
        }
      }

      // No transitions match
      return createUnchangedState(value, context);
    }
  };
  return machine;
}

function executeStateActions<
  TContext extends object,
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
  TContext extends object,
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
        matches: createMatcher(resolved.value),
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
  TContext extends object,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
>(
  machine: StateMachine.Machine<TContext, TEvent, TState>
): StateMachine.Service<TContext, TEvent, TState> {
  const service = new Service(machine);
  return service;
}
