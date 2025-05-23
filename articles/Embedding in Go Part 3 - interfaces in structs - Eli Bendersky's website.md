# Embedding in Go: Part 3 - interfaces in structs - Eli Bendersky's website
This post is part 3 in a series describing the kinds of embedding Go supports:

1.  Structs in structs ([part 1](https://eli.thegreenplace.net/2020/embedding-in-go-part-1-structs-in-structs/))
2.  Interfaces in interfaces ([part 2](https://eli.thegreenplace.net/2020/embedding-in-go-part-2-interfaces-in-interfaces/))
3.  Interfaces in structs (this part)

Embedding interfaces in structs
-------------------------------

At first sight, this is the most confusing embedding supported in Go. It's not immediately clear what embedding an interface in a struct means. In this post we'll work through this technique slowly and present several real-world examples. At the end, you'll see that the underlying mechanics are pretty simple and the technique is useful in various scenarios.

Let's start with a simple synthetic example:

type  Fooer  interface  {
  Foo()  string
}

type  Container  struct  {
  Fooer
}

Fooer is an interface and Container embeds it. Recall from [part 1](https://eli.thegreenplace.net/2020/embedding-in-go-part-1-structs-in-structs/) that an embedding in a struct _promotes_ the embedded struct's methods to the embedding struct. It works similarly for embedded interfaces; we can visualize it as if Container had a forwarding method like this:

func  (cont  Container)  Foo()  string  {
  return  cont.Fooer.Foo()
}

But what does cont.Fooer refer to? Well, it's just any object that implements the Fooer interface. Where does this object come from? It is assigned to the Fooer field of Container when the container is initialized, or later. Here's an example:

// sink takes a value implementing the Fooer interface.
func  sink(f  Fooer)  {
  fmt.Println("sink:",  f.Foo())
}

// TheRealFoo is a type that implements the Fooer interface.
type  TheRealFoo  struct  {
}

func  (trf  TheRealFoo)  Foo()  string  {
  return  "TheRealFoo Foo"
}

Now we can do:

co  :=  Container{Fooer:  TheRealFoo{}}
sink(co)

This will print sink: TheRealFoo Foo.

What's going on? Notice how the Container is initialized; the embedded Fooer field gets assigned a value of type TheRealFoo. We can only assign values that implement the Fooer interface to this field - any other value will be rejected by the compiler. Since the Fooer interface is embedded in Container, its methods are promoted to be Container's methods, which makes Container implement the Fooer interface as well! This is why we can pass a Container to sink at all; without the embedding, sink(co) would not compile because co wouldn't implement Fooer.

You may wonder what happens if the embedded Fooer field of Container is not initialized; this is a great question! What happens is pretty much what you'd expect - the field retains its default value, which in the case of an interface is nil. So this code:

co  :=  Container{}
sink(co)

Would result in a runtime error: invalid memory address or nil pointer dereference.

This pretty much covers _how_ embedding interfaces in structs works. What remains is the even more important question of - why would we need this? The following examples will present several use cases from the standard library, but I want to begin with one coming from elsewhere and demonstrating what is - in my opinion - the most important use of this technique in client code.

Example: interface wrapper
--------------------------

This example is courtesy of GitHub user [valyala](https://github.com/valyala), taken from [this comment](https://github.com/golang/go/issues/22013#issuecomment-331886875).

Suppose we want to have a socket connection with some additional functionality, like counting the total number of bytes read from it. We can define the following struct:

type  StatsConn  struct  {
  net.Conn

  BytesRead  uint64
}

StatsConn now implements the net.Conn interface and can be used anywhere a net.Conn is expected. When a StatsConn is initialized with a proper value implementing net.Conn for the embedded field, it "inherits" all the methods of that value; the key insight is, though, that we can intercept any method we wish, leaving all the others intact. For our purpose in this example, we'd like to intercept the Read method and record the number of bytes read:

func  (sc  \*StatsConn)  Read(p  \[\]byte)  (int,  error)  {
  n,  err  :=  sc.Conn.Read(p)
  sc.BytesRead  +=  uint64(n)
  return  n,  err
}

To users of StatsConn, this change is transparent; we can still call Read on it and it will do what we expect (due to delegating to sc.Conn.Read), but it will also do additional bookkeeping.

As shown in the previous section, it's critical to initialize a StatsConn properly; for example:

conn,  err  :=  net.Dial("tcp",  u.Host+":80")
if  err  !=  nil  {
  log.Fatal(err)
}
sconn  :=  &StatsConn{conn,  0}

Here net.Dial returns a value that implements net.Conn, so we can use that to initialize the embedded field of StatsConn.

We can now pass our sconn to any function that expects a net.Conn argument, e.g:

resp,  err  :=  ioutil.ReadAll(sconn)
if  err  !=  nil  {
  log.Fatal(err)
}

And later we can access its BytesRead field to get the total.

This is an example of _wrapping_ an interface. We created a new type that implements an existing interface, but reused an embedded value to implement most of the functionality. We could implement this without embedding by having an explicit conn field like this:

type  StatsConn  struct  {
  conn  net.Conn

  BytesRead  uint64
}

And then writing forwarding methods for each method in the net.Conn interface, e.g.:

func  (sc  \*StatsConn)  Close()  error  {
  return  sc.conn.Close()
}

However, the net.Conn interface has 8 methods. Writing forwarding methods for all of them is tedious and unnecessary. Embedding the interface gives us all these forwarding methods for free, and we can override just the ones we need.

Example: sort.Reverse
---------------------

A classical example of embedding an interface in a struct in the Go standard library is sort.Reverse. The usage of this function is often confounding to Go newbies, because it's not at all clear how it's supposed to work.

Let's start with a simpler example of sorting in Go, by sorting an integer slice.

lst  :=  \[\]int{4,  5,  2,  8,  1,  9,  3}
sort.Sort(sort.IntSlice(lst))
fmt.Println(lst)

This prints \[1 2 3 4 5 8 9\]. How does it work? The sort.Sort function takes an argument implementing the sort.Interface interface, which is defined as:

type  Interface  interface  {
  // Len is the number of elements in the collection.
  Len()  int
  // Less reports whether the element with
  // index i should sort before the element with index j.
  Less(i,  j  int)  bool
  // Swap swaps the elements with indexes i and j.
  Swap(i,  j  int)
}

If we have a type we'd like to sort with sort.Sort, we'll have to implement this interface; for simple types like an int slice, the standard library provides convenience types like sort.IntSlice that take our value and implement the sort.Interface methods on it. So far so good.

So how does sort.Reverse work? By cleverly employing an interface embedded in a struct. The sort package has this (unexported) type to help with the task:

type  reverse  struct  {
  sort.Interface
}

func  (r  reverse)  Less(i,  j  int)  bool  {
  return  r.Interface.Less(j,  i)
}

By this point it should be clear what this does; reverse implements sort.Interface by means of embedding it (as long as it's initialized with a value implementing the interface), and it intercepts a single method from that interface - Less. It then delegates it to the Less of the embedded value, but inverts the order of arguments. This Less actually compares element in reverse, which will make the sort work in reverse.

To complete the solution, the sort.Reverse function is simply:

func  Reverse(data  sort.Interface)  sort.Interface  {
  return  &reverse{data}
}

And now we can do:

sort.Sort(sort.Reverse(sort.IntSlice(lst)))
fmt.Println(lst)

Which prints \[9 8 5 4 3 2 1\]. The key point to understand here is that calling sort.Reverse itself does not sort or reverse anything. It can be seen as a higher order function: it produces a value that wraps the interface given to it and adjusts its functionality. The call to sort.Sort is where the sorting happens.

Example: context.WithValue
--------------------------

The context package has a function called WithValue:

func  WithValue(parent  Context,  key,  val  interface{})  Context

It "returns a copy of parent in which the value associated with key is val." Let's see how it works under the hood.

Ignoring error checking, WithValue basically boils down to:

func  WithValue(parent  Context,  key,  val  interface{})  Context  {
  return  &valueCtx{parent,  key,  val}
}

Where valueCtx is:

type  valueCtx  struct  {
  Context
  key,  val  interface{}
}

Here it is - a struct embedding an interface again. valueCtx now implements the Context interface and is free to intercept any of Context's 4 methods. It intercepts Value:

func  (c  \*valueCtx)  Value(key  interface{})  interface{}  {
  if  c.key  \==  key  {
  return  c.val
  }
  return  c.Context.Value(key)
}

And leaves the rest of the methods untouched.

Example: degrading capability with a more restricted interface
--------------------------------------------------------------

This technique is quite advanced, but it's used in many places throughout the standard library. That said, I don't expect it is commonly needed in client code so if you're a Go newbie and you don't get it on the first read, don't worry too much. Get back to it after you gain some more Go experience.

Let's start by talking about the io.ReaderFrom interface:

type  ReaderFrom  interface  {
  ReadFrom(r  Reader)  (n  int64,  err  error)
}

This interface is implemented by types that can meaningfully read data from an io.Reader. For example, the os.File type implements this interface and reads the data from the reader into the open file it (os.File) represents. Let's see how it does it:

func  (f  \*File)  ReadFrom(r  io.Reader)  (n  int64,  err  error)  {
  if  err  :=  f.checkValid("write");  err  !=  nil  {
  return  0,  err
  }
  n,  handled,  e  :=  f.readFrom(r)
  if  !handled  {
  return  genericReadFrom(f,  r)
  }
  return  n,  f.wrapErr("write",  e)
}

It first attempts to read from r using the readFrom method, which is OS specific. On Linux, for example, it uses the [copy\_file\_range](https://man7.org/linux/man-pages/man2/copy_file_range.2.html) syscall for very fast copying between two files, directly in the kernel.

readFrom returns a boolean saying whether it succeeded (handled). If not, ReadFrom attempts to do a "generic" operation using genericReadFrom, which is implemented as:

func  genericReadFrom(f  \*File,  r  io.Reader)  (int64,  error)  {
  return  io.Copy(onlyWriter{f},  r)
}

It uses io.Copy to copy from r to f, so far so good. But what is this onlyWriter wrapper?

type  onlyWriter  struct  {
  io.Writer
}

Interesting. So this is our - familiar by now - trick of an interface embedded in a struct. But if we search around in the file we won't find any methods defined on onlyWriter, so it doesn't intercept anything. Why is it needed then?

To understand why, we should look at what io.Copy does. Its code is long so I won't reproduce it fully here; but the key part to notice is that if its destination implements io.ReaderFrom, it will invoke ReadFrom. But this brings us back in a circle, since we ended up in io.Copy when File.ReadFrom was called. This causes an infinite recursion!

Now it starts to become clear why onlyWriter is needed. By wrapping f in the call to io.Copy, what io.Copy gets is not a type that implements io.ReaderFrom, but only a type that implements io.Writer. It will then call the Write method of our File and avoid the infinite recursion trap of ReadFrom.

As I've mentioned earlier, this technique is on the advanced side. I felt it's important to highlight because it represents a markedly different use of the "embed interface in struct" tool, and it's pervasively used throughout the standard library.

The usage in File is a good one because it gives onlyWriter an explicitly named type, which helps understand what it does. Some code in the standard library eschews this self-documenting pattern and uses an anonymous struct. For example, in the tar package it's done with:

io.Copy(struct{  io.Writer  }{sw},  r)