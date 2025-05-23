# Embedding in Go: Part 1 - structs in structs - Eli Bendersky's website
Go doesn't support inheritance in the classical sense; instead, in encourages _composition_ as a way to extend the functionality of types. This is not a notion peculiar to Go. [Composition over inheritance](https://en.wikipedia.org/wiki/Composition_over_inheritance) is a known principle of OOP and is featured in the very first chapter of the _Design Patterns_ book.

_Embedding_ is an important Go feature making composition more convenient and useful. While Go strives to be simple, embedding is one place where the essential complexity of the problem leaks somewhat. In this series of short posts, I want to cover the different kinds of embedding Go supports, and provide examples from real code (mostly the Go standard library).

There are three kinds of embedding in Go:

1.  Structs in structs (this part)
2.  Interfaces in interfaces ([part 2](https://eli.thegreenplace.net/2020/embedding-in-go-part-2-interfaces-in-interfaces/))
3.  Interfaces in structs ([part 3](https://eli.thegreenplace.net/2020/embedding-in-go-part-3-interfaces-in-structs/))

Embedding structs in structs
----------------------------

We'll start with a simple example demonstrating the embedding of a struct in another struct:

type  Base  struct  {
  b  int
}

type  Container  struct  {  // Container is the embedding struct
  Base  // Base is the embedded struct
  c  string
}

Instances of Container will now have the field b as well. In the [spec](https://tip.golang.org/ref/spec) it's called a _promoted_ field. We can access it just as we'd do for c:

co  :=  Container{}
co.b  \=  1
co.c  \=  "string"
fmt.Printf("co -> {b: %v, c: %v}\\n",  co.b,  co.c)

When using a struct literal, however, we have to initialize the embedded struct as a whole, not its fields. Promoted fields cannot be used as field names in composite literals of the struct:

co  :=  Container{Base:  Base{b:  10},  c:  "foo"}
fmt.Printf("co -> {b: %v, c: %v}\\n",  co.b,  co.c)

Note that the access co.b is a syntactic convenience; we can also do it more explicitly with co.Base.b.

Methods
-------

Embedding structs also works well with methods. Suppose we have this method available for Base:

func  (base  Base)  Describe()  string  {
  return  fmt.Sprintf("base %d belongs to us",  base.b)
}

We can now invoke it on instances of Container, as if it had this method too:

fmt.Println(cc.Describe())

To understand the mechanics of this call better, it helps to visualize Container having an explicit field of type Base and an explicit Describe method that forwards the call:

type  Container  struct  {
  base  Base
  c  string
}

func  (cont  Container)  Describe()  string  {
  return  cont.base.Describe()
}

The effect of calling Describe on this alternative Container is similar to our original one which uses an embedding.

This example also demonstrates an important subtlety in how methods on embedded fields behave; when Base's Describe is called, it's passed a Base receiver (the leftmost (...) in the method definition), regardless of which embedding struct it's called through. This is different from inheritance in other languages like Python and C++, where inherited methods get a reference to the subclass they are invoked through. This is a key way in which embedding in Go is different from classical inheritance.

Shadowing of embedded fields
----------------------------

What happens if the embedding struct has a field x and embeds a struct which also has a field x? In this case, when accessing x through the embedding struct, we get the embedding struct's field; the embedded struct's x is _shadowed_.

Here's an example demonstrating this:

type  Base  struct  {
  b  int
  tag  string
}

func  (base  Base)  DescribeTag()  string  {
  return  fmt.Sprintf("Base tag is %s",  base.tag)
}

type  Container  struct  {
  Base
  c  string
  tag  string
}

func  (co  Container)  DescribeTag()  string  {
  return  fmt.Sprintf("Container tag is %s",  co.tag)
}

When used like this:

b  :=  Base{b:  10,  tag:  "b's tag"}
co  :=  Container{Base:  b,  c:  "foo",  tag:  "co's tag"}

fmt.Println(b.DescribeTag())
fmt.Println(co.DescribeTag())

This prints:

Base tag is b's tag
Container tag is co's tag

Note that when accessing co.tag, we get the tag field of Container, not the one coming in through the shadowing of Base. We could access the other one explicitly, though, with co.Base.tag.

Example: sync.Mutex
-------------------

The following examples are all from the Go standard library.

A classical example of struct-in-struct embedding in Go is sync.Mutex. Here's lruSessionCache from [crypto/tls/common.go](https://golang.org/src/crypto/tls/common.go):

type  lruSessionCache  struct  {
  sync.Mutex
  m  map\[string\]\*list.Element
  q  \*list.List
  capacity  int
}

Note the embedding of sync.Mutex; now if cache is an object of type lruSessionCache, we can simply call cache.Lock() and cache.Unlock(). This is useful in some scenarios, but not always. If the locking is part of the struct's public API, embedding the mutex is convenient and removes the need for explicit forwarding methods.

However, it could be that the lock is only used internally by the struct's methods and isn't exposed to its users. In this case I wouldn't embed the sync.Mutex, but would rather make it an unexported field (like mu sync.Mutex).

I've written some more on embedded mutexes and gotchas to look out for [here](https://eli.thegreenplace.net/2018/beware-of-copying-mutexes-in-go/).

Example: bufio.ReadWriter
-------------------------

Since an embedding struct "inherits" (but not in the classical sense, as described above) the methods of an embedded struct, embedding can be a useful tool to implement interfaces.

Consider the bufio package, which has the type bufio.Reader. A pointer to this type implements the io.Reader interface. The same applies to \*bufio.Writer, which implements io.Writer. How can we create a bufio type that implements the io.ReadWriter interface?

Very easily with embedding:

type  ReadWriter  struct  {
  \*Reader
  \*Writer
}

This type inherits the methods of \*bufio.Reader and \*bufio.Writer, and thus implements io.ReadWriter. This is done without giving the fields explicit names (which they don't need) and without writing explicit forwarding methods.

A slightly more involved example is timerCtx in the context package:

type  timerCtx  struct  {
  cancelCtx
  timer  \*time.Timer

  deadline  time.Time
}

To implement the Context interface, timerCtx embeds cancelCtx, which implements 3 of the 4 methods required (Done, Err and Value). It then implements the fourth method - Deadline on its own.