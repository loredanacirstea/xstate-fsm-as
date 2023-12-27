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
                target: "#Semaphore.red",
                guard: "",
                actions: [],
            }],
            always: [],
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
                    target: "#Semaphore.blue",
                    guard: "",
                    actions: [],
                },
            ],
            always: [],
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
                    target: "#Semaphore.red",
                    guard: "",
                    actions: [],
                },
            ],
            always: [],
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
                target: "#Lock/unlock.unlocked",
                guard: "",
                    actions: [],
            }],
            always: [],
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
                    target: "#Lock/unlock.lock",
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
            always: [],
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
                    target: "#Lock/unlock.unlock",
                    guard: "",
                    actions: [],
                },
            ],
            always: [],
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
      data: "aGVsbG8=",
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
      log: "",
      nodeIPs: "[]",
      nextIndex: "[]",
      matchIndex: "[]",
      commitIndex: "",
      currentTerm: "0",
      lastApplied: "",
      max_tx_bytes: "65536",
      prevLogIndex: "0",
      currentNodeId: "0",
      max_block_gas: "20000000",
      heartbeatTimeout: 5000,
    },
    id: "RAFT-LogReplication",
    initial: "uninitialized",
    states: {
      uninitialized: {
        on: {
          initialize: {
            target: "initialized",
          },
        },
      },
      initialized: {
        initial: "Follower",
        states: {
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
              setupNode: {
                target: "Follower",
                actions: {
                  type: "setupNode",
                },
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
                type: "initializeNextIndex",
              },
              {
                type: "initializeMatchIndex",
              },
            ],
            initial: "active",
            states: {
              active: {
                entry: [
                  {
                    type: "sendAppendEntries",
                  },
                  {
                    type: "proposeBlock",
                  },
                  {
                    type: "commitBlocks",
                  },
                ],
                after: {
                  heartbeatTimeout: {
                    target: "#RAFT-LogReplication.initialized.Leader.active",
                    actions: [],
                    meta: {},
                  },
                },
                on: {
                  newTransaction: {
                    actions: [
                      {
                        type: "addToMempool",
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
                      {
                        type: "commitTransaction",
                      },
                    ],
                  },
                  start: {
                    target: "active",
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
        },
        on: {
          start: {},
        },
      },
    },
}

export const RAFT_Full = {
  context: {
    log: "",
    nodeIPs: "[]",
    votedFor: "0",
    nextIndex: "[]",
    matchIndex: "[]",
    commitIndex: "0",
    currentTerm: "0",
    lastApplied: "0",
    max_tx_bytes: "65536",
    prevLogIndex: "0",
    currentNodeId: "0",
    electionReset: "0",
    max_block_gas: "20000000",
    electionTimeout: "0",
    maxElectionTime: "20000",
    minElectionTime: "10000",
    heartbeatTimeout: "5000",
  },
  id: "RAFT-FULL-1",
  initial: "uninitialized",
  states: {
    uninitialized: {
      on: {
        initialize: {
          target: "initialized",
        },
      },
    },
    initialized: {
      initial: "unstarted",
      states: {
        unstarted: {
          on: {
            setupNode: {
              target: "unstarted",
              actions: {
                type: "setupNode",
              },
            },
            start: {
              target: "Follower",
            },
          },
        },
        Follower: {
          entry: [
            {
              type: "registeredCheck",
            },
            {
              type: "setRandomElectionTimeout",
              params: {
                max: "$maxElectionTime",
                min: "$minElectionTime",
              },
            },
            {
              type: "cancelActiveIntervals",
              params: {
                after: "electionTimeout",
              },
            },
            {
              type: "forwardTxsToLeader",
            },
          ],
          after: {
            electionTimeout: {
              target: "#RAFT-FULL-1.initialized.Candidate",
              guard: "ifIntervalActive",
              actions: [],
              meta: {},
            },
          },
          on: {
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
            receiveVoteRequest: {
              target: "Follower",
              actions: {
                type: "vote",
              },
            },
            newTransaction: {
              actions: [
                {
                  type: "addToMempool",
                },
                {
                  type: "sendNewTransactionResponse",
                },
              ],
            },
          },
        },
        Candidate: {
          entry: [
            {
              type: "incrementCurrentTerm",
            },
            {
              type: "selfVote",
            },
            {
              type: "setRandomElectionTimeout",
              params: {
                max: "$maxElectionTime",
                min: "$minElectionTime",
              },
            },
            {
              type: "sendVoteRequests",
            },
          ],
          always: [
            {
              target: "Leader",
              guard: "isVotedLeader",
            },
            {
              target: "Follower",
            },
          ],
          on: {
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
            newTransaction: {
              actions: [
                {
                  type: "addToMempool",
                },
                {
                  type: "sendNewTransactionResponse",
                },
              ],
            },
          },
        },
        Leader: {
          entry: [
            {
              type: "initializeNextIndex",
            },
            {
              type: "initializeMatchIndex",
            },
          ],
          initial: "active",
          states: {
            active: {
              entry: [
                {
                  type: "sendAppendEntries",
                },
                {
                  type: "commitBlocks",
                },
                {
                  type: "proposeBlock",
                },
              ],
              after: {
                heartbeatTimeout: {
                  target: "#RAFT-FULL-1.initialized.Leader.active",
                  actions: [],
                  meta: {},
                },
              },
              on: {
                newTransaction: {
                  actions: [
                    {
                      type: "addToMempool",
                    },
                    {
                      type: "sendNewTransactionResponse",
                    },
                  ],
                },
                start: {
                  target: "active",
                },
                nodeUpdate: {
                  actions: {
                    type: "updateNodeAndReturn",
                  },
                },
              },
            },
          },
          on: {
            reset: {
              target: "Follower",
            },
          },
        },
      },
      on: {
        start: {},
      },
    },
  }
}
