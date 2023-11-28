import {
  ActionParam,
  ContextGeneralString,
} from './types';

export function increment(
  ctx: ContextGeneralString,
  params: ActionParam[],
): ContextGeneralString {
  for (let i = 0; i < params.length; i++) {
    const value = parseInt(ctx.get(params[i].key), 10) + parseInt(params[i].value, 10);
    let vstr = value.toString(10);
    vstr = vstr.substring(0, vstr.length - 2);
    ctx.set(params[i].key,  vstr);
  }
  return ctx;
}
