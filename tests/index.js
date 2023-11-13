import assert from "assert";
// import { describe, it } from "test";
// import { describe, it } from 'node:test';
// import { create, getCurrentState, getContextValue, transition, run } from "../build/debug.js";
import { load, LOG } from './wasmx.js';
import { parseMachine } from './utils.js';

let currentState, value;

function runFnWrapped (storage = {}, env = {}) {
    return async function (fnName, args) {
        const argsStr = JSON.stringify({[fnName]: args});
        console.log("-EXT-argsStr", argsStr);
        // const defaultSender = new Uint8Array([31,31]);
        const defaultSender = encodeToUtf8Array("sender");
        env = {
            ...env,
            currentCall: {
                sender: defaultSender,
                ...env.currentCall,
                callData: encodeToUtf8Array(argsStr),
            }
        }
        const mainfn = await load(storage, env, LOG.debug);
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
                    guard: "",
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
                    guard: "",
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
                    guard: "",
                },
                {
                    name: "set",
                    target: "",
                    guard: "",
                    actions: [
                        {
                            value: "counter",
                            action: {type: "assign", args: ["counter"]},
                        }
                    ],
                },
                {
                    name: "increment",
                    target: "",
                    guard: "",
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
                    guard: "",
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

const machineWithGuard = {
    context: {
      counter: "0",
    },
    id: "lock-count-guard",
    initial: "unlocked",
    states: {
      unlocked: {
        on: {
          lock: {
            target: "locked",
          },
          increment: {
            target: "unlocked",
            guard: "isOwner",
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
    }
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

    ///// machine 4 with guard

    machineConfig = parseMachine(machineWithGuard);
    console.log("==machineWithGuard==")
    console.log(JSON.stringify(machineConfig))
    implementationsStr = JSON.stringify(implementations2);
    let runFnOwner = runFnWrapped(storage, {currentCall: {sender: new Uint8Array([1,1,1,1,1,1]).buffer}});
    let runFnOther = runFnWrapped(storage, {currentCall: {sender: new Uint8Array([1,1,1,1,1,2]).buffer}});

    // Create the machine
    result = await runFnOwner("create", machineConfig)
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 3);

    // Apply event
    await runFnOwner("run", {id: machineId, eventName: "increment"});
    console.log("!!!!!!! -> increment");

    try {
        await runFnOther("run", {id: machineId, eventName: "increment"});
    } catch (e) {
        console.error(e);
        assert.equal(e.message.includes("cannot execute transition; guard: isOwner"), true);
    }

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
