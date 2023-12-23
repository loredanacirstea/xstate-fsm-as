import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as consensus from './consensus';
import {
    ResponseWrap,
    RequestInitChain,
    RequestPrepareProposal,
    RequestProcessProposal,
    RequestFinalizeBlock,
    ResponseInitChain,
    ResponsePrepareProposal,
    ResponseProcessProposal,
    ResponseFinalizeBlock,
    ResponseFinalizeBlockWrap,
    ResponseCommit,
    RequestCheckTx,
    ResponseCheckTx,
} from './types_tendermint';

// @ts-ignore
@serializable
class MerkleSlices {
	slices: string[] // base64 encoded
    constructor(slices: string[]) {
        this.slices = slices;
    }
}

// @ts-ignore
@serializable
class LoggerLog {
	msg: string
	parts: string[]
    constructor(msg: string, parts: string[]) {
        this.msg = msg;
        this.parts = parts;
    }
}

// base64 encoded
export function MerkleHash(slices: string[]): string {
    const data = new MerkleSlices(slices);
    const databz = String.UTF8.encode(JSON.stringify<MerkleSlices>(data));
    const resp = consensus.MerkleHash(databz);
    return encodeBase64(Uint8Array.wrap(resp));
}

export function LoggerInfo(msg: string, parts: string[]): void {
    msg = `raft: ${msg}`
    const data = new LoggerLog(msg, parts);
    const databz = String.UTF8.encode(JSON.stringify<LoggerLog>(data));
    consensus.LoggerInfo(databz);
}

export function LoggerError(msg: string, parts: string[]): void {
    msg = `raft: ${msg}`
    const data = new LoggerLog(msg, parts);
    const databz = String.UTF8.encode(JSON.stringify<LoggerLog>(data));
    consensus.LoggerError(databz);
}

export function LoggerDebug(msg: string, parts: string[]): void {
    msg = `raft: ${msg}`
    const data = new LoggerLog(msg, parts);
    const databz = String.UTF8.encode(JSON.stringify<LoggerLog>(data));
    consensus.LoggerDebug(databz);
}

export function CheckTx(req: RequestCheckTx): ResponseCheckTx {
    const reqstr = JSON.stringify<RequestCheckTx>(req);
    LoggerDebug("CheckTx", ["request", reqstr]);
    const respbz = consensus.CheckTx(String.UTF8.encode(reqstr));
    const respstr = String.UTF8.decode(respbz);
    LoggerDebug("CheckTx", ["response", respstr]);
    return JSON.parse<ResponseCheckTx>(respstr);
}

export function PrepareProposal(req: RequestPrepareProposal): ResponsePrepareProposal {
    const reqstr = JSON.stringify<RequestPrepareProposal>(req);
    LoggerDebug("PrepareProposal", ["request", reqstr]);
    const respbz = consensus.PrepareProposal(String.UTF8.encode(reqstr));
    const respstr = String.UTF8.decode(respbz);
    LoggerDebug("PrepareProposal", ["response", respstr]);
    return JSON.parse<ResponsePrepareProposal>(respstr);
}

export function ProcessProposal(req: RequestProcessProposal): ResponseProcessProposal {
    const reqstr = JSON.stringify<RequestProcessProposal>(req);
    LoggerDebug("ProcessProposal", ["request", reqstr]);
    const respbz = consensus.ProcessProposal(String.UTF8.encode(reqstr));
    const respstr = String.UTF8.decode(respbz);
    LoggerDebug("ProcessProposal", ["response", respstr]);
    return JSON.parse<ResponseProcessProposal>(respstr);
}

export function FinalizeBlock(req: RequestFinalizeBlock): ResponseFinalizeBlockWrap {
    const reqstr = JSON.stringify<RequestFinalizeBlock>(req);
    LoggerDebug("FinalizeBlock", ["request", reqstr]);
    const respbz = consensus.FinalizeBlock(String.UTF8.encode(reqstr));
    const respstr = String.UTF8.decode(respbz);
    LoggerDebug("FinalizeBlock", ["response", respstr]);
    const wrap = JSON.parse<ResponseWrap>(respstr);
    const response = new ResponseFinalizeBlockWrap(wrap.error, null);
    if (wrap.error.length == 0) {
        response.data = JSON.parse<ResponseFinalizeBlock>(String.UTF8.decode(decodeBase64(wrap.data).buffer));
    }
    return response;
}

export function Commit(): ResponseCommit {
    LoggerDebug("Commit", []);
    const respbz = consensus.Commit();
    const respstr = String.UTF8.decode(respbz);
    LoggerDebug("Commit", ["response", respstr]);
    return JSON.parse<ResponseCommit>(respstr);
}

export function RollbackToVersion(height: i64): string {
    LoggerDebug("RollbackToVersion", []);
    const respbz = consensus.RollbackToVersion(height);
    const errstr = String.UTF8.decode(respbz);
    LoggerDebug("RollbackToVersion", ["err", errstr]);
    return errstr;
}

