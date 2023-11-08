import assert from "assert";
import { createMachine, interpret, getState } from "../build/debug.js";
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
      },
      "blue": {
        on: {
          next: {
            target: "white",
          },
        },
      },
      "white": {
        on: {
          next: {
            target: "New state 1",
          },
        },
      },
    },
}

const machineId = createMachine(machineConfig);
let currentState = getState(machineId);

const nextState = transition(machineId, 'green', 'TIMER');
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
