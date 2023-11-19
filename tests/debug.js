import { getWasi } from "./wasi.js";
async function instantiate(module, imports = {}, wasi) {
  const __module0 = imports.wasi_snapshot_preview1;
  const __module1 = imports.wasmx;
  const adaptedImports = {
    wasi_snapshot_preview1: Object.assign(Object.create(__module0), {
      fd_write(fd, iovs, iovs_len, nwritten) {
        // ~lib/bindings/wasi_snapshot_preview1/fd_write(u32, usize, usize, usize) => u16
        fd = fd >>> 0;
        iovs = iovs >>> 0;
        iovs_len = iovs_len >>> 0;
        nwritten = nwritten >>> 0;
        return __module0.fd_write(fd, iovs, iovs_len, nwritten);
      },
      proc_exit(rval) {
        // ~lib/bindings/wasi_snapshot_preview1/proc_exit(u32) => void
        rval = rval >>> 0;
        __module0.proc_exit(rval);
      },
      poll_oneoff(in_, out, nsubscriptions, nevents) {
        // ~lib/@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1/poll_oneoff(usize, usize, usize, usize) => u16
        in_ = in_ >>> 0;
        out = out >>> 0;
        nsubscriptions = nsubscriptions >>> 0;
        nevents = nevents >>> 0;
        return __module0.poll_oneoff(in_, out, nsubscriptions, nevents);
      },
    }),
    wasmx: Object.assign(Object.create(__module1), {
      storageLoad(key) {
        // assembly/wasmx/storageLoad(~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        key = __liftBuffer(key >>> 0);
        return __lowerBuffer(__module1.storageLoad(key)) || __notnull();
      },
      revert(message) {
        // assembly/wasmx/revert(~lib/arraybuffer/ArrayBuffer) => void
        message = __liftBuffer(message >>> 0);
        __module1.revert(message);
      },
      getCaller() {
        // assembly/wasmx/getCaller() => ~lib/arraybuffer/ArrayBuffer
        return __lowerBuffer(__module1.getCaller()) || __notnull();
      },
      grpcRequest(data) {
        // assembly/wasmx/grpcRequest(~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        data = __liftBuffer(data >>> 0);
        return __lowerBuffer(__module1.grpcRequest(data)) || __notnull();
      },
      log(value) {
        // assembly/wasmx/log(~lib/arraybuffer/ArrayBuffer) => void
        value = __liftBuffer(value >>> 0);
        __module1.log(value);
      },
      storageStore(key, value) {
        // assembly/wasmx/storageStore(~lib/arraybuffer/ArrayBuffer, ~lib/arraybuffer/ArrayBuffer) => void
        key = __liftBuffer(key >>> 0);
        value = __liftBuffer(value >>> 0);
        __module1.storageStore(key, value);
      },
      getCallData() {
        // assembly/wasmx/getCallData() => ~lib/arraybuffer/ArrayBuffer
        return __lowerBuffer(__module1.getCallData()) || __notnull();
      },
      finish(value) {
        // assembly/wasmx/finish(~lib/arraybuffer/ArrayBuffer) => void
        value = __liftBuffer(value >>> 0);
        __module1.finish(value);
      },
    }),
  };
  const inst = await WebAssembly.instantiate(module, adaptedImports);
  wasi.start(inst);
  const { exports } = inst;
  const memory = exports.memory || imports.env.memory;
  const adaptedExports = Object.setPrototypeOf({
    main() {
      // assembly/index/main() => ~lib/array/Array<u8>
      return __liftArray(__getU8, 0, exports.main() >>> 0);
    },
    create(_fsmConfig, _implementations) {
      // assembly/index/create(~lib/arraybuffer/ArrayBuffer, ~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
      _fsmConfig = __retain(__lowerBuffer(_fsmConfig) || __notnull());
      _implementations = __lowerBuffer(_implementations) || __notnull();
      try {
        return __liftBuffer(exports.create(_fsmConfig, _implementations) >>> 0);
      } finally {
        __release(_fsmConfig);
      }
    },
    run(id, eventNameBuf) {
      // assembly/index/run(i32, ~lib/arraybuffer/ArrayBuffer) => void
      eventNameBuf = __lowerBuffer(eventNameBuf) || __notnull();
      exports.run(id, eventNameBuf);
    },
    getCurrentState(id) {
      // assembly/index/getCurrentState(i32) => ~lib/arraybuffer/ArrayBuffer
      return __liftBuffer(exports.getCurrentState(id) >>> 0);
    },
    getContextValue(id, keyBuf) {
      // assembly/index/getContextValue(i32, ~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
      keyBuf = __lowerBuffer(keyBuf) || __notnull();
      return __liftBuffer(exports.getContextValue(id, keyBuf) >>> 0);
    },
  }, exports);
  function __liftBuffer(pointer) {
    if (!pointer) return null;
    return memory.buffer.slice(pointer, pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2]);
  }
  function __lowerBuffer(value) {
    if (value == null) return 0;
    const pointer = exports.__new(value.byteLength, 1) >>> 0;
    new Uint8Array(memory.buffer).set(new Uint8Array(value), pointer);
    return pointer;
  }
  function __liftArray(liftElement, align, pointer) {
    if (!pointer) return null;
    const
      dataStart = __getU32(pointer + 4),
      length = __dataview.getUint32(pointer + 12, true),
      values = new Array(length);
    for (let i = 0; i < length; ++i) values[i] = liftElement(dataStart + (i << align >>> 0));
    return values;
  }
  const refcounts = new Map();
  function __retain(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount) refcounts.set(pointer, refcount + 1);
      else refcounts.set(exports.__pin(pointer), 1);
    }
    return pointer;
  }
  function __release(pointer) {
    if (pointer) {
      const refcount = refcounts.get(pointer);
      if (refcount === 1) exports.__unpin(pointer), refcounts.delete(pointer);
      else if (refcount) refcounts.set(pointer, refcount - 1);
      else throw Error(`invalid refcount '${refcount}' for reference '${pointer}'`);
    }
  }
  function __notnull() {
    throw TypeError("value must not be null");
  }
  let __dataview = new DataView(memory.buffer);
  function __getU8(pointer) {
    try {
      return __dataview.getUint8(pointer, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      return __dataview.getUint8(pointer, true);
    }
  }
  function __getU32(pointer) {
    try {
      return __dataview.getUint32(pointer, true);
    } catch {
      __dataview = new DataView(memory.buffer);
      return __dataview.getUint32(pointer, true);
    }
  }
  exports._start();
  return adaptedExports;
}

export async function getExports(wasmxImport) {
    const wasi = getWasi();

    const exports = await (async url => instantiate(
        await (async () => {
          try { return await globalThis.WebAssembly.compileStreaming(globalThis.fetch(url)); }
          catch { return globalThis.WebAssembly.compile(await (await import("node:fs/promises")).readFile(url)); }
        })(), {
          wasi_snapshot_preview1: wasi.wasiImport,
          wasmx: __maybeDefault(wasmxImport),
        }, wasi,
    ))(new URL("../build/debug.wasm", import.meta.url));
    return exports
}

function __maybeDefault(module) {
  return typeof module.default === "object" && Object.keys(module).length == 1
    ? module.default
    : module;
}
