import { JSON } from "json-as/assembly";
import { encode as encodeBase64, decode as decodeBase64 } from "as-base64/assembly";
import * as consensus from './consensus';
import {
    RequestInitChain,
    RequestPrepareProposal,
    RequestProcessProposal,
    RequestFinalizeBlock,
    ResponseInitChain,
    ResponsePrepareProposal,
    ResponseProcessProposal,
    ResponseFinalizeBlock,
    ResponseCommit,
    RequestCheckTx,
    ResponseCheckTx,
} from './types_tendermint';

export function InitChain(req: RequestInitChain): ResponseInitChain {
    const reqbz = JSON.stringify<RequestInitChain>(req);
    const respbz = consensus.InitChain(String.UTF8.encode(reqbz));
    return JSON.parse<ResponseInitChain>(String.UTF8.decode(respbz));
}

export function PrepareProposal(req: RequestPrepareProposal): ResponsePrepareProposal {
    const reqbz = JSON.stringify<RequestPrepareProposal>(req);
    const respbz = consensus.PrepareProposal(String.UTF8.encode(reqbz));
    return JSON.parse<ResponsePrepareProposal>(String.UTF8.decode(respbz));
}

export function ProcessProposal(req: RequestProcessProposal): ResponseProcessProposal {
    const reqbz = JSON.stringify<RequestProcessProposal>(req);
    const respbz = consensus.ProcessProposal(String.UTF8.encode(reqbz));
    return JSON.parse<ResponseProcessProposal>(String.UTF8.decode(respbz));
}

export function FinalizeBlock(req: RequestFinalizeBlock): ResponseFinalizeBlock {
    const reqbz = JSON.stringify<RequestFinalizeBlock>(req);
    const respbz = consensus.FinalizeBlock(String.UTF8.encode(reqbz));
    return JSON.parse<ResponseFinalizeBlock>(String.UTF8.decode(respbz));
}

export function Commit(): ResponseCommit {
    const respbz = consensus.Commit();
    return JSON.parse<ResponseCommit>(String.UTF8.decode(respbz));
}

export function CheckTx(req: RequestCheckTx): ResponseCheckTx {
    const reqbz = JSON.stringify<RequestCheckTx>(req);
    const respbz = consensus.CheckTx(String.UTF8.encode(reqbz));
    return JSON.parse<ResponseCheckTx>(String.UTF8.decode(respbz));
}
