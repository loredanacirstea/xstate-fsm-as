export function parseMachine(origConfig) {
    origConfig.context = origConfig.context || {};
    const newConfig = {
        ...origConfig,
        context: Object.keys(origConfig.context).map(key => {
            return {key: key, value: origConfig.context[key]};
        }),
        states: parseMachineStates(origConfig.states),
    };
    return newConfig;
}

function parseMachineStates(configStates = {}) {
    return Object.keys(configStates).map(key => {
        const state = configStates[key];
        let _stateon = state.on || {};
        const stateon = Object.keys(_stateon).map(eventName => {
            const ev = _stateon[eventName];
            const actions = parseActions(ev.actions);
            return {
                name: eventName || "",
                target: ev.target || "",
                guard: ev.guard || "",
                actions,
            }
        })

        let _stateafter = state.after || {};
        const stateafter = Object.keys(_stateafter).map(delayKey => {
            const ev = _stateafter[delayKey];
            const actions = parseActions(ev.actions);
            return {
                name: delayKey || "",
                target: ev.target || "",
                guard: ev.guard || "",
                actions,
            }
        })

        const entryActions = parseActions(state.entry);
        const exitActions = parseActions(state.exit);

        return {
            name: key,
            after: stateafter,
            on: stateon,
            exit: entryActions,
            entry: exitActions,
            initial: state.initial || "",
            states: state.states ? parseMachineStates(state.states) : [],
        }
    })
}

// object or array
function parseActions(oactions) {
    const actions = [];
    if (!oactions) oactions = [];
    if (oactions instanceof Object && !(oactions instanceof Array)) {
        oactions = [oactions];
    }
    for (let i = 0; i < oactions.length; i++) {
        let ev = oactions[i].event;
        if (ev) {
            ev = {type: ev.type || "", params: ev.params || []}
        }
        const action = {
            ...oactions[i],
            params: Object.keys(oactions[i].params || {}).map(stateName => {
                return {key: stateName, value: oactions[i].params[stateName]};
            }),
            event: ev,
        }
        actions.push(action);
    }
    return actions;
}

export function uint8ArrayToHex(arr) {
    return arr.reduce((accum, v) => accum + v.toString(16).padStart(2, '0'), "");
}

export function raise(event, options = {}) {
    const _event = {type: event.type, params: []}
    const evkeys = Object.keys(event);
    for (let i = 0; i < evkeys.length; i++) {
        if (evkeys[i] !== "type") {
            _event.params.push({key: evkeys[i], value: event[evkeys[i]]})
        }
    }
    const _raise = {};
    _raise.type = 'xstate.raise';
    _raise.event = _event;
    // _raise.id = options.id;
    // _raise.delay = options.delay;
    return _raise;
}

export function numToUint8Array(num) {
    let arr = new Uint8Array(8);

    for (let i = 0; i < 8; i++) {
      arr[i] = num % 256;
      num = Math.floor(num / 256);
    }

    return arr.reverse();
}

export function numToUint8Array32(num) {
    const val = numToUint8Array(num);
    return new Uint8Array([...new Uint8Array(24), ...val]);
}
