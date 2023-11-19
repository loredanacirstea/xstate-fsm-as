import { WASI, File, OpenFile, PreopenDirectory } from "@bjorn3/browser_wasi_shim";

let args = ["bin", "arg1", "arg2"];
let env = ["FOO=bar"];
let fds = [
    new OpenFile(new File([])), // stdin
    new OpenFile(new File([])), // stdout
    new OpenFile(new File([])), // stderr
    new PreopenDirectory(".", {
        // "example.c": new File(new TextEncoder("utf-8").encode(`#include "a"`)),
        // "hello.rs": new File(new TextEncoder("utf-8").encode(`fn main() { println!("Hello World!"); }`)),
    }),
];
let wasi = new WASI(args, env, fds);

export function getWasi() {
    return wasi;
}
