import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';

import {
  EventObject,
  Typestate,
  ActionParam,
} from './types';
import { hexToUint8Array, revert, parseInt32, parseInt64 } from "./utils";
import { Block, LogEntry, Transaction, TransactionResponse, AppendEntry, AppendEntryResponse } from "./types_raft";

export function processAppendEntries<
TContext extends Map<string,string>,
TEvent extends EventObject,
TState extends Typestate<TContext>,
>(
    serviceId: i32,
    ctx: TContext,
    params: ActionParam[],
    event: TEvent,
): TContext {
    let entryBase64: string = event.params[0].value;
    console.log("==processAppendEntries==" + entryBase64)
    const entryStr = String.UTF8.decode(decodeBase64(entryBase64).buffer);
    console.log("==processAppendEntries=entryStr=" + entryStr)
    let entry: AppendEntry = JSON.parse<AppendEntry>(entryStr);
    for (let i = 0; i < entry.entries.length; i++) {
        appendLogEntry(serviceId, ctx, entry.entries[i]);
    }
    // TODO the rest of the verifications
    return ctx
}

export function sendHeartbeatResponse<
TContext extends Map<string,string>,
TEvent extends EventObject,
TState extends Typestate<TContext>,
>(
    serviceId: i32,
    ctx: TContext,
    params: ActionParam[],
    event: TEvent,
): TContext {
    const termId = getTermId<TContext>(ctx);
    const response = new AppendEntryResponse(termId, true);
    wasmx.finish(String.UTF8.encode(JSON.stringify<AppendEntryResponse>(response)));
    return ctx;
}

export function sendAppendEntries<
TContext extends Map<string,string>,
TEvent extends EventObject,
TState extends Typestate<TContext>,
>(
    serviceId: i32,
    ctx: TContext,
    params: ActionParam[],
    event: TEvent,
): TContext {
    // go through each node
    const nodeId = getCurrentNodeId<TContext>(ctx);
    const ips = getNodeIPs<TContext>(ctx);
    for (let i = 0; i < ips.length; i++) {
        if (nodeId === i) continue;
        sendAppendEntry<TContext, TEvent, TState>(serviceId, ctx, i, ips[i]);
    }
    return ctx;
}

// TODO continue sending the entries until all nodes receive them
export function sendAppendEntry<
TContext extends Map<string,string>,
TEvent extends EventObject,
TState extends Typestate<TContext>,
>(
    serviceId: i32,
    ctx: TContext,
    nodeId: i32,
    nodeIp: string,
): void {
    const nextIndexPerNode = getNextIndexArray<TContext>(ctx);
    const nextIndex = nextIndexPerNode.at(nodeId);
    const lastIndex = getLogCount<TContext>(serviceId, ctx);
    const entries: Array<LogEntry> = [];
    for (let i = nextIndex; i <= lastIndex; i++) {
        const entry = getLogEntry<TContext>(serviceId, ctx, i);
        const entryobj = JSON.parse<LogEntry>(entry);
        entries.push(entryobj);
    }
    const previousEntryStr = getLogEntry<TContext>(serviceId, ctx, nextIndex-1);
    let previousEntry: LogEntry;
    if (previousEntryStr != "") {
        previousEntry = JSON.parse<LogEntry>(previousEntryStr);
    } else {
        previousEntry = new LogEntry(0, 0, 0, "");
    }
    const data = new AppendEntry(
        getTermId<TContext>(ctx),
        getCurrentNodeId<TContext>(ctx),
        nextIndex - 1,
        previousEntry.termId,
        entries,
        getCommitIndex<TContext>(ctx),
    )
    const datastr = JSON.stringify<AppendEntry>(data);
    const dataBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(datastr)))
    const response = wasmxwrap.grpcRequest(nodeIp, dataBase64);
    const resp = JSON.parse<AppendEntryResponse>(response);
    // TODO something with resp.term
    if (resp.success) {
        nextIndexPerNode[nodeId] = lastIndex;
        setNextIndexArray<TContext>(ctx, nextIndexPerNode);
    }
}

export function sendNewTransactionResponse<
TContext extends Map<string,string>,
TEvent extends EventObject,
TState extends Typestate<TContext>,
>(
    serviceId: i32,
    ctx: TContext,
    params: ActionParam[],
    event: TEvent,
): TContext {
    // we expect that an entry has been added
    const entry = getLastLog<TContext>(serviceId, ctx);
    const response = new TransactionResponse(
        entry.termId,
        entry.leaderId,
        entry.index,
    );
    wasmx.finish(String.UTF8.encode(JSON.stringify<TransactionResponse>(response)));
    return ctx;
}

export function appendLog<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>,
>(
    serviceId: i32,
    ctx: TContext,
    params: ActionParam[],
    event: TEvent,
): TContext {
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
    return appendLogInternal<TContext>(serviceId, ctx, transaction)
}

function getLastLog<
    TContext extends Map<string,string>,
>(
    serviceId: i32,
    ctx: TContext,
): LogEntry {
    const index = getLogCount<TContext>(serviceId, ctx);
    const entry = getLogEntry<TContext>(serviceId, ctx, index);
    return JSON.parse<LogEntry>(entry);
}

export function getLogEntry<
    TContext extends Map<string,string>,
>(
    serviceId: i32,
    ctx: TContext,
    index: i64,
): string {
    const key = getLogEntryKey(serviceId, index);
    if (ctx.has(key)) {
        return ctx.get(key);
    }
    return "";
}

export function appendLogInternal<
    TContext extends Map<string,string>,
>(
    serviceId: i32,
    ctx: TContext,
    transaction: string, // base64
): TContext {
    const index = getLogCount<TContext>(serviceId, ctx) + 1;
    const hash = "";
    const parentHash = "";
    // TODO verify transaction data
    // const transactionbuf = decode(transaction);
    // const transactions: Transaction[] = [JSON.parse<Transaction>(String.UTF8.decode(transactionbuf))];
    const block = new Block(hash, parentHash, [transaction]);
    const blockData = JSON.stringify<Block>(block);
    const blockDataBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(blockData)))
    const termId = getTermId<TContext>(ctx);
    const leaderId = getCurrentNodeId<TContext>(ctx);
    const entry = new LogEntry(index, termId, leaderId, blockDataBase64);
    const entryData = JSON.stringify<LogEntry>(entry);
    setLogCount<TContext>(serviceId, ctx, index);
    setLogEntry<TContext>(serviceId, ctx, index, entryData);
    return ctx;
}

export function appendLogEntry<
    TContext extends Map<string,string>,
>(
    serviceId: i32,
    ctx: TContext,
    entry: LogEntry,
): void {
    const entryData = JSON.stringify<LogEntry>(entry);
    const index = getLogCount<TContext>(serviceId, ctx) + 1;
    setLogCount<TContext>(serviceId, ctx, index);
    setLogEntry<TContext>(serviceId, ctx, index, entryData);
}

export function setLogEntry<
    TContext extends Map<string,string>,
>(
    serviceId: i32,
    ctx: TContext,
    index: i64,
    entry: string,
): TContext {
    const key = getLogEntryKey(serviceId, index);
    ctx.set(key, entry);
    return ctx;
}

export function getLogCount<
    TContext extends Map<string,string>,
>(
    serviceId: i32,
    ctx: TContext,
): i64 {
    const key = getLogCountKey(serviceId);
    if (ctx.has(key)) {
        const valuestr = ctx.get(key);
        const value = parseInt(valuestr);
        return i64(value);
    }
    return i64(0);
}

export function setLogCount<
    TContext extends Map<string,string>,
>(
    serviceId: i32,
    ctx: TContext,
    value: i64,
): TContext {
    const key = getLogCountKey(serviceId);
    ctx.set(key, value.toString());
    return ctx;
}

export function getLogEntryKey(serviceId: i32, index: i64): string {
    return "logs_" + serviceId.toString() + "_" + index.toString();
}

export function getLogCountKey(serviceId: i32): string {
    return "logs_count" + serviceId.toString();
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

function getTermId<
    TContext extends Map<string,string>,
>(ctx: TContext): i32 {
    if (!ctx.has(TERM_ID)) revert(TERM_ID + " missing");
    const valuestr = ctx.get(TERM_ID);
    const value = parseInt(valuestr);
    return i32(value);
}

function getCurrentNodeId<
    TContext extends Map<string,string>,
>(ctx: TContext): i32 {
    if (!ctx.has(CURRENT_NODE_ID)) revert(CURRENT_NODE_ID + " missing");
    const valuestr = ctx.get(CURRENT_NODE_ID);
    const value = parseInt(valuestr);
    return i32(value);
}

function getLastApplied<
    TContext extends Map<string,string>,
>(ctx: TContext): i64 {
    if (!ctx.has(LAST_APPLIED)) revert(LAST_APPLIED + " missing");
    const valuestr = ctx.get(LAST_APPLIED);
    const value = parseInt(valuestr);
    return i64(value);
}

function getCommitIndex<
    TContext extends Map<string,string>,
>(ctx: TContext): i64 {
    if (!ctx.has(COMMIT_INDEX)) revert(COMMIT_INDEX + " missing");
    const valuestr = ctx.get(COMMIT_INDEX);
    const value = parseInt(valuestr);
    return i64(value);
}

function getMatchIndexArray<
    TContext extends Map<string,string>,
>(ctx: TContext): Array<i64> {
    if (!ctx.has(MATCH_INDEX_ARRAY)) revert(MATCH_INDEX_ARRAY + " missing");
    const valuestr = ctx.get(MATCH_INDEX_ARRAY);
    const value = JSON.parse<Array<i64>>(valuestr);
    return value;
}

function getNextIndexArray<
    TContext extends Map<string,string>,
>(ctx: TContext): Array<i64> {
    if (!ctx.has(NEXT_INDEX_ARRAY)) revert(NEXT_INDEX_ARRAY + " missing");
    const valuestr = ctx.get(NEXT_INDEX_ARRAY);
    const value = JSON.parse<Array<i64>>(valuestr);
    return value;
}

function getNodeIPs<
    TContext extends Map<string,string>,
>(ctx: TContext): Array<string> {
    if (!ctx.has(NODE_IPS)) revert(NODE_IPS + " missing");
    const valuestr = ctx.get(NODE_IPS);
    const value = JSON.parse<Array<string>>(valuestr);
    return value;
}

function setNextIndexArray<
    TContext extends Map<string,string>,
>(ctx: TContext, arr: Array<i64>): void {
    ctx.set(NEXT_INDEX_ARRAY, JSON.stringify<Array<i64>>(arr));
}
