# Gist of Go: Channels
_This is a chapter from my book on [Go concurrency](https://antonz.org/go-concurrency), which teaches the topic from the ground up through interactive examples._

We've learned how to launch [goroutines](https://antonz.org/go-concurrency/goroutines/) and pass data through channels. But channels have many more interesting features. Let's dive in!

End-of-data signaling
---------------------

Here's a program that splits a string by commas and filters out empty parts:

```
str := "one,two,,four"   in := make(chan string) go func() {                           // (1)  words := strings.Split(str, ",") for _, word := range words { in <- word } }()   for {                                 // (2)  word := <-in if word != "" { fmt.Printf("%s ", word) } } // one two four 
```

[Edit](#edit)

Goroutine ➊ splits the string into words and sends them to the `in` channel. Loop ➋ reads words from the channel and prints non-empty ones.

Unfortunately, the program doesn't work:

```
fatal error: all goroutines are asleep - deadlock! 
```

The problem is with the infinite loop ➋:

```
for {  word := <-in if word != "" { fmt.Printf("%s ", word) } } 
```

How do you know when there are no more words in `in`, and it's time to exit the loop? We used to solve this by checking for an empty string:

```
for {  word := <-in if word == "" { break } } 
```

But now an empty string is a valid value. It should be skipped, not used as a signal to exit the loop.

One way to handle this is:

*   The goroutine sends a special value to `in` after it finishes with the words ➊
*   The loop watches for this special value and stops working ➋

```
const eof = "__EOF__"   str := "one,two,,four"   in := make(chan string) go func() {  words := strings.Split(str, ",") for _, word := range words { in <- word } in <- eof         // (1) }()   for {  word := <-in if word == eof {  // (2) break } if word != "" { fmt.Printf("%s ", word) } } 
```

[Edit](#edit)

But, as you can imagine, this is a weak solution. Fortunately, Go provides a proper way.

Closing a channel
-----------------

We have encountered a common problem with interaction between two actors in a concurrent environment:

*   The writer _sends_ values to the channel.
*   The reader _receives_ values from the channel.
*   How does the writer tell the reader that there are no more values?

Go has a mechanism that solves this problem:

*   The writer can _close_ the channel.
*   The reader can detect that the channel is closed.

The writer closes the channel using the `close()` function:

```
str := "one,two,,four" in := make(chan string)   go func() {  words := strings.Split(str, ",") for _, word := range words { in <- word } close(in) }() 
```

[Edit](#edit)

The reader checks the channel's status with a second value ("comma OK") when reading:

```
for {  word, ok := <-in if !ok { break } if word != "" { fmt.Printf("%s ", word) } } 
```

[Edit](#edit) ✓ Done by [codapi](https://codapi.org/) [✕](#close)

```
one two four
```

Suppose the writer sends the strings "one" and "two" and then closes the channel. Here's what the reader gets:

```
// in <- "one" word, ok := <-in // word = "one", ok = true   // in <- "two" word, ok = <-in // word = "two", ok = true   // close(in) word, ok = <-in // word = "", ok = false   word, ok = <-in // word = "", ok = false   word, ok = <-in // word = "", ok = false 
```

While the channel is open, the reader receives the next value and a `true` status. If the channel is closed, the reader gets a zero value ("" for strings) and a `false` status.

As shown, you can read from a closed channel as much as you want — it always returns a zero value and a `false` status. This is intentional, and we'll explore why in a few steps.

A channel can only be closed once. Closing it again will cause a panic:

```
in := make(chan string) close(in) close(in) 
```

[Edit](#edit)

You also can't write to a closed channel:

```
in := make(chan string) go func() {  in <- "hi" close(in) }() fmt.Println(<-in) // hi   in <- "bye" // panic: send on closed channel 
```

[Edit](#edit)

Here are two important rules:

1.  _Only the writer can close the channel, not the reader_. If the reader closes it, the writer will encounter a panic on the next write.
2.  _A writer can only close the channel if they are the sole owner_. If there are multiple writers and one closes the channel, the others will face a panic on their next write or attempt to close the channel.

**Should I always close a channel?**

If you've ever worked with external resources (such as files or database connections), you know they should always be closed to prevent leaks. But a channel isn't an external resource. When a channel is no longer used, Go's garbage collector will free its resources, whether it's closed or not.

The only reason to close a channel is to signal to its readers that all data has been sent. If this isn't important to the readers, then you don't need to close it.

Channel iteration
-----------------

In the previous step, we made the reader constantly check if the channel was open:

```
for {  word, ok := <-in if !ok { break } if word != "" { fmt.Printf("%s ", word) } } 
```

[Edit](#edit)

That's pretty tedious. To avoid doing this manually, Go supports the `for-range` statement for reading from a channel:

```
for word := range in {  if word != "" { fmt.Printf("%s ", word) } } 
```

[Edit](#edit)

`range` automatically reads the next value from the channel and checks if it's closed. If the channel is closed, it exits the loop. Convenient, right?

Note that range over a channel returns a single value, not a pair, unlike range over a slice. Compare these cases:

```
// slice words := []string{"uno", "dos", "tres"} for idx, val := range words {  fmt.Println(idx, val) } 
```

[Edit](#edit)

```
// channel in := make(chan string) go func() {  in <- "uno" in <- "dos" in <- "tres" close(in) }()   for val := range in {  fmt.Println(val) } 
```

[Edit](#edit)

**✎ Exercise: Iterate & close**

Practice is crucial in turning abstract knowledge into skills, making theory alone insufficient. The full version of the book contains a lot of exercises — that's why I recommend [getting it](https://antonz.gumroad.com/l/go-concurrency).

If you are okay with just theory for now, let's continue.

Directional channels
--------------------

Here's a program that filters out empty strings:

```
func main() {  str := "one,two,,four" stream := make(chan string) go submit(str, stream) print(stream) }   func submit(str string, stream chan string) {  words := strings.Split(str, ",") for _, word := range words { stream <- word } close(stream) }   func print(stream chan string) {  for word := range stream { if word != "" { fmt.Printf("%s ", word) } } fmt.Println() } 
```

[Edit](#edit)

Everything works fine now, but if I come back to the code in a month and I'm not too careful, I could easily break it.

For example, if I close the channel from the reader function:

```
func print(stream chan string) {  for word := range stream { if word != "" { fmt.Printf("%s ", word) } } close(stream)    // (!) fmt.Println() } 
```

[Edit](#edit)

Or accidentally read from the channel in the writer function:

```
func submit(str string, stream chan string) {  words := strings.Split(str, ",") for _, word := range words { stream <- word } <-stream         // (!) close(stream) } 
```

[Edit](#edit)

These errors occur at runtime, so I won't notice them until I run the program. It would be better to catch them at compile time.

You can protect yourself from this kind of errors by setting the channel direction. Channels can be:

*   `chan` (bidirectional): for reading and writing (default);
*   `chan<-` (send-only): for writing only;
*   `<-chan` (receive-only): for reading only.

The `submit()` function needs a send-only channel:

```
func submit(str string, stream chan<- string) {  // (1)  words := strings.Split(str, ",") for _, word := range words { stream <- word } // <-stream                                  // (2) close(stream) } 
```

[Edit](#edit)

In the function signature ➊, we've specified that it's send-only, so you can't read from it. Uncomment line ➋, and you'll get a compile error:

```
invalid operation: cannot receive from send-only channel stream 
```

The `print()` function needs a receive-only channel:

```
func print(stream <-chan string) {  // (1)  for word := range stream { if word != "" { fmt.Printf("%s ", word) } } // stream <- "oops"             // (2) // close(stream)                // (3) fmt.Println() } 
```

[Edit](#edit)

In the function signature ➊, we've specified that it's receive-only. You can't write to it. Uncomment line ➋, and you'll get a compile error:

```
invalid operation: cannot send to receive-only channel stream 
```

You also can't close a receive-only channel. Uncomment line ➌, and you'll get a compile error:

```
invalid operation: cannot close receive-only channel stream 
```

You can set the channel direction during initialization, but it's not very helpful:

```
func main() {  str := "one,two,,four" stream := make(chan<- string)  // (!) go submit(str, stream) print(stream) } 
```

Here, stream is declared as send-only, so it doesn't fit the `print()` function anymore. If declared as receive-only, it won't fit `submit()`. So, channels are usually initialized for both reading and writing, and specified as directional in function parameters. Go automatically converts a regular channel to a directional one:

```
stream := make(chan int)   go func(in chan<- int) {  in <- 42 }(stream)   func(out <-chan int) {  fmt.Println(<-out) }(stream) // 42 
```

[Edit](#edit)

Always specify the channel direction in function parameters to avoid runtime errors.

**✎ Exercise: Fixing directions**

Practice is crucial in turning abstract knowledge into skills, making theory alone insufficient. The full version of the book contains a lot of exercises — that's why I recommend [getting it](https://antonz.gumroad.com/l/go-concurrency).

If you are okay with just theory for now, let's continue.

Done channel
------------

Suppose we have a function that speaks a phrase word by word with some pauses:

```
func say(id int, phrase string) {  for _, word := range strings.Fields(phrase) { fmt.Printf("Worker #%d says: %s...\n", id, word) dur := time.Duration(rand.Intn(100)) * time.Millisecond time.Sleep(dur) } } 
```

[Edit](#edit)

Let's create several concurrent talkers, one for each phrase:

```
func main() {  phrases := []string{ "go is awesome", "cats are cute", "rain is wet", "channels are hard", "floor is lava", } for idx, phrase := range phrases { go say(idx+1, phrase) } } 
```

[Edit](#edit)

The program doesn't print anything because the `main()` function finishes before any of the talkers completes.

Previously, we used `sync.WaitGroup` to wait for goroutines to finish. Alternatively, you can use a "done channel" approach:

```
func say(done chan<- struct{}, id int, phrase string) {  for _, word := range strings.Fields(phrase) { fmt.Printf("Worker #%d says: %s...\n", id, word) dur := time.Duration(rand.Intn(100)) * time.Millisecond time.Sleep(dur) } done <- struct{}{}                     // (1) } 
```

[Edit](#edit)

```
func main() {  phrases := []string{ "go is awesome", "cats are cute", "rain is wet", "channels are hard", "floor is lava", }   done := make(chan struct{})            // (2)   for idx, phrase := range phrases { go say(done, idx+1, phrase)        // (3) }   // wait for goroutines to finish for range len(phrases) {               // (4) <-done } } 
```

[Edit](#edit)

Here's how it works:

*   We create a separate channel ➋ and pass it to each goroutine ➌.
*   Inside the goroutine, we write a value to the channel once it completes ➊.
*   In the main function, we wait for each goroutine to write to the channel ➍.

For this to work, the main function must know exactly how many goroutines are running (in our case, one for each original string). Otherwise, it won't know how many values to read from `done`.

Now everything works fine!

If you don't like the done channel approach, you can always use `sync.WaitGroup` instead.

Preventing deadlocks
--------------------

The most common problem in concurrent programs is a deadlock. A deadlock occurs when one goroutine waits for another, and vice versa. Go detects such situations and terminates the program with an error.

```
fatal error: all goroutines are asleep - deadlock! 
```

To fight a deadlock, you should ~become a deadlock~ understand its cause. Let's look at an example:

```
func work(done chan struct{}, out chan int) {  for i := 1; i <= 5; i++ { out <- i } done <- struct{}{} }   func main() {  out := make(chan int) done := make(chan struct{})   go work(done, out)    // (1)   <-done                // (2)   for n := range out {  // (3) fmt.Println(n) } } 
```

[Edit](#edit)

In the main function, we start a goroutine called `work` ➊. It writes a result to the `out` channel and signals completion via the `done` channel. Meanwhile, the main function waits on the done channel ➋, then reads from the result channel ➌.

See the problem? `work()` ➊ wants to write to `out`, so it waits for a reader ➌. But ➋ wants to read from `done`, so it waits for ➊. So, `work()` waits for `main()`, and `main()` waits for `work()`. Deadlock.

The solution is to do ➋ and ➌ independently:

```
func main() {  out := make(chan int) done := make(chan struct{})   go work(done, out)        // (1)   go func() {               // (2) <-done fmt.Println("work done") close(out) }()   for n := range out {      // (3) fmt.Println(n) } fmt.Println("all goroutines done") } 
```

[Edit](#edit)

When you encounter a deadlock, identify its cause. Then a solution will present itself.

**✎ Exercise: Four counters**

Practice is crucial in turning abstract knowledge into skills, making theory alone insufficient. The full version of the book contains a lot of exercises — that's why I recommend [getting it](https://antonz.gumroad.com/l/go-concurrency).

If you are okay with just theory for now, let's continue.

Buffered channels
-----------------

There is a `send()` goroutine that sends a value through the `stream` channel to the `receive()` goroutine:

```
stream := make(chan bool)   send := func() {  fmt.Println("sender: ready to send...") stream <- true                                // (1) fmt.Println("sender: sent!") }   receive := func() {  fmt.Println("receiver: not ready yet...") time.Sleep(100 * time.Millisecond) fmt.Println("receiver: ready to receive...") <-stream                                      // (2) fmt.Println("receiver: received!") }   var wg sync.WaitGroup wg.Go(send) wg.Go(receive) wg.Wait() 
```

[Edit](#edit)

`send()` wants to send a value to the channel right after it starts, but `receive()` isn't ready yet. So, `send()` has to block at point ➊ and wait 100 milliseconds until `receive()` reaches point ➋ and agrees to take the value from the channel. This is how goroutines synchronize at the send/receive point.

Most of the time, this behavior is fine. But what if we want the sender not to wait for the receiver? Suppose we want it to send a value to the channel and move on. The receiver can pick it up when it is ready. If only we could put a value into a channel like into a queue!

Fortunately, Go provides such a feature:

```
// The second argument is the channel buffer size // i.e. the number of values it can hold. stream := make(chan int, 3) // ⬜ ⬜ ⬜   stream <- 1 // 1️⃣ ⬜ ⬜   stream <- 2 // 1️⃣ 2️⃣ ⬜   stream <- 3 // 1️⃣ 2️⃣ 3️⃣   fmt.Println(<-stream) // 1 // 2️⃣ 3️⃣ ⬜   fmt.Println(<-stream) // 2 // 3️⃣ ⬜ ⬜   stream <- 4 stream <- 5 // 3️⃣ 4️⃣ 5️⃣   stream <- 6 // There is no more room in the channel, // so the goroutine blocks. 
```

These channels are called _buffered_ because they have a fixed-size buffer for storing values. By default, if you don't specify a buffer size, a channel is _unbuffered_ (buffer size equals zero) — these are the channels we've been using so far:

```
// unbuffered channel unbuffered := make(chan int)   // buffered channel buffered := make(chan int, 3) 
```

Buffered channels work with the built-in `len()` and `cap()` functions:

*   `cap()` returns the capacity of the buffer;
*   `len()` returns the number of values in the buffer.

```
stream := make(chan int, 2) fmt.Println(cap(stream), len(stream)) // 2 0   stream <- 7 fmt.Println(cap(stream), len(stream)) // 2 1   stream <- 7 fmt.Println(cap(stream), len(stream)) // 2 2   <-stream fmt.Println(cap(stream), len(stream)) // 2 1 
```

[Edit](#edit)

To decouple `send()` from `receive()` using a buffered channel, just change the `stream` definition and leave the rest unchanged:

```
// Create a channel with a buffer of 1 // instead of unbuffered. stream := make(chan bool, 1)   // unchanged send := func() {  fmt.Println("sender: ready to send...") stream <- true fmt.Println("sender: sent!") }   // unchanged receive := func() {  fmt.Println("receiver: not ready yet...") time.Sleep(100 * time.Millisecond) fmt.Println("receiver: ready to receive...") <-stream fmt.Println("receiver: received!") }   // unchanged var wg sync.WaitGroup wg.Go(send) wg.Go(receive) wg.Wait() 
```

[Edit](#edit)

Now the sender doesn't wait for the receiver.

Buffered channels aren't always necessary. Don't overuse them, and only apply when regular channels don't fit for some reason. We'll look at some examples in the next steps.

async/await
-----------

async/await is a common concept in many programming languages, where functions are either _synchronous_ (run sequentially) or _asynchronous_ (can run concurrently). Asynchronous functions are marked with the keyword `async`, and the keyword `await` is used to wait for their results.

If Go supported this concept, it might look like this:

```
async func answer() int {  time.Sleep(100 * time.Millisecond) return 42 }   n := await answer() 
```

Fortunately, Go doesn't have async/await. Hopefully, you won't miss it. But you can implement it in just five lines of code:

```
// await runs fn in a separate goroutine // and waits for the result. func await(fn func() any) any {  out := make(chan any, 1)    // (1) go func() { out <- fn()             // (2) }() return <-out }   func main() {  slowpoke := func() any { fmt.Print("I'm so... ") time.Sleep(100 * time.Millisecond) fmt.Println("slow") return "okay" }   result := await(slowpoke) fmt.Println(result.(string)) } 
```

[Edit](#edit)

> I don't use generics in this book to keep the code simple. You can easily convert any non-generic function or type in the examples to a generic one by adding appropriate type parameters.

As you can see, `await()` doesn't do anything special:

*   Creates a result channel.
*   Starts a goroutine to execute the passed function.
*   Waits for completion.
*   Returns the result to the client.

Thanks to the buffered channel ➊, the goroutine isn't blocked at point ➋ and can exit immediately, making it independent of the caller. In this particular task, a regular channel would suffice, since `await()` reads the result immediately. But when there's no such guarantee, a buffered channel can be useful.

**About asynchronicity**

You might say that this is a "cheat" version of async/await: there's no separate asynchronous function entity, just waiting for a response with `await`. That's true. I didn't want to complicate things. The goal here is to demonstrate the technique of running a function in an internal goroutine and waiting for the result on a channel.

If you're curious about a more realistic asynchronous approach with goroutines, here's what it might look like:

```
// async converts a regular function to an asynchronous one. // An asynchronous function returns a result channel when called. func async(fn func() any) func() <-chan any {  return func() <-chan any { out := make(chan any, 1) go func() { out <- fn() }() return out } }   // await waits for the result of an asynchronous function // on the given channel. func await(in <-chan any) any {  return <-in } 
```

[Edit](#edit)

```
func main() {  fn := func() any { time.Sleep(100 * time.Millisecond) return "okay" }   slowpoke := async(fn) // create an asynchronous function   start := time.Now() slowpoke()                  // does not block slowpoke()                  // does not block slowpoke()                  // does not block result := await(slowpoke()) // blocks until the result is ready   elapsed := time.Since(start) fmt.Println(result) fmt.Println("took", elapsed) // okay // took 100ms   // total execution time is 100ms, not 400ms } 
```

[Edit](#edit)

**✎ Exercise: Promise.all()**

Practice is crucial in turning abstract knowledge into skills, making theory alone insufficient. The full version of the book contains a lot of exercises — that's why I recommend [getting it](https://antonz.gumroad.com/l/go-concurrency).

If you are okay with just theory for now, let's continue.

Semaphore
---------

Remember how we launched "talker" goroutines — one for each phrase?

```
func main() {  phrases := []string{ // ... } for idx, phrase := range phrases { go say(idx+1, phrase) } } 
```

Goroutines are lightweight. You can easily start 10, 100, or even 1,000 at once. But what if you have a million phrases? Real concurrency is still limited by the number of CPU cores. So, it's pointless to waste memory on hundreds of thousands of goroutines when only eight (or however many CPUs you have) can run concurrently.

Let's say we want only N `say` goroutines to exist at the same time. A buffered channel can help achieve this. Here's the idea:

*   Create a channel with a buffer size of N and fill it with "tokens" (arbitrary values).
*   Before starting, a goroutine takes a token from the channel.
*   Once finished, the goroutine returns the token to the channel.

If there are no tokens left in the channel, the next goroutine will not start and will wait until someone returns a token to the channel. In this way, no more than N goroutines will run simultaneously. This setup is called a _semaphore_.

Here's how it might look with N = 2:

```
func main() {  phrases := []string{ "a b c", "d e", "f", "g h", "i j k", "l m", "n", }   // Semaphore for 2 goroutines. sema := make(chan int, 2) sema <- 1 sema <- 2   for _, phrase := range phrases { // Get a token from the channel (if there are any). tok := <-sema go say(sema, tok, phrase) }   // Wait for all goroutines to finish their work // (all tokens are returned to the channel). <-sema <-sema fmt.Println("done") }   // say prints each word of a phrase. func say(sema chan<- int, tok int, phrase string) {  for _, word := range strings.Fields(phrase) { fmt.Printf("Worker #%d says: %s...\n", tok, word) dur := time.Duration(rand.Intn(100)) * time.Millisecond time.Sleep(dur) } // Return the token to the channel. sema <- tok } 
```

[Edit](#edit)

The `main` function goes through the phrases, takes a token from the channel for each phrase, and starts a `say` goroutine. The `say` goroutine prints the phrase and returns the token to the channel. This way, phrases are processed at the same time, and each is printed only once.

**Inverse semaphore**

In practice, you'll often find an "inverse" approach to implementing semaphores:

*   Create an empty channel with a buffer size of N.
*   Before starting, a goroutine puts a token into the channel.
*   Once finished, the goroutine takes a token from the channel.

```
func main() {  phrases := []string{  "a b c", "d e", "f", "g h", "i j k", "l m", "n",  }    // Semaphore for 2 goroutines.  sema := make(chan struct{}, 2)    for _, phrase := range phrases {  // Put a token into the channel (if there is space).  sema <- struct{}{}  go say(sema, phrase)  }    // Wait for all goroutines to finish their work  // (all tokens taken from the channel).  sema <- struct{}{}  sema <- struct{}{}  fmt.Println("done") }   // say prints each word of a phrase. func say(sema <-chan struct{}, phrase string) {  for _, word := range strings.Fields(phrase) {  fmt.Printf("Worker says: %s...\n", word)  dur := time.Duration(rand.Intn(100)) * time.Millisecond  time.Sleep(dur)  }  // Take the token from the channel.  <-sema } 
```

[Edit](#edit)

If the channel is full of tokens, the next goroutine will not start and will wait until someone takes a token from the channel. In this way, no more than N goroutines will run simultaneously.

Also, the tokens do not have to be numbers (as in the original example — for demonstration purposes). More often they are just empty structs.

**Alternative approach**

You could solve the problem without a semaphore, as we did in the "Four counters" section earlier. Just throw the data into an input channel and start N goroutines to process it:

```
func main() {  phrases := []string{ "a b c", "d e", "f", "g h", "i j k", "l m", "n", }   pending := make(chan string)   go func() { for _, phrase := range phrases { pending <- phrase } close(pending) }()   done := make(chan struct{})   go say(done, pending, 1) go say(done, pending, 2)   <-done <-done }   func say(done chan<- struct{}, pending <-chan string, id int) {  for phrase := range pending { for _, word := range strings.Fields(phrase) { fmt.Printf("Worker #%d says: %s...\n", id, word) dur := time.Duration(rand.Intn(100)) * time.Millisecond time.Sleep(dur) } } done <- struct{}{} } 
```

[Edit](#edit)

In this approach, we rely on the data provider to close the `pending` channel at the right time. If the input data arrives in chunks at an unpredictable rate, using a semaphore may be more convenient.

Another difference is that in the first approach (with a semaphore), we start many short-lived goroutines, while in the second (with an input channel), we use two long-lived ones.

**✎ Exercise: N workers**

Practice is crucial in turning abstract knowledge into skills, making theory alone insufficient. The full version of the book contains a lot of exercises — that's why I recommend [getting it](https://antonz.gumroad.com/l/go-concurrency).

If you are okay with just theory for now, let's continue.

Closing a buffered channel
--------------------------

As we know, reading from an unbuffered channel when it is closed returns a zero value and a `false` status:

```
stream := make(chan int) close(stream)   val, ok := <-stream fmt.Println(val, ok) // 0 false   val, ok = <-stream fmt.Println(val, ok) // 0 false   val, ok = <-stream fmt.Println(val, ok) // 0 false 
```

[Edit](#edit)

A buffered channel behaves the same way when the buffer is empty. However, if there are values in the buffer, it's different:

```
stream := make(chan int, 2) stream <- 1 stream <- 2 close(stream)   val, ok := <-stream fmt.Println(val, ok) // 1 true   val, ok = <-stream fmt.Println(val, ok) // 2 true   val, ok = <-stream fmt.Println(val, ok) // 0 false 
```

[Edit](#edit)

As long as there are values in the buffer, the channel returns those values and a `true` status. Once all values are read, it returns a zero value and a `false` status, just like a regular channel.

This allows the sender to close the channel at any time without worrying about leftover values. The receiver will read them anyway:

```
stream := make(chan int, 3)   go func() {  fmt.Println("Sending...") stream <- 1 stream <- 2 stream <- 3 close(stream) fmt.Println("Sent and closed!") }()   time.Sleep(100 * time.Millisecond) fmt.Println("Receiving...") for val := range stream {  fmt.Printf("%v ", val) } fmt.Println() fmt.Println("Received!") 
```

[Edit](#edit)

nil channel
-----------

Like any type in Go, channels have a zero value, which is `nil`:

```
var stream chan int fmt.Println(stream) 
```

[Edit](#edit)

A nil channel is an ugly beast:

*   Writing to a nil channel blocks the goroutine forever.
*   Reading from a nil channel blocks the goroutine forever.
*   Closing a nil channel causes a panic.

```
var stream chan int   go func() {  stream <- 1 }()   <-stream 
```

[Edit](#edit)

```
var stream chan int close(stream) 
```

[Edit](#edit)

Nil channels can be useful in certain cases. We'll look at one of them in the next chapter. In general, try to avoid nil channels unless you absolutely need them.

Keep it up
----------

We've mostly figured out channels in Go. Now you know how to:

*   close channels;
*   iterate over channels;
*   use directions;
*   use the done channel;
*   work with buffered channels;
*   limit the number of workers;
*   (not) use nil channels.

In the next chapter, we'll discuss [pipelines](https://antonz.org/go-concurrency/pipelines/).

[Pre-order for $10](https://antonz.gumroad.com/l/go-concurrency)   or [read online](https://antonz.org/go-concurrency/)

[★ Subscribe](https://antonz.org/subscribe/) to keep up with new posts.