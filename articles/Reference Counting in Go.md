# Reference Counting in Go
With the release of Go 1.3 the `sync.Pool` builtin became available in the [sync](http://golang.org/pkg/sync/) package. It allows you to keep a pool of objects for re-use. Objects are obtained by calling `Get()` and returned to the pool by calling `Put()`. The pool creates new objects by calling the `New` member. This member works as a factory function, allowing you to define how objects that are part of the pool get created. By using a pool of objects you avoid the cost of allocating the same object repeatedly. This also completely removes the cost of garbage collecting those same objects. The less garbage that is generated, the less CPU cycles are spent performing garbage collection.

This pattern works particularly well for servers that implement a request-response pattern. The server needs the same type of object to handle each request. This is the case with HTTP servers that need to read the body of a POST request. In this case I used an instance of `sync.Pool` to keep instances of `bytes.Buffer`. This only works if two things are true:

1.  Each object obtained from the pool can have its state reset.
2.  The object is needed only for the duration of one request.

In the case of the `bytes.Buffer` object, the `Reset()` function can be called to clear any data previously in the buffer. This satisfies the first requirement.

In the process of handling an HTTP request, the value of the body of the request is generally only applicable for the request itself. In other words, there is no reason to keep a copy of the request body around. This is important, because if the object needs to be shared in multiple contexts it is ill suited to being reused within an instance of `sync.Pool`. Once an instance of any object is returned back to an instance of `sync.Pool` it must not be accessed again. This is problematic because if multiple contexts all need to access the same object, it is unclear what context is responsible for returning the object to the pool once it is no longer in use.

This problem might seem like a non-issue but I encountered it while implementing a server that streams data to multiple clients. Each client connects to the server, but receives an identical data stream. The data stream consists of individual messages that are marshaled before being sent to the clients. This is implemented in its simplest form by having a single goroutine marshal the data, with a separate goroutine for sending the data to each client. Using `sync.Pool` the best approach I could come up with was to have a single goroutine create a copy of the object for each client and each client returning that object to the pool. This requires an amount of memory that increases linearly with each client that connects, so it is completely non-scalable.

The most appropriate solution to this problem is to implement a pool of objects that are reference counted. Reference counts allow the number of contexts using an object to be tracked explicitly. Each object has an integer number that is incremented when an object is in use and decremented when the object is no longer in use. If the reference count of an object is zero, then the object can be reused.

If you are unfamiliar with reference counting as a memory management strategy, this is not the place to learn. [Wikipedia](https://en.wikipedia.org/wiki/Reference_counting) has an extensive article on the topic, but it covers much more than is needed for understanding the concepts presented here. If you want to become familiar with pragmatic use of reference counts, the C API of the CPython implementation is an API built around reference counting that is relatively easy to learn. The [documentation](https://docs.python.org/2/c-api/refcounting.html) about its reference counting implementation is informative.

The basic reference counted pool is often implemented with the following components.

1.  A mechanism to construct new objects that are part of the pool.
2.  A master list of all the objects in the pool.
3.  A count of the number of references held to each object.

Using these components, a memory pool can be statically allocated at program startup and used for the life of the program. The allocation to fill the pool is performed all at once, and the program doesn't rely on the use of dynamic allocation. Objects are obtained from the pool by checking for a zero reference count until an object is found with no references held.

This formula is common in servers written in languages like C and C++. Using a reference counted pool built around these ideas provides a signficant speedup. It is also common in real time software. Relying on an unpredictable memory allocation scheme provided by the operating systems implementation of `malloc()` and `free()` can wreak havoc on deadlines.

This scheme has a couple drawbacks.

1.  You must determine the size of the pool in advance. This can be difficult. The use of a undersized pool can result in starvation, the result of an oversized pool results in large amount of memory being allocated and never used.
2.  Any programmatic mistakes around the decerementing of reference counts results in an object being removed from the pool forever. This eventually leads to starvation and the software's complete failure.
3.  The use of reference counted in multihreaded software requires the usage of atomics provided by the underlying software. In C and older versions of C++ this means using inline assembly.

The distinguishing factor of Golang from languages like C in this context is that you don't have to manually perform garbage collection in the first place. This makes implementing a reference counted pool _signficantly_ less challenging in several ways.

1.  The pool doesn't need to be sized in advance. The pool can grow as demand increases. The pool can be shrunk by simply removing unused references from the pool. The garbage collector takes care of reclaiming the resources. This allows for a pool that from the perspective of the programmer is simply bottomless.
2.  Any mistakes around the decrementing of reference counts simply results in garbage being generated. The garbage collection takes care of the rest.
3.  Golang exposes primitives for atomic manipulation integers in the `sync/atomic` built-in package.

With all of this taken into consideration, I initially experimented with implementing my own reference counted pool. However, the end result of this was I discovered that the built-in `sync.Pool` implementation is incredibly high performance. With this fact, I decided the correct thing to do was to wrap `sync.Pool` to handle reference counted objects.

Once I understood that the performance of the built-in `sync.Pool` is excellent, I decided to phrase the problem as follows

_How can a shared object determine when to release itself to an instance of `sync.Pool`?_

This is actually relatively easy, but I wanted to come up with a solution that could simply be added to existing software without requiring extensive refactoring. The thing that makes `sync.Pool` so powerful is that it can work with _any_ object type. This requires users to typecast the result of the `Get()` operation but that is an insigicant obstacle. The need to refactor existing code to call increment and decrement operations is inescapable.

The logic to solve the problem statement is straightforward.

1.  When an instance of an object is returned from `sync.Pool` using `Get()`, its reference count is set to one.
2.  When an additional context holds a reference to the object, increment its reference count.
3.  When a context no longer holds the reference count to the object, decrement its reference count.
4.  Check the result of each decrement operation. If the result is zero, return the object to the `sync.Pool` by using `Put()`.

That's really all there is to it. Atomic increment and decrement operations on a `uint32` are done using the functions in `sync/atomic`. To make this extensible to all objects, I created a type that contains the following information

1.  A pointer to a `uint32`
2.  A pointer to the instance of `sync.Pool` that the object needs to be returned to.
3.  A pointer to the object that should be returned when the reference count reaches zero.

The third point is important as this type must be embedded by value in another type. The actual type that does the embedding is what needs to be returned, not the embedded value. Instead of the typical `func() interface{}` being used to construct new objects, a new type of factory is defined. This is complex to explain in words, but simple to demonstate using code.

//This type is managed by a reference counting pool
type  cowCounter  struct  {
  Name  string
  NumberOfSpots  int
  NumberOfSplotches  int
  NumberOfOffspring  int
  //Embedded reference count type
  rapidcheetah.ReleasingReferenceCount
}

//This function constructs objects that are part of the reference counted pool
func  cowCounterFactory(rcFactory  rapidcheetah.ReleasingReferenceCountFactory)  
rapidcheetah.ReferenceCountable{
  //Create a new instance
  newobj  :=  &cowCounter{}
  //Initialize the reference count
  newobj.ReleasingReferenceCount  \=  rcFactory()
  //Set the field in the embedded reference count
  newobj.V  \=  newobj
  return  newobj
}

The `cowCounterFactory` function takes a single parameter: another factory function. This function is used to initialize the internals of the embedded reference count type. After it is initialized, the `V` member of embedded reference count is assigned. This allows the correct object to be returned to the pool when the reference count reaches zero.

The `cowCounterFactory` type also returns a defined interface type, not the empty interface as used in `sync.Pool`. This is necessary because the pool must be composed of objects that implement the `Incr()` and `Decr()` operations. All objects must be embed `rapidcheetah.ReleasingReferenceCount` to work, this type also implements the `rapidcheetah.ReferenceCountable` interface. Basically, this is just a clever usage of Golang's type system.

I packaged up all my work into a library I call `rapidcheetah`. The `rapidcheetah.ReferenceCountedPool` manages instances of reference counted objects. Internally, it wraps an instance of `sync.Pool`. To construct a pool, call `rapidcheetah.NewReferenceCountedPool`. The parameter to this function is a factory function for creating new objects as part of the pool, like `cowCounterFactory` in the above example.

You can call `Allocated()` on the pool object to get the number of times that the factory function has been called to create a new object. Calling `Returned()` gives the number of times objects have been returned to the pool. This is meant for troubleshooting errors around the manipulation of reference counts. These counters rollover.

[Source Code](#source-code)
---------------------------

You can download the library [on GitHub](http://www.github.com/hydrogen18/rapidcheetah).

[By Example](#by-example)
-------------------------

To demonstrate usage of the library I created a basic chat server. There is also a client, but that doesn't use the `rapidcheetah` package. Understanding the example is a first step to understanding proper usage of the library. The example has comments explaining the correct manipulation of reference counts. The explanation here focuses on a description of the server component and manipulation of reference counts in non-error cases.

### [The Server](#the-server)

The server listens on TCP port 52000. Each client connects and joins a single global room. Any client can send a message. The message is sent to all other clients.

When the server starts, a single goroutine referred to as the **distributor** is started. This goroutine runs the `distributor()` function in `server.go`. It is responsible for handing out a chat message to all clients, but does not do the actual sending on the TCP socket.

Each time a client connects, two goroutines are started. One is used for receiving messages. The other is used for sending messages. Communication between the **distributor** and the two goroutines is done using channels.

After a single chat message is received, the message is copied into an instance of `ChatLine` by the receiving goroutine. The `ChatLine` instance is reference counted and managed by an instance of `rapidcheetah.ReferenceCountingPool`. This object is passed back to the **distributor**. The receiving goroutine does not manipulate the reference count of an object, because the object has a reference count of one when obtained from the pool. When the receiving goroutine sends the object back to the **distributor** it is transferring ownership of the reference. This is why it does not decrement the reference count.

The distributor receives an instance of the `ChatLine` type. This message is passed to the sending goroutine for each client. The **distributor** increments the reference count to each object before passing to another goroutine. Finally the **distributor** decrements the reference count to the object since it no longer holds a reference to it.

### [Running it](#running-it)

You can run the client and the server with standard go tooling after setting your `GOPATH` environmental variable.

First start the server.

go get github.com/hydrogen18/rapidcheetah
go install github.com/hydrogen18/rapidcheetah/example/server
$GOPATH/bin/server

Assuming you want to run the client on the same machine, do the following.

go install github.com/hydrogen18/rapidcheetah/example/client
$GOPATH/bin/client localhost:52000 clientName

Otherwise you should change `localhost:52000` to the IP or hostname of the machine you intend to connect to. The client read lines from standard input and sends each line as a separate message to the server.