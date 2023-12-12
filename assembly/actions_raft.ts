import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';
import * as consensuswrap from './consensus_wrap';
import * as storage from './storage';

import {
  EventObject,
  ActionParam,
} from './types';
import { hexToUint8Array, revert, parseInt32, parseInt64, i32ToUint8ArrayBE, uint8ArrayToHex, i64ToUint8ArrayBE } from "./utils";
import { LogEntry, TransactionResponse, AppendEntry, AppendEntryResponse } from "./types_raft";
import * as typestnd from "./types_tendermint";

// start at 0 TODO?
const LOG_START = 1;

// LEADER:
// new tx -> check tx -> add to mempool
// proposeBlock -> mempool batch -> startBlockProposal -> propose block -> process block -> save to logs
// commitBlocks -> startBlockFinalization -> finalize block -> commit -> save to logs + index transactions
// commitBlocks ->


// ABCISemVer is the semantic version of the ABCI protocol
const ABCISemVer  = "2.0.0"
const ABCIVersion = ABCISemVer
// P2PProtocol versions all p2p behavior and msgs.
// This includes proposer selection.
const P2PProtocol: u64 = 8
// BlockProtocol versions all block data structures and processing.
// This includes validity of blocks and state updates.
const BlockProtocol: u64 = 12;


//// blockchain constants
// MaxBlockSizeBytes is the maximum permitted size of the blocks.
export const MaxBlockSizeBytes = 104857600 // 100MB

// BlockPartSizeBytes is the size of one block part.
export const BlockPartSizeBytes: u32 = 65536 // 64kB

// MaxBlockPartsCount is the maximum number of block parts.
export const MaxBlockPartsCount = (MaxBlockSizeBytes / BlockPartSizeBytes) + 1

export function setupNode(
    params: ActionParam[],
    event: EventObject,
): void {
    let currentNodeId: string = "";
    let nodeIPs: string = "";
    let initChainSetup: string = "";
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === CURRENT_NODE_ID) {
            currentNodeId = event.params[i].value;
            continue;
        }
        if (event.params[i].key === NODE_IPS) {
            nodeIPs = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "initChainSetup") {
            initChainSetup = event.params[i].value;
            continue;
        }
    }
    if (currentNodeId === "") {
        revert("no currentNodeId found");
    }
    if (nodeIPs === "") {
        revert("no nodeIPs found");
    }
    if (initChainSetup === "") {
        revert("no initChainSetup found");
    }
    storage.setContextValue(CURRENT_NODE_ID, currentNodeId);
    storage.setContextValue(NODE_IPS, nodeIPs);

    const data = JSON.parse<typestnd.InitChainSetup>(String.UTF8.decode(decodeBase64(initChainSetup).buffer));
    initChain(data);

    const ips = JSON.parse<string[]>(nodeIPs);
    const nextIndex: Array<i64> = [];
    const matchIndex: Array<i64> = [];
    for (let i = 0; i < ips.length; i++) {
        nextIndex[i] = LOG_START + 1; // TODO ?
        matchIndex[i] = LOG_START; // TODO ?
    }
    setNextIndexArray(nextIndex);
    setMatchIndexArray(matchIndex);
}

function initChain(req: typestnd.InitChainSetup): void {
    // TODO what are the correct empty valuew?
    const emptyBlockId = new typestnd.BlockID("", new typestnd.PartSetHeader(0, ""))
    const last_commit_hash = ""
    const currentHashes = new typestnd.CurrentState(
        req.chain_id,
        req.version,
        req.app_hash,
        emptyBlockId,
        last_commit_hash,
        req.last_results_hash,
        req.current_validator,
    );
    setConsensusParams(req.consensus_params);
    setValidators(req.validators);
    setCurrentState(currentHashes);
}

export function processAppendEntries(
    params: ActionParam[],
    event: EventObject,
): void {
    // here we receive new entries/logs/blocks
    // we need to run ProcessProposal on each block
    // and then FinalizeBlock & Commit
    let entryBase64: string = event.params[0].value;
    console.log("==processAppendEntries==" + entryBase64)
    const entryStr = String.UTF8.decode(decodeBase64(entryBase64).buffer);
    console.log("==processAppendEntries=entryStr=" + entryStr)
    let entry: AppendEntry = JSON.parse<AppendEntry>(entryStr);
    for (let i = 0; i < entry.entries.length; i++) {
        processAppendEntry(entry.entries[i]);
    }
    console.log("==processAppendEntries=processed entries=")
    setTermId(entry.termId);
    // TODO
    // entry.leaderId ?
    const lastCommitIndex = getCommitIndex();
    console.log("==processAppendEntries=lastCommitIndex=" + lastCommitIndex.toString() + "==" +  entry.leaderCommit.toString())
    for (let i = lastCommitIndex + 1; i <= entry.leaderCommit; i++) {
        startBlockFinalization(i);
        setCommitIndex(i);
    }
}

export function processAppendEntry(entry: LogEntry): void {
    const data = decodeBase64(entry.data);
    const processReq = JSON.parse<typestnd.RequestProcessProposal>(String.UTF8.decode(data.buffer));
    const processResp = consensuswrap.ProcessProposal(processReq);
    console.log("==processAppendEntry=after ProcessProposal=" + processResp.status.toString())
    if (processResp.status === typestnd.ProposalStatus.REJECT) {
        // TODO - what to do here? returning just discards the block and does not return a response to the leader
        // but this node will not sync with the leader anymore
        console.error("[Follower] ProcessProposal rejected for height: " + processReq.height.toString())
        return;
    }
    console.log("==processAppendEntry=pre appendLogEntry=")
    appendLogEntry(entry);
}

export function sendHeartbeatResponse(
    params: ActionParam[],
    event: EventObject,
): void {
    const termId = getTermId();
    // TODO when not successful
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

export function commitBlocks(
    params: ActionParam[],
    event: EventObject,
): void {
    checkCommits();
}

function checkCommits(): void {
    const lastCommitIndex = getLastApplied();
    // all commited + uncommited logs
    const lastLogIndex = getLogCount();
    const currentNodeId = getCurrentNodeId();
    const nextIndexPerNode = getNextIndexArray();
    const len = nextIndexPerNode.length;
    const majority = i64(f64.floor(f64(len) / 2) + 1);
    console.log("--majority-" + majority.toString());
    let nextCommit = lastCommitIndex + 1;
    if (lastLogIndex < nextCommit) {
        return;
    }
    let count = 1; // leader
    for (let i = 0; i < len; i++) {
        // next index is the next index to send, so we use >
        if (nextIndexPerNode.at(i) > nextCommit) {
            count += 1;
        }
    }
    if (count >= majority) {
        // We commit the state
        startBlockFinalization(nextCommit);
        // update last commited!
        setLastApplied(nextCommit);
        // We try the next index
        // checkCommits(); // we rely on the eventual transaction
    }
}

// TODO continue sending the entries until all nodes receive them
// TODO make this an eventual and retry until responses are received or leader is changed
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
        previousEntry = new LogEntry(0, 0, 0, "", "", "", "");
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
    console.log("==grpcRequest response==" + response);
    const resp = JSON.parse<AppendEntryResponse>(response);
    // TODO something with resp.term
    if (resp.success) {
        nextIndexPerNode[nodeId] = lastIndex;
        setNextIndexArray(nextIndexPerNode);
    }
}

function updateNextIndex(
    params: ActionParam[],
    event: EventObject,
): void {

}

function updateMatchIndex(
    params: ActionParam[],
    event: EventObject,
): void {
    let termId: i32 = 0;
    let success: bool = false;
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "termId") {
            termId = parseInt32(event.params[i].value);
            continue;
        }
        if (event.params[i].key === "success") {
            if (event.params[i].value === "")
            console.log("==success==" + event.params[i].value);
            if (event.params[i].value === "true") {
                success = true;
            }
            continue;
        }
    }
    // TODO termId
    // TODO success false?
    if (!success) return;
    // const matchIndex = getMatchIndexArray();

}

function commitTransaction(
    params: ActionParam[],
    event: EventObject,
): void {

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

export function proposeBlock(
    params: ActionParam[],
    event: EventObject,
): void {
    const mempool = getMempool();
    const cparams = getConsensusParams();
    let maxbytes = cparams.block.max_bytes;
    if (maxbytes == -1) {
        maxbytes = MaxBlockSizeBytes;
    }
    let maxgas = cparams.block.max_gas;
    const batch = mempool.batch(maxgas, maxbytes);

    // TODO
    // maxDataBytes := types.MaxDataBytes(maxBytes, evSize, state.Validators.Size())
    const maxDataBytes = maxbytes;

    // start proposal protocol
    startBlockProposal(batch.txs, batch.cummulatedGas, maxDataBytes);
    setMempool(mempool);
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
    // check that tx is valid
    const checktx = new typestnd.RequestCheckTx(transaction, typestnd.CheckTxType.New);
    const checkResp = consensuswrap.CheckTx(checktx);
    console.log("-checkResp-" + checkResp.code.toString())
    // we only check the code type; CheckTx should be stateless, just form checking
    if (checkResp.code !== typestnd.CodeType.Ok) {
        // transaction is not valid, we should finish
        return revert(`transaction is invalid; code ${checkResp.code}`);
    }

    // add to mempool
    const mempool = getMempool();
    console.log("-mempool-" + mempool.txs.length.toString())
    // TODO actually decode tx
    // const parsedTx = decodeTx(transaction);
    const parsedTx =  new typestnd.Transaction(15000000);
    const cparams = getConsensusParams();
    const maxgas = cparams.block.max_gas;
    if (maxgas < parsedTx.gas) {
        return revert(`out of gas: ${parsedTx.gas}; max ${maxgas}`);
    }
    console.log("-mempool before add-")
    mempool.add(transaction, parsedTx.gas);
    setMempool(mempool);
}

function startBlockProposal(txs: string[], cummulatedGas: i64, maxDataBytes: i64): void {
    // PrepareProposal TODO finish
    const height = getLogCount() + 1;
    console.log("* start block proposal: " + height.toString())
    const currentState = getCurrentState();
    const validators = getValidators();

    // TODO correct votes?
    // lastExtCommit *types.ExtendedCommit
    // lastExtCommit = cs.LastCommit.MakeExtendedCommit(cs.state.ConsensusParams.ABCI)
    const localLastCommit = new typestnd.ExtendedCommitInfo(0, new Array<typestnd.ExtendedVoteInfo>(0));
    const nextValidatorsHash = getValidatorsHash(validators);
    const proposerAddress = currentState.current_validator;
    const misbehavior: typestnd.Misbehavior[] = []; // block.Evidence.Evidence.ToABCI()

    const time = new Date(Date.now())

    const prepareReq = new typestnd.RequestPrepareProposal(
        maxDataBytes,
        txs,
        localLastCommit,
        misbehavior,
        height,
        time.toISOString(),
        nextValidatorsHash,
        proposerAddress,
    );

    const prepareResp = consensuswrap.PrepareProposal(prepareReq);

    // ProcessProposal: now check block is valid
    const lastCommit = new typestnd.CommitInfo(0, []); // TODO
    const lastBlockCommit = new typestnd.BlockCommit(prepareReq.height -1, 0, currentState.last_block_id, []); // TODO
    const evidence = new typestnd.Evidence(); // TODO
    // TODO load app version from storage or Info()?

    const header = new typestnd.Header(
        new typestnd.VersionConsensus(BlockProtocol, currentState.version.consensus.app),
        currentState.chain_id,
        prepareReq.height,
        prepareReq.time,
        currentState.last_block_id,
        getCommitHash(lastBlockCommit),
        getTxsHash(prepareResp.txs),
        nextValidatorsHash,
        nextValidatorsHash,
        getConsensusParamsHash(getConsensusParams()),
        currentState.app_hash,
        currentState.last_results_hash,
        getEvidenceHash(evidence),
        prepareReq.proposer_address,
    );
    const hash = getHeaderHash(header);
    const processReq = new typestnd.RequestProcessProposal(
        prepareResp.txs,
        lastCommit,
        prepareReq.misbehavior,
        hash,
        prepareReq.height,
        prepareReq.time,
        prepareReq.next_validators_hash,
        prepareReq.proposer_address,
    )
    const processResp = consensuswrap.ProcessProposal(processReq);
    if (processResp.status === typestnd.ProposalStatus.REJECT) {
        // TODO - what to do here? returning just discards the block and the transactions
        console.error("[Leader] ProcessProposal rejected for height: " + height.toString())
        return;
    }
    // We have a valid proposal to propagate to other nodes
    return appendLogInternalVerified(processReq, header, lastBlockCommit);
}

function startBlockFinalization(index: i64): void {
    console.log("* start block finalization: " + index.toString())
    // get entry and apply it
    const entry = getLogEntry(index);
    console.log("--startBlockFinalization-entry-" + entry)
    const entryobj = JSON.parse<LogEntry>(entry);
    const processReqBz = String.UTF8.decode(decodeBase64(entryobj.data).buffer);
    console.log("--startBlockFinalization-processReqBz-" + processReqBz)
    const processReq = JSON.parse<typestnd.RequestProcessProposal>(processReqBz);
    const finalizeReq = new typestnd.RequestFinalizeBlock(
        processReq.txs,
        processReq.proposed_last_commit,
        processReq.misbehavior,
        processReq.hash,
        processReq.height,
        processReq.time,
        processReq.next_validators_hash,
        processReq.proposer_address,
    )
    const finalizeResp = consensuswrap.FinalizeBlock(finalizeReq);
    console.log("--startBlockFinalization-post FinalizeBlock-");

    // TODO save less info? (events tx_results)
    const resultstr = JSON.stringify<typestnd.ResponseFinalizeBlock>(finalizeResp);
    const resultBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(resultstr)));
    entryobj.result = resultBase64;
    console.log("--startBlockFinalization-post FinalizeBlock stringified-" + entryobj.result);

    const commitBz = String.UTF8.decode(decodeBase64(entryobj.commit).buffer);
    console.log("--startBlockFinalization-commitBz-" + commitBz)
    const commit = JSON.parse<typestnd.BlockCommit>(commitBz);

    const last_commit_hash = getCommitHash(commit);
    const last_results_hash = getResultsHash(finalizeResp.tx_results);

    // update app_hash
    const state = getCurrentState();
    state.app_hash = finalizeResp.app_hash;
    state.last_block_id = new typestnd.BlockID(finalizeReq.hash, new typestnd.PartSetHeader(0, finalizeReq.hash.slice(0, 8)));
    state.last_commit_hash = last_commit_hash
    state.last_results_hash = last_results_hash
    setCurrentState(state);
    // update consensus params
    updateConsensusParams(finalizeResp.consensus_param_updates);
    // update validator info
    updateValidators(finalizeResp.validator_updates);

    // ! make all state changes before the commit

    // update existing log entry
    setLogEntryObj(entryobj);

    // index transactions
    for (let i = 0; i < finalizeReq.txs.length; i++) {
        // store IndexedTransaction
        const hash = wasmxwrap.sha256(finalizeReq.txs[i]);
        setIndexedTransaction(new typestnd.IndexedTransaction(finalizeReq.height, i), hash)
    }

    const commitResponse = consensuswrap.Commit();
    // TODO commitResponse.retainHeight
    // Tendermint removes all data for heights lower than `retain_height`
    console.log("--startBlockFinalization-commitResponse.retainHeight-" + commitResponse.retainHeight.toString());
    console.log(`* BLOCK FINALIZED: ` + index.toString());
}

function appendLogInternalVerified(processReq: typestnd.RequestProcessProposal, header: typestnd.Header, blockCommit: typestnd.BlockCommit): void {
    console.log("==appendLogInternalVerified==")
    // const hash = "";
    // const parentHash = "";
    // TODO verify transaction data
    // const transactionbuf = decode(transaction);
    // const transactions: Transaction[] = [JSON.parse<Transaction>(String.UTF8.decode(transactionbuf))];
    // const block = new Block(hash, parentHash, [transaction]);
    // const blockData = JSON.stringify<Block>(block);

    const blockData = JSON.stringify<typestnd.RequestProcessProposal>(processReq);
    const blockDataBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(blockData)))
    const blockHeader = JSON.stringify<typestnd.Header>(header);
    const blockHeaderBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(blockHeader)))
    const commit = JSON.stringify<typestnd.BlockCommit>(blockCommit);
    const commitBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(commit)))
    const termId = getTermId();
    const leaderId = getCurrentNodeId();
    const entry = new LogEntry(processReq.height, termId, leaderId, blockDataBase64, blockHeaderBase64, commitBase64, "");
    appendLogEntry(entry);
}

export function appendLogEntry(
    entry: LogEntry,
): void {
    const index = getLogCount() + 1;
    // TODO entry may be sent multiple times, we need to see if we already added it
    // and just return if already saved
    if (index !== entry.index) {
        revert(`mismatched index while appending log entry: expected ${index}, found ${entry.index}`);
    }
    setLogCount(index);
    setLogEntryObj(entry);
}

export function setLogEntryObj(
    entry: LogEntry,
): void {
    const data = JSON.stringify<LogEntry>(entry);
    setLogEntry(entry.index, data);
}

export function setLogEntry(
    index: i64,
    entry: string,
): void {
    console.log("--setLogEntry--" + index.toString() + "--" + entry);
    const key = getLogEntryKey(index);
    storage.setContextValue(key, entry);
}

export function getLogCount(): i64 {
    const key = getLogCountKey();
    const valuestr = storage.getContextValue(key);
    console.log("==getLogCount==" + key + "==" + valuestr)
    if (valuestr != "") {
        const value = parseInt(valuestr);
        return i64(value);
    }
    return i64(LOG_START);
}

export function setLogCount(
    value: i64,
): void {
    const key = getLogCountKey();
    console.log("==setLogCount==" + key + "==" + value.toString())
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
const CURRENT_NODE_ID = "currentNodeId";
const HEARTBEAT_TIMEOUT = "heartbeatTimeout";

//// Persistent state on all servers:
const TERM_ID = "currentTerm";
// votedFor
// log[]

//// Volatile state on all servers:
// index of highest log entry applied to state machine (initialized to 0, increases monotonically)
const LAST_APPLIED = "lastApplied";
// index of highest log entry known to be committed (initialized to 0, increases monotonically)
const COMMIT_INDEX = "commitIndex";

//// Volatile state on leaders
// for each server, index of highest log entry known to be replicated on server (initialized to 0, increases monotonically)
const MATCH_INDEX_ARRAY = "matchIndex";
// for each server, index of the next log entry to send to that server (initialized to leader last log index + 1)
const NEXT_INDEX_ARRAY = "nextIndex";

//// Cosmos-specific
const MEMPOOL_KEY = "mempool";

const MAX_TX_BYTES = "max_tx_bytes";

// index of log entry immediately preceding new ones
// const PREV_LOG_INDEX = "prevLogIndex";

//// blockchain
const TX_INDEXER = "tx_";

const PARAMS_KEY = "consensus_params";
const VALIDATORS_KEY = "validators";
const STATE_KEY = "state";

function getTermId(): i32 {
    const value = storage.getContextValue(TERM_ID);
    if (value === "") return i32(0);
    return parseInt32(value);
}

function setTermId(value: i32): void {
    storage.setContextValue(TERM_ID, value.toString());
}

function getCurrentNodeId(): i32 {
    const value = storage.getContextValue(CURRENT_NODE_ID);
    if (value === "") return i32(0);
    return parseInt32(value);
}

function getLastApplied(): i64 {
    const value = storage.getContextValue(LAST_APPLIED);
    if (value === "") return i64(LOG_START);
    return parseInt64(value);
}

function setLastApplied(value: i64): void {
    storage.setContextValue(LAST_APPLIED, value.toString());
}

function getCommitIndex(): i64 {
    const value = storage.getContextValue(COMMIT_INDEX);
    if (value === "") return i64(LOG_START);
    return parseInt64(value);
}

function setCommitIndex(index: i64): void {
    storage.setContextValue(COMMIT_INDEX, index.toString());
}

function getMatchIndexArray(): Array<i64> {
    const valuestr = storage.getContextValue(MATCH_INDEX_ARRAY);
    let value: Array<i64> = [];
    if (valuestr === "") return value;
    value = JSON.parse<Array<i64>>(valuestr);
    return value;
}

function setMatchIndexArray(value: Array<i64>): void {
    storage.setContextValue(MATCH_INDEX_ARRAY, JSON.stringify<Array<i64>>(value));
}

function getNextIndexArray(): Array<i64> {
    const valuestr = storage.getContextValue(NEXT_INDEX_ARRAY);
    let value: Array<i64> = [];
    if (valuestr === "") return value;
    value = JSON.parse<Array<i64>>(valuestr);
    return value;
}

function getNodeIPs(): Array<string> {
    const valuestr = storage.getContextValue(NODE_IPS);
    let value: Array<string> = [];
    if (valuestr === "") return value;
    value = JSON.parse<Array<string>>(valuestr);
    return value;
}

function setNextIndexArray(arr: Array<i64>): void {
    storage.setContextValue(NEXT_INDEX_ARRAY, JSON.stringify<Array<i64>>(arr));
}

export function getMempool(): typestnd.Mempool {
    const mempool = storage.getContextValue(MEMPOOL_KEY);
    if (mempool === "") return  new typestnd.Mempool(new Array<string>(0), new Array<i32>(0));
    return JSON.parse<typestnd.Mempool>(mempool);
}

export function setMempool(mempool: typestnd.Mempool): void {
    storage.setContextValue(MEMPOOL_KEY, JSON.stringify<typestnd.Mempool>(mempool));
}

export function getMaxTxBytes(): i64 {
    const value = storage.getContextValue(MAX_TX_BYTES);
    if (value === "") return i64(0);
    return parseInt64(value);
}

export function setMaxTxBytes(value: i64): void {
    storage.setContextValue(MAX_TX_BYTES, value.toString());
}

function getIndexedTransaction(hash: string): typestnd.IndexedTransaction {
    const value = storage.getContextValue(keyIndexedTransaction(hash));
    return JSON.parse<typestnd.IndexedTransaction>(value);
}

function setIndexedTransaction(tx: typestnd.IndexedTransaction, hash: string): void {
    storage.setContextValue(keyIndexedTransaction(hash), JSON.stringify<typestnd.IndexedTransaction>(tx));
}

function keyIndexedTransaction(hash: string): string {
    return TX_INDEXER + hash;
}

export function getConsensusParams(): typestnd.ConsensusParams {
    const value = storage.getContextValue(PARAMS_KEY);
    if (value === "") return new typestnd.ConsensusParams(
        new typestnd.BlockParams(0, 0),
        new typestnd.EvidenceParams(0, 0, 0),
        new typestnd.ValidatorParams([]),
        new typestnd.VersionParams(0),
        new typestnd.ABCIParams(0),
    );
    return JSON.parse<typestnd.ConsensusParams>(value);
}

export function setConsensusParams(value: typestnd.ConsensusParams): void {
    storage.setContextValue(PARAMS_KEY, JSON.stringify<typestnd.ConsensusParams>(value));
}

export function getValidators(): typestnd.ValidatorInfo[] {
    const value = storage.getContextValue(VALIDATORS_KEY);
    if (value === "") return [];
    return JSON.parse<typestnd.ValidatorInfo[]>(value);
}

export function setValidators(value: typestnd.ValidatorInfo[]): void {
    storage.setContextValue(VALIDATORS_KEY, JSON.stringify<typestnd.ValidatorInfo[]>(value));
}

export function updateValidators(updates: typestnd.ValidatorUpdate[]): void {
    const validators = getValidators();
    for (let i = 0; i < updates.length; i++) {
        for (let j = 0; j < validators.length; j++) {
            if (validators[j].pub_key == updates[i].pub_key) {
                validators[j].voting_power = updates[i].power;
            }
        }
    }
    setValidators(validators);
}

export function updateConsensusParams(updates: typestnd.ConsensusParams): void {
    const params = getConsensusParams();
    if (updates.abci) {
        if (updates.abci.vote_extensions_enable_height) {
            params.abci.vote_extensions_enable_height = updates.abci.vote_extensions_enable_height;
        }
    }
    if (updates.block) {
        if (updates.block.max_bytes) params.block.max_bytes = updates.block.max_bytes;
        if (updates.block.max_gas) params.block.max_gas = updates.block.max_gas;
    }
    if (updates.evidence) {
        if (updates.evidence.max_age_duration) params.evidence.max_age_duration = updates.evidence.max_age_duration;
        if (updates.evidence.max_age_num_blocks) params.evidence.max_age_num_blocks = updates.evidence.max_age_num_blocks;
        if (updates.evidence.max_bytes) params.evidence.max_bytes = updates.evidence.max_bytes;
    }
    if (updates.validator) {
        if (updates.validator.pub_key_types) params.validator.pub_key_types = updates.validator.pub_key_types;
    }
    if (updates.version) {
        if (updates.version.app) params.version.app = updates.version.app;
    }
    setConsensusParams(params);
}

export function getCurrentState(): typestnd.CurrentState {
    const value = storage.getContextValue(STATE_KEY);
    // this must be set before we try to read it
    if (value === "") {
        revert("chain init setup was not ran")
    }
    return JSON.parse<typestnd.CurrentState>(value);
}

export function setCurrentState(value: typestnd.CurrentState): void {
    storage.setContextValue(STATE_KEY, JSON.stringify<typestnd.CurrentState>(value));
}

// ValidatorSet.Validators hash (ValidatorInfo[] hash)
// TODO cometbft protobuf encodes cmtproto.SimpleValidator
function getValidatorsHash(validators: typestnd.ValidatorInfo[]): string {
    let data = new Array<string>(validators.length);
    for (let i = 0; i < validators.length; i++) {
        console.log("--getValidatorsHash-pub_key-" + i.toString() + "-" + validators[i].pub_key)
        // hex
        const pub_key = hexToUint8Array(validators[i].pub_key);
        const power = i64ToUint8ArrayBE(validators[i].voting_power);
        const newdata = new Uint8Array(pub_key.length + power.length);
        newdata.set(pub_key, 0);
        newdata.set(power, pub_key.length);
        data[i] = uint8ArrayToHex(newdata);
    }
    return consensuswrap.MerkleHash(data);
}

// Txs.Hash() -> [][]byte merkle.HashFromByteSlices
// base64
export function getTxsHash(txs: string[]): string {
    return consensuswrap.MerkleHash(txs);
}

// Hash returns a hash of a subset of the parameters to store in the block header.
// Only the Block.MaxBytes and Block.MaxGas are included in the hash.
// This allows the ConsensusParams to evolve more without breaking the block
// protocol. No need for a Merkle tree here, just a small struct to hash.
// cometbft: cmtproto.HashedParams
export function getConsensusParamsHash(params: typestnd.ConsensusParams): string {
    const value = JSON.stringify<typestnd.BlockParams>(params.block);
    const hash = wasmx.sha256(String.UTF8.encode(value));
    return encodeBase64(Uint8Array.wrap(hash));
}

// []Evidence hash
// TODO
export function getEvidenceHash(params: typestnd.Evidence): string {
    return consensuswrap.MerkleHash([]);
}

export function getCommitHash(lastCommit: typestnd.BlockCommit): string {
    // TODO MerkleHash(lastCommit.signatures)
    return consensuswrap.MerkleHash([]);
}

export function getResultsHash(results: typestnd.ExecTxResult[]): string {
    const data = new Array<string>(results.length);
    for (let i = 0; i < results.length; i++) {
        data[i] = encodeBase64(Uint8Array.wrap(String.UTF8.encode(JSON.stringify<typestnd.ExecTxResult>(results[i]))));
    }
    return consensuswrap.MerkleHash(data);
}

// Hash returns the hash of the header.
// It computes a Merkle tree from the header fields
// ordered as they appear in the Header.
// Returns nil if ValidatorHash is missing,
// since a Header is not valid unless there is
// a ValidatorsHash (corresponding to the validator set).
function getHeaderHash(header: typestnd.Header): string {
    const versionbz = String.UTF8.encode(JSON.stringify<typestnd.VersionConsensus>(header.version));
    const blockidbz = String.UTF8.encode(JSON.stringify<typestnd.BlockID>(header.last_block_id));
    const data = [
        encodeBase64(Uint8Array.wrap(versionbz)),
        encodeBase64(Uint8Array.wrap(String.UTF8.encode(header.chain_id))),
        encodeBase64(i64ToUint8ArrayBE(header.height)),
        encodeBase64(Uint8Array.wrap(String.UTF8.encode(header.time))),
        encodeBase64(Uint8Array.wrap(blockidbz)),
        header.last_commit_hash,
        header.data_hash,
        header.validators_hash,
        header.next_validators_hash,
        header.consensus_hash,
        header.app_hash,
        header.last_results_hash,
        header.evidence_hash,
        header.proposer_address, // TODO transform hex to base64
    ]
    return consensuswrap.MerkleHash(data);
}
