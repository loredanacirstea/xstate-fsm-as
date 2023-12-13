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

// @ts-ignore
@serializable
class MerkleSlices {
	slices: string[] // base64 encoded
    constructor(slices: string[]) {
        this.slices = slices;
    }
}

// base64 encoded
export function MerkleHash(slices: string[]): string {
    const data = new MerkleSlices(slices);
    const databz = String.UTF8.encode(JSON.stringify<MerkleSlices>(data));
    const resp = consensus.MerkleHash(databz);
    return encodeBase64(Uint8Array.wrap(resp));
}

export function PrepareProposal(req: RequestPrepareProposal): ResponsePrepareProposal {
    const reqbz = JSON.stringify<RequestPrepareProposal>(req);
    console.log("===PrepareProposal==" + reqbz);
    const respbz = consensus.PrepareProposal(String.UTF8.encode(reqbz));
    console.log("===PrepareProposal=resp=" + String.UTF8.decode(respbz));
    return JSON.parse<ResponsePrepareProposal>(String.UTF8.decode(respbz));
}

export function ProcessProposal(req: RequestProcessProposal): ResponseProcessProposal {
    const reqbz = JSON.stringify<RequestProcessProposal>(req);
    console.log("===ProcessProposal==" + reqbz);
    const respbz = consensus.ProcessProposal(String.UTF8.encode(reqbz));
    console.log("===ProcessProposal=resp=" + String.UTF8.decode(respbz));
    return JSON.parse<ResponseProcessProposal>(String.UTF8.decode(respbz));
}

export function FinalizeBlock(req: RequestFinalizeBlock): ResponseFinalizeBlock {
    const reqbz = JSON.stringify<RequestFinalizeBlock>(req);
    console.log("===FinalizeBlock==" + reqbz);
    const respbz = consensus.FinalizeBlock(String.UTF8.encode(reqbz));
    console.log("===FinalizeBlock=resp=" + String.UTF8.decode(respbz));
    return JSON.parse<ResponseFinalizeBlock>(String.UTF8.decode(respbz));
}

export function Commit(): ResponseCommit {
    console.log("===Commit==");
    const respbz = consensus.Commit();
    console.log("===Commit=resp=" + String.UTF8.decode(respbz));
    return JSON.parse<ResponseCommit>(String.UTF8.decode(respbz));
}

export function CheckTx(req: RequestCheckTx): ResponseCheckTx {
    const reqbz = JSON.stringify<RequestCheckTx>(req);
    console.log("===CheckTx==" + reqbz);
    const respbz = consensus.CheckTx(String.UTF8.encode(reqbz));
    console.log("===CheckTx=resp=" + String.UTF8.decode(respbz));
    return JSON.parse<ResponseCheckTx>(String.UTF8.decode(respbz));
}
