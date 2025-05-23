# Embedding in Go: Part 2 - interfaces in interfaces - Eli Bendersky's website
This post is part 2 in a series describing the kinds of embedding Go supports:

1.  Structs in structs ([part 1](https://eli.thegreenplace.net/2020/embedding-in-go-part-1-structs-in-structs/))
2.  Interfaces in interfaces (this part)
3.  Interfaces in structs ([part 3](https://eli.thegreenplace.net/2020/embedding-in-go-part-3-interfaces-in-structs/))

Embedding interfaces in interfaces
----------------------------------

Embedding an interface in another interface is the simplest kind of embedding in Go, because interfaces only declare capabilities; they don't actually define any new data or behavior for a type.

Let's start with the example listed in [Effective Go](https://golang.org/doc/effective_go.html#embedding), because it presents a well known case of interface embedding in the Go standard library. Given the io.Reader and io.Writer interfaces:

type  Reader  interface  {
  Read(p  \[\]byte)  (n  int,  err  error)
}

type  Writer  interface  {
  Write(p  \[\]byte)  (n  int,  err  error)
}

How do we define an interface for a type that's both a reader and a writer? An explicit way to do this is:

type  ReadWriter  interface  {
  Read(p  \[\]byte)  (n  int,  err  error)
  Write(p  \[\]byte)  (n  int,  err  error)
}

Apart from the obvious issue of duplicating the same method declarations in several places, this hinders the readability of ReadWriter because it's not immediately apparent how it composes with the other two interfaces. You either have to remember the exact declaration of each method by heart or keep looking back at other interfaces.

Note that there are _many_ such compositional interfaces in the standard library; there's io.ReadCloser, io.WriteCloser, io.ReadWriteCloser, io.ReadSeeker, io.WriteSeeker, io.ReadWriteSeeker and more in other packages. The declaration of the Read method alone would likely have to be repeated more than 10 times in the standard library. This would be a shame, but luckily interface embedding provides the perfect solution:

type  ReadWriter  interface  {
  Reader
  Writer
}

In addition to preventing duplication, this declaration _states intent_ in the clearest way possible: in order to implement ReadWriter, you have to implement Reader and Writer.

Fixing overlapping methods in Go 1.14
-------------------------------------

Embedding interfaces is composable and works as you'd expect. For example, given the interfaces A, B, C and D such that:

type  A  interface  {
  Amethod()
}

type  B  interface  {
  A
  Bmethod()
}

type  C  interface  {
  Cmethod()
}

type  D  interface  {
  B
  C
  Dmethod()
}

The [method set](https://tip.golang.org/ref/spec#Method_sets) of D will consist of Amethod(), Bmethod(), Cmethod() and Dmethod().

However, suppose C were defined as:

type  C  interface  {
  A
  Cmethod()
}

Generally speaking, this shouldn't change the method set of D. However, prior to Go 1.14 this would result in an error "Duplicate method Amethod" for D, because Amethod() would be declared twice - once through the embedding of B and once through the embedding of C.

[Go 1.14 fixed this](https://github.com/golang/proposal/blob/master/design/6977-overlapping-interfaces.md) and these days the new example works and just as we'd expect. The method set of D is the _union_ of the method sets of the interfaces it embeds and of its own methods.

A more practical example comes from the standard library. The type io.ReadWriteCloser is defined as:

type  ReadWriteCloser  interface  {
  Reader
  Writer
  Closer
}

But it could be defined more succinctly with:

type  ReadWriteCloser  interface  {
  io.ReadCloser
  io.WriteCloser
}

Prior to Go 1.14 this wouldn't have been possible due to the duplication of method Close() coming in from io.ReadCloser and again from io.WriteCloser.

Example: net.Error
------------------

The net package has its own error interface declared thus:

// An Error represents a network error.
type  Error  interface  {
  error
  Timeout()  bool  // Is the error a timeout?
  Temporary()  bool  // Is the error temporary?
}

Note the embedding of the built-in error interface. This embedding declares intent very clearly: a net.Error is also an error. Readers of the code wondering whether they can treat it as such have an immediate answer, instead of having to look for a declaration of an Error() method and mentally compare it to the canonical one in error.

Example: heap.Interface
-----------------------

The heap package has the following interface declared for client types to implement:

type  Interface  interface  {
  sort.Interface
  Push(x  interface{})  // add x as element Len()
  Pop()  interface{}  // remove and return element Len() - 1.
}

All types implementing heap.Interface must also implement sort.Interface; the latter requires 3 methods, so writing heap.Interface without the embedding would look like:

type  Interface  interface  {
  Len()  int
  Less(i,  j  int)  bool
  Swap(i,  j  int)
  Push(x  interface{})  // add x as element Len()
  Pop()  interface{}  // remove and return element Len() - 1.
}

The version with the embedding is superior on many levels. Most importantly, it makes it immediately clear that a type has to implement sort.Interface first; this information is much more tricky to pattern-match from the longer version.