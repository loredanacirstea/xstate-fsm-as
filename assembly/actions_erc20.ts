import { JSON } from "json-as/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';

import {
  ContextGeneralString,
  EventObject,
  ActionParam,
} from './types';
import { hexToUint8Array, revert } from "./utils";

export function hasEnoughBalance(
  ctx: ContextGeneralString,
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
    const balance = getBalance(ctx, from)
    return balance >= amount;
}

export function hasEnoughAllowance(
  ctx: ContextGeneralString,
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
    const caller = wasmxwrap.getCaller();
    const allowance = getAllowance(ctx, owner, caller);
    return allowance >= amount;
}

export function getBalance(
    ctx: ContextGeneralString,
    addr: string,
): i64 {
    const key = getBalanceKey(addr);
    if (ctx.has(key)) {
        const balancestr = ctx.get(key);
        const balance = parseInt(balancestr);
        return i64(balance);
    }
    return i64(0);
}

export function setBalance(
    ctx: ContextGeneralString,
    addr: string,
    amount: i64,
): ContextGeneralString {
    const key = getBalanceKey(addr);
    ctx.set(key, amount.toString());
    return ctx;
}

export function getAllowance(
    ctx: ContextGeneralString,
    owner: string,
    spender: string,
): i64 {
    const key = getAllowanceKey(owner, spender);
    if (ctx.has(key)) {
        const allowancestr = ctx.get(key);
        const allowance = parseInt(allowancestr);
        return i64(allowance);
    }
    return i64(0);
}

export function setAllowance(
    ctx: ContextGeneralString,
    owner: string,
    spender: string,
    amount: i64,
): ContextGeneralString {
    const key = getAllowanceKey(owner, spender);
    ctx.set(key, amount.toString());
    return ctx;
}

export function getBalanceKey(addr: string): string {
    return "balance_" + "_" + addr;
}

export function getAllowanceKey(owner: string, spender: string): string {
    return "allowance_" + "_" + owner + "_" + spender;
}

export function mint(
    ctx: ContextGeneralString,
    params: ActionParam[],
    event: EventObject,
): ContextGeneralString {
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
        return ctx;
    }
    let balance = getBalance(ctx, addr);
    balance += i64(amount);
    return setBalance(ctx, addr, balance);
}

export function move(
    ctx: ContextGeneralString,
    params: ActionParam[],
    event: EventObject,
): ContextGeneralString {
    // console.log("--move--" + event.type + "--" + event.params.length.toString());
    // console.log("--move--" + params.length.toString());

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
        return ctx;
    }
    // console.log("--move--" + from + "-" + to + "-" + amount.toString());
    let balanceFrom = getBalance(ctx, from);
    let balanceTo = getBalance(ctx, to);
    balanceFrom -= i64(amount);
    balanceTo += i64(amount);
    ctx = setBalance(ctx, from, balanceFrom);
    return setBalance(ctx, to, balanceTo);
}

export function approve(
    ctx: ContextGeneralString,
    params: ActionParam[],
    event: EventObject,
): ContextGeneralString {
    // console.log("--approve--" + event.type + "--" + event.params.length.toString());
    // console.log("--approve--" + params.length.toString());

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
    // console.log("--approve--" + spender + "-" + amount.toString());
    if (amount === 0) {
        return ctx;
    }
    const owner = wasmxwrap.getCaller();
    let allowance = getAllowance(ctx, owner, spender);
    allowance += amount;
    return setAllowance(ctx, owner, spender, allowance);
}

export function logTransfer(
    ctx: ContextGeneralString,
    params: ActionParam[],
    event: EventObject,
): ContextGeneralString {
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
        return ctx;
    }
    const topic1 = hexToUint8Array(from);
    const topic2 = hexToUint8Array(to);
    const topic3 = hexToUint8Array(amount.toString(16));
    wasmxwrap.log_fsm(new Uint8Array(0), [topic1, topic2, topic3]);
    return ctx;
}
