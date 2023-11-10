export declare function getEnv(): ArrayBuffer
export declare function getCallData(): ArrayBuffer

export declare function storageStore(key: ArrayBuffer, value: ArrayBuffer): void
export declare function storageLoad(key: ArrayBuffer): ArrayBuffer

export declare function log(value: ArrayBuffer): void
export declare function finish(value: ArrayBuffer): void
export declare function revert(message: ArrayBuffer): void

export declare function getAccount(address: ArrayBuffer): ArrayBuffer
export declare function externalCall(data: ArrayBuffer): ArrayBuffer
