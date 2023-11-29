import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';
import * as storage from './storage';

import {
  EventObject,
  ActionParam,
} from './types';
import { hexToUint8Array, revert, parseInt32, parseInt64 } from "./utils";
import { Block, LogEntry, Transaction, TransactionResponse, AppendEntry, AppendEntryResponse } from "./types_raft";

export function setupNode(
    params: ActionParam[],
    event: EventObject,
): void {
    let currentNodeId: string = "";
    let nodeIPs: string = "";
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === CURRENT_NODE_ID) {
            currentNodeId = event.params[i].value;
            continue;
        }
        if (event.params[i].key === NODE_IPS) {
            nodeIPs = event.params[i].value;
            continue;
        }
    }
    if (currentNodeId === "") {
        revert("no currentNodeId found");
    }
    if (nodeIPs === "") {
        revert("no nodeIPs found");
    }
    storage.setContextValue(CURRENT_NODE_ID, currentNodeId);
    storage.setContextValue(NODE_IPS, nodeIPs);
}

export function processAppendEntries(
    params: ActionParam[],
    event: EventObject,
): void {
    let entryBase64: string = event.params[0].value;
    console.log("==processAppendEntries==" + entryBase64)
    const entryStr = String.UTF8.decode(decodeBase64(entryBase64).buffer);
    console.log("==processAppendEntries=entryStr=" + entryStr)
    let entry: AppendEntry = JSON.parse<AppendEntry>(entryStr);
    for (let i = 0; i < entry.entries.length; i++) {
        appendLogEntry(entry.entries[i]);
    }
    // TODO the rest of the verifications
}

export function sendHeartbeatResponse(
    params: ActionParam[],
    event: EventObject,
): void {
    const termId = getTermId();
    const response = new AppendEntryResponse(termId, true);
    wasmx.finish(String.UTF8.encode(JSON.stringify<AppendEntryResponse>(response)));
}

export function sendAppendEntries(
    params: ActionParam[],
    event: EventObject,
): void {
    // go through each node
    const nodeId = getCurrentNodeId();
    const ips = getNodeIPs();
    for (let i = 0; i < ips.length; i++) {
        if (nodeId === i) continue;
        sendAppendEntry(i, ips[i]);
    }
}

// TODO continue sending the entries until all nodes receive them
export function sendAppendEntry(
    nodeId: i32,
    nodeIp: string,
): void {
    const nextIndexPerNode = getNextIndexArray();
    const nextIndex = nextIndexPerNode.at(nodeId);
    const lastIndex = getLogCount();
    const entries: Array<LogEntry> = [];
    for (let i = nextIndex; i <= lastIndex; i++) {
        const entry = getLogEntry(i);
        const entryobj = JSON.parse<LogEntry>(entry);
        entries.push(entryobj);
    }
    const previousEntryStr = getLogEntry(nextIndex-1);
    let previousEntry: LogEntry;
    if (previousEntryStr != "") {
        previousEntry = JSON.parse<LogEntry>(previousEntryStr);
    } else {
        previousEntry = new LogEntry(0, 0, 0, "");
    }
    const data = new AppendEntry(
        getTermId(),
        getCurrentNodeId(),
        nextIndex - 1,
        previousEntry.termId,
        entries,
        getCommitIndex(),
    )
    const datastr = JSON.stringify<AppendEntry>(data);
    const dataBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(datastr)));
    // we send the request to the same contract
    const contract = wasmx.getAddress();
    const response = wasmxwrap.grpcRequest(nodeIp, Uint8Array.wrap(contract), dataBase64);
    const resp = JSON.parse<AppendEntryResponse>(response);
    // TODO something with resp.term
    if (resp.success) {
        nextIndexPerNode[nodeId] = lastIndex;
        setNextIndexArray(nextIndexPerNode);
    }
}

export function sendNewTransactionResponse(
    params: ActionParam[],
    event: EventObject,
): void {
    // we expect that an entry has been added
    const entry = getLastLog();
    const response = new TransactionResponse(
        entry.termId,
        entry.leaderId,
        entry.index,
    );
    wasmx.finish(String.UTF8.encode(JSON.stringify<TransactionResponse>(response)));
}

export function appendLog(
    params: ActionParam[],
    event: EventObject,
): void {
    let transaction: string = "";
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "transaction") {
            transaction = event.params[i].value;
            continue;
        }
    }
    if (transaction === "") {
        revert("no transaction found");
    }
    return appendLogInternal(transaction)
}

function getLastLog(): LogEntry {
    const index = getLogCount();
    const entry = getLogEntry(index);
    return JSON.parse<LogEntry>(entry);
}

export function getLogEntry(
    index: i64,
): string {
    const key = getLogEntryKey(index);
    return storage.getContextValue(key);
}

export function appendLogInternal(
    transaction: string, // base64
): void {
    const index = getLogCount() + 1;
    const hash = "";
    const parentHash = "";
    // TODO verify transaction data
    // const transactionbuf = decode(transaction);
    // const transactions: Transaction[] = [JSON.parse<Transaction>(String.UTF8.decode(transactionbuf))];
    const block = new Block(hash, parentHash, [transaction]);
    const blockData = JSON.stringify<Block>(block);
    const blockDataBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(blockData)))
    const termId = getTermId();
    const leaderId = getCurrentNodeId();
    const entry = new LogEntry(index, termId, leaderId, blockDataBase64);
    const entryData = JSON.stringify<LogEntry>(entry);
    setLogCount(index);
    setLogEntry(index, entryData);
}

export function appendLogEntry(
    entry: LogEntry,
): void {
    const entryData = JSON.stringify<LogEntry>(entry);
    const index = getLogCount() + 1;
    setLogCount(index);
    setLogEntry(index, entryData);
}

export function setLogEntry(
    index: i64,
    entry: string,
): void {
    const key = getLogEntryKey(index);
    storage.setContextValue(key, entry);
}

export function getLogCount(): i64 {
    const key = getLogCountKey();
    const valuestr = storage.getContextValue(key);
    console.log("==getLogCount==" + key + "--" + valuestr);
    if (valuestr != "") {
        const value = parseInt(valuestr);
        return i64(value);
    }
    return i64(0);
}

export function setLogCount(
    value: i64,
): void {
    const key = getLogCountKey();
    storage.setContextValue(key, value.toString());
}

export function getLogEntryKey(index: i64): string {
    return "logs_" + index.toString();
}

export function getLogCountKey(): string {
    return "logs_count";
}

/// Context values
const NODE_IPS = "nodeIPs";
const TERM_ID = "currentTerm";
const CURRENT_NODE_ID = "currentNodeId";
const HEARTBEAT_TIMEOUT = "heartbeatTimeout";
// index of highest log entry applied to state machine (initialized to 0, increases monotonically)
const LAST_APPLIED = "lastApplied";
// index of highest log entry known to be committed (initialized to 0, increases monotonically)
const COMMIT_INDEX = "commitIndex";

//for each server, index of highest log entry known to be replicated on server (initialized to 0, increases monotonically)
const MATCH_INDEX_ARRAY = "matchIndex";
// for each server, index of the next log entry to send to that server (initialized to leader last log index + 1)
const NEXT_INDEX_ARRAY = "nextIndex";

// index of log entry immediately preceding new ones
// const PREV_LOG_INDEX = "prevLogIndex";

// updateNextIndex
// updateMatchIndex

function getTermId(): i32 {
    const valuestr = storage.getContextValue(TERM_ID);
    if (!valuestr) revert(TERM_ID + " missing");
    const value = parseInt(valuestr);
    return i32(value);
}

function getCurrentNodeId(): i32 {
    const valuestr = storage.getContextValue(CURRENT_NODE_ID);
    if (!valuestr) revert(CURRENT_NODE_ID + " missing");
    const value = parseInt(valuestr);
    return i32(value);
}

function getLastApplied(): i64 {
    const valuestr = storage.getContextValue(LAST_APPLIED);
    if (!valuestr) revert(LAST_APPLIED + " missing");
    const value = parseInt(valuestr);
    return i64(value);
}

function getCommitIndex(): i64 {
    const valuestr = storage.getContextValue(COMMIT_INDEX);
    if (!valuestr) revert(COMMIT_INDEX + " missing");
    const value = parseInt(valuestr);
    return i64(value);
}

function getMatchIndexArray(): Array<i64> {
    const valuestr = storage.getContextValue(MATCH_INDEX_ARRAY);
    if (!valuestr) revert(MATCH_INDEX_ARRAY + " missing");
    const value = JSON.parse<Array<i64>>(valuestr);
    return value;
}

function getNextIndexArray(): Array<i64> {
    const valuestr = storage.getContextValue(NEXT_INDEX_ARRAY);
    if (!valuestr) revert(NEXT_INDEX_ARRAY + " missing");
    const value = JSON.parse<Array<i64>>(valuestr);
    return value;
}

function getNodeIPs(): Array<string> {
    const valuestr = storage.getContextValue(NODE_IPS);
    if (!valuestr) revert(NODE_IPS + " missing");
    const value = JSON.parse<Array<string>>(valuestr);
    return value;
}

function setNextIndexArray(arr: Array<i64>): void {
    storage.setContextValue(NEXT_INDEX_ARRAY, JSON.stringify<Array<i64>>(arr));
}
