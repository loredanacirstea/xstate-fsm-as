import {
  ActionParam,
} from './types';
import * as storage from './storage';

export function increment(
  params: ActionParam[],
): void {
  for (let i = 0; i < params.length; i++) {
    const value = parseInt(storage.getContextValue(params[i].key), 10) + parseInt(params[i].value, 10);
    let vstr = value.toString(10);
    vstr = vstr.substring(0, vstr.length - 2);
    storage.setContextValue(params[i].key,  vstr);
  }
}
