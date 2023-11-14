import { getExports } from "./debug.js";

export const LOG = {
    error: 0,
    info: 1,
    debug: 2,
}

export async function load(storage = {}, env = {}, logType = LOG.debug) {
    const { main } = await getExports(wasmx(storage, env, logType));
    return main;
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
            console.log('-host-storageStore', [...new Uint8Array(keybuf)], [...new Uint8Array(valuebuf)]);
        }
        storageMap[key.toString()] = value;
    }

    function storageLoad(keybuf) {
        const key = [...new Uint8Array(keybuf)];
        const value = new Uint8Array(storageMap[key.toString()] || []).buffer;
        if (logType > 1) {
            console.log('-host-storageLoad', [...new Uint8Array(keybuf)], [...new Uint8Array(value)]);
        }
        return value;
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

    return {
        finish,
        stop,
        revert,
        storageStore,
        storageLoad,
        getCallData,
        getEnv,
        getCaller,
        getBalance,
        log,
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
