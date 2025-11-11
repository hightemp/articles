# Gist of Go: Time
_This is a chapter from my book on [Go concurrency](https://antonz.org/go-concurrency), which teaches the topic from the ground up through interactive examples._

In this chapter, we'll look at some techniques for handling time in concurrent programs.

Throttling
----------

Suppose we have work that needs to be done in large quantities:

```
func work() {  // Something very important, but not very fast. time.Sleep(100 * time.Millisecond) } 
```

[Edit](#edit)

The easiest way is to process sequentially:

```
func main() {  start := time.Now()   work() work() work() work()   fmt.Println("4 calls took", time.Since(start)) } 
```

[Edit](#edit)

Four calls of 100 ms each take a total of 400 ms when executed one after the other.

Of course, it's faster to do the work in parallel with N handlers like this:

*   If there's a free handler, give it the task.
*   Otherwise, wait until one becomes available.

In the "Channels" chapter we solved a similar problem using a semaphore. Recall the principle:

*   Create an empty channel with a buffer size of N.
*   Before starting, a goroutine puts a token (some value) into the channel.
*   Once finished, the goroutine takes a token from the channel.

Let's create a wrapper `throttle(n, fn)` to ensure concurrent execution. We'll set up a `sema` channel and make sure that no more than `n` work functions are running at the same time:

```
func throttle(n int, fn func()) (handle func(), wait func()) {  // Semaphore for n goroutines. sema := make(chan struct{}, n)   // Execute fn functions concurrently, but not more than n at a time. handle = func() { sema <- struct{}{} go func() { fn() <-sema }() }   // Wait until all functions have finished. wait = func() { for range n { sema <- struct{}{} } }   return handle, wait } 
```

[Edit](#edit)

Now the client calls the `work()` function through the wrapper, not directly:

```
func main() {  handle, wait := throttle(2, work) start := time.Now()   handle() handle() handle() handle() wait()   fmt.Println("4 calls took", time.Since(start)) } 
```

[Edit](#edit)

Here's how it works:

*   The first and second calls start processing immediately;
*   The third and fourth wait for the previous two to finish.

With two handlers, 4 calls complete in 200 ms.

Such throttling works well when the parallelism level `n` and the individual `work()` times match (more or less) the rate of `handle()` calls. Then each call has a good chance of being processed immediately or with a small delay.

However, if there are many more calls than the handlers can manage, the system will slow down. Each `work()` will still take 100 ms, but `handle()` calls will hang, waiting for a place in a semaphore. This isn't a big deal for data pipelines, but could be problematic for online requests.

Sometimes, clients may prefer to get an immediate error when all handlers are busy. We need another approach for such cases.

Backpressure
------------

Let's change the `throttle()` logic:

*   If there's room in the semaphore, execute the function.
*   Otherwise, return an error immediately.

This way, the client doesn't have to wait for a stuck call.

The select statement will help us once again.

Before:

```
// Execute fn functions concurrently, // but not more than n at a time. handle = func() {  sema <- struct{}{} go func() { fn() <-sema }() } 
```

After:

```
// Execute fn functions concurrently, // but not more than n at a time. handle = func() error {  select { case sema <- struct{}{}: go func() { fn() <-sema }() return nil default: return errors.New("busy") } } 
```

Let's recall how select works:

*   Checks which cases are not blocked.
*   If multiple cases are ready, randomly selects one to execute.
*   If all cases are blocked, waits until one is ready.

The third point (all cases are blocked) actually splits into two:

*   If there's _no default_ case, select waits until one is ready.
*   If there is a _default_ case, select executes it.

The default case is perfect for our situation:

*   If there's a token in the `sema` channel, we run `fn`.
*   Otherwise, we return a "busy" error without waiting.

Let's look at the client:

```
func main() {  handle, wait := throttle(2, work)   start := time.Now()   err := handle() fmt.Println("1st call, error:", err)   err = handle() fmt.Println("2nd call, error:", err)   err = handle() fmt.Println("3rd call, error:", err)   err = handle() fmt.Println("4th call, error:", err)   wait()   fmt.Println("4 calls took", time.Since(start)) } 
```

[Edit](#edit)

The first two calls ran concurrently (each took 100 ms), while the third and fourth got an error immediately. All calls were handled in 100 ms.

Of course, this approach (sometimes called _backpressure_) requires some awareness on the part of the client. The client should understand that a "busy" error means overload, and either delay further `handle()` calls or reduce their frequency.

**✎ Exercise: Queue with(out) blocking**

Practice is essential for turning knowledge into skills, making theory alone insufficient. The full version of the book contains a lot of interactive exercises with automated tests — that's why I recommend [getting it](https://antonz.gumroad.com/l/go-concurrency).

If you're okay with just reading for now, let's continue.

Operation timeout
-----------------

Here's a function that normally takes 10 ms, but in 20% of the calls it takes 200 ms:

```
func work() int {  if rand.Intn(10) < 8 { time.Sleep(10 * time.Millisecond) } else { time.Sleep(200 * time.Millisecond) } return 42 } 
```

[Edit](#edit)

Let's say we don't want to wait more than 50 ms. So, we set a _timeout_ — the maximum time we're willing to wait for a response. If the operation doesn't complete within the timeout, we'll consider it an error.

Let's create a wrapper that runs the given function with the given timeout:

```
func withTimeout(timeout time.Duration, fn func() int) (int, error) {  // ... } 
```

We'll call it like this:

```
func main() {  for range 10 { start := time.Now() timeout := 50 * time.Millisecond if answer, err := withTimeout(timeout, work); err != nil { fmt.Printf("Took longer than %v. Error: %v\n", time.Since(start), err) } else { fmt.Printf("Took %v. Result: %v\n", time.Since(start), answer) } } } 
```

[Edit](#edit)

Here's the idea behind `withTimeout()`:

*   Run the given `fn()` in a separate goroutine.
*   Wait for the `timeout` period.
*   If `fn()` returns a result, return it.
*   If it doesn't finish in time, return an error.

Here's how you can implement it:

```
// withTimeout executes a function with a given timeout. func withTimeout(timeout time.Duration, fn func() int) (int, error) {  var result int   done := make(chan struct{}) go func() { result = fn() close(done) }()   select { case <-done: return result, nil case <-time.After(timeout): return 0, errors.New("timeout") } } 
```

[Edit](#edit)

Everything here is familiar except for `time.After()`. This stdlib function returns a channel that is initially empty, but receives a value after the timeout period. This allows the select statement to choose the correct case:

*   The `<-done` case, if `fn()` finishes before the timeout (returns the result);
*   The `<-time.After()` case, if `fn()` doesn't finish in time (returns an error).

**✎ Exercise: Reimplementing time.After**

Practice is essential for turning knowledge into skills, making theory alone insufficient. The full version of the book contains a lot of interactive exercises with automated tests — that's why I recommend [getting it](https://antonz.gumroad.com/l/go-concurrency).

If you're okay with just reading for now, let's continue.

Timer
-----

Sometimes you want to perform an action after some time instead of immediately. In Go, you can use a _timer_ to do this.

```
func work() {  fmt.Println("work done") } 
```

[Edit](#edit)

```
func main() {  var eventTime time.Time    start := time.Now()  timer := time.NewTimer(100 * time.Millisecond)  // (1)  go func() {  eventTime = <-timer.C                       // (2)  work()  }()    // enough time for the timer to expire  time.Sleep(150 * time.Millisecond)  fmt.Printf("delayed function started after %v\n", eventTime.Sub(start)) } 
```

[Edit](#edit)

`time.NewTimer()` creates a new timer ➊ that will expire (trigger) after a specified duration. A timer is a structure with a `C` channel to which it sends the current time when expired ➋. This way, the `work()` function will only execute after the timer expires.

If you stop a timer, no value is sent to the `C` channel, preventing `work()` from running:

```
func main() {  start := time.Now() timer := time.NewTimer(100 * time.Millisecond) go func() { <-timer.C work() }()   time.Sleep(10 * time.Millisecond) fmt.Println("10ms has passed...")   // the timer hasn't expired yet if timer.Stop() { fmt.Printf("delayed function canceled after %v\n", time.Since(start)) } } 
```

[Edit](#edit)

`Stop()` stops the timer and returns `true` if it hasn't expired yet. In the above example, we stopped the timer after only 10 ms, so it returns `true`.

> You may notice a problem: since `timer.C` never receives a value, our goroutine hangs. You can fix this with a select statement or a library function, which we'll discuss later.

If you stop the timer too late, `Stop()` will return `false`:

```
func main() {  timer := time.NewTimer(100 * time.Millisecond) go func() { <-timer.C work() }()   time.Sleep(150 * time.Millisecond) fmt.Println("150ms has passed...")   // too late, the timer has already expired if !timer.Stop() { fmt.Println("too late to cancel") } } 
```

[Edit](#edit)

For delayed function execution, you don't need to manually create a timer and read from its channel. There's a handy wrapper `time.AfterFunc()`:

```
func main() {  time.AfterFunc(100*time.Millisecond, work)   // enough time for the timer to expire time.Sleep(150 * time.Millisecond) } 
```

[Edit](#edit)

`AfterFunc(d, f)` waits for duration `d` and then executes function `f`. It returns a timer that you can cancel before execution starts:

```
func main() {  timer := time.AfterFunc(100*time.Millisecond, work)   time.Sleep(10 * time.Millisecond) fmt.Println("10ms has passed...")   // the timer hasn't expired yet if timer.Stop() { fmt.Println("execution canceled") } } 
```

[Edit](#edit)

In this case, canceling execution with `timer.Stop()` won't cause any goroutines to hang (a good reason to use library functions instead of custom ones).

**✎ Exercise: Reimplementing time.AfterFunc**

Practice is essential for turning knowledge into skills, making theory alone insufficient. The full version of the book contains a lot of interactive exercises with automated tests — that's why I recommend [getting it](https://antonz.gumroad.com/l/go-concurrency).

If you're okay with just reading for now, let's continue.

Timer reset
-----------

Suppose we have a function that reads tokens from the input channel and alerts if a value does not appear in a channel after an hour:

```
type token struct{}   func consumer(cancel <-chan token, in <-chan token) {  const timeout = time.Hour for { select { case <-in: // do stuff case <-time.After(timeout): // log warning case <-cancel: return } } } 
```

[Edit](#edit)

Let's write a client that measures the memory usage after 100K channel sends:

```
func main() {  cancel := make(chan token) defer close(cancel)   tokens := make(chan token) go consumer(cancel, tokens)   measure(func() { for range 100000 { tokens <- token{} } }) } 
```

[Edit](#edit) What is measure

```
// measure returns the number of bytes allocated // and the number of allocations performed by the function fn. func measure(fn func()) {  var m runtime.MemStats    runtime.GC()  runtime.ReadMemStats(&m)  allocBefore, mallocsBefore := m.TotalAlloc, m.Mallocs    fn()    runtime.GC()  runtime.ReadMemStats(&m)  allocAfter, mallocsAfter := m.TotalAlloc, m.Mallocs    alloc := allocAfter - allocBefore  mallocs := mallocsAfter - mallocsBefore  fmt.Printf("Memory used: %d KB, # allocations: %d\n", alloc/1024, mallocs) } 
``` 

Behind the scenes, each `time.After` creates a timer that is later freed by the garbage collector. So our for loop is essentially creating a miriad of timers, doing a lot of allocations, and creating unnecessary work for the GC. This is usually not what we want.

To avoid creating a timer on each loop iteration, you can create it at the beginning and reset it before moving on to the next iteration. The `Reset` method in Go 1.23+ is perfect for this:

```
func consumer(cancel <-chan token, in <-chan token) {  const timeout = time.Hour timer := time.NewTimer(timeout) for { timer.Reset(timeout) select { case <-in: // do stuff case <-timer.C: // log warning case <-cancel: return } } } 
```

[Edit](#edit)

This approach does not create new timers, so the GC does not need to collect them.

### Reset in Go pre-1.23

Due to implementation quirks in Go versions prior to 1.23, `Reset` should only be called on an already stopped or expired timer with an empty output channel. So, to reset the timer correctly, you have to use a helper function:

```
// resetTimer stops, drains and resets the timer. func resetTimer(t *time.Timer, d time.Duration) {  if !t.Stop() { select { case <-t.C: default: } } t.Reset(d) } 
```

[Edit](#edit)

```
func consumer(cancel <-chan token, in <-chan token) {  const timeout = time.Hour timer := time.NewTimer(timeout) for { resetTimer(timer, timeout) select { case <-in: // do stuff case <-timer.C: // log warning case <-cancel: return } } } 
```

[Edit](#edit)

See the [Resetting timers in Go](https://antonz.org/timer-reset/) article for details if you are interested.

### time.AfterFunc

To make matters worse, `time.AfterFunc` also creates a timer, but a very different one. It has a nil `C` channel, so the `Reset` method works differently:

*   If the timer is still active (not stopped, not expired), `Reset` clears the timeout, effectively restarting the timer.
*   If the timer is already stopped or expired, `Reset` schedules a new function execution.

```
func main() {  var start time.Time   work := func() { fmt.Printf("work done after %dms\n", time.Since(start).Milliseconds()) }   // run work after 10 milliseconds timeout := 10 * time.Millisecond start = time.Now()  // ignore the data race for simplicity t := time.AfterFunc(timeout, work)   // wait for 5 to 15 milliseconds delay := time.Duration(5+rand.Intn(11)) * time.Millisecond time.Sleep(delay) fmt.Printf("%dms has passed...\n", delay.Milliseconds())   // Reset behavior depends on whether the timer has expired t.Reset(timeout) start = time.Now()   time.Sleep(50*time.Millisecond) } 
```

[Edit](#edit)

If the timer has not expired, `Reset` clears the timeout:

```
8ms has passed... work done after 10ms 
```

If the timer has expired, `Reset` schedules a new function call:

```
work done after 10ms 13ms has passed... work done after 10ms 
```

To reiterate:

*   Go ≤ 1.22: For a `Timer` created with `NewTimer`, `Reset` should only be called on stopped or expired timers with drained channels.
*   Go ≥ 1.23: For a `Timer` created with `NewTimer`, it's safe to call `Reset` on timers in any state (active, stopped or expired). No channel drain is required.
*   For a `Timer` created with `AfterFunc`, `Reset` either reschedules the function (if the timer is still active) or schedules the function to run again (if the timer has stopped or expired).

Timers are not the most obvious things in Go, are they?

Ticker
------

Sometimes you want to perform an action at regular intervals. There's a tool for this in Go called a _ticker_. A ticker is like a timer, but it keeps firing until you stop it:

```
func work(at time.Time) {  fmt.Printf("%s: work done\n", at.Format("15:04:05.000")) }   func main() {  ticker := time.NewTicker(50 * time.Millisecond) defer ticker.Stop()   go func() { for { at := <-ticker.C work(at) } }()   // enough for 5 ticks time.Sleep(260 * time.Millisecond) } 
```

[Edit](#edit)

`NewTicker(d)` creates a ticker that sends the current time to the channel `C` at interval `d`. You must stop the ticker eventually with `Stop()` to free up resources.

In our case, the interval is 50 ms, which allows for 5 ticks.

If the channel reader can't keep up with the ticker, the ticker will skip ticks:

```
func work(at time.Time) {  fmt.Printf("%s: work done\n", at.Format("15:04:05.000")) time.Sleep(100 * time.Millisecond) }   func main() {  ticker := time.NewTicker(50 * time.Millisecond) defer ticker.Stop()   go func() { for { at := <-ticker.C work(at) } }()   // enough for 3 ticks because of the slow work() time.Sleep(260 * time.Millisecond) } 
```

[Edit](#edit)

In this case, the receiver starts to fall behind after the second tick.

As you can see, the ticks don't pile up; they adapt to the slow receiver.

**✎ Exercises: Scheduler +1 more**

Practice is essential for turning knowledge into skills, making theory alone insufficient. The full version of the book contains a lot of interactive exercises with automated tests — that's why I recommend [getting it](https://antonz.gumroad.com/l/go-concurrency).

If you're okay with just reading for now, let's continue.

Keep it up
----------

Now you know that handling time in concurrent programs is not about (ab)using `time.Sleep`. Here are some useful tools you've learned:

*   Timeouts limit operation time.
*   Timers help with delayed operations.
*   Tickers are for periodic actions.
*   Default case in select allows nowait processing.

In the next chapter, we'll work with [context](https://antonz.org/go-concurrency/context/).

[Pre-order for $10](https://antonz.gumroad.com/l/go-concurrency)   or [read online](https://antonz.org/go-concurrency/)

[★ Subscribe](https://antonz.org/subscribe/) to keep up with new posts.