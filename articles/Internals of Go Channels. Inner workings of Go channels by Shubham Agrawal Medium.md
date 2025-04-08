# Internals of Go Channels. Inner workings of Go channels | by Shubham Agrawal | Medium
[

![](https://miro.medium.com/v2/resize:fill:44:44/1*aHYFfrOM484Ythlx88pJXw.jpeg)






](https://shubhagr.medium.com/?source=post_page---byline--cf5eb15858fc---------------------------------------)

In this blog, we are going to understand the internals of channels in Go.

Following are the things that I am covering in this blog.

1.  Overview and basic _definition, types, use-cases_ and _properties_ of channels.
2.  Making of channel, its representation `hchan struct`, and _initialisation._
3.  Different scenarios of _blocking_ and _unblocking_ of go-routines by channels .
4.  Exchange of messages between go-routines through channel, copying of data objects.
5.  Working of Pausing/Blocking and Resuming/Unblocking of go-routines by channels.
6.  Within it, brief introduction of runtime, scheduling, and `g, m, p structs`
7.  Algorithm of pausing of sender on a full buffered channel **(imp)**
8.  Algorithm to resume sender on a full buffered channel **(imp)**
9.  Algorithm to resume receiver on an empty buffered channel **(imp)**
10.  Unbuffered channels and **select** statement.

Go Channels are typed tubes/conduit through which different go-routines can communicate. By typed, I mean, channels can only send and receive objects of some type. There are 3 types of channels

1.  **_asynchronous_**_(buffered)_
2.  **_synchronous_**_(unbuffered)_
3.  **_async channels with zero-sized elements_**_(chan struct{}):_ These are basically semaphores with nil buffer and O(1) memory

To create a channel of **int** type, use `make` function

```
ch := make(chan int) // unbuffered channel  
bch := make(chan int, 100) // buffered channel
```

To send or receive objects from the channel, use `<-` operator

```
ch <- 3 //sends 3 to the channel   
v := <- ch // receives 3 from the channel and assigns it to v
```

1.  Used for synchronisation and communication between go routines without explicit locks or condition variables
2.  Internally, works like a FIFO circular queue
3.  Channels transfer the **copy** of the object.
4.  By default, **_sends_** and **_receives_** block until the other side is ready. This allows go-routines to synchronise without explicit locks or condition variables.
5.  **_Sends_** to a buffered channel block only when the buffer is full. **_Receives_** block when the buffer is empty.
6.  **zero-value** of a channel is `nil`
7.  When a go-routine `G1` wants to receive data from another go-routine `G2`, but `G2` never sends the data, then the channel will make `G1` to wait indefinitely, and vice versa.
8.  If the buffer is full or if there is nothing to receive, a buffered channel will behave very much like an unbuffered channel.
9.  For unbuffered channel, one go-routine should be in **_running_** state, while other go-routine should be in **_runnable_** state.

1.  Go-routine safe
2.  Implement FIFO behaviour
3.  Exchange data between go-routines
4.  Block and Unblock go-routines

If we want to have a naive implementation of a channel depicting first two use-cases, we would simply have a lock on a queue(FIFO data-structure). Likewise, `Go` implements it as `hchan` struct.

hchan struct
------------

Available in `chan.go` in `runtime` package

```
**type** hchan **struct** {  
    qcount   uint      // total data in the queue  
    dataqsiz uint      // size of the circular queue  
    buf      unsafe.Pointer // pointer to an array(queue)  
    elemsize uint16  
    closed   uint32    // if channel is closed  
    elemtype \*\_type    // element type  
    sendx    uint      // send index  
    recvx    uint      // receive index  
    recvq    waitq     // list of recv waiters  
    sendq    waitq     // list of send waiters  
    lock     mutex     // mutex for concurrent access to the channel  
}
```

Channels use a circular queue of size `dataqsiz`, where `sendx` or `recvx` point to the next element that is going to be sent to or received from the channel.

Initialisation of channel
-------------------------

> While making a channel, `Go` allocates `hchan` struct on a **heap** and returns a **pointer** to it. So, `ch` is just a pointer to a variable of type `hchan` .

For synchronous channels, `Go` doesn’t allocate any buffer, so `buf` will be `nil` and `dataqsiz` will be `0` . For asynchronous channels, `buf` will be pointing to head of the circular queue allocated in a heap(> 32 kB) using `mallocgc`.

![](https://miro.medium.com/v2/resize:fit:700/1*Nhmkd-1XDFRh34M-w_c9sQ.png)

Working of Buffered Channel

Blocking and Unblocking Go-routines
-----------------------------------

As we all know, channels block and unblock go-routines. Sender go-routine is blocked when the buffer is full or there is no receiver, and similarly, receiver go-routine is blocked when the buffer is empty or there is no sender.

There are two more attributes in `hchan`struct, `sendq` and `recvq` . These are pointers to a doubly linked list of **_waiting/blocked_** go-routines. `sendq` is a pointer to the list of go-routines waiting to send data on the channel(when channel is full or no receiver), whereas `recvq` is a pointer to the list of go-routines waiting for receiving data from the channel(when channel is empty or no sender).

Refer to unbuffered channel diagram for more understanding.

![](https://miro.medium.com/v2/resize:fit:700/1*48heQKd-FXbvS2JmQlU40g.png)

I have discussed more about the algorithm of **pausing** and **resuming** in further sections. Meanwhile, just remember that these two variables store `sudog` of **_waiting_** go-routines.

In this section, we will be discussing about how go-routines interact with channel for communication and inner workings of channel. Here I am taking single sender and receiver for the sake of simplicity, but the concepts is applicable for multiple senders and receivers.

Main go-routine(G1)

```
// G1**func** main() {  
   tasks := \[\]string{"task1", "task2", "task3"}

      ch := make(**chan** string, 3)

      **go** worker(ch)

      **for** \_, task := **range** tasks {  
      ch <- task  
   }  
}


```

worker go-routine(G2)

```
// G2 **func** worker(ch **chan** string) {  
   **for** {  
      t := <- ch  
      process(t)  
   }  
}
```

Now when `G1` sends a task to a channel(assuming `buf`is empty), following actions are taken by the go-runtime.

1.  acquire the lock
2.  make a copy of `task₀`and `enqueues` it in the `buf`.
3.  release the lock and allows `G1`on its merry way

> The `enqueue` operation is memory `copy`. It copies `task₀` into `buf`

![](https://miro.medium.com/v2/resize:fit:700/1*tI_URmQCBM43ZB9nIoBiow.png)

Now suppose, `G2` is scheduled to receive the data from the channel, following actions are taken by go-runtime

1.  acquire the lock
2.  `dequeue` the `task₀`from `buf` , make a copy and assign it to `t`.
3.  release the lock and allows `G2` to go on its merry way.

![](https://miro.medium.com/v2/resize:fit:700/1*qRj5TOR_eSeMnT5miTPrTg.png)

The important thing to note here is that the copy into and out of the channel buffer is what gives us **_memory safety_**. The only shared memory both the go-routines access is `hchan` which is protected by `mutex`. Every object is just a copy. This property is what allows channels to align with the principle

> Do not communicate by sharing memory; instead, share memory by communicating

Let’s come back to the discussion, now both the go routines `G1` and `G2` have send and receive the data respectively, and now `buf` is empty in the channel.

![](https://miro.medium.com/v2/resize:fit:700/1*tKh6MUf9GZQbrSDQFh-J5w.png)

Now, suppose `G2` is taking really long time to process a single task and is incapable of receiving any more tasks from the async channel. But `G1` keeps sending more tasks into it without getting blocked.

![](https://miro.medium.com/v2/resize:fit:700/1*hOBKdH1eG40fZj5PQIUT0Q.png)

As you can see, the buffered channel is full, `G1` can’t send anymore tasks into it. So, `G1` ‘s execution is `paused/blocked`, `resumed/unblocked` only after a receive. Let’s see how does the **pausing** and **resuming** works for go-routines with channels. (you can also refer to blocking and unblocking section above.)

Before we can understand pausing and resuming, it is important to understand the scheduling of go-routines.

Go-routines are **_user-space threads_**. They are managed by **_go-runtime scheduler_** on top of **_OS threads_**. Go-routines life-cycle is managed by go-runtime and not OS, that’s why these are **_lightweight_** compared to OS threads. These are less expensive in terms of resource consumption, scheduling overhead etc.

Go-runtime scheduler uses **_M:N scheduling_** model to schedule these go-routines on top of OS threads. Scheduler multiplexes these M go-routines onto these N OS threads.

![](https://miro.medium.com/v2/resize:fit:700/1*t7kqBbrshTyIH0ouFPDBvQ.png)

Go’s M:N scheduling is described by 3 structs.

g, m, and p structs
-------------------

These structs can be found in `runtime` package in `runtime2.go`

I have listed only few important attributes from all the three structs

```
**type** g **struct** {  
  ... stack       stack   // offset known to runtime/cgo  
   m          \*m      // current m; offset known to arm liblink  
   ...}**type** m **struct** {  
   ...

      g0      \*g     // go-routine with scheduling stack  
   curg    \*g       // current running go-routine  
   p       puintptr // attached p for executing go code (nil if not executing go code)  
   nextp         puintptr  
   oldp          puintptr // the p that was attached before executing a syscall  
   id            int64  
   locks         int32  
   blocked       bool // m is blocked on a note  
   createstack   \[32\]uintptr    // stack that created this thread.  
   mOS

      ...  
}

**type** p **struct** {  
   ...  
   m           muintptr   // back-link to associated m (nil if idle)

    // Queue of runnable goroutines. Accessed without lock.  
   runqhead uint32  
   runqtail uint32  
   runq     \[256\]guintptr  
   sudogcache \[\]\*sudog  
   ...  
}


```

![](https://miro.medium.com/v2/resize:fit:700/1*tpeI5xR8L1LZyxg7MbJYng.png)

Three different structs of go-routines

In order to run go-routines, `g1` must hold `t1(m)` and `t1(m)` must hold `p` , where `p` is basically `context for scheduling` . `p` holds a `runq` which a queue holding runnable go-routines.

![](https://miro.medium.com/v2/resize:fit:700/1*H4QVUq_fgY7b_40h7w-l-g.png)

During runtime, g holds m and m holds g and p.

Algorithm to pause/block a go-routine
-------------------------------------

Now let’s understand how does channel and scheduling play their roles while pausing/blocking a go-routine.

Here, I am taking an example a go-routine (G1) trying to send a task on full buffered channel

```
// G1ch <- task4 // sending task4 on a full channel
```

1.  When `G1` tries to send `task4`on a **_full buffered channel_**, the channel creates a `sudog` for itself and attaches it to `sendq` of `hchan` struct and then channel makes `gopark` call to scheduler.
2.  Now, scheduler changes the state of **_running_** `G1` into **_waiting_** state.
3.  Then scheduler, removes the association of `G1`from `t1(m)`, **_dequeues_** the **_runnable_** `G2` from `runq` (held by `P`), and **_schedules_** onto `t1(m)` .
4.  Later, when receiver is ready to take another tasks, it dequeues `sudog` from `sendq` .

![](https://miro.medium.com/v2/resize:fit:449/1*fVd_n0CWXPVMsqVpVB0HSA.png)

Channel creates sudog and then attaches it sendq

![](https://miro.medium.com/v2/resize:fit:700/1*EmmGbZb2MZHemi9yr90Bzg.png)

Pausing of go-routine(G1) while trying to send on full channel

This is basically a context switch of go-routines done by runtime scheduler. Observe that when send operation was executed, `G1` was running, but by the end of the operation, `G2` is running and `G1` is **_blocked_**. Also note that, OS thread `t1(m)` is **_not blocked._**

For more clarity, you can refer to this code snippet of `chansend()` func from `chan.go` file.

```
// Block on the channel. Some receiver will complete our operation for us.gp := getg()  
mysg := acquireSudog()// No stack splits between assigning elem and enqueuing mysg  
// on gp.waiting where copystack can find it.  
mysg.elem = ep  
mysg.g = gpmysg.c = c // setting the current channel  
gp.waiting = mysg// enque sudog on channel sendq  
c.sendq.enqueue(mysg)// trigger gopark call  
goparkunlock(&c.lock, _waitReasonChanSend_, _traceEvGoBlockSend_, 3)  
// Ensure the value being sent is kept alive until the  
// receiver copies it out. The sudog has a pointer to the  
// stack object.  
KeepAlive(ep)
```

Algorithm to resume/unblock a sender go-routine on full channel
---------------------------------------------------------------

Let’s understand how does channel and scheduling play their roles while resuming/unblocking a go-routine. Here I am continuing the same example, but, from receivers end.

Currently, we know that `G1` is in **waiting state,** and `hchan` holds a `sudog` containing details of `G1` and a copy of `task4` , also the `buf` is full.

![](https://miro.medium.com/v2/resize:fit:618/1*VIvxu31J8F4H2IegOgQikA.png)

`G2` gets schedule onto some OS thread, it is going perform receives on the channel. Note that, channel’s `buf` is containing \[`task1`, `task2`, `task3`\]

```
// G2t := <- ch // receives from the buffered channel
```

1.  Channel first **_dequeues_** the object(_task1_) from `buf`, which means it receives `task1`, assigns `task1`to the `t` variable.
2.  Then, **_dequeues_** `sudog`  from `sendq` , **_enqueues_** `sudog.elem(e.g task4)` into `buf`. **_(Important optimisation)_**
3.  Sets `G1` to **_runnable state._** It does this by making a call to runtime scheduler with `goready(G1)` . This means `G2` is telling scheduler to make `G1` runnable.

![](https://miro.medium.com/v2/resize:fit:575/1*5QiQQoyCzokOflWPKvSd9w.png)

Current state of hchan after receiving

![](https://miro.medium.com/v2/resize:fit:700/1*xhoEqtvt-yNi-avkYLAbGA.png)

Resuming of go-routine (G1)

Let’s address the important question

Q. Why did `G2` enqueue `task4` into `buf` ?
--------------------------------------------

> This is a veery important optimisation. G2 enqueues task4 into channels’ buf so that channel doesn’t have to wait for G1 to get schedule and then enqueue it. Also another advantage is that, for enqueuing object G1 needs to acquire the lock, but now G1 doesn’t have to acquire the lock and it doesn’t have to mess with the channel’s state.

You can refer to following snippet from `chan.go` for func `chanrecv()` and func `recv()` . When there is a `sendq` is not empty `chanrecv()` calls `recv()` .

```
**func** chanrecv() {  
    ... **if** sg := c.sendq.dequeue(); sg != nil {  
      // Found a waiting sender. If buffer is size 0, receive value  
      // directly from sender. Otherwise, receive from head of queue  
      // and add sender's value to tail of the queue (both map to  
      // the same buffer slot because the queue is full).

          recv(c, sg, ep, **func**() { unlock(&c.lock) }, 3)  
     **return** _true_, _true_ }  
     ...}// ep is pointing to caller's stack or a heap.  
**func** recv(c \*hchan, sg \*sudog, ep unsafe.Pointer, unlockf **func**(), skip int) {  
      // Queue is full. Take the item at the  
      // head of the queue. Make the sender enqueue  
      // its item at the tail of the queue. Since the  
      // queue is full, those are both the same slot.  
      qp := chanbuf(c, c.recvx) // copy data from queue to receiver  
      **if** ep != nil {  
         typedmemmove(c.elemtype, ep, qp)  
      } // copy data from sender to queue  
      typedmemmove(c.elemtype, qp, sg.elem) c.recvx++  
      **if** c.recvx == c.dataqsiz {  
         c.recvx = 0  
      }  
      c.sendx = c.recvx // c.sendx = (c.sendx+1) % c.dataqsiz  
   } sg.elem = nil  
   gp := sg.g  
   unlockf() goready(gp, skip+1)  
}}
```

Algorithm to resume/unblock a receive go-routine on empty channel
-----------------------------------------------------------------

> This is very interesting section

In the above section, we discussed about the resuming a sender blocked on full buffered channel. In this, we are going to discuss how does resuming of receiver go-routine takes place while waiting on the empty channel.

```
// G2t := <- ch
```

Suppose the channel is empty and scheduler schedules `G2` before `G1` could send any task on it. Since the channel `buf` is empty, `G2` will go into waiting(pause/block) state. (refer to pausing algo. and the diagram below)

![](https://miro.medium.com/v2/resize:fit:700/1*6kYvJpnflh3sUEmwvPF3Xw.png)

Following will the state of `hchan`

![](https://miro.medium.com/v2/resize:fit:628/1*vpOWxRzVOj7J3dN89KhMAg.png)

Now, `G1` gets schedule so we have two options to resume receiver.

**Option 1**

*   `G1` can **_enqueue_** the task, **_dequeue_** waiting `G2` from `recvq` and call `goready(G2)` to the scheduler.

**Option 2** (_smarter way, important optimisation, actual implementation_)

*   `G1` can directly copy `task` obj into `t` ‘s location from `sudog.elem`.

![](https://miro.medium.com/v2/resize:fit:700/1*63DT-Iw5c_wdVXiZCRnH6A.png)

Why did  `G1` directly copy `task0` into G2 stack instead enqueuing?
--------------------------------------------------------------------

> We know all the go-routines have non-overlapping separate stacks, and go-routines don’t access each other states. Here, `G1` is directly accessing stack pointer of `G2`, and changing the state of it. I know it is not right, but this will save `G2` from taking a lock and mess with the channel’s buffer, also one fewer memory copy and hence optimisation.

Unbuffered channels always work as **direct send** case

1.  receiver waiting → sender directly writes to receiver’s stack from `sudog`
2.  sender waiting → receiver directly writes to sender’s stack from `sudog`

Code snippet for the same

Sender waiting, receiver receiving from unbuffered channel
----------------------------------------------------------

```
// A non-nil ep must point to the heap or the caller's stack.**func** recv(c \*hchan, sg \*sudog, ep unsafe.Pointer, unlockf **func**(), skip int) { // unbuffered channel  
   **if** c.dataqsiz == 0 {  
          ...  
      **if** ep != nil {  
         // copy data from sender to ep  
         recvDirect(c.elemtype, sg, ep)  
      }  
   } **else** { ... }  
    ... sg.elem = nil  
  gp := sg.g  
  goready(gp, skip+1)  
}
```

Receiver waiting, sender sends on unbuffered channel
----------------------------------------------------

```
// The value ep sent by the sender is copied to the receiver sg.  
// sg must already be dequeued from c.  
// ep must be non-nil and point to the heap or the caller's stack.**func** send(c \*hchan, sg \*sudog, ep unsafe.Pointer, unlockf **func**(), skip int) {  
   **if** _raceenabled_ {  
      **if** c.dataqsiz == 0 {  
         racesync(c, sg)  
      } **else** {  
         // Pretend we go through the buffer, even though  
         // we copy directly. Note that we need to increment  
         // the head/tail locations only when raceenabled.  
         qp := chanbuf(c, c.recvx)  
              ...  
         c.recvx++  
         **if** c.recvx == c.dataqsiz {  
            c.recvx = 0  
         }  
         c.sendx = c.recvx  
      }  
   }  
   **if** sg.elem != nil {  
      // copy ep of sender to receiver's sg      
      sendDirect(c.elemtype, sg, ep)  
      sg.elem = nil  
   }  
   gp := sg.g  
   unlockf()  
   gp.param = unsafe.Pointer(sg)  
   **if** sg.releasetime != 0 {  
      sg.releasetime = cputicks()  
   }  
   goready(gp, skip+1)  
}
```

1.  **All** channels are locked
2.  A `sudog` is put in the`sendq`/`recvq` queues of **all** channels
3.  Channels unlocked, all the selecting G is **paused**
4.  CAS operation so there is only one winning case
5.  **Resuming** mirrors the pause sequence.

You can learn more about select statement from `runtime` package `select.go`

1.  [Dmitry Blog](http://dmitryvorobev.blogspot.com/2016/08/golang-channels-implementation.html)
2.  [Go Channels on steroids](https://docs.google.com/document/d/1yIAYmbvL3JxOKOjuCyon7JhW4cSv1wy5hC0ApeGMV9s/pub)
3.  [Kavya Joshi Talk](https://www.youtube.com/watch?v=KBZlN0izeiY)
4.  [Golang by example](https://golangbyexample.com/inner-working-of-channels-in-golang/)
5.  [Journey with Go](https://medium.com/a-journey-with-go/go-buffered-and-unbuffered-channels-29a107c00268)