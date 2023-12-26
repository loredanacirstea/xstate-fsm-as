async function instantiate(module, imports = {}) {
  const __module0 = imports.wasmx;
  const __module1 = imports.consensus;
  const adaptedImports = {
    env: Object.assign(Object.create(globalThis), imports.env || {}, {
      abort(message, fileName, lineNumber, columnNumber) {
        // ~lib/builtins/abort(~lib/string/String | null?, ~lib/string/String | null?, u32?, u32?) => void
        message = __liftString(message >>> 0);
        fileName = __liftString(fileName >>> 0);
        lineNumber = lineNumber >>> 0;
        columnNumber = columnNumber >>> 0;
        (() => {
          // @external.js
          throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`);
        })();
      },
      "console.log"(text) {
        // ~lib/bindings/dom/console.log(~lib/string/String) => void
        text = __liftString(text >>> 0);
        console.log(text);
      },
      "console.error"(text) {
        // ~lib/bindings/dom/console.error(~lib/string/String) => void
        text = __liftString(text >>> 0);
        console.error(text);
      },
      "console.debug"(text) {
        // ~lib/bindings/dom/console.debug(~lib/string/String) => void
        text = __liftString(text >>> 0);
        console.debug(text);
      },
      "Date.now"() {
        // ~lib/bindings/dom/Date.now() => f64
        return Date.now();
      },
      seed() {
        // ~lib/builtins/seed() => f64
        return (() => {
          // @external.js
          return Date.now() * Math.random();
        })();
      },
    }),
    wasmx: Object.assign(Object.create(__module0), {
      storageLoad(key) {
        // assembly/wasmx/storageLoad(~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        key = __liftBuffer(key >>> 0);
        return __lowerBuffer(__module0.storageLoad(key)) || __notnull();
      },
      revert(message) {
        // assembly/wasmx/revert(~lib/arraybuffer/ArrayBuffer) => void
        message = __liftBuffer(message >>> 0);
        __module0.revert(message);
      },
      getCaller() {
        // assembly/wasmx/getCaller() => ~lib/arraybuffer/ArrayBuffer
        return __lowerBuffer(__module0.getCaller()) || __notnull();
      },
      getAddress() {
        // assembly/wasmx/getAddress() => ~lib/arraybuffer/ArrayBuffer
        return __lowerBuffer(__module0.getAddress()) || __notnull();
      },
      grpcRequest(data) {
        // assembly/wasmx/grpcRequest(~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        data = __liftBuffer(data >>> 0);
        return __lowerBuffer(__module0.grpcRequest(data)) || __notnull();
      },
      log(value) {
        // assembly/wasmx/log(~lib/arraybuffer/ArrayBuffer) => void
        value = __liftBuffer(value >>> 0);
        __module0.log(value);
      },
      sha256(value) {
        // assembly/wasmx/sha256(~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        value = __liftBuffer(value >>> 0);
        return __lowerBuffer(__module0.sha256(value)) || __notnull();
      },
      setReturnData(value) {
        // assembly/wasmx/setReturnData(~lib/arraybuffer/ArrayBuffer) => void
        value = __liftBuffer(value >>> 0);
        __module0.setReturnData(value);
      },
      call(data) {
        // assembly/wasmx/call(~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        data = __liftBuffer(data >>> 0);
        return __lowerBuffer(__module0.call(data)) || __notnull();
      },
      storageStore(key, value) {
        // assembly/wasmx/storageStore(~lib/arraybuffer/ArrayBuffer, ~lib/arraybuffer/ArrayBuffer) => void
        key = __liftBuffer(key >>> 0);
        value = __liftBuffer(value >>> 0);
        __module0.storageStore(key, value);
      },
      startTimeout(repeat, time, args) {
        // assembly/wasmx/startTimeout(i32, i64, ~lib/arraybuffer/ArrayBuffer) => i32
        args = __liftBuffer(args >>> 0);
        return __module0.startTimeout(repeat, time, args);
      },
      getCallData() {
        // assembly/wasmx/getCallData() => ~lib/arraybuffer/ArrayBuffer
        return __lowerBuffer(__module0.getCallData()) || __notnull();
      },
      getReturnData() {
        // assembly/wasmx/getReturnData() => ~lib/arraybuffer/ArrayBuffer
        return __lowerBuffer(__module0.getReturnData()) || __notnull();
      },
      finish(value) {
        // assembly/wasmx/finish(~lib/arraybuffer/ArrayBuffer) => void
        value = __liftBuffer(value >>> 0);
        __module0.finish(value);
      },
    }),
    consensus: Object.assign(Object.create(__module1), {
      LoggerError(value) {
        // assembly/consensus/LoggerError(~lib/arraybuffer/ArrayBuffer) => void
        value = __liftBuffer(value >>> 0);
        __module1.LoggerError(value);
      },
      LoggerDebug(value) {
        // assembly/consensus/LoggerDebug(~lib/arraybuffer/ArrayBuffer) => void
        value = __liftBuffer(value >>> 0);
        __module1.LoggerDebug(value);
      },
      LoggerInfo(value) {
        // assembly/consensus/LoggerInfo(~lib/arraybuffer/ArrayBuffer) => void
        value = __liftBuffer(value >>> 0);
        __module1.LoggerInfo(value);
      },
      CheckTx(value) {
        // assembly/consensus/CheckTx(~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        value = __liftBuffer(value >>> 0);
        return __lowerBuffer(__module1.CheckTx(value)) || __notnull();
      },
      PrepareProposal(value) {
        // assembly/consensus/PrepareProposal(~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        value = __liftBuffer(value >>> 0);
        return __lowerBuffer(__module1.PrepareProposal(value)) || __notnull();
      },
      ProcessProposal(value) {
        // assembly/consensus/ProcessProposal(~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        value = __liftBuffer(value >>> 0);
        return __lowerBuffer(__module1.ProcessProposal(value)) || __notnull();
      },
      RollbackToVersion(height) {
        // assembly/consensus/RollbackToVersion(i64) => ~lib/arraybuffer/ArrayBuffer
        return __lowerBuffer(__module1.RollbackToVersion(height)) || __notnull();
      },
      MerkleHash(value) {
        // assembly/consensus/MerkleHash(~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        value = __liftBuffer(value >>> 0);
        return __lowerBuffer(__module1.MerkleHash(value)) || __notnull();
      },
      ed25519Verify(pubKey, signature, msgbz) {
        // assembly/consensus/ed25519Verify(~lib/arraybuffer/ArrayBuffer, ~lib/arraybuffer/ArrayBuffer, ~lib/arraybuffer/ArrayBuffer) => i32
        pubKey = __liftBuffer(pubKey >>> 0);
        signature = __liftBuffer(signature >>> 0);
        msgbz = __liftBuffer(msgbz >>> 0);
        return __module1.ed25519Verify(pubKey, signature, msgbz);
      },
      ed25519Sign(privKey, msgbz) {
        // assembly/consensus/ed25519Sign(~lib/arraybuffer/ArrayBuffer, ~lib/arraybuffer/ArrayBuffer) => ~lib/arraybuffer/ArrayBuffer
        privKey = __liftBuffer(privKey >>> 0);
        msgbz = __liftBuffer(msgbz >>> 0);
        return __lowerBuffer(__module1.ed25519Sign(privKey, msgbz)) || __notnull();
      },
    }),
  };
  const { exports } = await WebAssembly.instantiate(module, adaptedImports);
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
  function __liftString(pointer) {
    if (!pointer) return null;
    const
      end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1,
      memoryU16 = new Uint16Array(memory.buffer);
    let
      start = pointer >>> 1,
      string = "";
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
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
  return adaptedExports;
}

export async function getExports(wasmxImport, consensusImport) {
  const exports = await (async url => instantiate(
      await (async () => {
        try { return await globalThis.WebAssembly.compileStreaming(globalThis.fetch(url)); }
        catch { return globalThis.WebAssembly.compile(await (await import("node:fs/promises")).readFile(url)); }
      })(), {
        wasmx: __maybeDefault(wasmxImport),
        consensus: __maybeDefault(consensusImport),
      },
  ))(new URL("../build/debug.wasm", import.meta.url));
  return exports
}

function __maybeDefault(module) {
  return typeof module.default === "object" && Object.keys(module).length == 1
    ? module.default
    : module;
}
