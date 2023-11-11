import assert from "assert";
// import { describe, it } from "test";
// import { describe, it } from 'node:test';
// import { create, getCurrentState, getContextValue, transition, run } from "../build/debug.js";
import { load, LOG } from './wasmx.js';

let currentState, value;

function runFnWrapped (storage = {}) {
    return async function (fnName, args) {
        const argsStr = JSON.stringify({[fnName]: args});
        console.log("-EXT-argsStr", argsStr);
        const env = {
            currentCall: {
                callData: encodeToUtf8Array(argsStr),
            }
        }
        const mainfn = await load(storage, env, LOG.error);
        return mainfn();
    }
}

let machineConfig = {
    id: "Semaphore",
    initial: "red",
    context: [],
    states: [
        {
            name: "red",
            on: [
                {
                    name: "next",
                    target: "blue",
                },
            ],
            exit: [],
            entry: [],
        },
        {
            name: "blue",
            on: [
                {
                    name: "next",
                    target: "red",
                },
            ],
            exit: [],
            entry: [],
        },
    ],
}


const machineConfig2 = {
    id: "Lock/unlock",
    initial: "unlock",
    context: [{key: "counter", value: "0"}],
    states: [
        {
            name: "unlock",
            on: [
                {
                    name: "lock",
                    target: "lock",
                },
                {
                    name: "set",
                    actions: [
                        {
                            value: "counter",
                            action: {type: "assign", args: ["counter"]},
                        }
                    ],
                },
                {
                    name: "increment",
                    actions: [
                        {
                            value: "counter",
                            action: {type: "increment"},
                        }
                    ],
                },
            ],
            exit: [],
            entry: [],
        },
        {
            name: "lock",
            on: [
                {
                    name: "unlock",
                    target: "unlock",
                },
            ],
            exit: [],
            entry: [],
        },
    ],
}

const machineConfig2Orig = {
    context: {
      counter: "0",
    },
    id: "lock-count",
    initial: "unlocked",
    states: {
      unlocked: {
        on: {
          lock: {
            target: "locked",
          },
          increment: {
            target: "unlocked",
            actions: {
              type: "increment",
              params: {
                counter: "1",
              },
            },
          },
        },
      },
      locked: {
        on: {
          unlock: {
            target: "unlocked",
          },
        },
      },
    },
}

const machineConfig3Orig = {
    context: {
      counter: "0",
    },
    id: "Untitled",
    initial: "unlocked",
    states: {
      unlocked: {
        on: {
          lock: {
            target: "locked",
          },
          increment: {
            target: "unlocked",
            actions: [
              {
                type: "increment",
                params: {
                  counter: "2",
                },
              },
              {
                type: "log",
                params: {
                  counter: "",
                },
                expr: "",
              },
            ],
          },
        },
      },
      locked: {
        on: {
          unlock: {
            target: "unlocked",
          },
        },
      },
    },
}

const implementations = {actions: {}};

async function runTests() {
    const storage = {};
    let machineConfigStr = JSON.stringify(machineConfig);
    let implementationsStr = JSON.stringify(implementations);
    let machineId;
    let result;
    let runFn = runFnWrapped(storage);

    // Create the machine
    result = await runFn("create", machineConfig)
    console.log("!!!!!create", decodeFromUtf8Array(result))
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 0);

    // Get initial state
    result = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "red");

    // Run next state
    await runFn("run", {id: machineId, eventName: "next"});
    console.log("!!!!!!! -> next");

    // Check state has changed
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "blue");


    ///// machine 2

    const implementations2 = {actions: {}};

    machineConfig = parseMachine(machineConfig2Orig);
    console.log("==machineConfig==")
    console.log(JSON.stringify(machineConfig))
    implementationsStr = JSON.stringify(implementations2);

    // Create the machine
    result = await runFn("create", machineConfig)
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 1);

    // Get initial state
    result = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "unlocked");

    // Get context value
    result = await runFn("getContextValue", {id: machineId, key: "counter"});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "0");

    // Run next state
    await runFn("run", {id: machineId, eventName: "increment"});
    console.log("!!!!!!! -> increment");

    // Check state has changed
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "unlocked");

    // Get context value
    result = await runFn("getContextValue", {id: machineId, key: "counter"});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "1");

    // Run lock transition
    await runFn("run", {id: machineId, eventName: "lock"});
    console.log("!!!!!!! -> lock");

    // Check state has been locked
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "locked");

    // Check no increment is possible
    console.log("!!!!!!! -> try increment");
    try {
        await runFn("run", {id: machineId, eventName: "increment"});
    } catch (e) {
        console.error(e);
        assert.equal(e.message.includes("cannot apply event in current state"), true);
    }
    result = await runFn("getContextValue", {id: machineId, key: "counter"});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "1");

    ///// machine 3

    machineConfig = parseMachine(machineConfig3Orig);
    console.log("==machineConfig==")
    console.log(JSON.stringify(machineConfig))
    implementationsStr = JSON.stringify(implementations2);

    // Create the machine
    result = await runFn("create", machineConfig)
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 2);

    // Run next state
    await runFn("run", {id: machineId, eventName: "increment"});
    console.log("!!!!!!! -> increment");

    // Check state has changed
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "unlocked");
}

runTests();

export function encodeToUtf8Array(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

export function decodeFromUtf8Array(arr) {
    if (!(arr instanceof ArrayBuffer)) arr = new Uint8Array(arr).buffer;
    const encoder = new TextDecoder();
    return encoder.decode(arr);
}

export function hexToUint8Array(hexString) {
    const encodedString = hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
    return new Uint8Array(encodedString);
}

function parseMachine(origConfig) {
    const newConfig = {
        ...origConfig,
        context: Object.keys(origConfig.context).map(key => {
            return {key: key, value: origConfig.context[key]};
        }),
        states: Object.keys(origConfig.states).map(key => {
            const state = origConfig.states[key];
            const stateon = Object.keys(state.on).map(eventName => {
                const ev = state.on[eventName];
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
                    name: eventName,
                    target: ev.target,
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
