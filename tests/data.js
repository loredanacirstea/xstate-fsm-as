import { raise } from './utils.js';

export const machineConfigSemaphore = {
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
            after: [],
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
            after: [],
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
            after: [],
            exit: [],
            entry: [],
            initial: "",
            states: [],
        },
    ],
}

export const machineConfig2 = {
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
            after: [],
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
            after: [],
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
            after: [],
            exit: [],
            entry: [],
            initial: "",
            states: [],
        },
    ],
}

export const machineConfig2Orig = {
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

export const machineConfig3Orig = {
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

export const machineWithGuard = {
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

export const erc20Machine1Orig = {
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
                actions: raise({ from: "getCaller()", to: "to", amount: "amount", type: "move" }),
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
                actions: raise({ from: "from", to: "to", amount: "amount", type: "move" }),
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

export const consensusSMConfigOrig = {
  id: "AB-Req-Res",
  initial: "uninitialized",
  context: {},
  states: {
    uninitialized: {
      on: {
        initialize: {
          target: "active",
        },
      },
    },
    active: {
      on: {
        sendRequest: {
          target: "ISentTheRequest",
          actions: {
            type: "sendRequest",
          },
        },
        receiveRequest: {
          target: "IReceivedTheRequest",
        },
      },
    },
    ISentTheRequest: {
      on: {
        reset: {
          target: "uninitialized",
        },
      },
    },
    IReceivedTheRequest: {
      on: {
        reset: {
          target: "uninitialized",
        },
      },
    },
  }
}

export const consensusSMTimerConfigOrig = {
    context: {
      data: "hello",
      address: "0.0.0.0:8091",
    },
    id: "AB-Req-Res-timer",
    initial: "uninitialized",
    states: {
      uninitialized: {
        on: {
          initialize: {
            target: "active",
          },
        },
      },
      active: {
        on: {
          receiveRequest: {
            target: "received",
          },
          send: {
            target: "sender",
          },
        },
      },
      received: {
        after: {
          "1000": {
            target: "#AB-Req-Res-timer.active",
            actions: [],
            meta: {},
          },
        },
      },
      sender: {
        after: {
          "5000": {
            target: "#AB-Req-Res-timer.sending",
            actions: [raise({ data: "data", type: "sendRequest", address: "address" })],
            meta: {},
          },
        },
      },
      sending: {
        on: {
          sendRequest: {
            target: "sender",
            actions: {
              type: "sendRequest",
            },
          },
        },
      },
    }
}

export const RAFTLogReplication = {
    context: {
      heartbeatTimeout: 0,
      log: "",
      lastApplied: "0",
      commitIndex: "0",
      prevLogIndex: "0",
      matchIndex: "",
      nextIndex: "",
      currentTerm: "0",
      currentNodeId: "0",
      nodeIPs: "",
    },
    id: "RAFT-LogReplication",
    initial: "uninitialized",
    states: {
      uninitialized: {
        on: {
          initialize: {
            target: "Follower",
          },
        },
      },
      Follower: {
        on: {
          change: {
            target: "Candidate",
          },
          receiveHeartbeat: {
            target: "Follower",
            actions: [
              {
                type: "processAppendEntries",
              },
              {
                type: "sendHeartbeatResponse",
              },
            ],
          },
        },
      },
      Candidate: {
        on: {
          change: {
            target: "Leader",
          },
        },
      },
      Leader: {
        entry: [
          {
            type: "reeinitialize_nextIndex",
          },
          {
            type: "reeinitialize_matchIndex",
          },
        ],
        initial: "active",
        states: {
          active: {
            after: {
              heartbeatTimeout: {
                target: "#RAFT-LogReplication.Leader.active",
                actions: [
                  {
                    type: "sendAppendEntries",
                  },
                ],
                meta: {},
              },
            },
            on: {
              newTransaction: {
                target: "active",
                actions: [
                  {
                    type: "appendLog",
                  },
                  {
                    type: "sendNewTransactionResponse",
                  },
                ],
              },
              heartbeatResponse: {
                target: "active",
                actions: [
                  {
                    type: "updateNextIndex",
                  },
                  {
                    type: "updateMatchIndex",
                  },
                ],
              },
            },
          },
        },
        on: {
          change: {
            target: "Follower",
          },
        },
      },
    }
}
