
export function parseMachine(origConfig) {
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
            const actions = [];
            let oactions = ev.actions;
            if (!oactions) oactions = [];
            if (oactions instanceof Object && !(oactions instanceof Array)) {
                oactions = [oactions];
            }
            for (let i = 0; i < oactions.length; i++) {
                const action = {
                    ...oactions[i],
                    params: Object.keys(oactions[i].params || {}).map(stateName => {
                        return {key: stateName, value: oactions[i].params[stateName]};
                    }),
                }
                actions.push(action);
            }

            return {
                name: eventName || "",
                target: ev.target || "",
                guard: ev.guard || "",
                actions,
            }
        })

        return {
            name: key,
            on: stateon,
            exit: [], // TODO
            entry: [], // TODO
            initial: state.initial || "",
            states: state.states ? parseMachineStates(state.states) : [],
        }
    })
}

export function uint8ArrayToHex(arr) {
    return arr.reduce((accum, v) => accum + v.toString(16).padStart(2, '0'), "");
}

export function raise(event, options = {}) {
    const _raise = {};
    _raise.type = 'xstate.raise';
    _raise.event = event;
    // _raise.id = options.id;
    // _raise.delay = options.delay;
    return raise;
}
