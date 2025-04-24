# Mocking time and testing event loops in Go [Dmitry Frank]
Initially I wanted to write articles on those two topics separately (mocking time and testing event loops), but during the process I realized that the things I want to talk about are too interrelated: when I need to mock time, it's usually to test some event loop with it, and when I test event loops, typically mocked time is also involved in that.

So in the end, it felt better to just combine all that in a single article.

* * *

Unfortunately, as of today, time functions in Go stdlib aren't mockable: whenever we use e.g. `time.Now()`, or `time.NewTicker`, etc, they are going to use real time, and this makes the time-sensitive code quite hard to test properly.

Luckily, there exist a couple of attempts to address the problem:

Also there is an old [Go issue in Github about mockable time support](https://github.com/golang/go/issues/8869 "https://github.com/golang/go/issues/8869"), which mentions the two libraries above, and I do have some kind of hope that mocking time sooner or later will be included to the stdlib in some form, but we gotta be patient. So as of today, if we want to have mocked time, we have to use custom solutions.

In this article, I'm going to be focusing on the second library, `benbjohnson/clock`, ([a fork of](https://github.com/dimonomid/clock "https://github.com/dimonomid/clock")) which I've been using for a few years already, and overall it does the job when used properly. So let's take a closer look at it.

Brief overview of benbjohnson/clock
-----------------------------------

At its core, this library just has an interface named `Clock`, which tries to mimic functionality of the `time` package:

```
// Clock represents an interface to the functions in the standard library time
// package. Two implementations are available in the clock package. The first
// is a real-time clock which simply wraps the time package's functions. The
// second is a mock clock which will only make forward progress when
// programmatically adjusted.
type Clock interface {
        After(d time.Duration) <\-chan [time.Time](http://golang.org/search?q=time.Time)
        AfterFunc(d time.Duration, f func()) \*Timer
        Now() [time.Time](http://golang.org/search?q=time.Time)
        Since(t [time.Time](http://golang.org/search?q=time.Time)) time.Duration
        Sleep(d time.Duration)
        Tick(d time.Duration) <\-chan [time.Time](http://golang.org/search?q=time.Time)
        Ticker(d time.Duration) \*Ticker
        Timer(d time.Duration) \*Timer
}
```

So in our code, instead of using e.g. `time.Now()`, we need to have an instance of this `Clock` interface, and use it. So instead of this:

```
fmt.Println(time.Now())
```

We need to do something like:

```
// Somewhere in initialization code, create an instance of the Clock interface:
c := clock.New()
 
// Somewhere later, use that instance:
fmt.Println(c.Now())
```

Most of the time, I find myself having an instance of `Clock` as part of the params of something, like this:

```
type Foo struct {
        clock clock.Clock
}
 
type FooParams struct {
        Clock clock.Clock
}
 
func NewFoo(params \*FooParams) \*Foo {
        foo := &Foo{
                clock: params.Clock,
        }
 
        // NOTE: we intentionally don't default params.Clock to clock.New, see the
        // caveat section below.
 
        return foo
}
```

And then we should obviously use that `clock` instance in the methods of `Foo`, instead of real `time` functions:

```
func (foo \*Foo) PrintTime() {
        fmt.Println(foo.clock.Now())
}
```

So in production code, we'll do this:

```
foo := NewFoo(&FooParams{
        Clock: clock.New(), // Use real time
})
 
// Use foo in some way
```

And in tests for `Foo`, we initialize it as follows:

```
const testTimeLayout \= "Jan 2, 2006 at 15:04:05.000"
 
func TestFoo(t \*testing.T) {
        // Create mocked clock
        mockedClock := clock.NewMock()
        now, \_ := time.Parse(testTimeLayout, "May 1, 2020 at 00:00:00.000")
        mockedClock.Set(now)
 
        foo := NewFoo(&FooParams{
                Clock: mockedClock,
        })
 
        // Test foo somehow, e.g. we can advance mocked time like this:
        mockedClock.Add(1 \* time.Second)
        foo.PrintTime()
 
        mockedClock.Add(1 \* time.Second)
        foo.PrintTime()
}
```

If you run the test code above, it will print:

```
\=== RUN   TestFoo
2020-05-01 00:00:01 +0000 UTC
2020-05-01 00:00:02 +0000 UTC
--- PASS: TestFoo (0.00s)
```

That is all very straightforward, but also not so interesting. Things get more tricky when we start using goroutines with timers or tickers, so let's get to it.

Mocked timers and tickers
-------------------------

As mentioned above, `clock` tries to mimic the stdlib `time` package, so of course it has timers and tickers. To use them properly and to avoid surprises (such as flakey tests), it's useful to understand how mocked timers and tickers work, to a certain extent.

To create a ticker, we can do that:

```
// Assuming c is an instance of clock.
 
ticker := c.Ticker(1 \* time.Second)
```

_(By the way yeah, the method is weirdly named `Ticker` and not `NewTicker` as in stdlib; the same is true for `Timer` vs `NewTimer`. I don't know if that was done intentionally, but in any case, doesn't hurt much, just something to keep in mind)_

So if that `c` instance represents actual (not mocked) time, then, as you'd expect, the `Ticker` method just delegates to `Time.NewTicker` and doesn't do much besides that. If however `c` is a mocked time, then calling `Ticker` registers a new mocked ticker internally, so that whenever we advance mocked time later by calling `Add`, that ticker created previously will receive ticks when appropriate.

It's also worth noting that when we advance mocked time by calling `Add`, all tickers and timers which need to fire, get fired _synchronously_ right in the goroutine calling `Add`. For example, having that:

```
	c := clock.NewMock()
	now, \_ := time.Parse(testTimeLayout, "May 1, 2020 at 00:00:00.000")
	c.Set(now)
 
	// Create some timers using AfterFunc with a custom callback
	c.AfterFunc(200\*time.Millisecond, func() {
		fmt.Println("AfterFunc1 fired, time:", c.Now())
	})
	c.AfterFunc(50\*time.Millisecond, func() {
		fmt.Println("AfterFunc2 fired, time:", c.Now())
	})
 
	// Create some regular timers
	var mytimers \[\]\*clock.Timer
	mytimers \= append(mytimers, c.Timer(1\*time.Second))
	mytimers \= append(mytimers, c.Timer(2\*time.Second))
	mytimers \= append(mytimers, c.Timer(5\*time.Second))
	mytimers \= append(mytimers, c.Timer(100\*time.Millisecond))
 
	// Create some tickers
	var mytickers \[\]\*clock.Ticker
	mytickers \= append(mytickers, c.Ticker(500\*time.Millisecond))
```

We can then just call:

```
	c.Add(3 \* time.Second)
```

And by the time that `Add` call returns, both our `AfterFunc` callbacks were called already in this same goroutine, all those regular timers have received a message to their `C` channels (except the one at 5 seconds, because we only advanced the time by 3s), and the ticker was _attempted_ to send a message to its `C` channel 6 times, however only the first attempt succeeded, because nobody was reading from that channel. So, after that `Add` call, the following is already printed:

```
AfterFunc2 fired, time: 2020-05-01 00:00:00.05 +0000 UTC
AfterFunc1 fired, time: 2020-05-01 00:00:00.2 +0000 UTC
```

And we can also go over the `mytimers` slice and get the messages from their `C` channels:

```
	for i, tmr := range mytimers {
		var val string
		select {
		case t := <\-tmr.C:
			val \= fmt.Sprintf("%s", t)
		default:
			val \= "not fired yet"
		}
 
		fmt.Printf("Timer #%d: %s\\n", i, val)
	}
```

That prints:

```
Timer #0: 2020-05-01 00:00:01 +0000 UTC
Timer #1: 2020-05-01 00:00:02 +0000 UTC
Timer #2: not fired yet
Timer #3: 2020-05-01 00:00:00.1 +0000 UTC
```

### Letting other goroutines run

And one more important (and annoying) detail is that as of today, there is no good universal way to tell to the Go runtime: “run all runnable goroutines until they block”. But, with mocked time, we actually do need that: for example, if we have an event loop which reads from some ticker's `C` channel, and we advance mocked time so that this `C` channel might have received a message already (because the ticker might have ticked), we want to make sure that this goroutine handles the message before we proceed further.

But since there is no good universal way to do that, the `clock` library uses a poor way: every time it advances mocked time, it also [just sleeps for 1ms](https://github.com/benbjohnson/clock/blob/dcb3cf9a2a5365f0f1505ab0029497da5118443c/clock.go#L336-L337 "https://github.com/benbjohnson/clock/blob/dcb3cf9a2a5365f0f1505ab0029497da5118443c/clock.go#L336-L337") (I mean, it sleeps “real” 1ms, not mocked 1ms). It does mean that the tests using that are flakey by definition (because sleeping for w/e duration doesn't provide any guarantees that any goroutines will actually run), and also if the tests advance mocked time a lot, it slows down the tests dramatically (because sleeping for “1ms” obviously doesn't sleep exactly 1ms: usually it end up being a lot longer).

So, while I agree that as the most generic logic it's okay to default to just sleeping some arbitrary duration like 1ms, but I believe that applications should have a way to override that behavior with some custom logic, because we might have some application-specific reliable way to ensure that goroutines which we need to run, did run (like adding some mockable callbacks which get called whenever certain events are handled by an event loop).

So, I had to fork `clock` library as [https://github.com/dimonomid/clock](https://github.com/dimonomid/clock "https://github.com/dimonomid/clock") and implement that; if you're interested, here's the commit: [Make the implementation of gosched configurable](https://github.com/dimonomid/clock/commit/0c9323d5ad21d4063d529a550236e852a1bf62cf "https://github.com/dimonomid/clock/commit/0c9323d5ad21d4063d529a550236e852a1bf62cf").

The API was updated in a backwards-compatible way: we can still just call `clock.NewMock()`, and we'll get the same mocked clock which would just sleep 1ms when advancing mocked time. But, if we want to override that behavior, we can do that:

```
	c := clock.NewMockOpt(clock.MockOpt{
		Gosched: func() {
			// Any custom logic to run after advancing mocked time
		},
	})
```

My pull request with those changes was opened for almost 2 years already, and unfortuately I'm not sure if it is ever going to be merged to the upstream, so in the examples below I'll use my fork.

We'll discuss alternative implementations of this `Gosched` callback later, but for now, keeping all this in mind, let's move on.

### Example component which uses ticker in an internal goroutine

As an example, let's consider a simple component `Foo`, which takes an interval (like 1 second) and an output channel of ints, and sends an ever-incremented number to that channel on a given interval, just like 0, 1, 2, etc.

An implementation might look as follows:

[foo.go](https://dmitryfrank.com/_export/code/articles/mocking_time_in_go?codeblock=15 "Download Snippet")

```
package foo
 
import (
	"time"
 
	"github.com/dimonomid/clock"
)
 
type Foo struct {
	nextNum int
	out     chan<\- int
 
	clock clock.Clock
}
 
type FooParams struct {
	Clock clock.Clock
 
	// Out is the channel to deliver numbers to
	Out chan<\- int
	// Interval is how often to deliver numbers to Out
	Interval time.Duration
}
 
// NewFoo creates and returns an instance of Foo, and also starts an internal
// goroutine which will send numbers to the provided channel params.Out.
func NewFoo(params \*FooParams) \*Foo {
	if params.Clock \== nil {
		panic("Clock is required")
	}
 
	foo := &Foo{
		clock: params.Clock,
		out:   params.Out,
	}
 
	go foo.run(params.Interval)
 
	return foo
}
 
func (foo \*Foo) run(interval time.Duration) {
	// NOTE: there is an issue with creating ticker right in this goroutine,
	// explained below.
	ticker := foo.clock.Ticker(interval)
 
	for {
		<\-ticker.C
		foo.out <\- foo.nextNum
		foo.nextNum += 1
	}
}
```

And now, a simple test for that:

[foo\_test.go](https://dmitryfrank.com/_export/code/articles/mocking_time_in_go?codeblock=16 "Download Snippet")

```
package foo
 
import (
	"testing"
	"time"
 
	"github.com/dimonomid/clock"
)
 
const testTimeLayout \= "Jan 2, 2006 at 15:04:05.000"
 
func TestFoo(t \*testing.T) {
	// Create a mocked time, initialized at May 1, 2020 midnight.
	mockedClock := clock.NewMock()
	now, \_ := time.Parse(testTimeLayout, "May 1, 2020 at 00:00:00.000")
	mockedClock.Set(now)
 
	// Create output channel, we'll check later that it receives the numbers we
	// expect.
	out := make(chan int, 1)
 
	// Create Foo, it will also start the internal goroutine to send numbers
	// to the channel.
	NewFoo(&FooParams{
		Clock: mockedClock,
 
		Out:      out,
		Interval: 1 \* time.Second,
	})
 
	// Assert that we receive the numbers we expect
	mockedClock.Add(1 \* time.Second)
	assertRecvInt(t, out, 0)
 
	mockedClock.Add(1 \* time.Second)
	assertRecvInt(t, out, 1)
 
	mockedClock.Add(1 \* time.Second)
	assertRecvInt(t, out, 2)
}
 
func assertRecvInt(t \*testing.T, ch <\-chan int, want int) {
	select {
	case got := <\-ch:
		if got != want {
			t.Errorf("wanted %d, got %d", want, got)
		}
	default:
		t.Errorf("wanted %d, got nothing", want)
	}
}
```

However if we run it, we'll see that the tests are often failing with non-deterministic result. Sometimes it could be this:

```
\--- FAIL: TestFoo (0.01s)
    foo\_test.go:50: wanted 0, got nothing
    foo\_test.go:47: wanted 1, got 0
    foo\_test.go:47: wanted 2, got 1
```

And sometimes it's that:

```
\--- FAIL: TestFoo (0.01s)
    foo\_test.go:50: wanted 0, got nothing
    foo\_test.go:47: wanted 1, got nothing
    foo\_test.go:47: wanted 2, got 0
```

Or it could be something else. So clearly, there is a race in how mocked time is used. And indeed, the race is in between of creating a ticker and advancing mocked time. As you remember, calling `Ticker` on a mocked clock instance causes it to register that ticker internally, so that when the mocked time is advanced later, it can deliver ticks to that mocked ticker. But our code above creates the ticker right in the `run` which runs in a separate goroutine:

```
func (foo \*Foo) run(interval time.Duration) {
	ticker := foo.clock.Ticker(interval)
 
	for { /\* ... \*/ }
}
```

While we advance mocked time in the main test goroutine. Therefore the outcome depends on when Go runtime schedules the `run` goroutine, relatively to the `mockedClock.Add` calls. If `run` runs right after we create it, then tests pass, because the ticker is created before we advance mocked time. If however at least a single call to `mockedClock.Add` happens before the ticker is created, the tests will fail.

So to fix that, we need to make sure that the ticker is created synchronously in `NewFoo`: that is, create the ticker right in `NewFoo`, and pass it as a param to `run`:

```
func NewFoo(params \*FooParams) \*Foo {
	foo := &Foo{
		clock: params.Clock,
		out:   params.Out,
	}
 
	ticker := foo.clock.Ticker(params.Interval)
	go foo.run(ticker)
 
	return foo
}
 
func (foo \*Foo) run(ticker \*clock.Ticker) {
	for {
		/\* ... the same loop body ... \*/
	}
}
```

After that change, tests aren't flakey, and they pass. That change doesn't have any practical effect on production code, but as we use `clock`, we have to keep in mind the internal details of mocked time like that.

### Handling other events in the event loop

Now let's imagine that we need to improve our `Foo` component by adding a method `SetInterval`, which would update the interval at which numbers are sent to `Out`, in run time. This method would just send a message to the event loop, and then event loop will receive it and recreate the ticker with the new interval.

We'll add a new field to the `Foo` struct:

```
	intervalReqCh chan time.Duration
```

Initialize it to the unbuffered channel in `NewFoo`:

```
	intervalReqCh: make(chan time.Duration),
```

Add a method `SetInterval` which sends to that channel:

```
func (foo \*Foo) SetInterval(interval time.Duration) {
	foo.intervalReqCh <\- interval
}
```

And in the event loop in `run`, handle it as follows:

```
func (foo \*Foo) run(ticker \*clock.Ticker) {
	for {
		select {
		case <\-ticker.C:
			foo.out <\- foo.nextNum
			foo.nextNum += 1
 
		case interval := <\-foo.intervalReqCh:
			ticker.Stop()
			ticker \= foo.clock.Ticker(interval)
		}
	}
}
```

Then we add the following snippet to the end of `TestFoo`, to test this new functionality:

```
	// Make the interval longer by 50 milliseconds.
	foo.SetInterval(1050 \* time.Millisecond)
 
	// Make sure that after advancing the time by the updated interval, we get
	// the next number.
	mockedClock.Add(1050 \* time.Millisecond)
	assertRecvInt(t, out, 3)
```

And we run tests, only to realize that something is missing again:

```
\--- FAIL: TestFoo (0.01s)
    foo\_test.go:62: wanted 3, got nothing
```

The tests are flakey: sometimes they pass, sometimes not.

So after some debugging, we realize that even though the channel `intervalReqCh` is unbuffered, sending to that channel doesn't mean that the event loop fully handled the message (that is, recreated the ticker with the new duration). What happens is: we call `SetInterval`, it sends the message to `intervalReqCh`, and the message is already _received_ by the `run` goroutine, but not handled yet; then we advance mocked time, at this moment it also sleeps 1ms to let Go runtime schedule goroutines (that annoying detail I mentioned above), and then `run` goroutine is finally scheduled, so it handles the message from `intervalReqCh` and recreates the ticker, but we don't advance time anymore, so it never ticks.

We need to add a way to make sure that the message was actually handled by the event loop already. For example, implement some “mockable” callback which, if not nil, gets called whenever `intervalReqCh` is fully handled. Like this: add one more unexported field to the `Foo` struct:

```
	// intervalApplied is only used for tests: test code can set it to non-nil
	// function, and then it'll be called from the event loop whenever the
	// message from intervalReqCh is handled.
	intervalApplied func()
```

And in the event loop, the case receiving from `intervalReqCh` would look like this:

```
		case interval := <\-foo.intervalReqCh:
			ticker.Stop()
			ticker \= foo.clock.Ticker(interval)
			if foo.intervalApplied != nil {
				foo.intervalApplied()
			}
```

Then in test code, right after creating `foo`, we populate that `intervalApplied` callback with a function which sends a message to another channel:

```
	intervalAppliedCh := make(chan struct{})
	foo.intervalApplied \= func() {
		intervalAppliedCh <\- struct{}{}
	}
```

And we receive from that channel right after calling `SetInterval`:

```
	foo.SetInterval(curInterval)
	<-intervalAppliedCh
```

Now, tests pass. However, it also makes us realize that we would have to add those mockable callbacks for every message we expect event loop to handle, and that smells quite a bit because it requires test code to know too much about the implementation details. In a small component like that, it might be acceptable, but as we develop components with larger event loops, knowing the exact sequence of internal events handled by the event loop might become too much.

I do have a better proposal for you, but for now, bear with me. Apparently we've got another problem to solve first.

An attentive reader might notice that our tests for updating the interval do not actually test that the new interval was applied: we set a new interval to 1050ms, we advance time by that duration and check that we get the next number from `Foo`, but actually, even if the ticker is unchanged, the tests would still pass, because the new interval we set is larger than the old one, therefore advancing mocked time by 1050ms means that a 1000ms-ticker would fire as well. It's easy to verify: just comment those two lines:

```
			//ticker.Stop()
			//ticker = foo.clock.Ticker(interval)
			\_ \= interval // To avoid compile errors about unused variable
```

Run tests, and they still pass.

So to actually cover this case, we'd need some way to do this:

1.  Advance mocked time by 1049ms (or by 1049.999ms, or something along those lines);
    
2.  Verify that we did _not_ receive an item yet;
    
3.  Advance mocked time by the remaining millisecond (or w/e duration left);
    
4.  Verify that we did receive an item.
    

And then we realize that we can't really do that easily, because there is no reliable way to do the (2), that is, to verify that something did not happen yet. We can do our best by adding this function which ensures that there are no messages in the channel:

```
func assertNoRecvInt(t \*testing.T, ch <\-chan int) {
	select {
	case got := <\-ch:
		t.Errorf("wanted nothing, got %d", got)
	default:
		// All good
	}
}
```

And then in test code,

```
	mockedClock.Add(1049 \* time.Millisecond)
	assertNoRecvInt(t, out)
 
	mockedClock.Add(1 \* time.Millisecond)
	assertRecvInt(t, out, 3)
```

But then, still having commented `ticker` logic (i.e. broken code), tests sometimes pass anyway. That's because we're at Go scheduler's mercy here: it's possible that we don't yet receive an item **not because our logic is correct, but just because it happened that Go scheduler didn't run the event loop goroutine yet**.

In fact, for this simple component, we can work it around by e.g. setting the new interval to be _smaller_: then, by advancing the time by a smaller duration, we can verify that it did not yet happen, and this check would work reliably. But this kind of workaround isn't always possible with real world code: sometimes it's actually desirable to reliably verify that some event did not happen yet, so let's try to figure how to do that.

### Testing that certain events did not yet happen

Having a loop like this:

```
	for {
		select {
		case msg := <\-foo:
			handleFoo(msg)
 
		case msg := <\-bar:
			handleBar(msg)
	}
```

What we want is to have a way to make sure that all pending messages (if any) in those channels `foo` and `bar` (which might be buffered) are already handled by that loop.

If we can make all the channels unbuffered for tests, then it's not a problem, because the messages will be handled as we send them. However, unbuffered channels aren't always appropriate: e.g. ticker and timer channels `C` are 1-buffered, or maybe some action results in multiple messages being sent to a channel, so this channel should have a buffer to fit them all before we check them.

So again, we want to have a way to make sure that all pending messages, however many of them we have buffered, are already handled.

Imagine for a moment that we have a function like `cycleEventLoop`, which does exactly that: it blocks until event loop has any more messages to handle. When there are no more messages, `cycleEventLoop` returns. It also means that it's harmless to call `cycleEventLoop` even if the event loop has no messages to handle at all: in this case, `cycleEventLoop` just returns.

So having that magic `cycleEventLoop` function, going back to our previous problem of testing that ticker does not tick after advancing mocked time by 1049ms, we would be able to just set `Gosched` implementation to call this `cycleEventLoop` function (instead of sleeping 1ms), and that would be enough. Indeed: if ticker ticks, then its `C` channel already has a message, so by the time `cycleEventLoop` returns, this message would be already handled, and we'd have an item received from the `Out` channel. Therefore, if after calling `cycleEventLoop` there are still no messages in `Out` channel, we can be sure that the ticker did not tick.

Well then…

[![](https://dmitryfrank.com/_media/articles/bill_lumbergh_cycle_event_loop.jpg?w=600&tok=7f33dc)
](https://dmitryfrank.com/_detail/articles/bill_lumbergh_cycle_event_loop.jpg?id=articles%3Amocking_time_in_go "articles:bill_lumbergh_cycle_event_loop.jpg")

As I mentioned earlier, we don't have any explicit support from Go runtime for that yet, so if we really want to do that, we'd have to come up with something not too elegant.

After reflecting on it for a little bit, we realize that we can achieve that by doing something like this. First, create a channel of channels of empty structs:

```
	eventLoopCyclerCh := make(chan chan struct{})
```

And then, with a little bit of copy paste:

```
	for {
		select {
		case msg := <\-foo:
			handleFoo(msg)
		case msg := <\-bar:
			handleBar(msg)
 
		default:
			select {
			case ch := <\-eventLoopCyclerCh:
				ch <\- struct{}{}
 
			// NOTE: those cases are identical to the cases above.
			case msg := <\-foo:
				handleFoo(msg)
			case msg := <\-bar:
				handleBar(msg)
			}
		}
	}
```

Our desired `cycleEventLoop` function would look as simple as:

```
func cycleEventLoop() {
	ackCh := make(chan struct{})
 
	// We need to do that at least \*two\* times, I'll explain that below.
	for i := 0; i < 2; i++ {
		eventLoopCyclerCh <\- ackCh
		<\-ackCh
	}
}
```

Now, let's take a moment to understand how exactly this “double-layered select” setup works.

So, the first layer contains cases for all the “useful” messages which the event loop needs to handle. But, this first layer also has a default case, and that default case (which is the second layer) contains almost identical select, but with two distinctions: (1) it has a case for that `eventLoopCyclerCh` channel, and (2) it doesn't have a default case.

The effect of that is this:

*   As long as event loop has stuff to do (pending useful messages to handle), it will keep running in the first layer.
    
*   When there's no more pending useful messages, it will fallback to the default case, and will stay there, until either some new useful message comes in, or `eventLoopCyclerCh` is triggered. And when it triggers, the handler code confirms it by sending an empty struct back (in the channel received from `eventLoopCyclerCh`).
    

The tests can use it as follows: right before checking effects of some work done by the event loop, we need to “trigger” the `eventLoopCyclerCh` twice. By “triggering” I mean sending a channel there and wait for the message back. And note the _twice_ part: if we only trigger `eventLoopCyclerCh` once, it's not a guarantee that event loop has handled all the pending useful messages already: it might be the case that Go picks the `eventLoopCyclerCh` message first, and by the time we receive the response back, event loop did not do any useful work yet. But then, event loop has to go to the first layer, and it has to keep running there until there are no more useful messages to handle. After that, it goes again to the second layer, and handles the `eventLoopCyclerCh` case. So, by the time we receive the response on the _second_ trigger of `eventLoopCyclerCh`, we have a guarantee that all the pending messages, if they existed, were already handled.

In production code, `eventLoopCyclerCh` would just stay nil, so receiving from it will never happen, and the code will just handle events from either of the “layers” in exactly the same way (because the code handling them must be the same in both “layers”).

So as you remember, the goal was to reliably check whether something did _not_ happen. This double-layered select provides that. Awesome! But in fact, it also helps us in a couple other ways:

*   Since this is a universal method to “cycle” event loop, we don't have to maintain any ad-hoc mockable functions which get called after handling certain events. E.g. the `intervalApplied` callback with the corresponding channel `intervalAppliedCh`, which we added previously, is no longer needed: instead, we can just use `eventLoopCyclerCh` again. The same is true for any other event handled by this event loop.
    
*   We don't have to sleep 1m anymore after advancing mocked time. As mentioned above, first of all it makes the tests reliable (while 1ms thing is flakey), and also if the tests advance mocked time a lot (and my tests tend to do this a lot indeed), it can speed up the tests dramatically.
    

For those who believe that this two-layered event loop design is ugly: I don't disagree with you, but it's the best reliable way that I could come up with. Other alternatives include:

*   Using `reflect.Select`. This way, we can make the selection dynamic, add default case dynamically, and get rid of the code duplication. But we'll lose type safety for the messages we receive, and will make the code more obscure. My opinion is that it's worse than the copypasted two layers.
    
*   Just don't use anything like that: don't check for events which don't happen (or tolerate the non-reliability, however also see the section on `AfterFunc` below, it can help us here), keep having ad-hoc mockables for certain events so the tests rely on implementation details more, and keep relying on 1ms sleep, and tolerate test flakiness.
    

Let me know if I'm missing some better way of doing this.

There is no “best” solution, it's a tradeoff as everywhere else. When the component being tested is simple enough, I personally can consider not using the double layered select. However, more often than not, I do find it very useful, and I'm fine with this small amount of copypaste which I have to pay for this universal and reliable way to “cycle” my event loops. Obviously we should copypaste as little as we can (that is, if the message handler code consists of more than a single line, factor it out into a function, and then only copypaste the calls to that function).

There is one thing left untested with that design though: that both layers have to contain exactly the same cases for “useful” messages, and the same code to handle them. I hope to find time to implement some static analisys tool which would ensure that, it doesn't sound too hard. Will share it here once done.

Other things to consider
------------------------

### AfterFunc is called synchronously when mocked time is advanced

One aspect of `AfterFunc` callback, which might become very useful if you do _not_ use the double-layered select, is that it's called synchronously when mocked time is advanced. Let me clarify. Consider this code:

```
	// Assume we have an instance of clock.Clock called "c"
 
	timeout := c.After(1 \* time.Second)
 
	for {
		select {
		case msg := <\-foo:
			handleFoo(msg)
		case <\-timeout.C:
			handleTimeout()
		}
	}
```

Having this code, without double-layered select, there is again no reliable way to test if timeout did _not_ happen yet. However, we can convert it to the following:

```
	timeoutCh := make(chan struct{})
	foo.clock.AfterFunc(1\*time.Second, func() {
		timeoutCh <\- struct{}{}
 
		// NOTE: we can include any mockable code here, like this:
		if timeoutFired != nil {
			timeoutFired()
		}
	})
 
	for {
		select {
		case msg := <\-foo:
			handleFoo(msg)
		case <\-timeoutCh:
			handleTimeout()
		}
	}
```

This change wouldn't have any practical effect on the production code (with non-mocked time), but for tests, it has an important advantage: we can now execute any arbitrary code in the `AfterFunc` callback, and that callback is guaranteed to be called before the `Add` method returns, when we advance mocked time. Therefore, we can at least add some ad-hoc mockable callback to that method (like the `timeoutFired` in the example above), and have a chance to check reliably whether the timer has fired already or not.

### Caveat with defaulting to "real" clock

When creating a new instance of something (like in `NewFoo` function), it's tempting to default to the real clock if nil was provided, like this:

```
	if foo.clock \== nil {
		foo.clock \= clock.New()
	}
```

The intention is that production code will just omit the `Clock` parameter, while tests will set it to a mocked one. However, I found it to be an anti-pattern of sorts. Consider the situation where the component A creates component(s) B internally, and both A and B use `clock`. The B component might have a params struct like this:

```
type BParams struct {
	Clock clock.Clock
 
	// ... Other params
}
```

And the component A uses it when creating instances of B. Now, if we get used to not specifying `clock` explicitly in production code, it's likely that in the A code, we will omit it as well. But the problem is that this code runs in both production and test code, and actually A _has_ to explicitly forward the `clock` instance it has to B:

```
	BParams{
		Clock: a.clock,
		// ... Other params
	}
```

Otherwise, in tests, we'll end up with a situation where A uses mocked time (because test code provides it with the mocked time), but then B gets created with the nil clock, which will default to the real non-mocked time, and B will use it.

So to avoid that kind of situation, I found it to be a good practice to just make nil clock illegal, and panic if it's not provided, because it's considered an abuse of API.

```
	if params.Clock \== nil {
		panic("Clock is required")
	}
```

This way, should the code have a bug like A not specifying `Clock` explicitly when creating B, we'd get a panic the first time we run the tests, and it'll be clear on what we need to fix.

### Caveat with mixing clock and time

If you don't have a habit of using `clock` yet, it might be easy to unintentionally use a real `time` function like `time.Since` in some place, and then waste time on debugging failing tests (or worse, flakey tests).

We can't just ban the `time` package completely, because we do need certain things from it, e.g. durations like `time.Second`, etc. Also, on rare occassions, we actually do want to use things like `time.After` directly.

So I just wrote a simple bash script to help me with that:

[ensure\_usage\_of\_clock.sh](https://dmitryfrank.com/_export/code/articles/mocking_time_in_go?codeblock=44 "Download Snippet")

```
#!/bin/bash
 
# This code should almost never use plain time functions like time.Now(),
# time.Since(), etc, because we should use mockable clock functions instead,
# for the time\-related tests to work.
#
# I already wasted some time trying to debug tests which were failing just
# because I accidentally used plain time functions, so I wrote this script to
# to ensure that.
#
# On those rare occassions when we do want plain time functions, we also should
# place the guard comment: YES\_I\_WANT\_PLAIN\_TIME. This script will not complain
# about those.
 
guard\="YES\_I\_WANT\_PLAIN\_TIME"
path\="$1"
 
if \[\[ "$path" \== "" \]\]; then
  echo "Usage: $0 <path>"
  exit 1
fi
 
grep \-r 'time\\.\\(Now\\|After\\|Since\\|Sleep\\|Tick\\|Timer\\)' "${path}" \\
  | grep \-v "${guard}"
if \[\[ "$?" \== "0" \]\]; then
  echo ""
  echo "^^^"
  echo "Error: found occurrences of plain time functions not guarded with ${guard}"
  exit 1
fi
 
echo "OK: no occurrences of plain time functions found."
exit 0
```

And then I just run it as a part of my tests. If for whatever reason I need to use actual `time` package, then I add a comment on this line, like this

```
  <\-time.After(1 \* time.Second) // YES\_I\_WANT\_PLAIN\_TIME
```

And that script wouldn't complain about those.

Conclusion
----------

As was mentioned in the beginning, as of today Go doesn't make it easy for us to mock time. During my journey, I developed a bunch of techniques which can help, but neither of them are great, there's a tradeoff as everywhere else. So apply common sense.

And happy Going!