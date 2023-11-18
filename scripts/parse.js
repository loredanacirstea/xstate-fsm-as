import {parseMachine, raise} from '../tests/utils.js';

const jsonConfig = {
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
                actions: raise({ to: "to", from: "getCaller()", amount: "amount", type: "move" }),
              },
              mint: {
                target: "active",
                guard: "isAdmin",
                actions: {
                  type: "mint",
                },
              },
              approve: {
                target: "active",
                actions: {
                  type: "approve",
                },
              },
              transferFrom: {
                target: "intransfer",
                guard: "hasEnoughAllowance",
                actions: raise({ to: "to", from: "from", type: "move", amount: "amount" }),
              },
            },
          },
          intransfer: {
            initial: "unmoved",
            states: {
              unmoved: {
                on: {
                  move: {
                    target: "moved",
                    guard: "hasEnoughBalance",
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

const parsedConfig = parseMachine(jsonConfig);
console.log(JSON.stringify(parsedConfig));
