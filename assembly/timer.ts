import {
    clockid,
    event,
    eventtype,
    subscription_clock,
    poll_oneoff,
} from "@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1";

export class Time {
    static NANOSECOND: u64 = 1;
    static MILLISECOND: u64 = Time.NANOSECOND * 1000000;
    static SECOND: u64 = Time.MILLISECOND * 1000;

    // This uses some hardcoded values to fix issues from:
    // https://github.com/AssemblyScript/assemblyscript/issues/1116
    static sleep(nanoseconds: u64): void {
      // Create our subscription to the clock
      let clockSub = changetype<subscription_clock>(
        // @ts-ignore
        memory.data(offsetof<subscription_clock>())
      );
      clockSub.userdata = 0;
      clockSub.clock_id = clockid.REALTIME;
      clockSub.timeout = nanoseconds;
      clockSub.precision = 10000;
      clockSub.type = eventtype.CLOCK;
      clockSub.flags = 0;
      // We want this to be relative, no flags / subclockflag

      // Create our output event
      // @ts-ignore
      let clockEvent = memory.data(offsetof<event>() + 3);

      // Create a buffer for our number of sleep events
      // To inspect how many events happened, one would then do load<i32>(neventsBuffer)
      // @ts-ignore
      let neventsBuffer = memory.data(4);

      // Poll the subscription
      poll_oneoff(
        changetype<usize>(clockSub), // Pointer to the clock subscription
        clockEvent, // Pointer to the clock event
        1, // Number of events to wait for
        neventsBuffer // Buffer where events should be stored.
      );
    }
  }
