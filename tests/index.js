import assert from "assert";
import { createMachine, getCurrentState, transition } from "../build/debug.js";
// assert.strictEqual(add(1, 2), 3);
// console.log("ok");

const machineConfig = {
    id: "Semaphore",
    context: {},
    initial: "red",
    states: {
      "red": {
        on: {
          next: {
            target: "blue",
          },
        },
        exit: [],
        entry: [],
      },
      "blue": {
        on: {
          next: {
            target: "white",
          },
        },
        exit: [],
        entry: [],
      },
      "white": {
        on: {
          next: {
            target: "red",
          },
        },
        exit: [],
        entry: [],
      },
    },
}

const machineConfig2 = {
    id: "Semaphore",
    initial: "red",
    // context: {state: "red"},
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

const machineConfigStr = JSON.stringify(machineConfig2);
const implementationsStr = JSON.stringify(implementations);
const machineId = createMachine(encodeToUtf8Array(machineConfigStr), encodeToUtf8Array(implementationsStr));
console.log("!!!!!machineId", machineId)

const nextState = transition(machineId, encodeToUtf8Array('blue'), encodeToUtf8Array('next'));
console.log("!!!!!nextState", nextState, decodeFromUtf8Array(nextState))
// assert.strictEqual(nextState.value, 'red');
assert.strictEqual(decodeFromUtf8Array(nextState), 'red');

// let currentState = getCurrentState(machineId);
// console.log("!!!!!currentState", currentState)
// assert.strictEqual(decodeFromUtf8Array(currentState), "blue");

// const nextState = transition(machineId, 'green', 'TIMER');


// expect(nextState.value).toEqual('yellow');
// expect(nextState.actions.map((action) => action.type)).toEqual([
//     'exitGreen',
//     'g-y 1',
//     'g-y 2'
// ]);
// expect(nextState.context).toEqual({
//     count: 2,
//     foo: 'static++',
//     go: false
// });


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
