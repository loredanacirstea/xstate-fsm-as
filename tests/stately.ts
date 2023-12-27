import { createMachine } from "xstate";

export const machine = createMachine(
  {
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
    },
    types: {
      events: {} as
        | { type: "" }
        | { type: "reset" }
        | { type: "setup"; nodeIPs: string; currentNodeId: string }
        | { type: "start" }
        | { type: "newChange"; transaction: string }
        | { type: "setupNode"; nodeIPs: string; currentNodeId: string; initChainSetup: string }
        | { type: "initialize" }
        | { type: "nodeUpdate"; ip: string; index: string; removed: string; signature: string }
        | { type: "newTransaction"; transaction: string }
        | { type: "nodeListUpdate"; ips: string }
        | {
            type: "receiveHeartbeat";
            termId: string;
            entries: string;
            nodeIps: string;
            leaderId: string;
            prevLogTerm: string;
            leaderCommit: string;
            prevLogIndex: string;
            signature: string;
          }
        | { type: "heartbeatResponse"; term: string; success: string }
        | {
            type: "receiveVoteRequest";
            termId: string;
            candidateId: string;
            lastLogTerm: string;
            lastLogIndex: string;
            signature: string;
          },
      context: {} as {
        log: string;
        nodeIPs: string;
        templog: string;
        votedFor: string;
        nextIndex: string;
        matchIndex: string;
        commitIndex: string;
        currentTerm: string;
        lastApplied: string;
        max_tx_bytes: string;
        prevLogIndex: string;
        currentNodeId: string;
        electionReset: string;
        max_block_gas: string;
        electionTimeout: string;
        maxElectionTime: string;
        minElectionTime: string;
        heartbeatTimeout: number;
      },
    },
  },
  {
    actions: {
      registeredCheck: ({ context, event }) => {},
      setRandomElectionTimeout: ({ context, event }) => {},
      cancelActiveIntervals: ({ context, event }) => {},
      forwardTxsToLeader: ({ context, event }) => {},
      initializeNextIndex: ({ context, event }) => {},
      initializeMatchIndex: ({ context, event }) => {},
      sendAppendEntries: ({ context, event }) => {},
      commitBlocks: ({ context, event }) => {},
      proposeBlock: ({ context, event }) => {},
      incrementCurrentTerm: ({ context, event }) => {},
      selfVote: ({ context, event }) => {},
      sendVoteRequests: ({ context, event }) => {},
      addToMempool: ({ context, event }) => {},
      sendNewTransactionResponse: ({ context, event }) => {},
      processAppendEntries: ({ context, event }) => {},
      sendHeartbeatResponse: ({ context, event }) => {},
      setupNode: ({ context, event }) => {},
      vote: ({ context, event }) => {},
      updateNodeAndReturn: ({ context, event }) => {},
    },
    actors: {},
    guards: {
      ifIntervalActive: ({ context, event }, params) => {
        return false;
      },
      isVotedLeader: ({ context, event }, params) => {
        return false;
      },
    },
    delays: {
      heartbeatTimeout: ({ context, event }) => {
        return 1000;
      },
      electionTimeout: ({ context, event }) => {
        return 1000;
      },
    },
  },
);
