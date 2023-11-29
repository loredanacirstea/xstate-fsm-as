import assert from "assert";
// import { describe, it } from "test";
// import { describe, it } from 'node:test';
// import { create, getCurrentState, getContextValue, transition, run } from "../build/debug.js";
import { load, LOG } from './wasmx.js';
import { parseMachine, uint8ArrayToHex, numToUint8Array32 } from './utils.js';
import {
  machineConfig2,
  machineConfig2Orig,
  machineConfig3Orig,
  machineWithGuard,
  erc20Machine1Orig,
  consensusSMConfigOrig,
  consensusSMTimerConfigOrig,
  machineConfigSemaphore,
  RAFTLogReplication,
} from './data.js';

let currentState, value;

function runFnWrapped (storage = {}, env = {}) {
    return async function (fnName, config, args, runfn = "main") {
        let calldata;
        const config_ = encodeToUtf8Array(JSON.stringify(config));
        if (runfn === "main") {
          calldata = encodeToUtf8Array(JSON.stringify({[fnName]: args}));
        } else {
          calldata = args;
        }
        calldata = new Uint8Array([
          ...numToUint8Array32(config_.length),
          ...config_,
          ...numToUint8Array32(calldata.length),
          ...calldata,
        ])

        const defaultSender = encodeToUtf8Array("sender");
        const defaultContract = encodeToUtf8Array("contract");
        env = {
            ...env,
            currentCall: {
                sender: defaultSender,
                contract: defaultContract,
                ...env.currentCall,
                callData: calldata,
            }
        }
        const instance = await load(storage, env, LOG.debug);
        return instance[runfn]();
    }
}

async function runTests() {

    let machineConfig, machineConfigStr, implementationsStr;
    const storage = {};
    let machineId;
    let result;
    let runFn = runFnWrapped(storage);

    // Create the machine
    let machine = {id: machineConfigSemaphore.id, states: machineConfigSemaphore.states};
    await runFn("instantiate", machine, {initialState: machineConfigSemaphore.initial, context: machineConfigSemaphore.context})

    // Get initial state
    result = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "red");

    // Run next state
    await runFn("run", machine, {event: {type: "next", params: []}});
    console.log("!!!!!!! -> next");

    // Check state has changed
    currentState = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "blue");

    ///// machine 2
    machineConfig = parseMachine(machineConfig2Orig);
    console.log("==machineConfig2Orig==")
    console.log(JSON.stringify(machineConfig))

    // Create the machine
    machine = {id: machineConfig.id, states: machineConfig.states};
    await runFn("instantiate", machine, {initialState: machineConfig.initial, context: machineConfig.context})

    // Get initial state
    result = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "unlocked");

    // Get context value
    result = await runFn("getContextValue", machine, {key: "counter"});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "0");

    // Run next state
    await runFn("run", machine, {event: {type: "increment", params: []}});
    console.log("!!!!!!! -> increment");

    // Check state has changed
    currentState = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "unlocked");

    // Get context value
    result = await runFn("getContextValue", machine, {key: "counter"});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "1");

    // Run lock transition
    await runFn("run", machine, {event: {type: "lock", params: []}});
    console.log("!!!!!!! -> lock");

    // Check state has been locked
    currentState = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "locked");

    // Check no increment is possible
    console.log("!!!!!!! -> try increment");
    try {
        await runFn("run", machine, {event: {type: "increment", params: []}});
    } catch (e) {
        console.error(e);
        assert.equal(e.message.includes(`cannot apply "increment" event in current "locked" state`), true);
    }
    result = await runFn("getContextValue", machine, {key: "counter"});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "1");

    ///// machine 3
    machineConfig = parseMachine(machineConfig3Orig);
    console.log("==machineConfig==")
    console.log(JSON.stringify(machineConfig))

    // Create the machine
    machine = {id: machineConfig.id, states: machineConfig.states};
    await runFn("instantiate", machine, {initialState: machineConfig.initial, context: machineConfig.context})

    // Run next state
    await runFn("run", machine, {event: {type: "increment", params: []}});
    console.log("!!!!!!! -> increment");

    // Check state has changed
    currentState = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "unlocked");

    ///// machine 4 with guard
    machineConfig = parseMachine(machineWithGuard);
    console.log("==machineWithGuard==")
    console.log(JSON.stringify(machineConfig))
    let runFnOwner = runFnWrapped(storage, {currentCall: {sender: new Uint8Array([1,1,1,1,1,1]).buffer}});
    let runFnOther = runFnWrapped(storage, {currentCall: {sender: new Uint8Array([1,1,1,1,1,2]).buffer}});

    // Create the machine
    machine = {id: machineConfig.id, states: machineConfig.states};
    await runFnOwner("instantiate", machine, {initialState: machineConfig.initial, context: machineConfig.context})

    // Apply event
    await runFnOwner("run", machine, {event: {type: "increment", params: []}});
    console.log("!!!!!!! -> increment");

    try {
        await runFnOther("run", machine, {event: {type: "increment", params: []}});
    } catch (e) {
        console.error(e);
        assert.equal(e.message.includes("cannot execute transition; guard: isAdmin"), true);
    }

    // Check state has changed
    currentState = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "unlocked");

    // machine 5 - erc20
    const admin = new Uint8Array([1,1,1,1,1,1]);
    const sender = new Uint8Array([1,1,1,1,1,2]);
    const sender2 = new Uint8Array([1,1,1,1,1,3]);
    erc20Machine1Orig.context.admin = uint8ArrayToHex(admin);
    // erc20Machine1Orig.context.supply = "1000000";
    erc20Machine1Orig.context.tokenName = "Token";
    erc20Machine1Orig.context.tokenSymbol = "TKN";

    machineConfig = parseMachine(erc20Machine1Orig);
    console.log("==erc20Machine1Orig==");
    console.log(JSON.stringify(machineConfig));
    runFnOwner = runFnWrapped(storage, {currentCall: {sender: admin.buffer}});
    runFnOther = runFnWrapped(storage, {currentCall: {sender: sender2.buffer}});

    // Create the machine
    machine = {id: machineConfig.id, states: machineConfig.states};
    await runFnOwner("instantiate", machine, {initialState: machineConfig.initial, context: machineConfig.context})

    // Check state is active
    currentState = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "active");

    // Mint tokens for admin
    await runFnOwner("run", machine, {event: {type: "mint", params: [{key: "to", value: uint8ArrayToHex(admin)}, {key: "amount", value: "100"}]}});
    console.log("!!!!!!! -> minted");

    result = await runFn("getContextValue", machine, {key: "balance_" + uint8ArrayToHex(admin)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "100");

    result = await runFn("getContextValue", machine, {key: "balance_" + uint8ArrayToHex(sender)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "");

    // Transfer tokens from owner to sender
    await runFnOwner("run", machine, {event: {type: "transfer", params: [{key: "to", value: uint8ArrayToHex(sender)}, {key: "amount", value: "10"}]}});
    console.log("!!!!!!! -> transferred");

    result = await runFn("getContextValue", machine, {key: "balance_" + uint8ArrayToHex(sender)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "10");

    result = await runFn("getContextValue", machine, {key: "balance_" + uint8ArrayToHex(admin)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "90");

    // Check state is active
    currentState = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "#ERC20.unlocked.active");

    // Approve tokens
    await runFnOwner("run", machine, {event: {type: "approve", params: [{key: "spender", value: uint8ArrayToHex(sender2)}, {key: "amount", value: "10"}]}});
    console.log("!!!!!!! -> approved");

    // check allowance
    result = await runFn("getContextValue", machine, {key: "allowance_" + uint8ArrayToHex(admin) + "_" + uint8ArrayToHex(sender2)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "10");

    // TransferFrom tokens from owner to sender
    await runFnOther("run", machine, {event: {type: "transferFrom", params: [{key: "from", value: uint8ArrayToHex(admin)}, {key: "to", value: uint8ArrayToHex(sender)}, {key: "amount", value: "10"}]}});
    console.log("!!!!!!! -> transferred");

    // check admin balance
    result = await runFn("getContextValue", machine, {key: "balance_" + uint8ArrayToHex(admin)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "80");

    // check sender balance
    result = await runFn("getContextValue", machine, {key: "balance_" + uint8ArrayToHex(sender)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "20");

    // machine 6 consensusSMConfigOrig
    machineConfig = parseMachine(consensusSMConfigOrig);
    console.log("==consensusSMConfigOrig==");
    console.log(JSON.stringify(machineConfig));
    // Create the machine
    machine = {id: machineConfig.id, states: machineConfig.states};
    await runFn("instantiate", machine, {initialState: machineConfig.initial, context: machineConfig.context})

    await runFnOwner("run", machine, {event: {type: "sendRequest", params: [{key: "address", value: "localhost"}, {key: "data", value: "aGVsbG8="}]}});

    // {run: {id: 0, event: {type: "sendRequest", params: [{key: "address", value: "%s"}, {key: "data", value: "aGVsbG8="}]}

    // machine 7
    machineConfig = parseMachine(consensusSMTimerConfigOrig);
    console.log("==consensusSMTimerConfigOrig==");
    console.log(JSON.stringify(machineConfig));
    // Create the machine
    machine = {id: machineConfig.id, states: machineConfig.states};
    await runFn("instantiate", machine, {initialState: machineConfig.initial, context: machineConfig.context})

    // RAFTLogReplication
    machineConfig = parseMachine(RAFTLogReplication);
    console.log("==RAFTLogReplication==");
    console.log(JSON.stringify(machineConfig));
    // Create the machine
    machine = {id: machineConfig.id, states: machineConfig.states};
    await runFn("instantiate", machine, {initialState: machineConfig.initial, context: machineConfig.context})
    let txstr;

    // [temp] setup values
    await runFnOwner("run", machine, {event: {type: "setupNode", params: [{key: "currentNodeId", value: "0"},{key: "nodeIPs", value: "[\"0.0.0.0:8090\",\"0.0.0.0:8091\"]"}]}});

    txstr = JSON.stringify({termId: 1, leaderId: 0, prevLogIndex: 2, prevLogTerm: 0, entries: [{index: 2, termId: 1, leaderId: 0, data: ""}]})
    await runFnOwner("run", machine, {event: {type: "receiveHeartbeat", params: [{key: "entry", value: btoa(txstr)}]}});

    await runFnOwner("run", machine, {event: {type: "change", params: []}});
    await runFnOwner("run", machine, {event: {type: "change", params: []}});

    // Check state is active
    currentState = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "active");

    const tx = {from: "aa", to: "bb", funds: [], data: "1122", gas: 1000, price: 10}
    txstr = JSON.stringify(tx);
    await runFnOwner("run", machine, {event: {type: "newTransaction", params: [{key: "transaction", value: btoa(txstr)}]}});

    const bz = encodeToUtf8Array(JSON.stringify({"delay":"heartbeatTimeout","serviceId":machineId,"state":"active"}))
    await runFnOwner("eventual", machine, new Uint8Array([0, 0, 0, 0, ...bz]), "eventual");

    currentState = await runFn("getCurrentState", machine, {});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "#RAFT-LogReplication.Leader.active");

    result = await runFn("getContextValue", machine, {key: "logs_count"});
    console.log("!!!!!getContextValue logs_count", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "2");
}

runTests();

export function encodeToUtf8Array(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

export function decodeFromUtf8Array(arr) {
    if (!(arr instanceof ArrayBuffer)) arr = new Uint8Array(arr).buffer;
    const encoder = new TextDecoder();
    return encoder.decode(arr);
}

export function hexToUint8Array(hexString) {
    const encodedString = hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
    return new Uint8Array(encodedString);
}

// function name() public view returns (string)
// function symbol() public view returns (string)
// function decimals() public view returns (uint8)
// function totalSupply() public view returns (uint256)
// function balanceOf(address _owner) public view returns (uint256 balance)
// function transfer(address _to, uint256 _value) public returns (bool success)
// function transferFrom(address _from, address _to, uint256 _value) public returns (bool success)
// function approve(address _spender, uint256 _value) public returns (bool success)
// function allowance(address _owner, address _spender) public view returns (uint256 remaining)


// event Transfer(address indexed _from, address indexed _to, uint256 _value)
// event Approval(address indexed _owner, address indexed _spender, uint256 _value)
