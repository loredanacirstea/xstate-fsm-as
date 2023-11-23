import { JSON } from "json-as/assembly";
import * as wasmxwrap from './wasmx_wrap';
import * as wasmx from './wasmx';

import {
  EventObject,
  Typestate,
  ActionParam,
} from './types';
import { hexToUint8Array, revert } from "./utils";

export function hasEnoughBalance<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
>(
  id: i32,
  ctx: TContext,
  params: ActionParam[],
  event: TEvent,
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
    const balance = getBalance(id, ctx, from)
    return balance >= amount;
}

export function hasEnoughAllowance<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
>(
  id: i32,
  ctx: TContext,
  params: ActionParam[],
  event: TEvent,
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
    const allowance = getAllowance(id, ctx, owner, caller);
    return allowance >= amount;
}

export function getBalance<
    TContext extends Map<string,string>,
>(
    id: i32,
    ctx: TContext,
    addr: string,
): i64 {
    const key = getBalanceKey(id, addr);
    if (ctx.has(key)) {
        const balancestr = ctx.get(key);
        const balance = parseInt(balancestr);
        return i64(balance);
    }
    return i64(0);
}

export function setBalance<
    TContext extends Map<string,string>,
>(
    id: i32,
    ctx: TContext,
    addr: string,
    amount: i64,
): TContext {
    const key = getBalanceKey(id, addr);
    ctx.set(key, amount.toString());
    return ctx;
}

export function getAllowance<
    TContext extends Map<string,string>,
>(
    id: i32,
    ctx: TContext,
    owner: string,
    spender: string,
): i64 {
    const key = getAllowanceKey(id, owner, spender);
    if (ctx.has(key)) {
        const allowancestr = ctx.get(key);
        const allowance = parseInt(allowancestr);
        return i64(allowance);
    }
    return i64(0);
}

export function setAllowance<
    TContext extends Map<string,string>,
>(
    id: i32,
    ctx: TContext,
    owner: string,
    spender: string,
    amount: i64,
): TContext {
    const key = getAllowanceKey(id, owner, spender);
    ctx.set(key, amount.toString());
    return ctx;
}

export function getBalanceKey(id: i32, addr: string): string {
    return "balance_" + id.toString() + "_" + addr;
}

export function getAllowanceKey(id: i32, owner: string, spender: string): string {
    return "allowance_" + id.toString() + "_" + owner + "_" + spender;
}

export function mint<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
>(
    id: i32,
    ctx: TContext,
    params: ActionParam[],
    event: TEvent,
): TContext {
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
    let balance = getBalance(id, ctx, addr);
    balance += i64(amount);
    return setBalance(id, ctx, addr, balance);
}

export function move<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>,
>(
    id: i32,
    ctx: TContext,
    params: ActionParam[],
    event: TEvent,
): TContext {
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
    let balanceFrom = getBalance(id, ctx, from);
    let balanceTo = getBalance(id, ctx, to);
    balanceFrom -= i64(amount);
    balanceTo += i64(amount);
    ctx = setBalance(id, ctx, from, balanceFrom);
    return setBalance(id, ctx, to, balanceTo);
}

export function approve<
  TContext extends Map<string,string>,
  TEvent extends EventObject,
  TState extends Typestate<TContext>,
>(
    id: i32,
    ctx: TContext,
    params: ActionParam[],
    event: TEvent,
): TContext {
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
    let allowance = getAllowance(id, ctx, owner, spender);
    allowance += amount;
    return setAllowance(id, ctx, owner, spender, allowance);
}

export function logTransfer<
    TContext extends Map<string,string>,
    TEvent extends EventObject,
    TState extends Typestate<TContext>,
>(
    id: i32,
    ctx: TContext,
    params: ActionParam[],
    event: TEvent,
): TContext {
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
    const topic0 = hexToUint8Array(id.toString(16));
    const topic1 = hexToUint8Array(from);
    const topic2 = hexToUint8Array(to);
    const topic3 = hexToUint8Array(amount.toString(16));
    wasmxwrap.log_fsm(new Uint8Array(0), [topic0, topic1, topic2, topic3]);
    return ctx;
}
