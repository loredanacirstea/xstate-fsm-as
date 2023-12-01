import { JSON } from "json-as/assembly";

// @ts-ignore
@serializable
export class ExtendedCommitInfo {
    // TODO
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
	maxTxBytes: i64;
	txs: Array<string>; // base64
	localLastCommit: ExtendedCommitInfo;
	misbehavior: Misbehavior[];
	height: i64;
	time: i64;
	nextValidatorsHash: string; // base64
	proposerAddress: string; // base64
    constructor(maxTxBytes: i64, txs: Array<string>, localLastCommit: ExtendedCommitInfo, misbehavior: Misbehavior[], height: i64, time: i64, nextValidatorsHash: string, proposerAddress: string) {
        this.maxTxBytes = maxTxBytes;
        this.txs = txs;
        this.localLastCommit = localLastCommit;
        this.misbehavior = misbehavior;
        this.height = height;
        this.time = time;
        this.nextValidatorsHash = nextValidatorsHash;
        this.proposerAddress = proposerAddress;
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
	address: Uint8Array
	power: i64
    constructor(address: Uint8Array, power: i64) {
        this.address = address
        this.power = power
    }
}

// @ts-ignore
@serializable
export class VoteInfo {
	validator:   Validator
	blockIdFlag: BlockIDFlag
    constructor(validator: Validator, blockIdFlag: BlockIDFlag) {
        this.validator = validator
        this.blockIdFlag = blockIdFlag
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
	proposedLastCommit: CommitInfo
	misbehavior: Misbehavior[]
	hash: string // base64
	height: i64
	time: i64
	nextValidatorsHash: string // base64
	proposerAddress: string // base64
    constructor(txs: Array<string>, proposedLastCommit: CommitInfo, misbehavior: Misbehavior[], hash: string, height: i64, time: i64, nextValidatorsHash: string, proposerAddress: string) {
        this.txs = txs;
        this.proposedLastCommit = proposedLastCommit;
        this.misbehavior = misbehavior;
        this.hash = hash;
        this.height = height;
        this.time = time;
        this.nextValidatorsHash = nextValidatorsHash;
        this.proposerAddress = proposerAddress;
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
	decidedLastCommit: CommitInfo
	misbehavior: Misbehavior[]
	hash: string // base64 encoded
	height: i64
	time: Date
	nextValidatorsHash: string // base64 encoded
	proposerAddress: string // base64 encoded
    constructor(txs: Array<string>, decidedLastCommit: CommitInfo, misbehavior: Misbehavior[], hash: string, height: i64, time: Date, nextValidatorsHash: string, proposerAddress: string) {
        this.txs = txs;
        this.decidedLastCommit = decidedLastCommit;
        this.misbehavior = misbehavior;
        this.hash = hash;
        this.height = height;
        this.time = time;
        this.nextValidatorsHash = nextValidatorsHash;
        this.proposerAddress = proposerAddress;
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
export class ConsensusParams {
}

// @ts-ignore
@serializable
export class ResponseFinalizeBlock {
	events: Event[]
	txResults: ExecTxResult[]
	validatorUpdates: ValidatorUpdate[]
	consensusParamUpdates: ConsensusParams
	appHash: Uint8Array
    constructor(events: Event[], txResults: ExecTxResult[], validatorUpdates: ValidatorUpdate[], consensusParamUpdates: ConsensusParams, appHash: Uint8Array) {
        this.events = events;
        this.txResults = txResults;
        this.validatorUpdates = validatorUpdates;
        this.consensusParamUpdates = consensusParamUpdates;
        this.appHash = appHash;
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
    gas: i64;
    constructor(gas: i64) {
        this.gas = gas;
    }
}
