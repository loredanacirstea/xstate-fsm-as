import { JSON } from "json-as/assembly";
import { Base64String } from "./types";

// @ts-ignore
@serializable
export class LogEntry {
    index: i64;
    termId: i32;
    leaderId: i32;
    data: string; // base64-encoded RequestProcessProposal
    header: string // base64-encoded Header
    commit: string // base64-encoded commit info
    result: string // base64-encoded ResponseFinalizeBlock
    constructor(index: i64, termId: i32, leaderId: i32, data: string, header: string, commit: string, result: string) {
        this.index = index;
        this.termId = termId;
        this.leaderId = leaderId;
        this.data = data;
        this.header = header;
        this.commit = commit;
        this.result = result;
    }
}

// @ts-ignore
@serializable
export class Coin {
    amount: string;
    denom: string;
    constructor(amount: string, denom: string) {
        this.amount = amount;
        this.denom = denom;
    }
}

// @ts-ignore
@serializable
export class Transaction {
    from: string;
    to: string;
    funds: Array<Coin>;
    data: string;
    gas: i64;
    price: i64;
    constructor(from: string, to: string, funds: Array<Coin>, data: string, gas: i64, price: i64) {
        this.from = from;
        this.to = to;
        this.funds = funds;
        this.data = data;
        this.gas = gas;
        this.price = price;
    }
}

// @ts-ignore
@serializable
export class TransactionResponse {
    termId: i32;
    leaderId: i32;
    index: i64;
    constructor(termId: i32, leaderId: i32, index: i64) {
        this.termId = termId;
        this.leaderId = leaderId;
        this.index = index;
    }
}

// @ts-ignore
@serializable
export class AppendEntry {
    // leader’s term
    termId: i32;
    // so follower can redirect clients
    leaderId: i32;
    // index of log entry immediately preceding new ones
    prevLogIndex: i64;
    // term of prevLogIndex entry
    prevLogTerm: i32;
    // log entries to store (empty for heartbeat; may send more than one for efficiency)
    entries: Array<LogEntry>
    // leader’s commitIndex
    leaderCommit: i64;
    nodeIps: Array<string>;
    validators: Base64String;
    constructor(termId: i32, leaderId: i32, prevLogIndex: i64, prevLogTerm: i32, entries: Array<LogEntry>, leaderCommit: i64, nodeIps: Array<string>, validators: Base64String) {
        this.termId = termId;
        this.leaderId = leaderId;
        this.prevLogIndex = prevLogIndex;
        this.prevLogTerm = prevLogTerm;
        this.entries = entries;
        this.leaderCommit = leaderCommit;
        this.nodeIps = nodeIps;
        this.validators = validators;
    }
}

// @ts-ignore
@serializable
export class AppendEntryResponse {
    // currentTerm, for leader to update itself
    termId: i32;
    // true if follower contained entry matching prevLogIndex and prevLogTerm
    success: bool;
    constructor(termId: i32, success: bool) {
        this.termId = termId;
        this.success = success;
    }
}

// @ts-ignore
@serializable
export class VoteRequest {
    termId: i32;
    candidateId: i32;
    lastLogIndex: i64;
    lastLogTerm: i32;
    constructor(termId: i32, candidateId: i32, lastLogIndex: i64, lastLogTerm: i32) {
        this.termId = termId;
        this.candidateId = candidateId;
        this.lastLogIndex = lastLogIndex;
        this.lastLogTerm = lastLogTerm;
    }
}

// @ts-ignore
@serializable
export class NodeUpdate {
    ip: string;
    index: i32;
    type: i32; // removed = 0; added = 1; updated = 2;
    validator_info: Base64String; // "" if a remove or update; ValidatorInfo if added
    constructor(ip: string, index: i32, type: i32, validator_info: Base64String) {
        this.ip = ip;
        this.index = index;
        this.type = type;
        this.validator_info = validator_info;
    }
}

// @ts-ignore
@serializable
export class UpdateNodeResponse {
  nodeIPs: string[]
  nodeId: i32
  validators: Base64String
  constructor(nodeIPs: string[], nodeId: i32, validators: Base64String) {
    this.nodeIPs = nodeIPs
    this.nodeId = nodeId
    this.validators = validators
  }
}

// @ts-ignore
@serializable
export class VoteResponse {
    termId: i32;
    voteGranted: bool;
    constructor(termId: i32, voteGranted: bool) {
        this.termId = termId;
        this.voteGranted = voteGranted;
    }
}
