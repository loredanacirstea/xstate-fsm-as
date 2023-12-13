import { JSON } from "json-as/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';
import * as storage from './storage';

import {
  EventObject,
  ActionParam,
} from './types';
import { hexToUint8Array, revert, getAddressHex } from "./utils";

export function hasEnoughBalance(
  params: ActionParam[],
  event: EventObject,
): boolean {
    let from: string = "";
    let amount: i64 = 0;
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "from") {
            from = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "amount") {
            amount = i64(parseInt(event.params[i].value));
            continue;
        }
    }
    if (from === "") {
        revert("move event empty from address");
    }
    if (amount === 0) {
        return true;
    }
    const balance = getBalance(from)
    return balance >= amount;
}

export function hasEnoughAllowance(
  params: ActionParam[],
  event: EventObject,
): boolean {
    let owner: string = "";
    let amount: i64 = 0;
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "from") {
            owner = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "amount") {
            amount = i64(parseInt(event.params[i].value));
            continue;
        }
    }
    if (owner === "") {
        revert("move event empty from address");
    }
    if (amount === 0) {
        return true;
    }
    const caller = getAddressHex(wasmx.getCaller());
    const allowance = getAllowance(owner, caller);
    return allowance >= amount;
}

export function getBalance(
    addr: string,
): i64 {
    const key = getBalanceKey(addr);
    const balancestr = storage.getContextValue(key);
    if (balancestr) {
        const balance = parseInt(balancestr);
        return i64(balance);
    }
    return i64(0);
}

export function setBalance(
    addr: string,
    amount: i64,
): void {
    const key = getBalanceKey(addr);
    storage.setContextValue(key, amount.toString());
}

export function getAllowance(
    owner: string,
    spender: string,
): i64 {
    const key = getAllowanceKey(owner, spender);
    const allowancestr = storage.getContextValue(key);
    if (allowancestr) {
        const allowance = parseInt(allowancestr);
        return i64(allowance);
    }
    return i64(0);
}

export function setAllowance(
    owner: string,
    spender: string,
    amount: i64,
): void {
    const key = getAllowanceKey(owner, spender);
    storage.setContextValue(key, amount.toString());
    return;
}

export function getBalanceKey(addr: string): string {
    return "balance_" + addr;
}

export function getAllowanceKey(owner: string, spender: string): string {
    return "allowance_" + owner + "_" + spender;
}

export function mint(
    params: ActionParam[],
    event: EventObject,
): void {
    let addr: string = "";
    let amount: i64 = 0;
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "to") {
            addr = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "amount") {
            amount = i64(parseInt(event.params[i].value));
            continue;
        }
    }
    if (addr === "") {
        revert("mint event empty address");
    }
    if (amount === 0) {
        return;
    }
    let balance = getBalance(addr);
    balance += i64(amount);
    return setBalance(addr, balance);
}

export function move(
    params: ActionParam[],
    event: EventObject,
): void {
    let from: string = "";
    let to: string = "";
    let amount: i64 = 0;
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "from") {
            from = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "to") {
            to = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "amount") {
            amount = i64(parseInt(event.params[i].value));
            continue;
        }
    }
    if (from === "") {
        revert("move event empty from address");
    }
    if (to === "") {
        revert("move event empty to address");
    }
    if (amount === 0) {
        return;
    }
    let balanceFrom = getBalance(from);
    let balanceTo = getBalance(to);
    balanceFrom -= i64(amount);
    balanceTo += i64(amount);
    setBalance(from, balanceFrom);
    return setBalance(to, balanceTo);
}

export function approve(
    params: ActionParam[],
    event: EventObject,
): void {
    let spender: string = "";
    let amount: i64 = 0;
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "spender") {
            spender = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "amount") {
            amount = i64(parseInt(event.params[i].value));
            continue;
        }
    }
    if (spender === "") {
        revert("approve event empty address");
    }
    if (amount === 0) {
        return;
    }
    const owner = getAddressHex(wasmx.getCaller());
    let allowance = getAllowance(owner, spender);
    allowance += amount;
    return setAllowance(owner, spender, allowance);
}

export function logTransfer(
    params: ActionParam[],
    event: EventObject,
): void {
    let from: string = "";
    let to: string = "";
    let amount: i64 = 0;
    for (let i = 0; i < event.params.length; i++) {
        if (event.params[i].key === "from") {
            from = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "to") {
            to = event.params[i].value;
            continue;
        }
        if (event.params[i].key === "amount") {
            amount = i64(parseInt(event.params[i].value));
            continue;
        }
    }
    if (from === "") {
        revert("move event empty from address");
    }
    if (to === "") {
        revert("move event empty to address");
    }
    if (amount === 0) {
        return;
    }
    const topic1 = hexToUint8Array(from);
    const topic2 = hexToUint8Array(to);
    const topic3 = hexToUint8Array(amount.toString(16));
    wasmxwrap.log_fsm(new Uint8Array(0), [topic1, topic2, topic3]);
}
