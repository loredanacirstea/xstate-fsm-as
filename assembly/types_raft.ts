import { JSON } from "json-as/assembly";
import { RequestProcessProposal, ResponseFinalizeBlock } from "./types_tendermint";

// @ts-ignore
@serializable
export class LogEntry {
    index: i64;
    termId: i32;
    leaderId: i32;
    data: string; // base64-encoded RequestProcessProposal
    result: string // base64-encoded ResponseFinalizeBlock
    constructor(index: i64, termId: i32, leaderId: i32, data: string, result: string) {
        this.index = index;
        this.termId = termId;
        this.leaderId = leaderId;
        this.data = data;
        this.result = result;
    }
}

// @ts-ignore
@serializable
export class LogEntryInternal {
    index: i64;
    termId: i32;
    leaderId: i32;
    data: RequestProcessProposal;
    result: ResponseFinalizeBlock;
    constructor(index: i64, termId: i32, leaderId: i32, data: RequestProcessProposal, result: ResponseFinalizeBlock) {
        this.index = index;
        this.termId = termId;
        this.leaderId = leaderId;
        this.data = data;
        this.result = result;
    }
}

// @ts-ignore
@serializable
export class Block {
    hash: string;
    parentHash: string;
    transactions: Array<string>; // base64-encoded JSON transaction data
    constructor(hash: string, parentHash: string, transactions: Array<string>) {
        this.hash = hash;
        this.parentHash = parentHash;
        this.transactions = transactions;
    }
}

// @ts-ignore
@serializable
export class BlockInternal {
    hash: string;
    parentHash: string;
    transactions: Array<Transaction>;
    constructor(hash: string, parentHash: string, transactions: Array<Transaction>) {
        this.hash = hash;
        this.parentHash = parentHash;
        this.transactions = transactions;
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
    constructor(termId: i32, leaderId: i32, prevLogIndex: i64, prevLogTerm: i32, entries: Array<LogEntry>, leaderCommit: i64) {
        this.termId = termId;
        this.leaderId = leaderId;
        this.prevLogIndex = prevLogIndex;
        this.prevLogTerm = prevLogTerm;
        this.entries = entries;
        this.leaderCommit = leaderCommit;
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
class MempoolBatch {
    txs: string[];
    cummulatedGas: i64;
    constructor(txs: string[] = [], cummulatedGas: i64 = 0) {
        this.txs = txs;
        this.cummulatedGas = cummulatedGas;
    }
}

// @ts-ignore
@serializable
export class Mempool {
    txs: string[];
    gas: i32[];
    constructor(txs: string[] = [], gas: i32[] = []) {
        this.txs = txs;
        this.gas = gas;
    }

    add(tx: string, gas: i32): void {
        this.gas = this.gas.concat([gas]);
        this.txs = this.txs.concat([tx]);
    }

    batch(maxGas: i64): MempoolBatch {
        let batch: MempoolBatch = new MempoolBatch([], 0);
        for (let i = 0; i < this.txs.length; i++) {
            if (maxGas < (batch.cummulatedGas + this.gas[i])) {
                break;
            }
            batch.txs = batch.txs.concat([this.txs[i]]);
            batch.cummulatedGas += this.gas[i];
        }
        this.txs.splice(0, batch.txs.length);
        return batch;
    }
}
