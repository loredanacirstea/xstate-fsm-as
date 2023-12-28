import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64, encode } from "as-base64/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';
import * as consensuswrap from './consensus_wrap';
import * as consensus from './consensus';
import * as storage from './storage';

import {
  EventObject,
  ActionParam,
} from './types';
import { hexToUint8Array, revert, parseInt32, parseInt64, i32ToUint8ArrayBE, uint8ArrayToHex, i64ToUint8ArrayBE, base64ToHex, hex64ToBase64 } from "./utils";
import { LogEntry, TransactionResponse, AppendEntry, AppendEntryResponse, VoteResponse, VoteRequest, NodeUpdate, UpdateNodeResponse } from "./types_raft";
import * as typestnd from "./types_tendermint";
import { Base64String } from "./types";
import { LoggerDebug, LoggerError } from "./consensus";

// Docs: https://raft.github.io/raft.pdf

// start at 0 TODO?
const LOG_START = 1;

const STATE_SYNC_BATCH = 200;

const ERROR_INVALID_TX = "transaction is invalid";

const MAX_LOGGED = 2000;

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

const NODE_UPDATE_REMOVE = 0
const NODE_UPDATE_ADD = 1
const NODE_UPDATE_UPDATE = 2

//// storage


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

export function registeredCheck(
    params: ActionParam[],
    event: EventObject,
): void {
    // when a node starts, it needs to add itself to the pack
    // we just need [ourIP, leaderIP]

    // if blocks, return
    const lastIndex = getLastLogIndex();
    if (lastIndex > LOG_START) {
        return;
    }
    // if we are alone, return
    const ips = getNodeIPs();
    if (ips.length == 1) {
        return;
    }
    // we have tried to become leader 2 times
    const termId = getTermId();
    if (termId < 2) {
        return;
    }
    consensuswrap.LoggerInfo("trying to register node IP with Leader", []);

    // send updateNode to all ips except us
    const nodeId = getCurrentNodeId();
    const nodeIp = ips[nodeId];
    // TODO signature on protobuf encoding, not JSON
    const validatorInfo = getCurrentValidator();
    const validatorInfoStr = encodeBase64(Uint8Array.wrap(String.UTF8.encode(JSON.stringify<typestnd.ValidatorInfo>(validatorInfo))))
    const updateMsg = new NodeUpdate(nodeIp, nodeId, NODE_UPDATE_ADD, validatorInfoStr);
    const updateMsgStr = JSON.stringify<NodeUpdate>(updateMsg);
    const signature = signMessage(updateMsgStr);

    // const msgstr = `{"run":{"event":{"type":"nodeUpdate","params":[{"key": "ip","value":"${updateMsg.ip.toString()}"},{"key": "index","value":"${updateMsg.index.toString()}"},{"key": "removed","value":"0"},{"key": "signature","value":"${signature}"}]}}}`
    const dataBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(updateMsgStr)));
    const msgstr = `{"run":{"event":{"type":"nodeUpdate","params":[{"key": "entry","value":"${dataBase64}"},{"key": "signature","value":"${signature}"}]}}}`
    const msgBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(msgstr)));
    consensuswrap.LoggerInfo("register request", ["req", msgstr])

    // we send the request to the same contract
    const contract = wasmx.getAddress();

    for (let i = 0; i < ips.length; i++) {
        // don't send to ourselves or to removed nodes
        if (i == nodeId || ips[i] == "") continue;
        consensuswrap.LoggerInfo("register request", ["IP", ips[i]])
        const response = wasmxwrap.grpcRequest(ips[i], Uint8Array.wrap(contract), msgBase64);
        consensuswrap.LoggerInfo("register response", ["error", response.error, "data", response.data])
        if (response.error.length > 0 || response.data.length == 0) {
            return
        }
        const resp = JSON.parse<UpdateNodeResponse>(response.data);
        if (resp.nodeIPs[resp.nodeId] != nodeIp) {
            consensuswrap.LoggerError("register node response has wrong ip", ["expected", nodeIp]);
            revert(`register node response has wrong ip`)
        }
        const allvalidStr = String.UTF8.decode(decodeBase64(resp.validators).buffer);
        console.debug("* register node allvalidStr: " + allvalidStr)
        const allvalidators = JSON.parse<typestnd.ValidatorInfo[]>(allvalidStr);
        checkValidatorsUpdate(allvalidators, validatorInfo, resp.nodeId);
        setCurrentNodeId(resp.nodeId);
        setNodeIPs(resp.nodeIPs);
        setValidators(allvalidators);
    }
}

// temporary node updates - only for Leader
export function updateNodeAndReturn(
    params: ActionParam[],
    event: EventObject,
): void {
    let entryBase64: string = "";
    let signature: string = "";
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "entry") {
            entryBase64 = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "signature") {
            signature = event.params[i].value;
            continue;
        }
    }
    if (entryBase64 === "") {
        revert("updateNodeAndReturn: empty entry");
    }
    if (signature === "") {
        revert("updateNodeAndReturn: empty signature");
    }
    const entryStr = String.UTF8.decode(decodeBase64(entryBase64).buffer);
    consensuswrap.LoggerDebug("updateNodeAndReturn", ["entry", entryStr, "signature", signature])
    let entry: NodeUpdate = JSON.parse<NodeUpdate>(entryStr);

    consensuswrap.LoggerInfo("update node", ["ip", entry.ip, "type", entry.type.toString(), "validator_info", "index", entry.index.toString(), entry.validator_info])

    const ips = getNodeIPs();
    let entryIndex = entry.index;

    if (entry.type == NODE_UPDATE_ADD) {
        if (entry.validator_info == "") {
            consensuswrap.LoggerError("validator info missing from node update", ["ip", entry.ip])
            return;
        }
        // make it idempotent & don't add same ip multiple times
        if (ips.includes(entry.ip)) {
            consensuswrap.LoggerDebug("ip already included", ["ip", entry.ip])
            return;
        }
        entryIndex = ips.length;

        // verify signature and store the new validator
        const validatorInfo = JSON.parse<typestnd.ValidatorInfo>(String.UTF8.decode(decodeBase64(entry.validator_info).buffer))
        const isSender = consensuswrap.ed25519Verify(validatorInfo.pub_key, signature, entryStr);
        if (!isSender) {
            consensuswrap.LoggerError("signature verification failed", ["nodeIndex", entryIndex.toString(), "nodeIp", entry.ip]);
            return;
        }

        const validators = getValidators();
        validators.push(validatorInfo);
        setValidators(validators);

    } else {
        // verify signature
        const isSender = verifyMessage(entryIndex, signature, entryStr);
        if (!isSender) {
            consensuswrap.LoggerError("signature verification failed", ["nodeIndex", entryIndex.toString(), "nodeIp", entry.ip]);
            return;
        }
    }

    // removed
    if (entry.type == NODE_UPDATE_REMOVE) {
        // idempotent
        ips[entryIndex] = "";
    } else if (entry.type == NODE_UPDATE_ADD) {
        ips.push(entry.ip);
        const nextIndexes = getNextIndexArray();
        const matchIndexes = getMatchIndexArray();
        nextIndexes.push(LOG_START + 1);
        matchIndexes.push(LOG_START);
        setNextIndexArray(nextIndexes);
        setMatchIndexArray(matchIndexes);
        const validators = encodeBase64(Uint8Array.wrap(String.UTF8.encode(storage.getContextValue(VALIDATORS_KEY))))
        const response = new UpdateNodeResponse(ips, entryIndex, validators);
        wasmx.setReturnData(String.UTF8.encode(JSON.stringify<UpdateNodeResponse>(response)));
    } else {
        // NODE_UPDATE_UPDATE
        // just update the ip
        ips[entryIndex] = entry.ip;
    }

    consensuswrap.LoggerInfo("node updates", ["ips", ips.join(",")])
    setNodeIPs(ips);
}

// forward transactions to leader
export function forwardTxsToLeader(
    params: ActionParam[],
    event: EventObject,
): void {
    // look in the mempool to see if we have user transactions left
    // and send to leader
    const mempool = getMempool();
    if (mempool.txs.length == 0) {
        return;
    }

    // get leader from last log
    const entry = getLastLog();
    if (entry.index == 0) {
        return;
    }
    const nodeId = entry.leaderId;
    const nodeIps = getNodeIPs();
    const nodeIp = nodeIps[nodeId];
    const contract = wasmx.getAddress();

    let limit = mempool.txs.length;
    if (limit > 5) {
        limit = 5;
    }
    const txs = mempool.txs.slice(0, limit);
    consensuswrap.LoggerDebug("forwarding txs to leader", ["nodeId", nodeId.toString(), "nodeIp", nodeIp, "count", limit.toString()])

    for (let i = 0; i < limit; i++) {
        const tx = txs[0];
        const msgstr = `{"run":{"event":{"type":"newTransaction","params":[{"key": "transaction","value":"${tx}"}]}}}`
        const msgBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(msgstr)));
        const response = wasmxwrap.grpcRequest(nodeIp, Uint8Array.wrap(contract), msgBase64);
        consensuswrap.LoggerDebug("forwarding tx to leader", ["nodeId", nodeId.toString(), "nodeIp", nodeIp, "batch", i.toString(), "error", response.error])

        if (response.error.length == 0) {
            mempool.txs.splice(i, 1);
            continue;
        }
        // should never happen, because we check when we receive the tx
        if (response.error.includes(ERROR_INVALID_TX)) {
            mempool.txs.splice(i, 1);
            consensuswrap.LoggerDebug("forwarded invalid transaction", ["tx", tx]);
        } else {
            // leader is not ready, we return
            break;
        }
    }

    setMempool(mempool);
}

function getCurrentValidator(): typestnd.ValidatorInfo {
    const currentState = getCurrentState();
    // TODO voting_power & proposer_priority
    return new typestnd.ValidatorInfo(currentState.validator_address, currentState.validator_pubkey, 0, 0);
}

function checkValidatorsUpdate(validators: typestnd.ValidatorInfo[], validatorInfo: typestnd.ValidatorInfo, nodeId: i32): void {
    if (validators[nodeId].address != validatorInfo.address) {
        consensuswrap.LoggerError("register node response has wrong validator address", ["expected", validatorInfo.address]);
        revert(`register node response has wrong validator address`)
    }
    if (validators[nodeId].pub_key != validatorInfo.pub_key) {
        consensuswrap.LoggerError("register node response has wrong validator pub_key", ["expected", validatorInfo.pub_key]);
        revert(`register node response has wrong validator pub_key`)
    }
}

export function initializeNextIndex(
    params: ActionParam[],
    event: EventObject,
): void {
    const lastIndex = getLastLogIndex();
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
    let entryBase64: string = "";
    let signature: string = "";
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "entry") {
            entryBase64 = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "signature") {
            signature = event.params[i].value;
            continue;
        }
    }
    if (entryBase64 === "") {
        revert("vote: empty entry");
    }
    if (signature === "") {
        revert("vote: empty signature");
    }
    const entryStr = String.UTF8.decode(decodeBase64(entryBase64).buffer);
    let entry: VoteRequest = JSON.parse<VoteRequest>(entryStr);
    // verify signature
    const isSender = verifyMessage(entry.candidateId, signature, entryStr);
    if (!isSender) {
        consensuswrap.LoggerError("signature verification failed for VoteRequest", ["candidateId", entry.candidateId.toString(), "termId", entry.termId.toString()]);
        return;
    }

    voteInternal(entry.termId, entry.candidateId, entry.lastLogIndex, entry.lastLogTerm);
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
    const lastLogIndex = getLastLogIndex();
    const lastEntry = getLastLog();
    const lastLogTerm = lastEntry.termId;

    // iterate through the other nodes and send a VoteRequest
    const request = new VoteRequest(termId, candidateId, lastLogIndex, lastLogTerm);
    const ips = getNodeIPs();
    consensuswrap.LoggerInfo("sending vote requests...", ["candidateId", candidateId.toString(), "termId", termId.toString(), "lastLogIndex", lastLogIndex.toString(), "lastLogTerm", lastLogTerm.toString(), "ips", JSON.stringify<Array<string>>(ips)])
    for (let i = 0; i < ips.length; i++) {
        // don't send to ourselves or to removed nodes
        if (candidateId === i || ips[i].length == 0) continue;
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
    const len = getNodeCount();
    const majority = getMajority(len);
    consensuswrap.LoggerDebug("check if is voted Leader", ["yes", count.toString(), "votes", len.toString(), "majority", majority.toString()])
    return count >= majority;
}

function sendVoteRequest(nodeId: i32, nodeIp: string, request: VoteRequest, termId: i32): void {
    const datastr = JSON.stringify<VoteRequest>(request);
    const signature = signMessage(datastr);

    // const msgstr = `{"run":{"event":{"type":"receiveVoteRequest","params":[{"key":"termId","value":"${request.termId.toString()}"},{"key":"candidateId","value":"${request.candidateId.toString()}"},{"key":"lastLogIndex","value":"${request.lastLogIndex.toString()}"},{"key":"lastLogTerm","value":"${request.lastLogTerm.toString()}"}]}}}`
    const dataBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(datastr)));
    const msgstr = `{"run":{"event":{"type":"receiveVoteRequest","params":[{"key": "entry","value":"${dataBase64}"},{"key": "signature","value":"${signature}"}]}}}`
    const msgBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(msgstr)));

    const contract = wasmx.getAddress();
    consensuswrap.LoggerDebug("sending vote request", ["nodeId", nodeId.toString(), "nodeIp", nodeIp, "termId", termId.toString(), "data", datastr])
    const response = wasmxwrap.grpcRequest(nodeIp, Uint8Array.wrap(contract), msgBase64);
    consensuswrap.LoggerDebug("vote request response", ["nodeId", nodeId.toString(), "nodeIp", nodeIp, "termId", termId.toString(), "data", response.data, "error", response.error])
    if (response.error.length > 0 || response.data.length == 0) {
        return
    }

    const resp = JSON.parse<VoteResponse>(response.data);
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
        response = new VoteResponse(termId, true);
        consensuswrap.LoggerInfo("voting for Candidate", ["candidateId", candidateId.toString(), "termId", termId.toString()])
    } else {
        // if we already voted, we do not grant a new vote
        if (hasVotedFor()) {
            response = new VoteResponse(mytermId, false);
        } else {
            // candidate’s log is at least as up-to-date as receiver’s log
            const lastIndex = getLastLogIndex();
            if (lastLogIndex < lastIndex) {
                consensuswrap.LoggerDebug("candidate is not up-to-date", ["candidateLastIndex", lastLogIndex.toString(), "ourLastIndex", lastIndex.toString(), "candidateId", candidateId.toString()])
                response = new VoteResponse(mytermId, false);
            } else {
                setVotedFor(candidateId);
                consensuswrap.LoggerInfo("voting for Candidate", ["candidateId", candidateId.toString(), "termId", termId.toString()])
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

    setCommitIndex(LOG_START);
    setLastApplied(LOG_START);

    const datajson = String.UTF8.decode(decodeBase64(initChainSetup).buffer);
    // TODO remove validator private key from logs in initChainSetup
    consensuswrap.LoggerDebug("setupNode", ["currentNodeId", currentNodeId, "nodeIPs", nodeIPs, "initChainSetup", datajson])
    const data = JSON.parse<typestnd.InitChainSetup>(datajson);
    const ips = JSON.parse<string[]>(nodeIPs);
    // TODO better way; we may have the leader's node ip here
    if (ips.length < data.validators.length) {
        revert(`Node IPS count ${ips.length.toString()} mismatch validator count ${data.validators.length}`);
    }
    initChain(data);

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
        req.validator_address,
        req.validator_privkey,
        req.validator_pubkey,
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
    let entryBase64: string = "";
    let signature: string = "";
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "entry") {
            entryBase64 = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "signature") {
            signature = event.params[i].value;
            continue;
        }
    }
    if (entryBase64 === "") {
        revert("update node: empty entry");
    }
    if (signature === "") {
        revert("update node: empty signature");
    }
    const entryStr = String.UTF8.decode(decodeBase64(entryBase64).buffer);
    consensuswrap.LoggerDebug("received new entries", ["AppendEntry", entryStr.slice(0, MAX_LOGGED) + " [...]"]);

    let entry: AppendEntry = JSON.parse<AppendEntry>(entryStr);
    consensuswrap.LoggerInfo("received new entries", [
        "leaderId", entry.leaderId.toString(),
        "termId", entry.termId.toString(),
        "leaderCommit", entry.leaderCommit.toString(),
        "prevLogIndex", entry.prevLogIndex.toString(),
        "prevLogTerm", entry.prevLogTerm.toString(),
        "count", entry.entries.length.toString(),
        "nodeIps", entry.nodeIps.join(","),
    ]);

    // verify signature
    const isSender = verifyMessage(entry.leaderId, signature, entryStr);
    if (!isSender) {
        consensuswrap.LoggerError("signature verification failed for AppendEntry", ["leaderId", entry.leaderId.toString(), "termId", entry.termId.toString()]);
        return;
    }

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
        setLastApplied(i);
    }

    // update our nodeips
    const ips = getNodeIPs();
    const nodeId = getCurrentNodeId();
    const nodeIp = ips[nodeId];
    // check that our nodeId is still in line
    let newId = nodeId;
    for(let i = 0; i < entry.nodeIps.length; i++) {
        if (entry.nodeIps[i] == nodeIp) {
            newId = i;
            break;
        }
    }
    if (newId != nodeId) {
        consensuswrap.LoggerDebug("our node ID has changed", ["old", nodeId.toString(), "new", newId.toString()])
        setCurrentNodeId(newId);
    }
    const allvalidStr = String.UTF8.decode(decodeBase64(entry.validators).buffer);
    console.debug("* processAppendEntries allvalidStr: " + allvalidStr)
    const allvalidators = JSON.parse<typestnd.ValidatorInfo[]>(allvalidStr);
    const validatorInfo = getCurrentValidator();
    checkValidatorsUpdate(allvalidators, validatorInfo, newId);
    setNodeIPs(entry.nodeIps);
    setValidators(allvalidators);
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
        // don't send to Leader or removed nodes
        if (nodeId === i || ips[i].length == 0) continue;
        sendAppendEntry(i, ips[i], ips);
    }
}

// this actually commits one block at a time
export function commitBlocks(
    params: ActionParam[],
    event: EventObject,
): void {
    checkCommits();
}

// this gets called each reentry in Leader.active state
function checkCommits(): void {
    const lastCommitIndex = getCommitIndex();
    // all commited + uncommited logs
    const lastLogIndex = getLastLogIndex();
    const currentNodeId = getCurrentNodeId();
    const nextIndexPerNode = getNextIndexArray();
    const len = getNodeCount();
    let nextCommit = lastCommitIndex + 1;

    consensuswrap.LoggerDebug("committing diseminated blocks...", ["lastCommitIndex", lastCommitIndex.toString(), "lastSaved", lastLogIndex.toString(), "blocksToCommit", (lastLogIndex >= nextCommit).toString()])

    if (lastLogIndex < nextCommit) {
        return;
    }
    const majority = getMajority(len);
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
        setCommitIndex(nextCommit);
        setLastApplied(nextCommit);
    }
}

// TODO continue sending the entries until all nodes receive them
// TODO make this an eventual and retry until responses are received or leader is changed
export function sendAppendEntry(
    nodeId: i32,
    nodeIp: string,
    nodeIps: string[],
): void {
    const nextIndexPerNode = getNextIndexArray();
    const nextIndex = nextIndexPerNode.at(nodeId);
    let lastIndex = getLastLogIndex();
    // TODO state sync & snapshotting
    // right now, don't send more than STATE_SYNC_BATCH blocks at a time
    if ((lastIndex - nextIndex) > STATE_SYNC_BATCH) {
        lastIndex = nextIndex + STATE_SYNC_BATCH;
    }

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
    const lastCommitIndex = getCommitIndex();
    const validators = encodeBase64(Uint8Array.wrap(String.UTF8.encode(storage.getContextValue(VALIDATORS_KEY))))
    const data = new AppendEntry(
        getTermId(),
        getCurrentNodeId(),
        nextIndex - 1,
        previousEntry.termId,
        entries,
        lastCommitIndex,
        nodeIps,
        validators,
    )
    const datastr = JSON.stringify<AppendEntry>(data);
    const signature = signMessage(datastr);

    const dataBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(datastr)));
    const msgstr = `{"run":{"event":{"type":"receiveHeartbeat","params":[{"key": "entry","value":"${dataBase64}"},{"key": "signature","value":"${signature}"}]}}}`

    consensuswrap.LoggerDebug("diseminate append entry...", ["nodeId", nodeId.toString(), "receiver", nodeIp, "count", entries.length.toString(), "from", nextIndex.toString(), "to", lastIndex.toString()])
    const msgBase64 = encodeBase64(Uint8Array.wrap(String.UTF8.encode(msgstr)));
    // we send the request to the same contract
    const contract = wasmx.getAddress();
    const response = wasmxwrap.grpcRequest(nodeIp, Uint8Array.wrap(contract), msgBase64);
    if (response.error.length > 0) {
        return
    }
    const resp = JSON.parse<AppendEntryResponse>(response.data);
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

    const entry = getLastLog();
    const response = new TransactionResponse(
        entry.termId,
        entry.leaderId,
        entry.index,
    );
    wasmx.setReturnData(String.UTF8.encode(JSON.stringify<TransactionResponse>(response)));
}

export function addToMempool(
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
    return addTransactionToMempool(transaction)
}

export function proposeBlock(
    params: ActionParam[],
    event: EventObject,
): void {
    // if last block is not commited, we return; Cosmos SDK can only commit one block at a time.
    const height = getLastLogIndex();
    const lastCommitIndex = getCommitIndex();
    if (height < lastCommitIndex) {
        consensuswrap.LoggerInfo("cannot propose new block, last block not commited", ["height", height.toString(), "lastCommitIndex", lastCommitIndex.toString()])
        return;
    }

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
    const index = getLastLogIndex();
    const entry = getLogEntry(index);
    return JSON.parse<LogEntry>(entry);
}

export function getLogEntry(
    index: i64,
): string {
    const key = getLogEntryKey(index);
    return storage.getContextValue(key);
}

export function addTransactionToMempool(
    transaction: string, // base64
): void {
    // check that tx is valid
    const checktx = new typestnd.RequestCheckTx(transaction, typestnd.CheckTxType.New);
    const checkResp = consensuswrap.CheckTx(checktx);
    // we only check the code type; CheckTx should be stateless, just form checking
    if (checkResp.code !== typestnd.CodeType.Ok) {
        // transaction is not valid, we should finish; we use this error to check forwarded txs to leader
        return revert(`${ERROR_INVALID_TX}; code ${checkResp.code}`);
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
    const height = getLastLogIndex() + 1;
    consensuswrap.LoggerDebug("start block proposal", ["height", height.toString()])

    const currentState = getCurrentState();
    const validators = getValidators();

    // TODO correct votes?
    // lastExtCommit *types.ExtendedCommit
    // lastExtCommit = cs.LastCommit.MakeExtendedCommit(cs.state.ConsensusParams.ABCI)
    const localLastCommit = new typestnd.ExtendedCommitInfo(0, new Array<typestnd.ExtendedVoteInfo>(0));
    const nextValidatorsHash = getValidatorsHash(validators);
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
        currentState.validator_address,
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
        base64ToHex(getCommitHash(lastBlockCommit)),
        base64ToHex(getTxsHash(prepareResp.txs)),
        base64ToHex(nextValidatorsHash),
        base64ToHex(nextValidatorsHash),
        base64ToHex(getConsensusParamsHash(getConsensusParams())),
        base64ToHex(currentState.app_hash),
        base64ToHex(currentState.last_results_hash),
        base64ToHex(getEvidenceHash(evidence)),
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
        return startBlockFinalizationInternal(entryobj, false);
    } else {
        consensuswrap.LoggerError("entry has current term mismatch", ["nodeType", "Leader", "currentTerm", currentTerm.toString(), "entryTermId", entryobj.termId.toString()])
    }
}

function startBlockFinalizationFollower(index: i64): void {
    consensuswrap.LoggerInfo("start block finalization", ["height", index.toString()])
    // get entry and apply it
    const entry = getLogEntry(index);
    consensuswrap.LoggerDebug("start block finalization", ["height", index.toString(), "entry", entry])

    const entryobj = JSON.parse<LogEntry>(entry);
    return startBlockFinalizationInternal(entryobj, false);
}

function startBlockFinalizationInternal(entryobj: LogEntry, retry: boolean): void {
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
    let respWrap = consensuswrap.FinalizeBlock(finalizeReq);
    if (respWrap.error.length > 0 && !retry) {
        // ERR invalid height: 3232; expected: 3233
        const mismatchErr = `expected: ${(finalizeReq.height + 1).toString()}`
        if (respWrap.error.includes("invalid height") && respWrap.error.includes(mismatchErr)) {
            const rollbackHeight = finalizeReq.height - 1;
            consensuswrap.LoggerInfo(`trying to rollback`, ["height", rollbackHeight.toString()])
            const err = consensuswrap.RollbackToVersion(rollbackHeight);
            if (err.length > 0) {
                return revert(`consensus break: ${respWrap.error}; ${err}`);
            }
            // repeat FinalizeBlock
            return startBlockFinalizationInternal(entryobj, true);
        } else {
            return revert(respWrap.error)
        }
    }
    const finalizeResp = respWrap.data;
    if (finalizeResp == null) {
        return revert("FinalizeBlock response is null");
    }

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
    state.last_block_id = new typestnd.BlockID(
        base64ToHex(finalizeReq.hash),
        new typestnd.PartSetHeader(0, base64ToHex(finalizeReq.hash.slice(0, 8)))
    );
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

function getMajority(count: i32): i64 {
    return i64(f64.floor(f64(count) / 2) + 1)
}

function getNodeCount(): i32 {
    const ips = getNodeIPs();
    return getNodeCountInternal(ips);
}

function getNodeCountInternal(ips: string[]): i32 {
    let count = 0;
    for (let i = 0; i < ips.length; i++) {
        if (ips[i].length > 0) {
            count += 1;
        }
    }
    return count;
}

export function appendLogEntry(
    entry: LogEntry,
): void {
    const index = getLastLogIndex() + 1;
    // TODO rollback entries in case of a network split (e.g. entries with higher termId than we have have priority); they must be uncommited
    // and just return if already saved
    if (index > entry.index) {
        consensuswrap.LoggerDebug("already appended entry", ["height", entry.index.toString()])
        return;
    }
    if (index !== entry.index) {
        revert(`mismatched index while appending log entry: expected ${index}, found ${entry.index}`);
    }
    setLastLogIndex(index);
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
    consensuswrap.LoggerDebug("setting entry", ["height", index.toString(), "value", entry.slice(0, MAX_LOGGED) + " [...]"])
    const key = getLogEntryKey(index);
    storage.setContextValue(key, entry);
}

export function getLastLogIndex(): i64 {
    const key = getLastLogIndexKey();
    const valuestr = storage.getContextValue(key);
    if (valuestr != "") {
        const value = parseInt(valuestr);
        return i64(value);
    }
    return i64(LOG_START);
}

export function setLastLogIndex(
    value: i64,
): void {
    const key = getLastLogIndexKey();
    consensuswrap.LoggerDebug("setting entry count", ["height", value.toString()])
    storage.setContextValue(key, value.toString());
}

export function getLogEntryKey(index: i64): string {
    return "logs_" + index.toString();
}

export function getLastLogIndexKey(): string {
    return "logs_last_index";
}

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
    return getVotedForInternal() > 0;
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

function setCurrentNodeId(index: i32): void {
    storage.setContextValue(CURRENT_NODE_ID, index.toString());
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

function setNodeIPs(ips: Array<string>): void {
    const valuestr = JSON.stringify<Array<string>>(ips);
    storage.setContextValue(NODE_IPS, valuestr);
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
        hex64ToBase64(header.last_commit_hash),
        hex64ToBase64(header.data_hash),
        hex64ToBase64(header.validators_hash),
        hex64ToBase64(header.next_validators_hash),
        hex64ToBase64(header.consensus_hash),
        hex64ToBase64(header.app_hash),
        hex64ToBase64(header.last_results_hash),
        hex64ToBase64(header.evidence_hash),
        hex64ToBase64(header.proposer_address), // TODO transform hex to base64
    ]
    return consensuswrap.MerkleHash(data);
}

function getRandomInRange(min: i64, max: i64): i64 {
    const rand = Math.random()
    const numb = Math.floor(rand * f64((max - min + 1)))
    return i64(numb) + min;
}

export function signMessage(msgstr: string): Base64String {
    const currentState = getCurrentState();
    return consensuswrap.ed25519Sign(currentState.validator_privkey, msgstr);
}

export function verifyMessage(nodeIndex: i32, signatureStr: Base64String, msg: string): boolean {
    const validators = getValidators();
    const validator = validators[nodeIndex];
    return consensuswrap.ed25519Verify(validator.pub_key, signatureStr, msg);
}
