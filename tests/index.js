import assert from "assert";
import { create, getCurrentState, getContextValue, transition, run } from "../build/debug.js";

let currentState, value;

const machineConfig = {
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

const machineConfigStr = JSON.stringify(machineConfig);
const implementationsStr = JSON.stringify(implementations);
const machineId = create(encodeToUtf8Array(machineConfigStr), encodeToUtf8Array(implementationsStr));
console.log("!!!!!machineId", machineId)

const nextState = transition(machineId, encodeToUtf8Array('blue'), encodeToUtf8Array('next'));
console.log("!!!!!!! -> next", decodeFromUtf8Array(nextState))
// assert.strictEqual(nextState.value, 'red');
assert.strictEqual(decodeFromUtf8Array(nextState), 'red');

currentState = getCurrentState(machineId);
console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
assert.strictEqual(decodeFromUtf8Array(currentState), "red");

run(machineId, encodeToUtf8Array("next"));
console.log("!!!!!!! -> next");
currentState = getCurrentState(machineId);
console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
assert.strictEqual(decodeFromUtf8Array(currentState), "blue");

// value = getContextValue(machineId, encodeToUtf8Array('value'));
// console.log("!!!!!getContextValue", decodeFromUtf8Array(value))
// assert.strictEqual(decodeFromUtf8Array(value), "blue");

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
