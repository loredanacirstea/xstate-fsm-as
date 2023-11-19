import assert from "assert";
// import { describe, it } from "test";
// import { describe, it } from 'node:test';
// import { create, getCurrentState, getContextValue, transition, run } from "../build/debug.js";
import { load, LOG } from './wasmx.js';
import { parseMachine, uint8ArrayToHex } from './utils.js';
import {
  machineConfig2,
  machineConfig2Orig,
  machineConfig3Orig,
  machineWithGuard,
  erc20Machine1Orig,
  consensusSMConfigOrig,
  consensusSMTimerConfigOrig,
  machineConfigSemaphore,
} from './data.js';

let currentState, value;

function runFnWrapped (storage = {}, env = {}) {
    return async function (fnName, args) {
        const argsStr = JSON.stringify({[fnName]: args});
        const defaultSender = encodeToUtf8Array("sender");
        env = {
            ...env,
            currentCall: {
                sender: defaultSender,
                ...env.currentCall,
                callData: encodeToUtf8Array(argsStr),
            }
        }
        const instance = await load(storage, env, LOG.debug);
        return instance._start();
    }
}

const implementations = {actions: {}};

async function runTests() {
    console.log("=consensusSMTimerConfigOrig=" , JSON.stringify(parseMachine(consensusSMTimerConfigOrig)));


    let machineConfig, machineConfigStr, implementationsStr;
    const storage = {};
    let machineId;
    let result;
    let runFn = runFnWrapped(storage);

    // Create the machine
    result = await runFn("create", machineConfigSemaphore)
    console.log("!!!!!create", decodeFromUtf8Array(result))
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 0);

    // Get initial state
    result = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "red");

    // Run next state
    await runFn("run", {id: machineId, event: {type: "next", params: []}});
    console.log("!!!!!!! -> next");

    // Check state has changed
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "blue");


    ///// machine 2

    const implementations2 = {actions: {}};

    machineConfig = parseMachine(machineConfig2Orig);
    console.log("==machineConfig2Orig==")
    console.log(JSON.stringify(machineConfig))
    implementationsStr = JSON.stringify(implementations2);

    // Create the machine
    result = await runFn("create", machineConfig)
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 1);

    // Get initial state
    result = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "unlocked");

    // Get context value
    result = await runFn("getContextValue", {id: machineId, key: "counter"});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "0");

    // Run next state
    await runFn("run", {id: machineId, event: {type: "increment", params: []}});
    console.log("!!!!!!! -> increment");

    // Check state has changed
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "unlocked");

    // Get context value
    result = await runFn("getContextValue", {id: machineId, key: "counter"});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "1");

    // Run lock transition
    await runFn("run", {id: machineId, event: {type: "lock", params: []}});
    console.log("!!!!!!! -> lock");

    // Check state has been locked
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "locked");

    // Check no increment is possible
    console.log("!!!!!!! -> try increment");
    try {
        await runFn("run", {id: machineId, event: {type: "increment", params: []}});
    } catch (e) {
        console.error(e);
        assert.equal(e.message.includes("cannot apply event in current state"), true);
    }
    result = await runFn("getContextValue", {id: machineId, key: "counter"});
    console.log("!!!!!currentState", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "1");

    ///// machine 3

    machineConfig = parseMachine(machineConfig3Orig);
    console.log("==machineConfig==")
    console.log(JSON.stringify(machineConfig))
    implementationsStr = JSON.stringify(implementations2);

    // Create the machine
    result = await runFn("create", machineConfig)
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 2);

    // Run next state
    await runFn("run", {id: machineId, event: {type: "increment", params: []}});
    console.log("!!!!!!! -> increment");

    // Check state has changed
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "unlocked");

    ///// machine 4 with guard

    machineConfig = parseMachine(machineWithGuard);
    console.log("==machineWithGuard==")
    console.log(JSON.stringify(machineConfig))
    implementationsStr = JSON.stringify(implementations2);
    let runFnOwner = runFnWrapped(storage, {currentCall: {sender: new Uint8Array([1,1,1,1,1,1]).buffer}});
    let runFnOther = runFnWrapped(storage, {currentCall: {sender: new Uint8Array([1,1,1,1,1,2]).buffer}});

    // Create the machine
    result = await runFnOwner("create", machineConfig)
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 3);

    // Apply event
    await runFnOwner("run", {id: machineId, event: {type: "increment", params: []}});
    console.log("!!!!!!! -> increment");

    try {
        await runFnOther("run", {id: machineId, event: {type: "increment", params: []}});
    } catch (e) {
        console.error(e);
        assert.equal(e.message.includes("cannot execute transition; guard: isAdmin"), true);
    }

    // Check state has changed
    currentState = await runFn("getCurrentState", {id: machineId});
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
    result = await runFnOwner("create", machineConfig)
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 4);

    // Check state is active
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "active");

    // Mint tokens for admin
    await runFnOwner("run", {id: machineId, event: {type: "mint", params: [{key: "to", value: uint8ArrayToHex(admin)}, {key: "amount", value: "100"}]}});
    console.log("!!!!!!! -> minted");

    result = await runFn("getContextValue", {id: machineId, key: "balance_4_" + uint8ArrayToHex(admin)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "100");

    result = await runFn("getContextValue", {id: machineId, key: "balance_4_" + uint8ArrayToHex(sender)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "");

    // Transfer tokens from owner to sender
    await runFnOwner("run", {id: machineId, event: {type: "transfer", params: [{key: "to", value: uint8ArrayToHex(sender)}, {key: "amount", value: "10"}]}});
    console.log("!!!!!!! -> transferred");

    result = await runFn("getContextValue", {id: machineId, key: "balance_4_" + uint8ArrayToHex(sender)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "10");

    result = await runFn("getContextValue", {id: machineId, key: "balance_4_" + uint8ArrayToHex(admin)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "90");

    // Check state is active
    currentState = await runFn("getCurrentState", {id: machineId});
    console.log("!!!!!currentState", decodeFromUtf8Array(currentState))
    assert.strictEqual(decodeFromUtf8Array(currentState), "#ERC20.unlocked.active");

    // Approve tokens
    await runFnOwner("run", {id: machineId, event: {type: "approve", params: [{key: "spender", value: uint8ArrayToHex(sender2)}, {key: "amount", value: "10"}]}});
    console.log("!!!!!!! -> approved");

    // check allowance
    result = await runFn("getContextValue", {id: machineId, key: "allowance_4_" + uint8ArrayToHex(admin) + "_" + uint8ArrayToHex(sender2)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "10");

    // TransferFrom tokens from owner to sender
    await runFnOther("run", {id: machineId, event: {type: "transferFrom", params: [{key: "from", value: uint8ArrayToHex(admin)}, {key: "to", value: uint8ArrayToHex(sender)}, {key: "amount", value: "10"}]}});
    console.log("!!!!!!! -> transferred");

    // check admin balance
    result = await runFn("getContextValue", {id: machineId, key: "balance_4_" + uint8ArrayToHex(admin)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "80");

    // check sender balance
    result = await runFn("getContextValue", {id: machineId, key: "balance_4_" + uint8ArrayToHex(sender)});
    console.log("!!!!!getContextValue", decodeFromUtf8Array(result))
    currentState = decodeFromUtf8Array(result);
    assert.strictEqual(currentState, "20");

    // machine 6 consensusSMConfigOrig
    machineConfig = parseMachine(consensusSMConfigOrig);
    console.log("==consensusSMConfigOrig==");
    console.log(JSON.stringify(machineConfig));
    // Create the machine
    result = await runFnOwner("create", machineConfig);
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 5);

    await runFnOwner("run", {id: machineId, event: {type: "sendRequest", params: [{key: "address", value: "localhost"}, {key: "data", value: "hello"}]}});

    // {run: {id: 0, event: {type: "sendRequest", params: [{key: "address", value: "%s"}, {key: "data", value: "hello"}]}

    // machine 7
    machineConfig = parseMachine(consensusSMTimerConfigOrig);
    console.log("==consensusSMTimerConfigOrig==");
    console.log(JSON.stringify(machineConfig));
    // Create the machine
    result = await runFnOwner("create", machineConfig);
    machineId = JSON.parse(decodeFromUtf8Array(result)).id;
    assert.strictEqual(machineId, 6);

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
