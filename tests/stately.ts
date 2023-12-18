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
      maxElectionTime: "6000",
      minElectionTime: "4000",
      heartbeatTimeout: 3000,
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
                    target: "#RAFT-FULL-1.initialized.Leader.active",
                    actions: [],
                    meta: {},
                  },
                },
                on: {
                  newTransaction: {
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
        | { type: "newTransaction"; transaction: string }
        | {
            type: "receiveHeartbeat";
            termId: string;
            entries: string;
            leaderId: string;
            prevLogTerm: string;
            leaderCommit: string;
            prevLogIndex: string;
          }
        | { type: "heartbeatResponse"; term: string; success: string }
        | {
            type: "receiveVoteRequest";
            termId: string;
            candidateId: string;
            lastLogTerm: string;
            lastLogIndex: string;
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
      setRandomElectionTimeout: ({ context, event }) => {},
      cancelActiveIntervals: ({ context, event }) => {},
      initializeNextIndex: ({ context, event }) => {},
      initializeMatchIndex: ({ context, event }) => {},
      sendAppendEntries: ({ context, event }) => {},
      proposeBlock: ({ context, event }) => {},
      commitBlocks: ({ context, event }) => {},
      incrementCurrentTerm: ({ context, event }) => {},
      selfVote: ({ context, event }) => {},
      sendVoteRequests: ({ context, event }) => {},
      appendLog: ({ context, event }) => {},
      sendNewTransactionResponse: ({ context, event }) => {},
      updateNextIndex: ({ context, event }) => {},
      updateMatchIndex: ({ context, event }) => {},
      commitTransaction: ({ context, event }) => {},
      processAppendEntries: ({ context, event }) => {},
      sendHeartbeatResponse: ({ context, event }) => {},
      setupNode: ({ context, event }) => {},
      vote: ({ context, event }) => {},
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
