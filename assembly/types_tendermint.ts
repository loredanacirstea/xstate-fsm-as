import { JSON } from "json-as/assembly";

// @ts-ignore
@serializable
export class ExtendedVoteInfo {
	// The validator that sent the vote.
	validator: Validator;
	// Non-deterministic extension provided by the sending validator's application.
	vote_extension: string; // base64
	// Vote extension signature created by CometBFT
	extension_signature: string; // base64
	// block_id_flag indicates whether the validator voted for a block, nil, or did not vote at all
	block_id_flag: BlockIDFlag;
    constructor(validator: Validator, voteExtension: string, extensionSignature: string, blockIdFlag: BlockIDFlag) {
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
export class Misbehavior {
    // TODO
}

// @ts-ignore
@serializable
export class RequestPrepareProposal {
    // the modified transactions cannot exceed this size.
	max_tx_bytes: i64;
	txs: Array<string>; // base64
	local_last_commit: ExtendedCommitInfo;
	misbehavior: Misbehavior[];
	height: i64;
	time: string;
	next_validators_hash: string; // base64
	proposer_address: string; // base64
    constructor(maxTxBytes: i64, txs: Array<string>, localLastCommit: ExtendedCommitInfo, misbehavior: Misbehavior[], height: i64, time: string, nextValidatorsHash: string, proposerAddress: string) {
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
    txs: Array<string> // base64
    constructor(txs: Array<string>) {
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
	address: string // bech32
	power: i64
    constructor(address: string, power: i64) {
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
    txs: Array<string> // base64 encoded
	proposed_last_commit: CommitInfo
	misbehavior: Misbehavior[]
	hash: string // base64
	height: i64
	time: string
	next_validators_hash: string // base64
	proposer_address: string // base64
    constructor(txs: Array<string>, proposedLastCommit: CommitInfo, misbehavior: Misbehavior[], hash: string, height: i64, time: string, nextValidatorsHash: string, proposerAddress: string) {
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
    txs: Array<string> // base64 encoded
	decided_last_commit: CommitInfo
	misbehavior: Misbehavior[]
	hash: string // base64 encoded
	height: i64
	time: string
	next_validators_hash: string // base64 encoded
	proposer_address: string // base64 encoded
    constructor(txs: Array<string>, decidedLastCommit: CommitInfo, misbehavior: Misbehavior[], hash: string, height: i64, time: string, nextValidatorsHash: string, proposerAddress: string) {
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
export class ExecTxResult {
}

// @ts-ignore
@serializable
export class ValidatorUpdate {
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
export class Duration {
    seconds: i64
	nanos: i32
    constructor(seconds: i64 , nanos: i32) {
        this.seconds = seconds
        this.nanos = nanos
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
	max_age_duration: Duration
	// This sets the maximum size of total evidence in bytes that can be committed in a single block.
	// and should fall comfortably under the max block bytes.
	// Default is 1048576 or 1MB
	max_bytes: i64
    constructor(max_age_num_blocks: i64, max_age_duration: Duration, max_bytes: i64) {
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
	app_hash: string // base64
    constructor(events: Event[], txResults: ExecTxResult[], validatorUpdates: ValidatorUpdate[], consensusParamUpdates: ConsensusParams, appHash: string) {
        this.events = events;
        this.tx_results = txResults;
        this.validator_updates = validatorUpdates;
        this.consensus_param_updates = consensusParamUpdates;
        this.app_hash = appHash;
    }
}

// @ts-ignore
@serializable
export class ResponseCommit {
	retain_height: i64;
    constructor(retainHeight: i64) {
        this.retain_height = retainHeight;
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
    tx: string; // base64
	type: CheckTxType
    constructor(tx: string, type: CheckTxType) {
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
export class ResponseCheckTx {
	code: u32
	data: string // base64
	log: string
	info: string
	gas_wanted: i64
	gas_used: i64
	events: Event[]
	codespace: string
    constructor(code: u32, data: string, log: string, info: string, gas_wanted: i64, gas_used: i64, events: Event[], codespace: string) {
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
export class Transaction {
    gas: i32;
    constructor(gas: i32) {
        this.gas = gas;
    }
}

// @ts-ignore
@serializable
export class RequestInitChain {
	time: string
	chain_id: string
	consensus_params: ConsensusParams
	validators: ValidatorUpdate[]
	app_state_bytes: string // base64
	initial_height: i64
    constructor(time: string, chain_id: string, consensus_params: ConsensusParams, validators: ValidatorUpdate[], app_state_bytes: string, initial_height: i64) {
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
	app_hash: string
    constructor(consensus_params: ConsensusParams, validators: ValidatorUpdate[], app_hash: string) {
        this.consensus_params = consensus_params
        this.validators = validators
        this.app_hash = app_hash
    }
}
