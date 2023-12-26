export declare function CheckTx(value: ArrayBuffer): ArrayBuffer
export declare function PrepareProposal(value: ArrayBuffer): ArrayBuffer
export declare function ProcessProposal(value: ArrayBuffer): ArrayBuffer
export declare function FinalizeBlock(value: ArrayBuffer): ArrayBuffer
export declare function Commit(): ArrayBuffer
export declare function RollbackToVersion(height: i64): ArrayBuffer
export declare function MerkleHash(value: ArrayBuffer): ArrayBuffer

export declare function LoggerInfo(value: ArrayBuffer): void
export declare function LoggerError(value: ArrayBuffer): void
export declare function LoggerDebug(value: ArrayBuffer): void

export declare function ed25519Sign(privKey: ArrayBuffer, msgbz: ArrayBuffer): ArrayBuffer
export declare function ed25519Verify(pubKey: ArrayBuffer, signature: ArrayBuffer, msgbz: ArrayBuffer): i32
