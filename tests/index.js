import assert from "assert";
// import { describe, it } from "test";
// import { describe, it } from 'node:test';
import { create, getCurrentState, getContextValue, transition, run } from "../build/debug.js";

let currentState, value;

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
const implementations = {actions: {}};

let machineConfigStr = JSON.stringify(machineConfig);
let implementationsStr = JSON.stringify(implementations);
let machineId;


machineId = create(encodeToUtf8Array(machineConfigStr), encodeToUtf8Array(implementationsStr));
console.log("!!!!!machineId", machineId)

let nextState = transition(machineId, encodeToUtf8Array('blue'), encodeToUtf8Array('next'));
console.log("!!!!!!! -> next", decodeFromUtf8Array(nextState))
assert.strictEqual(decodeFromUtf8Array(nextState), 'red');

currentState = getCurrentState(machineId);
console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
assert.strictEqual(decodeFromUtf8Array(currentState), "red");

run(machineId, encodeToUtf8Array("next"));
console.log("!!!!!!! -> next");
currentState = getCurrentState(machineId);
console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
assert.strictEqual(decodeFromUtf8Array(currentState), "blue");


///// machine 2

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

const implementations2 = {actions: {}};

machineConfig = parseMachine(machineConfig2Orig);
machineConfigStr = JSON.stringify(machineConfig);
console.log("machineConfig", machineConfigStr);
implementationsStr = JSON.stringify(implementations2);

machineId = create(encodeToUtf8Array(machineConfigStr), encodeToUtf8Array(implementationsStr));
console.log("!!!!!machineId", machineId)

currentState = getCurrentState(machineId);
console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
assert.strictEqual(decodeFromUtf8Array(currentState), "unlocked");

value = getContextValue(machineId, encodeToUtf8Array('counter'));
console.log("!!!!!counter", decodeFromUtf8Array(value))
assert.strictEqual(decodeFromUtf8Array(value), "0");

run(machineId, encodeToUtf8Array("increment"));
console.log("!!!!!!! -> increment");
currentState = getCurrentState(machineId);
console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
assert.strictEqual(decodeFromUtf8Array(currentState), "unlocked");

value = getContextValue(machineId, encodeToUtf8Array('counter'));
console.log("!!!!!counter", decodeFromUtf8Array(value))
assert.strictEqual(decodeFromUtf8Array(value), "1");

run(machineId, encodeToUtf8Array("lock"));
console.log("!!!!!!! -> lock");
currentState = getCurrentState(machineId);
console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
assert.strictEqual(decodeFromUtf8Array(currentState), "locked");

run(machineId, encodeToUtf8Array("increment"));
console.log("!!!!!!! -> increment");
value = getContextValue(machineId, encodeToUtf8Array('counter'));
console.log("!!!!!counter", decodeFromUtf8Array(value))
assert.strictEqual(decodeFromUtf8Array(value), "1");

export function encodeToUtf8Array(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

export function decodeFromUtf8Array(arr) {
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
                if (ev.actions) {
                    const action = {
                        ...ev.actions,
                        params: Object.keys(ev.actions.params).map(stateName => {
                            return {key: stateName, value: ev.actions.params[stateName]};
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
