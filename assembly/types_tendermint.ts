import { JSON } from "json-as/assembly";
import {HexString, Base64String, Bech32String} from './types';

// @ts-ignore
@serializable
export class ResponseWrap {
    error: string
    data: Base64String
    constructor(error: string, data: Base64String) {
        this.error = error
        this.data = data
    }
}

// @ts-ignore
@serializable
export class VersionConsensus {
    block: u64
    app: u64
    constructor(block: u64, app: u64) {
        this.block = block
        this.app = app
    }
}

// @ts-ignore
@serializable
export class Version {
	consensus: VersionConsensus
	software: string
    constructor(consensus: VersionConsensus, software: string) {
        this.consensus = consensus
        this.software = software
    }
}

// @ts-ignore
@serializable
export class PartSetHeader {
    total: u32
    hash: HexString
    constructor(total: u32, hash: HexString) {
        this.total = total;
        this.hash = hash;
    }
}

// @ts-ignore
@serializable
export class BlockID {
    // block hash
    hash: HexString
    // PartSet containing parts of a serialized block. is the form in which the block is gossipped to peers.
    // PartSetHeader:
    // 1. total number of parts
    // 2. first 6 bytes of the hash
    parts: PartSetHeader
    constructor(hash: HexString, parts: PartSetHeader) {
        this.hash = hash;
        this.parts = parts;
    }
}

// @ts-ignore
@serializable
export class Header {
    // basic block info
    version: VersionConsensus
    chain_id: string
    height: i64
    time: string

    // prev block info
    last_block_id: BlockID

    // hashes of block data
    // commit from validators from the last block
    last_commit_hash: HexString
    // transactions
    data_hash: HexString // transactions

    // hashes from the app output from the prev block
    // validators for the current block
    validators_hash: HexString
    // validators for the next block
    next_validators_hash: HexString
    // consensus params for current block
    consensus_hash: HexString
    // state after txs from the previous block
    app_hash: HexString
    // root hash of all results from the txs from the previous block
    // see `deterministicExecTxResult` to understand which parts of a tx is hashed into here
    last_results_hash: HexString

    // consensus info
    // evidence included in the block
    evidence_hash: HexString
    // original proposer of the block
    proposer_address: string // hex
    constructor(version: VersionConsensus, chain_id: string, height: i64, time: string, last_block_id: BlockID, last_commit_hash: HexString, data_hash: HexString, validators_hash: HexString, next_validators_hash: HexString, consensus_hash: HexString, app_hash: HexString, last_results_hash: HexString, evidence_hash: HexString, proposer_address: string) {
        this.version = version;
        this.chain_id = chain_id;
        this.height = height;
        this.time = time;
        this.last_block_id = last_block_id;
        this.last_commit_hash = last_commit_hash;
        this.data_hash = data_hash;
        this.validators_hash = validators_hash;
        this.next_validators_hash = next_validators_hash;
        this.consensus_hash = consensus_hash;
        this.app_hash = app_hash;
        this.last_results_hash = last_results_hash;
        this.evidence_hash = evidence_hash;
        this.proposer_address = proposer_address;
    }
}

// @ts-ignore
@serializable
export class ExtendedVoteInfo {
	// The validator that sent the vote.
	validator: Validator;
	// Non-deterministic extension provided by the sending validator's application.
	vote_extension: Base64String;
	// Vote extension signature created by CometBFT
	extension_signature: Base64String;
	// block_id_flag indicates whether the validator voted for a block, nil, or did not vote at all
	block_id_flag: BlockIDFlag;
    constructor(validator: Validator, voteExtension: Base64String, extensionSignature: Base64String, blockIdFlag: BlockIDFlag) {
        this.validator = validator;
        this.vote_extension = voteExtension;
        this.extension_signature = extensionSignature;
        this.block_id_flag = blockIdFlag;
    }
}

// @ts-ignore
@serializable
export class ExtendedCommitInfo {
    // The round at which the block proposer decided in the previous height.
	round: i32;
	// List of validators' addresses in the last validator set with their voting
	// information, including vote extensions.
	votes: ExtendedVoteInfo[];
    constructor(round: i32, votes: ExtendedVoteInfo[]) {
        this.round = round;
        this.votes = votes;
    }
}

// @ts-ignore
@serializable
export class CommitSig {
    block_id_flag: BlockIDFlag
    validator_address: HexString
    timestamp: string
    signature: Base64String
    constructor(block_id_flag: BlockIDFlag, validator_address: HexString, timestamp: string, signature: Base64String) {
        this.block_id_flag = block_id_flag;
        this.validator_address = validator_address;
        this.timestamp = timestamp;
        this.signature = signature;
    }
}

// @ts-ignore
@serializable
export class BlockCommit {
    // NOTE: The signatures are in order of address to preserve the bonded
    // ValidatorSet order.
    // Any peer with a block can gossip signatures by index with a peer without
    // recalculating the active ValidatorSet.
    height: i64
    round: i32
    block_id: BlockID
    signatures: CommitSig[]
    constructor(height: i64, round: i32, block_id: BlockID, signatures: CommitSig[]) {
        this.height = height;
        this.round = round;
        this.block_id = block_id;
        this.signatures = signatures;
    }
}

// @ts-ignore
@serializable
export class Misbehavior {
    // TODO
}

// @ts-ignore
@serializable
export class Evidence {
     // TODO
}

// @ts-ignore
@serializable
export class RequestPrepareProposal {
    // the modified transactions cannot exceed this size.
	max_tx_bytes: i64;
	txs: Array<Base64String>;
	local_last_commit: ExtendedCommitInfo;
	misbehavior: Misbehavior[];
	height: i64;
	time: string;
	next_validators_hash: Base64String;
	proposer_address: Base64String;
    constructor(maxTxBytes: i64, txs: Array<Base64String>, localLastCommit: ExtendedCommitInfo, misbehavior: Misbehavior[], height: i64, time: string, nextValidatorsHash: Base64String, proposerAddress: Base64String) {
        this.max_tx_bytes = maxTxBytes;
        this.txs = txs;
        this.local_last_commit = localLastCommit;
        this.misbehavior = misbehavior;
        this.height = height;
        this.time = time;
        this.next_validators_hash = nextValidatorsHash;
        this.proposer_address = proposerAddress;
    }
}

// @ts-ignore
@serializable
export class ResponsePrepareProposal {
    txs: Array<Base64String>
    constructor(txs: Array<Base64String>) {
        this.txs = txs;
    }
}

// @ts-ignore
@serializable
export enum BlockIDFlag {
    Unknown = 0,
    Absent = 1,
    Commit = 2,
    Nil = 3
}

// @ts-ignore
@serializable
export class Validator {
	address: Bech32String
	power: i64
    constructor(address: Bech32String, power: i64) {
        this.address = address
        this.power = power
    }
}

// @ts-ignore
@serializable
export class VoteInfo {
	validator:   Validator
	block_id_flag: BlockIDFlag
    constructor(validator: Validator, blockIdFlag: BlockIDFlag) {
        this.validator = validator
        this.block_id_flag = blockIdFlag
    }
}

// @ts-ignore
@serializable
export class CommitInfo {
	round: i32
	votes: VoteInfo[]
    constructor(round: i32, votes: VoteInfo[]) {
        this.round = round
        this.votes = votes
    }
}

// @ts-ignore
@serializable
export class RequestProcessProposal {
    txs: Array<Base64String>
	proposed_last_commit: CommitInfo
	misbehavior: Misbehavior[]
    // hash is the merkle root hash of the fields of the proposed block
    // block.Header.Hash()
	hash: Base64String
	height: i64
	time: string
	next_validators_hash: Base64String
    // address of the public key of the original proposer of the block.
	proposer_address: Base64String
    constructor(txs: Array<Base64String>, proposedLastCommit: CommitInfo, misbehavior: Misbehavior[], hash: Base64String, height: i64, time: string, nextValidatorsHash: Base64String, proposerAddress: Base64String) {
        this.txs = txs;
        this.proposed_last_commit = proposedLastCommit;
        this.misbehavior = misbehavior;
        this.hash = hash;
        this.height = height;
        this.time = time;
        this.next_validators_hash = nextValidatorsHash;
        this.proposer_address = proposerAddress;
    }
}

// @ts-ignore
@serializable
export enum ProposalStatus {
    UNKNOWN = 0,
    ACCEPT = 1,
    REJECT = 2
}

// @ts-ignore
@serializable
export class ResponseProcessProposal {
    status: ProposalStatus;
    constructor(status: ProposalStatus) {
        this.status = status;
    }
}

// @ts-ignore
@serializable
export class RequestFinalizeBlock {
    txs: Array<Base64String>
	decided_last_commit: CommitInfo
	misbehavior: Misbehavior[]
	hash: Base64String
	height: i64
	time: string
	next_validators_hash: Base64String
	proposer_address: Base64String
    constructor(txs: Array<Base64String>, decidedLastCommit: CommitInfo, misbehavior: Misbehavior[], hash: Base64String, height: i64, time: string, nextValidatorsHash: Base64String, proposerAddress: Base64String) {
        this.txs = txs;
        this.decided_last_commit = decidedLastCommit;
        this.misbehavior = misbehavior;
        this.hash = hash;
        this.height = height;
        this.time = time;
        this.next_validators_hash = nextValidatorsHash;
        this.proposer_address = proposerAddress;
    }
}

// @ts-ignore
@serializable
export class EventAttribute {
    key: string
	value: string
	index: bool
    constructor(key: string, value: string, index: bool) {
        this.key = key;
        this.value = value;
        this.index = index;
    }
}

// @ts-ignore
@serializable
export class Event {
    type: string
	attributes: EventAttribute[]
    constructor(type: string, attributes: EventAttribute[]) {
        this.type = type;
        this.attributes = attributes;
    }
}

// @ts-ignore
@serializable
export class ExecTxResult { // same as ResponseCheckTx
    code: u32
	data: Base64String
	log: string
	info: string
	gas_wanted: i64
	gas_used: i64
	events: Event[]
	codespace: string
    constructor(code: u32, data: Base64String, log: string, info: string, gas_wanted: i64, gas_used: i64, events: Event[], codespace: string) {
        this.code = code;
        this.data = data;
        this.log = log;
        this.info = info;
        this.gas_wanted = gas_wanted;
        this.gas_used = gas_used;
        this.events = events;
        this.codespace = codespace;
    }
}

// @ts-ignore
@serializable
export class ValidatorUpdate {
    pub_key: string // crypto.PublicKey
	power: i64
    constructor(pub_key: string, power: i64) {
        this.pub_key = pub_key;
        this.power = power;
    }
}

// @ts-ignore
@serializable
export class ValidatorInfo {
    address: HexString
    pub_key: Base64String // crypto.PubKey
    voting_power: i64
    proposer_priority: i64
    constructor(address: HexString, pub_key: string, voting_power: i64, proposer_priority: i64) {
        this.address = address;
        this.pub_key = pub_key;
        this.voting_power = voting_power;
        this.proposer_priority = proposer_priority;
    }
}

// @ts-ignore
@serializable
export class BlockParams {
    // Max block size, in bytes.
	// Note: must be greater than 0
	max_bytes: i64
	// Max gas per block.
	// Note: must be greater or equal to -1
	max_gas: i64
    constructor(max_bytes: i64, max_gas: i64) {
        this.max_bytes = max_bytes;
        this.max_gas = max_gas;
    }
}

// @ts-ignore
@serializable
export class EvidenceParams {
    // Max age of evidence, in blocks.
	//
	// The basic formula for calculating this is: MaxAgeDuration / {average block
	// time}.
	max_age_num_blocks: i64
	// Max age of evidence, in time.
	//
	// It should correspond with an app's "unbonding period" or other similar
	// mechanism for handling [Nothing-At-Stake
	// attacks](https://github.com/ethereum/wiki/wiki/Proof-of-Stake-FAQ#what-is-the-nothing-at-stake-problem-and-how-can-it-be-fixed).
	max_age_duration: i64
	// This sets the maximum size of total evidence in bytes that can be committed in a single block.
	// and should fall comfortably under the max block bytes.
	// Default is 1048576 or 1MB
	max_bytes: i64
    constructor(max_age_num_blocks: i64, max_age_duration: i64, max_bytes: i64) {
        this.max_age_num_blocks = max_age_num_blocks;
        this.max_age_duration = max_age_duration;
        this.max_bytes = max_bytes;
    }
}

// @ts-ignore
@serializable
export class ValidatorParams {
    pub_key_types: string[]
    constructor(pub_key_types: string[]) {
        this.pub_key_types = pub_key_types
    }
}

// @ts-ignore
@serializable
export class VersionParams {
    app: u64
    constructor(app: u64) {
        this.app = app;
    }
}

// @ts-ignore
@serializable
export class ABCIParams {
    vote_extensions_enable_height: i64
    constructor(vote_extensions_enable_height: i64) {
        this.vote_extensions_enable_height = vote_extensions_enable_height;
    }
}

// @ts-ignore
@serializable
export class ConsensusParams {
    block: BlockParams
	evidence: EvidenceParams
	validator: ValidatorParams
	version: VersionParams
	abci: ABCIParams
    constructor(block: BlockParams, evidence: EvidenceParams, validator: ValidatorParams, version: VersionParams, abci: ABCIParams) {
        this.block = block
        this.evidence = evidence
        this.validator = validator
        this.version = version
        this.abci = abci
    }
}

// @ts-ignore
@serializable
export class ResponseFinalizeBlock {
	events: Event[]
	tx_results: ExecTxResult[]
	validator_updates: ValidatorUpdate[]
	consensus_param_updates: ConsensusParams
	app_hash: Base64String
    constructor(events: Event[], txResults: ExecTxResult[], validatorUpdates: ValidatorUpdate[], consensusParamUpdates: ConsensusParams, appHash: Base64String) {
        this.events = events;
        this.tx_results = txResults;
        this.validator_updates = validatorUpdates;
        this.consensus_param_updates = consensusParamUpdates;
        this.app_hash = appHash;
    }
}

// @ts-ignore
@serializable
export class ResponseFinalizeBlockWrap {
    error: string
    data: ResponseFinalizeBlock | null
    constructor(error: string, data: ResponseFinalizeBlock | null) {
        this.error = error
        this.data = data
    }
}

// @ts-ignore
@serializable
export class ResponseCommit {
	retainHeight: i64;
    constructor(retainHeight: i64) {
        this.retainHeight = retainHeight;
    }
}

// @ts-ignore
@serializable
export enum CheckTxType {
    New = 0,
	Recheck = 1,
}

// @ts-ignore
@serializable
export class RequestCheckTx {
    tx: Base64String;
	type: CheckTxType
    constructor(tx: Base64String, type: CheckTxType) {
        this.tx = tx;
        this.type = type;
    }
}

// @ts-ignore
@serializable
export enum CodeType {
    Ok = 0,
    EncodingError = 1,
    InvalidTxFormat = 2,
    Unauthorized = 3,
    Executed = 4,
}

// CodeTypeOK              uint32 = 0
// CodeTypeEncodingError   uint32 = 1
// CodeTypeInvalidTxFormat uint32 = 2
// CodeTypeUnauthorized    uint32 = 3
// CodeTypeExecuted        uint32 = 5

// @ts-ignore
@serializable
export class ResponseCheckTx extends ExecTxResult {}

// @ts-ignore
@serializable
export class Transaction {
    gas: i32;
    constructor(gas: i32) {
        this.gas = gas;
    }
}

// @ts-ignore
@serializable
export class TxResult {
	height: i64
	index: u32
	tx: Base64String
	result: ExecTxResult
    constructor(height: i64, index: u32, tx: Base64String, result: ExecTxResult) {
        this.height = height;
        this.index = index;
        this.tx = tx;
        this.result = result;
    }
}

// @ts-ignore
@serializable
export class IndexedTransaction {
    height: i64
	index: u32
    constructor(height: i64, index: u32) {
        this.height = height;
        this.index = index;
    }
}

// @ts-ignore
@serializable
export class RequestInitChain {
	time: string
	chain_id: string
	consensus_params: ConsensusParams
	validators: ValidatorUpdate[]
	app_state_bytes: Base64String
	initial_height: i64
    constructor(time: string, chain_id: string, consensus_params: ConsensusParams, validators: ValidatorUpdate[], app_state_bytes: Base64String, initial_height: i64) {
        this.time = time
        this.chain_id = chain_id
        this.consensus_params = consensus_params
        this.validators = validators
        this.app_state_bytes = app_state_bytes
        this.initial_height = initial_height
    }
}

// @ts-ignore
@serializable
export class ResponseInitChain {
	consensus_params: ConsensusParams
	validators: ValidatorUpdate[]
	app_hash: Base64String
    constructor(consensus_params: ConsensusParams, validators: ValidatorUpdate[], app_hash: Base64String) {
        this.consensus_params = consensus_params
        this.validators = validators
        this.app_hash = app_hash
    }
}

// @ts-ignore
@serializable
export class InitChainSetup {
    chain_id: string
    version: Version
	consensus_params: ConsensusParams
	validators: ValidatorInfo[]
	app_hash: Base64String
    last_results_hash: Base64String
    validator_address: HexString
    validator_privkey: Base64String
    validator_pubkey: Base64String
    constructor(chain_id: string, version: Version, consensus_params: ConsensusParams, validators: ValidatorInfo[], app_hash: Base64String, last_results_hash: Base64String, validator_address: HexString, validator_privkey: Base64String, validator_pubkey: Base64String) {
        this.chain_id = chain_id
        this.version = version
        this.consensus_params = consensus_params
        this.validators = validators
        this.app_hash = app_hash
        this.last_results_hash = last_results_hash
        this.validator_address = validator_address
        this.validator_privkey = validator_privkey
        this.validator_pubkey = validator_pubkey
    }
}

// @ts-ignore
@serializable
export class CurrentState {
    chain_id: string
    version: Version
	app_hash: string // updated after Finalized Block
    // prev block info
    last_block_id: BlockID // updated after Finalized Block
    // commit from validators from the last block
    last_commit_hash: string // base64
    // tx results hash
    last_results_hash: string // base64
    validator_address: HexString
    validator_privkey: Base64String
    validator_pubkey: Base64String

    constructor(chain_id: string, version: Version, app_hash: string, last_block_id: BlockID, last_commit_hash: string, last_results_hash: string, validator_address: HexString, validator_privkey: Base64String, validator_pubkey: Base64String) {
        this.chain_id = chain_id
        this.version = version
        this.app_hash = app_hash
        this.last_block_id = last_block_id
        this.last_commit_hash = last_commit_hash
        this.last_results_hash = last_results_hash
        this.validator_address = validator_address
        this.validator_privkey = validator_privkey
        this.validator_pubkey = validator_pubkey
    }
}

// @ts-ignore
@serializable
class MempoolBatch {
    txs: Base64String[];
    cummulatedGas: i64;
    constructor(txs: Base64String[] = [], cummulatedGas: i64 = 0) {
        this.txs = txs;
        this.cummulatedGas = cummulatedGas;
    }
}

// @ts-ignore
@serializable
export class Mempool {
    txs: Base64String[];
    gas: i32[];
    constructor(txs: Base64String[] = [], gas: i32[] = []) {
        this.txs = txs;
        this.gas = gas;
    }

    add(tx: Base64String, gas: i32): void {
        this.gas = this.gas.concat([gas]);
        this.txs = this.txs.concat([tx]);
    }

    batch(maxGas: i64, maxBytes: i64): MempoolBatch {
        let batch: MempoolBatch = new MempoolBatch([], 0);
        let cummulatedBytes: i64 = 0;
        for (let i = 0; i < this.txs.length; i++) {
            if (maxGas > -1 && maxGas < (batch.cummulatedGas + this.gas[i])) {
                break;
            }
            const bytelen = base64Len(this.txs[i]);
            if (maxBytes < (cummulatedBytes + bytelen)) {
                break;
            }
            batch.txs = batch.txs.concat([this.txs[i]]);
            batch.cummulatedGas += this.gas[i];
            cummulatedBytes += bytelen;
        }
        this.txs.splice(0, batch.txs.length);
        return batch;
    }

    spliceTxs(limit: i32): Base64String[] {
        return this.txs.splice(0, limit);
    }
}

// 4 chars represent 3 bytes
function base64Len(value: Base64String): i32 {
    return i32(Math.ceil(value.length / 4)) * 3;
}
