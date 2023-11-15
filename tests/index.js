import assert from "assert";
// import { describe, it } from "test";
// import { describe, it } from 'node:test';
// import { create, getCurrentState, getContextValue, transition, run } from "../build/debug.js";
import { load, LOG } from './wasmx.js';
import { parseMachine, uint8ArrayToHex, raise } from './utils.js';

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
    initial: "uninitialized",
    context: [],
    states: [
        {
            name: "uninitialized",
            on: [{
                name: "initialize",
                target: "red",
                guard: "",
                    actions: [],
            }],
            exit: [],
            entry: [],
            initial: "",
            states: [],
        },
        {
            name: "red",
            on: [
                {
                    name: "next",
                    target: "blue",
                    guard: "",
                    actions: [],
                },
            ],
            exit: [],
            entry: [],
            initial: "",
            states: [],
        },
        {
            name: "blue",
            on: [
                {
                    name: "next",
                    target: "red",
                    guard: "",
                    actions: [],
                },
            ],
            exit: [],
            entry: [],
            initial: "",
            states: [],
        },
    ],
}


const machineConfig2 = {
    id: "Lock/unlock",
    initial: "uninitialized",
    context: [{key: "counter", value: "0"}],
    states: [
        {
            name: "uninitialized",
            on: [{
                name: "initialize",
                target: "unlocked",
                guard: "",
                    actions: [],
            }],
            exit: [],
            entry: [],
            initial: "",
            states: [],
        },
        {
            name: "unlock",
            on: [
                {
                    name: "lock",
                    target: "lock",
                    guard: "",
                    actions: [],
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
            initial: "",
            states: [],
        },
        {
            name: "lock",
            on: [
                {
                    name: "unlock",
                    target: "unlock",
                    guard: "",
                    actions: [],
                },
            ],
            exit: [],
            entry: [],
            initial: "",
            states: [],
        },
    ],
}

const machineConfig2Orig = {
    context: {
      counter: "0",
    },
    id: "lock-count",
    initial: "uninitialized",
    states: {
        uninitialized: {
            on: {
              initialize: {
                target: "unlocked",
              },
            },
        },
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
    initial: "uninitialized",
    states: {
        uninitialized: {
            on: {
              initialize: {
                target: "unlocked",
              },
            },
        },
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
    initial: "uninitialized",
    states: {
        uninitialized: {
            on: {
              initialize: {
                target: "unlocked",
              },
            },
        },
      unlocked: {
        on: {
          lock: {
            target: "locked",
          },
          increment: {
            target: "unlocked",
            guard: "isAdmin",
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

const erc20Machine1Orig = {
    context: {
      admin: "",
      supply: "0",
      tokenName: "",
      tokenSymbol: "",
    },
    id: "ERC20",
    initial: "uninitialized",
    states: {
      uninitialized: {
        on: {
          initialize: {
            target: "unlocked",
            // actions: {
            //   type: "mint",
            //   params: {
            //     admin: "",
            //     adminBalance: "",
            //   },
            // },
          },
        },
      },
      unlocked: {
        initial: "active",
        states: {
          active: {
            on: {
              transfer: {
                target: "intransfer",
                guard: "hasEnoughBalance",
                actions: raise({ from: "from", to: "to", amount: "amount", type: "move" }),
              },
              mint: {
                target: "active",
                guard: "isAdmin",
                actions: {
                  type: "mint",
                },
              },
            },
          },
          intransfer: {
            entry: {
              type: "setCurrentTransfer",
            },
            exit: {
              type: "deleteCurrentTransfer",
            },
            initial: "unmoved",
            states: {
              unmoved: {
                on: {
                  move: {
                    target: "moved",
                    actions: [
                      {
                        type: "move",
                      },
                      {
                        type: "logTransfer",
                      },
                      raise({ type: "finish" }),
                    ],
                  },
                },
              },
              moved: {
                on: {
                  finish: {
                    target: "#ERC20.unlocked.active",
                  },
                },
              },
            },
          },
        },
        on: {
          lock: {
            target: "locked",
            guard: "isAdmin",
          },
        },
      },
      locked: {
        on: {
          unlock: {
            target: "unlocked",
            guard: "isAdmin",
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
    await runFn("run", {id: machineId, event: {type: "next", params: []}});
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
    await runFn("run", {id: machineId, event: {type: "increment", params: []}});
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
    await runFn("run", {id: machineId, event: {type: "lock", params: []}});
    console.log("!!!!!!! -> lock");

    // Check state has been locked
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "locked");

    // Check no increment is possible
    console.log("!!!!!!! -> try increment");
    try {
        await runFn("run", {id: machineId, event: {type: "increment", params: []}});
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
    await runFn("run", {id: machineId, event: {type: "increment", params: []}});
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
    await runFnOwner("run", {id: machineId, event: {type: "increment", params: []}});
    console.log("!!!!!!! -> increment");

    try {
        await runFnOther("run", {id: machineId, event: {type: "increment", params: []}});
    } catch (e) {
        console.error(e);
        assert.equal(e.message.includes("cannot execute transition; guard: isAdmin"), true);
    }

    // Check state has changed
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "unlocked");

    // machine 5 - erc20
    const admin = new Uint8Array([1,1,1,1,1,1]);
    const sender = new Uint8Array([1,1,1,1,1,2]);
    erc20Machine1Orig.context.admin = uint8ArrayToHex(admin);
    // erc20Machine1Orig.context.supply = "1000000";
    erc20Machine1Orig.context.tokenName = "Token";
    erc20Machine1Orig.context.tokenSymbol = "TKN";

    machineConfig = parseMachine(erc20Machine1Orig);
    console.log("==erc20Machine1Orig==");
    console.log(JSON.stringify(machineConfig));
    runFnOwner = runFnWrapped(storage, {currentCall: {sender: admin.buffer}});
    runFnOther = runFnWrapped(storage, {currentCall: {sender: sender.buffer}});

    // Create the machine
    result = await runFnOwner("create", machineConfig)
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 4);

    // Check state is unlocked
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "active");

    // Mint tokens for admin
    await runFnOwner("run", {id: machineId, event: {type: "mint", params: [{key: "to", value: uint8ArrayToHex(admin)}, {key: "amount", value: "100"}]}});
    console.log("!!!!!!! -> minted");

    result = await runFn("getContextValue", {id: machineId, key: "balance_4_" + uint8ArrayToHex(admin)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "100");

    // Transfer tokens from owner to sender
    await runFnOwner("run", {id: machineId, event: {type: "transfer", params: [{key: "from", value: uint8ArrayToHex(admin)}, {key: "to", value: uint8ArrayToHex(sender)}, {key: "amount", value: "10"}]}});
    console.log("!!!!!!! -> transferred");

    result = await runFn("getContextValue", {id: machineId, key: "balance_4_" + uint8ArrayToHex(sender)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "10");

    result = await runFn("getContextValue", {id: machineId, key: "balance_4_" + uint8ArrayToHex(admin)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "90");
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
