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
import { LogEntry, TransactionResponse, AppendEntry, AppendEntryResponse, VoteResponse, VoteRequest } from "./types_raft";
import * as typestnd from "./types_tendermint";
import { LoggerDebug, LoggerError } from "./consensus";

// Docs: https://raft.github.io/raft.pdf

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

export function initializeNextIndex(
    params: ActionParam[],
    event: EventObject,
): void {
    const lastIndex = getLogCount();
    const nextIndex = lastIndex + 1;
    const nextIndexes = getNextIndexArray();
    for (let i = 0; i < nextIndexes.length; i++) {
        nextIndexes[i] = nextIndex;
    }
    setNextIndexArray(nextIndexes);
}

export function initializeMatchIndex(
    params: ActionParam[],
    event: EventObject,
): void {
    const matchIndexes = getMatchIndexArray();
    for (let i = 0; i < matchIndexes.length; i++) {
        matchIndexes[i] = 0;
    }
    setMatchIndexArray(matchIndexes);
}

export function elapsedNotReset(
    params: ActionParam[],
    event: EventObject,
): boolean {
    return !getElectionReset();
}

export function setRandomElectionTimeout(
    params: ActionParam[],
    event: EventObject,
): void {
    let min: string = "";
    let max: string = "";
    if (params.length == 0) {
        params = event.params;
    }
    for (let i = 0; i < params.length; i++) {
        if (params[i].key === "min") {
            min = params[i].value;
            continue;
        }
        if (params[i].key === "max") {
            max = params[i].value;
            continue;
        }
    }
    if (min === "") {
        revert("no min found");
    }
    if (max === "") {
        revert("no max found");
    }
    const min_ = parseInt64(min)
    const max_ = parseInt64(max)
    setElectionTimeout(getRandomInRange(min_, max_));
    electionReset();
}

// received vote request
export function vote(
    params: ActionParam[],
    event: EventObject,
): void {
    let termId: i32 = 0;
    let candidateId: i32 = 0;
    let lastLogIndex: i64 = 0;
    let lastLogTerm: i32 = 0;
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "termId") {
            if (event.params[i].value === "") {
                revert("no termId found");
            }
            termId = parseInt32(event.params[i].value);
            continue;
        }
        if (event.params[i].key === "candidateId") {
            if (event.params[i].value === "") {
                revert("no candidateId found");
            }
            candidateId = parseInt32(event.params[i].value);
            continue;
        }
        if (event.params[i].key === "lastLogIndex") {
            if (event.params[i].value === "") {
                revert("no lastLogIndex found");
            }
            lastLogIndex = parseInt64(event.params[i].value);
            continue;
        }
        if (event.params[i].key === "lastLogTerm") {
            if (event.params[i].value === "") {
                revert("no lastLogTerm found");
            }
            lastLogTerm = parseInt32(event.params[i].value);
            continue;
        }
    }
    voteInternal(termId, candidateId, lastLogIndex, lastLogTerm);
}

export function incrementCurrentTerm(
    params: ActionParam[],
    event: EventObject,
): void {
    const termId = getTermId();
    setTermId(termId + 1);
}

export function selfVote(
    params: ActionParam[],
    event: EventObject,
): void {
    const myId = getCurrentNodeId();
    setVotedFor(myId);
    // initialize voting array for this node's election cycle
    const ips = getNodeIPs();
    const voteArray = new Array<i32>(ips.length);
    for (let i = 0; i < ips.length; i++) {
        voteArray[i] = 0;
    }
    voteArray[myId] = 1;
    setVoteIndexArray(voteArray);
}

export function sendVoteRequests(
    params: ActionParam[],
    event: EventObject,
): void {
    const termId = getTermId();
    const candidateId = getCurrentNodeId();
    const lastEntry = getLastLog();
    const lastLogIndex = lastEntry.index;
    const lastLogTerm = lastEntry.termId;

    // iterate through the other nodes and send a VoteRequest
    const request = new VoteRequest(termId, candidateId, lastLogIndex, lastLogTerm);
    const ips = getNodeIPs();
    consensuswrap.LoggerDebug("sending vote requests...", ["candidateId", candidateId.toString(), "termId", termId.toString(), "lastLogIndex", lastLogIndex.toString(), "lastLogTerm", lastLogTerm.toString(), "ips", JSON.stringify<Array<string>>(ips)])
    for (let i = 0; i < ips.length; i++) {
        if (candidateId === i) continue;
        sendVoteRequest(i, ips[i], request, termId);
    }
}

export function isVotedLeader(
    params: ActionParam[],
    event: EventObject,
): boolean {
    // check if we have a vote majority
    const voteArray = getVoteIndexArray();
    let count = 0;
    for (let i = 0; i < voteArray.length; i++) {
        count += voteArray[i];
    }
    const len = voteArray.length;
    const majority = i64(f64.floor(f64(len) / 2) + 1);
    return count >= majority;
}

function sendVoteRequest(nodeId: i32, nodeIp: string, request: VoteRequest, termId: i32): void {
    const datastr = JSON.stringify<VoteRequest>(request);
    const dataBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(datastr)));
    const contract = wasmx.getAddress();
    const response = wasmxwrap.grpcRequest(nodeIp, Uint8Array.wrap(contract), dataBase64);
    const resp = JSON.parse<VoteResponse>(response);
    // if vote granted, add to the votes and check that we have majority
    if (resp.voteGranted) {
        const voteArray = getVoteIndexArray();
        voteArray[nodeId] = 1;
        setVoteIndexArray(voteArray);
    } else {
        // update our termId if we are behind
        if (resp.termId > termId) {
            setTermId(resp.termId);
        }
        // TODO do we need to rollback entries?
    }
}

// TODO lastLogTerm
function voteInternal(termId: i32, candidateId: i32, lastLogIndex: i64, lastLogTerm: i32): void {
    const mytermId = getTermId();
    let response = new VoteResponse(mytermId, true);
    if (termId < mytermId) {
        response = new VoteResponse(mytermId, false);
    } else if (termId > mytermId) {
        // TODO what now?
        // this vote request should override what we have
        // TODO - we need to rollback uncommited changes from mytermId to termId
        // update termId & votedFor
        setTermId(termId);
        setVotedFor(candidateId);
    } else {
        // if we already voted, we do not grant a new vote
        if (hasVotedFor()) {
            response = new VoteResponse(mytermId, false);
        } else {
            // candidate’s log is at least as up-to-date as receiver’s log
            const lastIndex = getLogCount();
            if (lastLogIndex < lastIndex) {
                consensuswrap.LoggerDebug("candidate is not up-to-date", ["candidateLastIndex", lastLogIndex.toString(), "ourLastIndex", lastIndex.toString(), "candidateId", candidateId.toString()])
                response = new VoteResponse(mytermId, false);
            } else {
                setVotedFor(candidateId);
            }
        }
    }
    wasmx.setReturnData(String.UTF8.encode(JSON.stringify<VoteResponse>(response)));
}

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

    // !! nodeIps must be the same for all nodes

    // TODO ID@host:ip
    // 6efc12ab37fc0e096d8618872f6930df53972879@0.0.0.0:26757
    storage.setContextValue(NODE_IPS, nodeIPs);

    const datajson = String.UTF8.decode(decodeBase64(initChainSetup).buffer);
    consensuswrap.LoggerDebug("setupNode", ["currentNodeId", currentNodeId, "nodeIPs", nodeIPs, "initChainSetup", datajson])
    const data = JSON.parse<typestnd.InitChainSetup>(datajson);
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
    consensuswrap.LoggerDebug("start chain init", [])

    // TODO what are the correct empty valuew?
    const emptyBlockId = new typestnd.BlockID("", new typestnd.PartSetHeader(0, ""))
    const last_commit_hash = ""
    const currentState = new typestnd.CurrentState(
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

    const valuestr = JSON.stringify<typestnd.CurrentState>(currentState);
    consensuswrap.LoggerDebug("set current state", ["state", valuestr])
    setCurrentState(currentState);
}

export function processAppendEntries(
    params: ActionParam[],
    event: EventObject,
): void {
    // here we receive new entries/logs/blocks
    // we need to run ProcessProposal on each block
    // and then FinalizeBlock & Commit
    // TODO we also look at termId, as we might need to rollback changes in case of a network split
    let entryBase64: string = event.params[0].value;
    const entryStr = String.UTF8.decode(decodeBase64(entryBase64).buffer);
    consensuswrap.LoggerDebug("received new entries", ["AppendEntry", entryStr]);

    let entry: AppendEntry = JSON.parse<AppendEntry>(entryStr);
    consensuswrap.LoggerInfo("received new entries", [
        "leaderId", entry.leaderId.toString(),
        "termId", entry.termId.toString(),
        "leaderCommit", entry.leaderCommit.toString(),
        "prevLogIndex", entry.prevLogIndex.toString(),
        "prevLogTerm", entry.prevLogTerm.toString(),
        "count", entry.entries.length.toString(),
    ]);
    for (let i = 0; i < entry.entries.length; i++) {
        processAppendEntry(entry.entries[i]);
    }
    setTermId(entry.termId);
    // TODO
    // entry.leaderId ?
    const lastCommitIndex = getCommitIndex();
    for (let i = lastCommitIndex + 1; i <= entry.leaderCommit; i++) {
        startBlockFinalizationFollower(i);
        setCommitIndex(i);
    }
}

export function processAppendEntry(entry: LogEntry): void {
    const data = decodeBase64(entry.data);
    const processReq = JSON.parse<typestnd.RequestProcessProposal>(String.UTF8.decode(data.buffer));
    const processResp = consensuswrap.ProcessProposal(processReq);
    if (processResp.status === typestnd.ProposalStatus.REJECT) {
        // TODO - what to do here? returning just discards the block and does not return a response to the leader
        // but this node will not sync with the leader anymore
        consensuswrap.LoggerError("new block rejected", ["height", processReq.height.toString(), "node type", "Follower"])
        return;
    }
    appendLogEntry(entry);
}

export function sendHeartbeatResponse(
    params: ActionParam[],
    event: EventObject,
): void {
    const termId = getTermId();
    // TODO when not successful
    const response = new AppendEntryResponse(termId, true);
    consensuswrap.LoggerDebug("send heartbeat response", ["termId", termId.toString(), "success", "true"])
    wasmx.setReturnData(String.UTF8.encode(JSON.stringify<AppendEntryResponse>(response)));
}

export function sendAppendEntries(
    params: ActionParam[],
    event: EventObject,
): void {
    // go through each node
    const nodeId = getCurrentNodeId();
    const ips = getNodeIPs();
    consensuswrap.LoggerDebug("diseminate entries...", ["nodeId", nodeId.toString(), "ips", JSON.stringify<Array<string>>(ips)])
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

// this gets called each reentry in Leader.active state
function checkCommits(): void {
    const lastCommitIndex = getLastApplied();
    // all commited + uncommited logs
    const lastLogIndex = getLogCount();
    const currentNodeId = getCurrentNodeId();
    const nextIndexPerNode = getNextIndexArray();
    const len = nextIndexPerNode.length;
    let nextCommit = lastCommitIndex + 1;

    consensuswrap.LoggerDebug("committing diseminated blocks...", ["lastApplied", lastCommitIndex.toString(), "lastSaved", lastLogIndex.toString(), "blocksToCommit", (lastLogIndex < nextCommit).toString()])

    if (lastLogIndex < nextCommit) {
        return;
    }
    const majority = i64(f64.floor(f64(len) / 2) + 1);
    let count = 1; // leader
    for (let i = 0; i < len; i++) {
        // next index is the next index to send, so we use >
        if (nextIndexPerNode.at(i) > nextCommit) {
            count += 1;
        }
    }
    const committing = count >= majority;
    consensuswrap.LoggerDebug("committing diseminated block", ["height", nextCommit.toString(), "nodes_count", len.toString(), "nodes_received", count.toString(), "committing", committing.toString()])

    // TODO If AppendEntries fails because of log inconsistency: decrement nextIndex and retry
    if (committing) {
        // TODO commit only if entry.term == currentTerm:

        // We commit the state
        startBlockFinalizationLeader(nextCommit);
        // update last commited!
        setLastApplied(nextCommit);
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
    consensuswrap.LoggerDebug("diseminate append entry...", ["nodeId", nodeId.toString(), "receiver", nodeIp, "count", entries.length.toString(), "from", nextIndex.toString(), "to", lastIndex.toString()])
    const dataBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(datastr)));
    // we send the request to the same contract
    const contract = wasmx.getAddress();
    const response = wasmxwrap.grpcRequest(nodeIp, Uint8Array.wrap(contract), dataBase64);
    const resp = JSON.parse<AppendEntryResponse>(response);
    // TODO something with resp.term
    if (resp.success) {
        nextIndexPerNode[nodeId] = nextIndex + entries.length;
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
    wasmx.setReturnData(String.UTF8.encode(JSON.stringify<TransactionResponse>(response)));
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
    consensuswrap.LoggerDebug("new transaction received", ["transaction", transaction])
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
    const batch = mempool.batch(cparams.block.max_gas, maxbytes);
    consensuswrap.LoggerDebug("batch transactions", ["count", batch.txs.length.toString()])

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
    // we only check the code type; CheckTx should be stateless, just form checking
    if (checkResp.code !== typestnd.CodeType.Ok) {
        // transaction is not valid, we should finish
        return revert(`transaction is invalid; code ${checkResp.code}`);
    }

    // add to mempool
    const mempool = getMempool();
    // TODO actually decode tx
    // const parsedTx = decodeTx(transaction);
    const parsedTx =  new typestnd.Transaction(15000000);
    const cparams = getConsensusParams();
    const maxgas = cparams.block.max_gas;
    if (maxgas > -1 && maxgas < parsedTx.gas) {
        return revert(`out of gas: ${parsedTx.gas}; max ${maxgas}`);
    }
    mempool.add(transaction, parsedTx.gas);
    setMempool(mempool);
}

function startBlockProposal(txs: string[], cummulatedGas: i64, maxDataBytes: i64): void {
    // PrepareProposal TODO finish
    const height = getLogCount() + 1;
    consensuswrap.LoggerDebug("start block proposal", ["height", height.toString()])

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
    consensuswrap.LoggerInfo("start block proposal", ["height", height.toString(), "hash", hash])
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
        consensuswrap.LoggerError("new block rejected", ["height", processReq.height.toString(), "node type", "Leader"])
        return;
    }
    // We have a valid proposal to propagate to other nodes
    return appendLogInternalVerified(processReq, header, lastBlockCommit);
}

function startBlockFinalizationLeader(index: i64): void {
    consensuswrap.LoggerInfo("start block finalization", ["height", index.toString()])
    // get entry and apply it
    const entry = getLogEntry(index);
    consensuswrap.LoggerDebug("start block finalization", ["height", index.toString(), "entry", entry])

    const entryobj = JSON.parse<LogEntry>(entry);
    const currentTerm = getTermId();

    if (currentTerm == entryobj.termId) {
        return startBlockFinalizationInternal(entryobj);
    } else consensuswrap.LoggerError("entry has current term mismatch", ["nodeType", "Leader", "currentTerm", currentTerm.toString(), "entryTermId", entryobj.termId.toString()])
}

function startBlockFinalizationFollower(index: i64): void {
    consensuswrap.LoggerInfo("start block finalization", ["height", index.toString()])
    // get entry and apply it
    const entry = getLogEntry(index);
    consensuswrap.LoggerDebug("start block finalization", ["height", index.toString(), "entry", entry])

    const entryobj = JSON.parse<LogEntry>(entry);
    return startBlockFinalizationInternal(entryobj);
}

function startBlockFinalizationInternal(entryobj: LogEntry): void {
    const processReqStr = String.UTF8.decode(decodeBase64(entryobj.data).buffer);
    const processReq = JSON.parse<typestnd.RequestProcessProposal>(processReqStr);
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

    // TODO save less info? (events tx_results)
    const resultstr = JSON.stringify<typestnd.ResponseFinalizeBlock>(finalizeResp);
    const resultBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(resultstr)));
    entryobj.result = resultBase64;

    const commitBz = String.UTF8.decode(decodeBase64(entryobj.commit).buffer);
    const commit = JSON.parse<typestnd.BlockCommit>(commitBz);

    const last_commit_hash = getCommitHash(commit);
    const last_results_hash = getResultsHash(finalizeResp.tx_results);

    // update current state
    consensuswrap.LoggerDebug("updating current state...", [])
    const state = getCurrentState();
    state.app_hash = finalizeResp.app_hash;
    state.last_block_id = new typestnd.BlockID(finalizeReq.hash, new typestnd.PartSetHeader(0, finalizeReq.hash.slice(0, 8)));
    state.last_commit_hash = last_commit_hash
    state.last_results_hash = last_results_hash
    setCurrentState(state);
    // update consensus params
    consensuswrap.LoggerDebug("updating consensus parameters...", [])
    updateConsensusParams(finalizeResp.consensus_param_updates);
    // update validator info
    consensuswrap.LoggerDebug("updating validator info...", [])
    updateValidators(finalizeResp.validator_updates);

    // ! make all state changes before the commit

    // update existing log entry
    setLogEntryObj(entryobj);

    // index transactions
    consensuswrap.LoggerDebug("index block transactions", ["count", finalizeReq.txs.length.toString()])
    for (let i = 0; i < finalizeReq.txs.length; i++) {
        // store IndexedTransaction
        const hash = wasmxwrap.sha256(finalizeReq.txs[i]);
        setIndexedTransaction(new typestnd.IndexedTransaction(finalizeReq.height, i), hash)
    }

    const commitResponse = consensuswrap.Commit();
    // TODO commitResponse.retainHeight
    // Tendermint removes all data for heights lower than `retain_height`
    consensuswrap.LoggerInfo("block finalized", ["height", entryobj.index.toString()])
}

function appendLogInternalVerified(processReq: typestnd.RequestProcessProposal, header: typestnd.Header, blockCommit: typestnd.BlockCommit): void {
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
    // TODO rollback entries in case of a network split (e.g. entries with higher termId than we have have priority); they must be uncommited
    // and just return if already saved
    if (index > entry.index) {
        consensuswrap.LoggerDebug("already appended entry", ["height", entry.index.toString()])
        return;
    }
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
    consensuswrap.LoggerDebug("setting entry", ["height", index.toString(), "value", entry])
    const key = getLogEntryKey(index);
    storage.setContextValue(key, entry);
}

export function getLogCount(): i64 {
    const key = getLogCountKey();
    const valuestr = storage.getContextValue(key);
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
    consensuswrap.LoggerDebug("setting entry count", ["height", value.toString()])
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
const ELECTION_TIMEOUT_KEY = "electionTimeout";
const ELECTION_RESET_KEY = "electionReset";

//// Persistent state on all servers:
const TERM_ID = "currentTerm";
const VOTED_FOR_KEY = "votedFor"
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

const VOTE_INDEX_ARRAY = "voteIndex";

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

// function getVotedFor(): i32 {
//     const value = getVotedForInternal();
//     if (value > 0) {
//         return value - 1;
//     }
//     return value;
// }

function hasVotedFor(): boolean {
    return getVotedForInternal() == 0;
}

function getVotedForInternal(): i32 {
    const value = storage.getContextValue(VOTED_FOR_KEY);
    if (value === "") return i32(0);
    return parseInt32(value);
}

function setVotedFor(value: i32): void {
    setVotedForInternal(value + 1);
}

function setVotedForInternal(value: i32): void {
    storage.setContextValue(VOTED_FOR_KEY, value.toString());
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

function getNodeIPs(): Array<string> {
    const valuestr = storage.getContextValue(NODE_IPS);
    let value: Array<string> = [];
    if (valuestr === "") return value;
    value = JSON.parse<Array<string>>(valuestr);
    return value;
}

function getNextIndexArray(): Array<i64> {
    const valuestr = storage.getContextValue(NEXT_INDEX_ARRAY);
    let value: Array<i64> = [];
    if (valuestr === "") return value;
    value = JSON.parse<Array<i64>>(valuestr);
    return value;
}

function setNextIndexArray(arr: Array<i64>): void {
    storage.setContextValue(NEXT_INDEX_ARRAY, JSON.stringify<Array<i64>>(arr));
}

function getVoteIndexArray(): Array<i32> {
    const valuestr = storage.getContextValue(VOTE_INDEX_ARRAY);
    let value: Array<i32> = [];
    if (valuestr === "") return value;
    value = JSON.parse<Array<i32>>(valuestr);
    return value;
}

function setVoteIndexArray(arr: Array<i32>): void {
    storage.setContextValue(VOTE_INDEX_ARRAY, JSON.stringify<Array<i32>>(arr));
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
    consensuswrap.LoggerInfo("indexing transaction", ["hash", hash])
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
    const valuestr = JSON.stringify<typestnd.ConsensusParams>(value)
    consensuswrap.LoggerDebug("setting consensus parameters", ["params", valuestr])
    storage.setContextValue(PARAMS_KEY, valuestr);
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

export function getElectionTimeout(): i64 {
    const value = storage.getContextValue(ELECTION_TIMEOUT_KEY);
    if (value === "") return i64(0);
    return parseInt64(value);
}

export function setElectionTimeout(value: i64): void {
    storage.setContextValue(ELECTION_TIMEOUT_KEY, value.toString());
}

// 0 == true -> election time was reset by an event
// 1 = false -> election time is ongoing
export function getElectionReset(): boolean {
    const value = storage.getContextValue(ELECTION_RESET_KEY);
    if (value === "0") return true;
    return false;
}

export function setElectionReset(value: boolean): void {
    const _value = value ? "0" : "1";
    storage.setContextValue(ELECTION_RESET_KEY, _value);
}

export function electionReset(): void {
    setElectionReset(true);
}

// ValidatorSet.Validators hash (ValidatorInfo[] hash)
// TODO cometbft protobuf encodes cmtproto.SimpleValidator
function getValidatorsHash(validators: typestnd.ValidatorInfo[]): string {
    let data = new Array<string>(validators.length);
    for (let i = 0; i < validators.length; i++) {
        console.debug("--getValidatorsHash-pub_key-" + i.toString() + "-" + validators[i].pub_key)
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

function getRandomInRange(min: i64, max: i64): i64 {
    return i64(Math.floor(Math.random() * f64((max - min + 1)))) + min;
}
