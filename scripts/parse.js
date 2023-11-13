import {parseMachine} from '../tests/utils.js';

const jsonConfig = {
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


const parsedConfig = parseMachine(jsonConfig);
console.log(JSON.stringify(parsedConfig));
