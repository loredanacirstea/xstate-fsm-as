import { getExports } from "./debug.js";

export const LOG = {
    error: 0,
    info: 1,
    debug: 2,
}

export async function load(storage = {}, env = {}, logType = LOG.debug) {
    const inst = await getExports(wasmx(storage, env, logType), consensus(storage, env, logType));
    return inst
}

export function wasmx(storageMap, env, logType = LOG.error) {
    function finish(buf) {
        if (logType > 0) {
            console.log('-host-finish', [...new Uint8Array(buf)]);
        }
    }

    function stop(buf) {
        if (logType > 0) {
            console.log('-host-stop', [...new Uint8Array(buf)]);
        }
    }

    function revert(buf) {
        if (logType > 0) {
            console.log('-host-revert', [...new Uint8Array(buf)]);
        }
    }

    function storageStore(keybuf, valuebuf) {
        const key = [...new Uint8Array(keybuf)];
        const value = [...new Uint8Array(valuebuf)];
        if (logType > 1) {
            console.log('-host-storageStore', [...new Uint8Array(keybuf)]);
        }
        storageMap[key.toString()] = value;
    }

    function storageLoad(keybuf) {
        const key = [...new Uint8Array(keybuf)];
        const value = new Uint8Array(storageMap[key.toString()] || []).buffer;
        if (logType > 1) {
            console.log('-host-storageLoad', [...new Uint8Array(keybuf)]);
        }
        return value;
    }

    function grpcRequest(keybuf) {
        if (logType > 1) {
            console.log('-host-grpcRequest', [...new Uint8Array(keybuf)]);
        }
        const resp = {data: "", error: ""};
        return encodeToUtf8Array(JSON.stringify(resp));
    }

    function getCallData() {
        if (logType > 1) {
            console.log('-host-getCallData', env.currentCall.callData);
        }
        return env.currentCall.callData;
    }

    function getCaller() {
        if (logType > 1) {
            console.log('-host-getCaller', env.currentCall.sender);
        }
        return env.currentCall.sender;
    }

    function getAddress() {
        if (logType > 1) {
            console.log('-host-getAddress', env.currentCall.contract);
        }
        return env.currentCall.contract;
    }

    function getBalance(addrbuf) {
        const key = [...new Uint8Array(addrbuf)];
        if (logType > 1) {
            console.log('-host-getBalance', env.balance[key.toString()]);
        }
        return env.balance[key.toString()];
    }

    function getEnv() {
        return encodeToUtf8Array(JSON.stringify(env));
    }

    function log(item) {
        console.log('-host-log', item);
    }

    function startTimeout() {
        console.log('-host-startTimeout');
    }

    function stopInterval() {
        console.log('-host-stopInterval');
    }

    function sha256(buf) {
        if (logType > 0) {
            console.log('-host-sha256', [...new Uint8Array(buf)]);
        }
        return new Uint8Array(0);
    }

    function setReturnData(buf) {
        if (logType > 0) {
            console.log('-host-setReturnData', [...new Uint8Array(buf)]);
        }
        env.ReturnData = buf;
    }

    function getReturnData() {
        if (logType > 0) {
            console.log('-host-getReturnData');
        }
        return env.ReturnData || new Uint8Array(0);
    }

    return {
        finish,
        stop,
        revert,
        storageStore,
        storageLoad,
        getCallData,
        getEnv,
        getCaller,
        getAddress,
        getBalance,
        log,
        grpcRequest,
        startTimeout,
        stopInterval,
        sha256,
        setReturnData,
        getReturnData,
    }
}

export function consensus(storageMap, env, logType = LOG.error) {
    function PrepareProposal(buf) {
        if (logType > 0) {
            console.log('-host-PrepareProposal', [...new Uint8Array(buf)]);
        }
        const req = JSON.parse(decodeFromUtf8Array(buf));
        const resp = {txs: req.txs};
        return encodeToUtf8Array(JSON.stringify(resp));
    }

    function ProcessProposal(buf) {
        if (logType > 0) {
            console.log('-host-ProcessProposal', [...new Uint8Array(buf)]);
        }
        return encodeToUtf8Array(JSON.stringify({status: 0}));
    }

    function FinalizeBlock(buf) {
        if (logType > 0) {
            console.log('-host-FinalizeBlock');
        }
        const resp = {events: [], tx_results: [], validator_updates: [], consensus_param_updates: {"block":{"max_bytes":2000000,"max_gas":30000000},"evidence":{"max_age_num_blocks":302400,"max_age_duration":1814400,"max_bytes":10000},"validator":{"pub_key_types":["ed25519"]},"version":{"app":0},"abci":{"vote_extensions_enable_height":0}}, app_hash: "O0hNTDaj3XTRiEIeqqlo4+dxTrmV3JlHbCOnyOX24f8="}
        return encodeToUtf8Array(JSON.stringify(resp));
    }

    function Commit(buf) {
        if (logType > 0) {
            console.log('-host-Commit', [...new Uint8Array(buf)]);
        }
        const resp = {"retainHeight":"0"}
        return encodeToUtf8Array(JSON.stringify(resp));
    }

    function CheckTx(buf) {
        if (logType > 0) {
            console.log('-host-CheckTx', [...new Uint8Array(buf)]);
        }
        const resp = {code: 0, data: "", log: "", info: "", gas_wanted: 10000, gas_used: 1000, events: [], codespace: ""}
        return encodeToUtf8Array(JSON.stringify(resp));
    }

    function MerkleHash(buf) {
        if (logType > 0) {
            console.log('-host-MerkleHash', [...new Uint8Array(buf)]);
        }
        return new Uint8Array(0);
    }

    function LoggerDebug(buf) {
        const req = JSON.parse(decodeFromUtf8Array(buf));
        console.debug(req.msg, ...req.parts);
    }

    function LoggerInfo(buf) {
        const req = JSON.parse(decodeFromUtf8Array(buf));
        console.info(req.msg, ...req.parts);
    }

    function LoggerError(buf) {
        const req = JSON.parse(decodeFromUtf8Array(buf));
        console.error(req.msg, ...req.parts);
    }

    return {
        PrepareProposal,
        ProcessProposal,
        FinalizeBlock,
        Commit,
        CheckTx,
        MerkleHash,
        LoggerDebug,
        LoggerInfo,
        LoggerError,
    }
}

export function encodeToUtf8Array(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

export function decodeFromUtf8Array(arr) {
    const encoder = new TextDecoder();
    return encoder.decode(arr);
}

export function hexToUint8Array(hexString) {
    const encodedString = hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
    return new Uint8Array(encodedString);
}

export function paddLeft(arr8uint, maxlen = 32) {
    return new Uint8Array([...new Uint8Array(maxlen - arr8uint.length), ...arr8uint])
}
