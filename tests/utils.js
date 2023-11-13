
export function parseMachine(origConfig) {
    const newConfig = {
        ...origConfig,
        context: Object.keys(origConfig.context).map(key => {
            return {key: key, value: origConfig.context[key]};
        }),
        states: Object.keys(origConfig.states).map(key => {
            const state = origConfig.states[key];
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
                        params: Object.keys(oactions[i].params).map(stateName => {
                            return {key: stateName, value: oactions[i].params[stateName]};
                        })
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
            }
        })
    };
    return newConfig;
}
// unlocked: {
//     on: {
//       lock: {
//         target: "locked",
//       },
//       increment: {
//         target: "unlocked",
//         actions: {
//           type: "increment",
//           params: {
//             counter: "1",
//           },
//         },
//       },
//     },
//   },
