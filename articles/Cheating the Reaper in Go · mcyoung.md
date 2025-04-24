# Cheating the Reaper in Go · mcyoung
Even though I am a C++ programmer at heart, Go fascinates me for none of the reasons you think. Go has made several interesting design decisions:

1.  It has virtually no Undefined Behavior[1](#fn:goub).
    
2.  It has very simple GC semantics that they’re mostly stuck with due to design decisions in the surface language.
    

These things mean that despite Go having a GC, it’s possible to do manual memory management in pure Go and in cooperation with the GC (although without any help from the `runtime` package). To demonstrate this, we will be building an untyped, garbage-collected arena abstraction in Go which relies on several GC implementation details.

I would never play this kind of game in Rust or C++, because LLVM is extremely intelligent and able to find all kinds of ways to break you over the course of frequent compiler upgrades. On the other hand, although Go does not promise any compatibility across versions for code that imports `unsafe`, in practice, two forces work against Go doing this:

1.  Go does not attempt to define what is and isn’t allowed: `unsafe` lacks any [operational semantics](https://en.wikipedia.org/wiki/Operational_semantics).
    
2.  Go prioritizes not breaking the ecosystem; this allows to assume that [Hyrum’s Law](https://www.hyrumslaw.com/) will protect certain observable behaviors of the runtime, from which we may infer what can or cannot break easily.
    

This is in contrast to a high-performance native compiler like LLVM, which has a carefully defined boundary around all UB, allowing them to arbitrarily break programs that cross it (mostly) without fear of breaking the ecosystem.

So, let’s dive in and cheat death.

[What Are We Building?](#what-are-we-building)
----------------------------------------------

Our goal is to build an _arena_, which is a data structure for efficient allocation of memory that has the same lifetime. This reduces pressure on the general-purpose allocator by only requesting memory in large chunks and then freeing it all at once.

For a comparison in Go, consider the following program:

```go
package main

import "fmt"

func main() {
  var s []int
  for i := range 1000 {
    prev := cap(s)
    s = append(s, i)
    if cap(s) != prev {
      fmt.Println(cap(s))
    }
  }
}
```

This program will print successive powers of 2: this is because `append` is implemented approximately like so:

```go
func append[S ~[]T, T any](a, b S) S {
  // If needed, grow the allocation.
  if cap(a) - len(a) < len(b) {
    // Either double the size, or allocate just enough if doubling is
    // too little.
    newCap := max(2*cap(a), len(a)+len(b))

    // Grow a.
    a2 := make([]T, len(a), newCap)
    copy(a2, a)
    a = a2
  }

  // Increase the length of a to fit b, then write b into the freshly
  // grown region.
  a = a[:len(a)+len(b)]
  copy(a[len(a)-len(b):], b)
  return a
}
```

For appending small pieces, `make` is only called O(log⁡n)O(\\log n) times, a big improvement over calling it for every call to `append`. Virtually every programming language’s dynamic array abstraction makes this optimization.

An arena generalizes this concept, but instead of resizing exponentially, it allocates _new_ blocks and vends pointers into them. The interface we want to conform to is as follows:

```go
type Allocator interface {
  Alloc(size, align uintptr) unsafe.Pointer
}
```

In go a size and and an alignment, out comes a pointer fresh memory with that layout. Go does not have user-visible uninitialized memory, so we additionally require that the returned region be zeroed. We also require that `align` be a power of two.

We can give this a type-safe interface by writing a generic `New` function:

```go
// New allocates a fresh zero value of type T on the given allocator, and
// returns a pointer to it.
func New[T any](a Allocator) *T {
  var t T
  p := a.Alloc(unsafe.Sizeof(t), unsafe.Alignof(t))
  return (*T)(p)
}
```

This all feels very fine and dandy to anyone used to hurting themselves with `malloc` or `operator new` in C++, but there is a small problem. What happens when we allocate pointer-typed memory into this allocator?

```go
// Allocate a pointer in our custom allocator, and then
// initialize it to a pointer on the Go heap.
p := New[*int](myAlloc)
*p = new(int)

runtime.GC()
**p = 42  // Use after free!
```

`Allocator.Alloc` takes a size and an alignment, which is sufficient to describe the _layout_ of any type. For example, on 64-bit systems, `int` and `*int` have the same layout: 8 bytes of size, and 8 bytes of alignment.

However, the Go GC (and all garbage collectors, generally) require one additional piece of information, which is somewhere between the layout of a value (how it is placed in memory) and the type of a value (rich information on its structure). To understand this, we need a brief overview on what a GC does.

[Mark and Sweep](#mark-and-sweep)
---------------------------------

> For a complete overview on how to build a simple GC, take a look at a toy GC I designed some time ago: [The Alkyne GC](https://mcyoung.xyz/2022/06/07/alkyne-gc/).

A garbage collector’s responsibility is to maintain a memory allocator and an accounting of:

1.  What memory has been allocated.
2.  Whether that memory is still in use.

Memory that is not in use can be reclaimed and marked as unallocated, for re-use.

The most popular way to accomplish this is via a “mark and sweep” architecture. The GC will periodically walk the entire object graph of the program from certain pre-determined _roots_; anything it finds is “marked” as alive. After a mark is complete, all other memory is “swept”, which means to mark it is unallocated for future re-use, or to return it to the OS, in the case of significant surplus.

The roots are typically entities that are actively being manipulated by the program. In the case of Go, this is anything currently on the stack of some G[2](#fn:g), or anything in a global (of which there is a compile-time-known set).

The marking phase begins with _stack scanning_, which looks at the stack of each G and locates any pointers contained therein. The Go compiler generates metadata for each function that specifies which stack slots in a function’s frame contain pointers. All of these pointers are live by definition.

These pointers are placed into a queue, and each pointer is traced to its allocation on the heap. If the GC does not know anything about a particular address, it is discarded as foreign memory that does not need to be marked. If it does, each pointer in that allocation is pushed onto the queue if it has not already been marked as alive. The process continues until the queue is empty.

The critical step here is to take the address of some allocation, and convert it into all of the pointer values within. Go has precise garbage collection, which means that it only treats things declared as pointers in the surface language as pointers: an integer that happens to look like an address will not result in sweeping. This results in more efficient memory usage, but trades off some more complexity in the GC.

For example, the types `*int`, `map[int]byte`, `string`, `struct {A int; B *int}` all contain at least one pointer, while `int`, `[1000]byte`, `struct {X bool; F uintptr}` do not. The latter are called _pointer-free_ types.

Go enhances the layout of a type into a _shape_ by adding a bitset that specifies which pointer-aligned, pointer-sized words of the type’s memory region contain a pointer. These are called the _pointer bits_. For example, here are the shapes of a few Go types on a 64-bit system.

| Type | Size/Align | Pointer Bits[3](#fn:ptr-bits-endian) |
| --- | --- | --- |
| `byte` | 1/1 | `0` |
| `int` | 8/8 | `0` |
| `rune` | 4/4 | `0` |
| `*int` | 8/8 | `1` |
| `unsafe.Pointer` | 8/8 | `1` |
| `string` | 16/8 | `10` |
| `[]int` | 24/8 | `100` |
| `[3]string` | 48/8 | `101010` |
| `map[int]byte` | 8/8 | `1` |
| `map[int]string` | 8/8 | `1` |
| `any` | 16/8 | `01`[4](#fn:itab) |
| `error` | 16/8 | `01` |
| `func(int) int` | 8/8 | `1` |
| `runtime.hchan`[5](#fn:hchan) | 104/8 | `0010110011110` |

In the Go GC, each allocation is tagged with its shape (this is done in a variety of ways in the GC, either through an explicit header on the allocation, itself (a “malloc header”), a runtime type stored in the allocation’s `runtime.mspan`, or another mechanism). When scanning a value, it uses this information to determine where the pointers to scan through are.

The most obvious problem with our `Allocator.Alloc` type is that it does not discriminate shapes, so it cannot allocate memory that contains pointers: the GC will not be able to find the pointers, and will free them prematurely!

In our example where we allocated an `*int` in our custom allocator, we wind up with a `**int` on the stack. You would think that Go would simply trace through the first `*` to find an `*int` and mark it as being alive, but that is not what happens! Go instead finds a pointer into some chunk that the custom allocator grabbed from the heap, which is missing the pointer bits of its shape!

Why does go not look at the type of the pointer it steps through? Two reasons.

1.  All pointers in Go are untyped from the runtime’s perspective; every `*T` gets erased into an `unsafe.Pointer`. This allows much of the Go runtime to be “generic” without using actual generics.
    
2.  Pointee metadata can be aggregated, so that each pointer to an object does not have to remember its type at runtime.
    

The end result for us is that we can’t put pointers on the arena. This makes our `New` API unsafe, especially since Go does not provide a standard constraint for marking generic parameters as pointer-free: unsurprisingly, the don’t expect most users to care about such a detail.

It _is_ possible to deduce the pointer bits of a type using reflection, but that’s very slow, and the whole point of using arenas is to go fast. As we design our arena, though, it will become clear that there is a safe way to have pointers on it.

[Designing The Arena](#designing-the-arena)
-------------------------------------------

Now that we have a pretty good understanding about what the Go GC is doing, we can go about designing a fast arena structure.

The ideal case is that a call to `Alloc` is very fast: just offsetting a pointer in the common case. One assumption we can make off the bat is that all memory can be forced to have maximum alignment: most objects are a pointer or larger, and Go does have a maximum alignment for ordinary user types, so we can just ignore the `align` parameter and always align to say, 8 bytes. This means that the pointer to the next unallocated chunk will always be well-aligned. Thus, we might come up with a structure like this one:

```go
type Arena struct {
  next      unsafe.Pointer
  left, cap uintptr
}

const (
  // Power of two size of the minimum allocation granularity.
  wordBytes = 8  // Depends on target, this is for 64-bit.
  minWords  = 8
)

func (a *Arena) Alloc(size, align uintptr) unsafe.Pointer {
  // First, round the size up to the alignment of every object in
  // the arena.
  mask := wordBytes - 1
  size = (size + mask) &^ mask
  // Then, replace the size with the size in pointer-sized words.
  // This does not result in any loss of size, since size is now
  // a multiple of the uintptr size.
  words := size / wordBytes

  // Next, check if we have enough space left for this chunk. If
  // there isn't, we need to grow.
  if a.left < words {
    // Pick whichever is largest: the minimum allocation size,
    // twice the last allocation, or the next power of two
    // after words.
    a.cap = max(minWords, a.cap*2, nextPow2(words))
    a.next = unsafe.Pointer(unsafe.SliceData(make([]uintptr, a.cap)))
    a.left = a.cap
  }

  // Allocate the chunk by incrementing the pointer.
  p := a.next
  a.left -= words
  if a.left > 0 {
    a.next = unsafe.Add(a.next, size)
  } else {
    // Beware, offsetting to one-past-the-end is one of the few
    // things explicitly not allowed by Go.
    a.next = nil
  }

  return p
}

// nextPow2 returns the smallest power of two greater than n.
func nextPow2(n uintptr) uintptr {
  return uintptr(1) << bits.Len(uint(n))
}
```

How fast is this really? Here’s a simple benchmark for it.

```go
func BenchmarkArena(b *testing.B) {
  bench[int](b)
  bench[[2]int](b)
  bench[[64]int](b)
  bench[[1024]int](b)
}

const runs = 100000

var sink any

func bench[T any](b *testing.B) {
  var z T
  n := int64(runs * unsafe.Sizeof(z))
  name := fmt.Sprintf("%v", reflect.TypeFor[T]())

  b.Run(name, func(b *testing.B) {
    b.Run("arena", func(b *testing.B) {
      b.SetBytes(n)
      for b.Loop() {
        a := new(arena.Arena)
        for range runs {
          sink = arena.New[T](a)
        }
      }
    })

    b.Run("new", func(b *testing.B) {
      b.SetBytes(n)
      for b.Loop() {
        for range runs {
          sink = new(T)
        }
      }
    })
  })
}
```

The focus of this benchmark is to measure the cost of allocating many objects of the same size. The number of times the `for b.Loop()` loop will execute is unknown, and determined by the benchmarking framework to try to reduce statistical anomaly. This means that if we instead just benchmark a single allocation, the result will be _very_ sensitive to the number of runs.

We also use `b.SetBytes` to get a throughput measurement on the benchmark. This is a bit easier to interpret than the gross `ns/op`, the benchmark would otherwise produce. It tells us how much memory each allocator can allocate per unit time.

We want to compare against `new`, but just writing `_ = new(T)` will get optimized out, since the resulting pointer does not escape. Writing it to a global is sufficient to convince Go that it escapes.

Here’s the results, abbreviated to show only the bytes per second. All benchmarks were performed on my AMD Ryzen Threadripper 3960X. Larger is better.

```console
BenchmarkArena/int/arena-48         794.84 MB/s
BenchmarkArena/int/new-48           390.59 MB/s
BenchmarkArena/[2]int/arena-48      1263.58 MB/s
BenchmarkArena/[2]int/new-48        528.06 MB/s
BenchmarkArena/[64]int/arena-48     7370.08 MB/s
BenchmarkArena/[64]int/new-48       2865.24 MB/s
BenchmarkArena/[1024]int/arena-48   9889.20 MB/s
BenchmarkArena/[1024]int/new-48     2875.75 MB/s
```

This is quite nice, and certainly worth pursuing! The performance increase seems to scale up with the amount of memory allocated, for a 2x-4x improvement across different cases.

Now we need to contend with the fact that our implementation is completely broken if we want to have pointers in it.

### [Not Dropping Memory on the Ground](#not-dropping-memory-on-the-ground)

In `(*Arena).Alloc`, when we assign a freshly-allocated chunk, we overwrite `a.next`, which means the GC can reclaim it. But this is fine: as long as pointers into that arena chunk are alive, the GC will not free it, independent of the arena. So it seems like we don’t need to worry about it?

However, the whole point of an arena is to allocate lots of memory that has the same lifetime. This is common for graph data structures, such as an AST or a compiler IR, which performs a lot of work that allocates a lot and then throws the result away.

We are not allowed to put pointers in the arena, because they would disappear from the view of the GC and become freed too soon. But, if a pointer wants to go on an arena, it necessarily outlive the whole arena, since it outlives part of the arena, and the arena is meant to have the same lifetime.

In particular, if we could make it so that holding any pointer returned by `Alloc` prevents the _entire arena_ from being swept by the GC, the arena can safely contain pointers into itself! Consider this:

1.  We have a pointer `p **int`. It is allocated on some arena `a`.
    
2.  The GC sees our pointer (as a type-erased `unsafe.Pointer`) and marks its allocation as live.
    
3.  Somehow, the GC also marks `a` as alive as a consequence.
    
4.  Somehow, the GC then marks every chunk `a` has allocated as alive.
    
5.  Therefore he chunk that `*p` points to is also alive, so `*p` does not need to be marked directly, and will not be freed early.
    

The step (3) is crucial. By forcing the whole arena to be marked, any pointers stored in the arena into itself will be kept alive automatically, without the GC needing to know how to scan for them.

So, even though `*New[*int](a) = new(int)` is still going to result in a use-after-free, `*New[*int](a) = New[int](a)` would not! This small improvement does not make arenas themselves safe, but a data structure with an internal arena can be completely safe, so long as the only pointers that go into the arena are from the arena itself.

How can we make this work? The easy part is (4), which we can implement by adding a `[]unsafe.Pointer` to the arena, and sticking every pointer we allocate into it.

```go
type Arena struct {
  next      unsafe.Pointer
  left, cap uintptr

  chunks []unsafe.Pointer  // New field.
}

func (a *Arena) Alloc(size, align uintptr) unsafe.Pointer {
  // ... snip ...
  if a.left < words {
    // Pick whichever is largest: the minimum allocation size,
    // twice the last allocation, or the next power of two
    // after words.
    a.cap = max(minWords, a.cap*2, nextPow2(words))
    a.next = unsafe.Pointer(unsafe.SliceData(make([]uintptr, a.cap)))
    a.left = a.cap
    a.chunks = append(a.chunks, a.next)
  }
  // ... snip ...
}
```

The cost of the `append` is amortized: to allocate `n` bytes, we wind up allocating an additional O(log⁡log⁡n)O(\\log \\log n) times. But what does this do to our benchmarks?

```console
BenchmarkArena/int/arena-48         800.08 MB/s
BenchmarkArena/int/new-48           386.81 MB/s
BenchmarkArena/[2]int/arena-48      1236.00 MB/s
BenchmarkArena/[2]int/new-48        520.84 MB/s
BenchmarkArena/[64]int/arena-48     7999.71 MB/s
BenchmarkArena/[64]int/new-48       2706.68 MB/s
BenchmarkArena/[1024]int/arena-48   9998.00 MB/s
BenchmarkArena/[1024]int/new-48     2816.28 MB/s
```

Seems pretty much the same, which is a good sign.

### [Back Pointers](#back-pointers)

Now that the arena does not discard any allocated memory, we can focus on condition (3): making it so that if any pointer returned by `Alloc` is alive, then so is the whole arena.

Here we can make use of an important property of how Go’s GC works: any pointer into an allocation will keep it alive, as well as _anything reachable from that pointer_. But the chunks we’re allocating are `[]uintptr`s, which will not be scanned. If there could _somehow_ be a single pointer in this slice that was scanned, we would be able to stick the pointer `a *Arena` there, and so when anything that `Alloc` returns is scanned, it would cause `a` to be marked as alive.

So far, we have been allocating `[N]uintptr` using `make([]T)`, but we would actually like to allocate `struct { A [N]uintptr; P unsafe.Pointer }`, where `N` is some dynamic value.

In its infintie wisdom, the Go standard library actually gives us a dedicated mechanism to do this: `reflect.StructOf`. This can be used to construct arbitrary anonymous `struct` types at runtime, which we can then allocate on the heap.

So, instead of calling `make`, we might call this function:

```go
func (a *Arena) allocChunk(words uintptr) unsafe.Pointer {
  chunk := reflect.New(reflect.StructOf([]reflect.StructField{
    {
      Name: "X0",
      Type: reflect.ArrayOf(int(words), reflect.TypeFor[uintptr]()),
    },
    {Name: "X1", Type: reflect.TypeFor[unsafe.Pointer]()},
  })).UnsafePointer()

  // Offset to the end of the chunk, and write a to it.
  end := unsafe.Add(chunk, words * unsafe.Sizeof(uintptr(0)))
  *(**Arena)(end) = a

  return chunk
}
```

This appears to have a minor but noticeable effect on performance[6](#fn:type-cache).

```console
BenchmarkArena/int/arena-48         763.91 MB/s
BenchmarkArena/int/new-48           385.49 MB/s
BenchmarkArena/[2]int/arena-48      1174.00 MB/s
BenchmarkArena/[2]int/new-48        524.32 MB/s
BenchmarkArena/[64]int/arena-48     7563.54 MB/s
BenchmarkArena/[64]int/new-48       2649.63 MB/s
BenchmarkArena/[1024]int/arena-48   8668.02 MB/s
BenchmarkArena/[1024]int/new-48     2648.10 MB/s
```

[More Optimizations](#more-optimizations)
-----------------------------------------

Looking back at `Arena.Alloc`, the end of this function has a branch:

```go
func (a *Arena) Alloc(size, align uintptr) unsafe.Pointer {
  // ... snip...

  // Allocate the chunk by incrementing the pointer.
  p := a.next
  a.left -= words
  if a.left > 0 {
    a.next = unsafe.Add(a.next, size)
  } else {
    // Beware, offsetting to one-past-the-end is one of the few
    // things explicitly not allowed by Go.
    a.next = nil
  }

  return p
}
```

This is the absolute hottest part of allocation, since it is executed every time we call this function. The branch is a bit unfortunate, but it’s necessary, as noted by the comment.

In C++, if we have an array of `int` with `n` elements in it, and `int* p` is a pointer to the start of the array, `p + n` is a valid pointer, even though it can’t be dereferenced; it points “one past the end” of the array. This is a useful construction, since, for example, you can use it to eliminate a loop induction variable:

```c--
// Naive for loop, has an induction variable i.
for (int i = 0; i < n; i++) {
  do_something(p[i]);
}

// Faster: avoids the extra variable increment in the loop
// body for doing p[i].
for (auto end = p + n; p < end; p++) {
  do_something(*p);
}
```

Go, however, gets very upset if you do this, because it confuses the garbage collector. The GC can’t tell the difference between a one-past-the-end pointer for allocation A, and for the start of allocation B immediately after it. At best this causes memory to stay alive for longer, and at worst it triggers safety interlocks in the GC. The GC will panic if it happens to scan a pointer for an address that it knows has been freed.

But in our code above, every chunk now has an extra element at the very end that is not used for allocation, so we _can_ have a pointer that _is_ one-past-the-end of the `[N]uintptr` that we are vending memory from.

The updated allocation function would look like this:

```go
func (a *Arena) Alloc(size, align uintptr) unsafe.Pointer {
  // ... snip ...

  // Allocate the chunk by incrementing the pointer.
  p := a.next
  a.next = unsafe.Add(a.next, size)
  a.left -= words

  return p
}
```

Notably, we do not replace `a.left` with an end pointer, because of the `if a.left < words` comparison. We can’t actually avoid the subtraction `a.left -= words` because we would have to do it to make this comparison work if we got rid of `a.left`.

So how much better is this?

```console
BenchmarkArena/int/arena-48         780.07 MB/s
BenchmarkArena/int/new-48           383.16 MB/s
BenchmarkArena/[2]int/arena-48      1245.73 MB/s
BenchmarkArena/[2]int/new-48        530.39 MB/s
BenchmarkArena/[64]int/arena-48     7684.39 MB/s
BenchmarkArena/[64]int/new-48       2679.94 MB/s
BenchmarkArena/[1024]int/arena-48   8859.99 MB/s
BenchmarkArena/[1024]int/new-48     2611.33 MB/s
```

Remarkably, not very! This is an improvement on the order of magnitude of one or two percentage points. This is because the branch we deleted is extremely predictable. Because Go’s codegen is relatively mediocre, the effect of highly predictable branches (assuming Go actually schedules the branches correctly 🙄) is quite minor.

Turns out there’s a bigger improvement we can make.

### [Write Barriers](#write-barriers)

Here’s the assembly Go generated for this function, heavily abridged, and annotated with the corresponding Go source code.

```llvm
TEXT (*Arena).Alloc(SB)
  CMPQ    SP, 0x10(R14)
  JBE     moreStack  ; Stack growth prologue.
  PUSHQ   BP
  MOVQ    SP, BP
  SUBQ    $0x58, SP

  ; size = (size + mask) &^ mask
  LEAQ    0x7(BX), DX
  ANDQ    $-0x8, DX
  ; words := size / wordBytes
  MOVQ    DX, SI
  SHRQ    $0x3, DX

  ; if a.left < words
  CMPQ    0x8(AX), DX
  JAE     alloc

  MOVQ    AX, 0x68(SP)
  MOVQ    SI, 0x48(SP)
  MOVQ    DX, 0x40(SP)

  ; nextPow2(words)
  MOVZX   runtime.x86HasPOPCNT(SB), DI
  TESTL   DI, DI
  JE      1f
  XORL    DI, DI
  POPCNTQ DX, DI
  JMP     2f
1:
  MOVQ    DX, AX
  CALL    math/bits.OnesCount(SB)
  MOVQ    0x40(SP), DX
  MOVQ    0x48(SP), SI
  MOVQ    AX, DI
  MOVQ    0x68(SP), AX
2:
  CMPQ    DI, $0x1
  JE      1f
  BSRQ    DX, CX
  MOVQ    $-0x1, DI
  CMOVE   DI, CX
  INCQ    CX
  MOVL    $0x1, DI
  SHLQ    CL, DI
  CMPQ    CX, $0x40
  SBBQ    R8, R8
  ANDQ    R8, DI
  MOVQ    DI, DX
1:
  MOVQ    0x10(AX), CX
  SHLQ    $0x1, CX

  ; a.cap = max(minWords, a.cap*2, nextPow2(words))
  CMPQ    CX, $0x8
  MOVL    $0x8, BX
  CMOVA   CX, BX
  CMPQ    DX, BX
  CMOVA   DX, BX
  MOVQ    BX, 0x10(AX)

  ; a.next = a.allocChunk(a.cap)
  CALL    github.com/mcy/go-arena.(*Arena).allocChunk(SB)
  CMPL    runtime.writeBarrier(SB), $0x0
  JNE     1f
  MOVQ    0x68(SP), DX
  JMP     2f
1:
  CALL    runtime.gcWriteBarrier2(SB)
  MOVQ    AX, 0(R11)
  MOVQ    0x68(SP), DX
  MOVQ    0(DX), R8
  MOVQ    R8, 0x8(R11)
2:
  MOVQ    AX, 0(DX)

  ; a.left = a.cap
  MOVQ    0x10(DX), R8
  MOVQ    R8, 0x8(DX)
  MOVQ    0x28(DX), CX
  MOVQ    0x20(DX), BX
  INCQ    BX
  MOVQ    0x18(DX), R8
  CMPQ    CX, BX
  JAE     2f

  ; a.chunks = append(a.chunks, a.next)
  MOVQ    AX, 0x50(SP)
  MOVQ    R8, AX
  MOVL    $0x1, DI
  LEAQ    0x28f70(IP), SI
  CALL    runtime.growslice(SB)
  MOVQ    0x68(SP), DX
  MOVQ    CX, 0x28(DX)
  CMPL    runtime.writeBarrier(SB), $0x0
  JE      1f
  CALL    runtime.gcWriteBarrier2(SB)
  MOVQ    AX, 0(R11)
  MOVQ    0x18(DX), CX
  MOVQ    CX, 0x8(R11)
1:
  MOVQ    AX, 0x18(DX)
  MOVQ    AX, R8
  MOVQ    0x50(SP), AX
2:
  MOVQ    BX, 0x20(DX)
  CMPL    runtime.writeBarrier(SB), $0x0
  JE      1f
  CALL    runtime.gcWriteBarrier2(SB)
  MOVQ    AX, 0(R11)
  MOVQ    -0x8(R8)(BX*8), CX
  MOVQ    CX, 0x8(R11)
1:
  MOVQ    AX, -0x8(R8)(BX*8)
  MOVQ    DX, AX
  MOVQ    0x40(SP), DX
  MOVQ    0x48(SP), SI

alloc:
  ; p := a.next
  MOVQ    0(AX), CX

  ; a.next = unsafe.Add(a.next, size)
  LEAQ    0(CX)(SI*1), BX
  CMPL    runtime.writeBarrier(SB), $0x0
  JE      1f
  CALL    runtime.gcWriteBarrier2(SB)
  MOVQ    BX, 0(R11)
  MOVQ    0(AX), SI
  MOVQ    SI, 0x8(R11)
1:
  MOVQ    BX, 0(AX)

  ; a.left -= words
  LEAQ    0(CX)(SI*1), BX
  SUBQ    DX, 0x8(AX)

  ; return p
  MOVQ    CX, AX
  ADDQ    $0x58, SP
  POPQ    BP
  RET
```

There’s a lot going on in this function, but most of it is a mix of Go not being great at register allocation, and lots of _write barriers_.

A write barrier is a mechanism for synchronizing ordinary user code with the GC. Go generates code for one any time a non-pointer-free type is stored. For example, writing to a `**int`, `*string`, or `*[]int` requires a write barrier.

Write barriers are implemented as follows:

1.  `runtime.writeBarrier` is checked, which determines whether the write barrier is necessary, which is only when the GC is in the mark phase. Otherwise the branch is taken to skip the write barrier.
    
2.  A call to one of the `runtime.gcWriteBarrierN` functions happens. `N` is the number of pointers that the GC needs to be informed of.
    
3.  This function calls `runtime.gcWriteBarrier`, which returns a buffer onto which pointers the GC needs to now trace through should be written to.
    
4.  The actual store happens.
    

A write barrier is required for a case like the following. Consider the following code.

```go
func alloc(n **int) {
  *n = new(int)
}
```

This function will call `runtime.newobject` to allocate eight bytes of memory. The resulting pointer will be returned in `rax`. This function then stores `rax` into `n` and returns. If we Godbolt this function, we’ll find that it does, in fact, generate a write barrier:

```llvm
TEXT x.alloc
  CMPQ    SP, 16(R14)
  JLS     growStack
  PUSHQ   BP
  MOVQ    SP, BP
  SUBQ    $16, SP

  MOVQ    AX, main.n+32(SP)

  ; new(int)
  LEAQ    type:int(SB), AX
  CALL    runtime.newobject(SB)

  MOVQ    main.n+32(SP), CX
  TESTB   AL, (CX)

  ; This is the write barrier.
  CMPL    runtime.writeBarrier(SB), $0
  JEQ     skip
  MOVQ    (CX), DX
  CALL    runtime.gcWriteBarrier2(SB)
  MOVQ    AX, (R11)
  MOVQ    DX, 8(R11)
skip:
  MOVQ    AX, (CX)  ; The actual store.

  ADDQ    $16, SP
  POPQ    BP
  RET

growStack:
  NOP
  MOVQ    AX, 8(SP)
  CALL    runtime.morestack_noctxt(SB)
  MOVQ    8(SP), AX
  JMP     x.alloc
```

Note that two pointers get written: the pointer returned by `new(int)`, and the old value of `*n`. This ensures that regardless of where in this function the GC happens to be scanning through `*n`, it sees both values during the mark phase.

Now, this isn’t necessary if the relevant pointers are already reachable in some other way… which is exactly the case in our arena (thanks to the `chunks` slice). So the write barrier in the fast path is redundant.

But, how do we get rid of it? There is `//go:nowritebarrier`, but that’s not allowed outside of a list of packages allowlisted in the compiler. It also doens’t disable write barriers; it simply generates a diagnostic if any are emitted.

But remember, write barriers only occur when storing pointer-typed memory… so we can just replace `next unsafe.Pointer` with `next uintptr`.

```go
type Arena struct {
  next      uintptr // A real pointer!
  left, cap uintptr

  chunks []unsafe.Pointer
}

func (a *Arena) Alloc(size, align uintptr) unsafe.Pointer {
  mask := wordBytes - 1
  size = (size + mask) &^ mask
  words := size / wordBytes

  if a.left < words {
    a.cap = max(minWords, a.cap*2, nextPow2(words))

    p := a.allocChunk(a.cap)
    a.next = uintptr(p)
    a.left = a.cap
    a.chunks = append(a.chunks, p)
  }

  p := a.next
  a.next += size
  a.left -= words

  return unsafe.Pointer(p)
}
```

`go vet` hates this, because it doesn’t know that we’re smarter than it is. Does This make the code faster? To make it a little bit more realistic, I’ve written a separate variant of the benchmarks that hammers the GC really hard in a separate G:

```go
go func() {
  for { runtime.GC() }
}()
```

The result indicates that this is a worthwhile optimization for churn-heavy contexts. Performance is much worse overall, but that’s because the GC is pre-empting everyone. The improvement seems to be on the order of 20% for very small allocations.

```console
# Before
BenchmarkArena/int/arena-48         169.09 MB/s
BenchmarkArena/int/new-48           84.73 MB/s
BenchmarkArena/[2]int/arena-48      309.40 MB/s
BenchmarkArena/[2]int/new-48        120.23 MB/s
BenchmarkArena/[64]int/arena-48     1954.16 MB/s
BenchmarkArena/[64]int/new-48       950.48 MB/s
BenchmarkArena/[1024]int/arena-48   3341.13 MB/s
BenchmarkArena/[1024]int/new-48     1413.26 MB/s

# After
BenchmarkArena/int/arena-48         195.58 MB/s
BenchmarkArena/int/new-48           83.67 MB/s
BenchmarkArena/[2]int/arena-48      352.49 MB/s
BenchmarkArena/[2]int/new-48        120.13 MB/s
BenchmarkArena/[64]int/arena-48     1987.22 MB/s
BenchmarkArena/[64]int/new-48       903.78 MB/s
BenchmarkArena/[1024]int/arena-48   3342.67 MB/s
BenchmarkArena/[1024]int/new-48     1439.99 MB/s
```

### [Cutting Out The Heap Entirely](#cutting-out-the-heap-entirely)

Another source of slowdown is the fact that any time we allocate from the heap, it’s forced to eagerly clear the huge allocated chunk every time, because it contains pointers. If you profile this code, a ton of time is spent in `runtime.memclrNoHeapPointers`. Because the chunks of memory we allocate are always of a specific size, we can use an array of `sync.Pool`s to amortize the cost of allocating and clearing chunks.

First, we need an entry in this array of pools, one for each size of memory we allocate. Then, we need to set a finalizer on the arena to reclaim its memory once we’re done. Finally, we can change the contract of `Alloc` to require the caller to clear the value for us, and change `New` take a value as its argument:

```go
func New[T any](a Allocator, v T) *T {
  p := (*T)(a.Alloc(unsafe.Sizeof(v), unsafe.Alignof(v)))
  *p = v
  return p
}
```

What’s nice about this is that it avoids having to clear the value if a non-zero value would be allocated to it instead.

Putting this all together, it would look like this:

```go
var pools [64]sync.Pool

func init() {
  for i := range pools {
    pools[i].New = func() any {
      return reflect.New(reflect.StructOf([]reflect.StructField{
        {
          Name: "A",
          Type: reflect.ArrayOf(1<<i, reflect.TypeFor[uintptr]()),
        },
        {Name: "P", Type: reflect.TypeFor[unsafe.Pointer]()},
      })).UnsafePointer()
    }
  }
}

func (a *Arena) allocChunk(words uintptr) unsafe.Pointer {
  log := bits.TrailingZeros(uint(words))
  chunk := pools[log].Get().(unsafe.Pointer)

  // Offset to the end of the chunk, and write a to it.
  end := unsafe.Add(chunk, words*unsafe.Sizeof(uintptr(0)))
  *(**Arena)(end) = a

  // If this is the first chunk allocated, set a finalizer.
  if a.chunks == nil {
    runtime.SetFinalizer(a, (*Arena).finalize)
  }

  // Place the returned chunk at the offset in a.chunks that
  // corresponds to its log, so we can identify its size easily
  // in the loop above.
  a.chunks = append(a.chunks, make([]unsafe.Pointer, log+1-len(a.chunks))...)
  a.chunks[log] = chunk

  return chunk
}

func (a *Arena) finalize() {
  for log, chunk := range a.chunks {
    if chunk == nil {
      continue
    }

    words := uintptr(1) << log
    end := unsafe.Add(chunk, words*unsafe.Sizeof(uintptr(0)))
    *(**Arena)(end) = nil // Make sure that we don't leak the arena.

    pools[log].Put(chunk)
  }
}
```

How does this perform?

```console
BenchmarkArena/int/arena-48        1260.73 MB/s
BenchmarkArena/int/new-48          712.94 MB/s
BenchmarkArena/[2]int/arena-48     2457.27 MB/s
BenchmarkArena/[2]int/new-48       1167.57 MB/s
BenchmarkArena/[64]int/arena-48    4491.49 MB/s
BenchmarkArena/[64]int/new-48      6800.76 MB/s
BenchmarkArena/[1024]int/arena-48  3992.32 MB/s
BenchmarkArena/[1024]int/new-48    4320.65 MB/s
```

Well. That’s a surprise. It does much better for small allocations, but it made really big allocations worse! It’s not immediately clear to me why this is, but note that `new` also got _much_ faster, which tells me that because the allocations from the arena are longer-lived, the GC behaves somewhat differently, causing some of the cost from allocating really large things with `new` to be amortized.

Whether this optimization makes sense would require some profiling. An alternative is to manually manage arena re-use, by adding a very unsafe `Reset()` function that causes the arena to behave as if it was just constructed, but _keeping all of its allocated chunks_. This is analogous to reslicing to zero: `x = x[:0]`.

This is very unsafe because it can lead to the same memory being allocated twice: this is _only_ ok if the memory is not re-used.

Implementing this is very simple.

```go
func (a *Arena) Reset() {
  a.next, a.left, a.cap = 0, 0, 0
}

func (a *Arena) allocChunk(words uintptr) unsafe.Pointer {
  log := bits.TrailingZeros(uint(words))
  if len(a.chunks) > log {
    // If we've already allocated a chunk of this size in a previous arena
    // generation, return it.
    //
    // This relies on the fact that an arena never tries to allocate the same
    // size of chunk twice between calls to Reset().
    return a.chunks[log]
  }

  // ... snip ...
}
```

Then, if we modify our arena benchmark to take advantage of this…

```go
b.Run("arena", func(b *testing.B) {
  b.SetBytes(n)
  a := new(arena.Arena)
  for b.Loop() {
    a.Reset()  // Important!
    for range runs {
      sink = arena.New[T](a)
    }
  }
})
```

What does the performance look like now?

```console
BenchmarkArena/int/arena-48         2376.01 MB/s
BenchmarkArena/int/new-48           377.64 MB/s
BenchmarkArena/[2]int/arena-48      4314.98 MB/s
BenchmarkArena/[2]int/new-48        530.62 MB/s
BenchmarkArena/[64]int/arena-48     10496.49 MB/s
BenchmarkArena/[64]int/new-48       3959.85 MB/s
BenchmarkArena/[1024]int/arena-48   9735.19 MB/s
BenchmarkArena/[1024]int/new-48     6160.73 MB/s
```

That’s a massive improvement! There’s a couple of reasons this is faster. First, it doesn’t require waiting for the GC to collect old arenas to make their memory get reused. Second, the fast path is _very_ fast with no synchronization.

On the flipside, this is very dangerous: arena re-use needs to be carefully managed, because you can wind up with unique pointers that aren’t.

### [Realloc](#realloc)

Go does not offer an easy mechanism to “reallocate” an allocation, as with `realloc()` in C. This is because it has no mechanism for freeing pointers explicitly, which is necessary for a reallocation abstraction.

But we already don’t care about safety, so we can offer reallocation on our arena. Now, the reallocation we can offer is quite primitive: if a chunk happens to be the most recent one allocated, we can grow it. Otherwise we just allocate a new chunk and don’t free the old one.

This makes it possible to implement “arena slices” that can be constructed by appending, which will not trigger reallocation on slice growth as long as nothing else gets put on the arena.

`Realloc` would look something like this:

```go
func (a *Arena) Realloc(
  ptr unsafe.Pointer,
  oldSize, newSize, align uintptr,
) unsafe.Pointer {
  mask := wordBytes - 1
  oldSize = (oldSize + mask) &^ mask
  newSize = (newSize + mask) &^ mask

  if newSize <= oldSize {
    return ptr
  }

  // Check if this is the most recent allocation. If it is,
  // we can grow in-place.
  if a.next - oldSize == uintptr(ptr) {
    // Check if we have enough space available for the
    // requisite extra space.
    need := (newSize - oldSize) / wordBytes
    if a.left >= need {
      // Grow in-place.
      a.left -= need
      return ptr
    }
  }

  // Can't grow in place, allocate new memory and copy to it.
  new := a.Alloc(newSize, align)
  copy(
    unsafe.Slice((*byte)(new), newSize),
    unsafe.Slice((*byte)(ptr), oldSize),
  )

  return new
}
```

Then, whenever we append to our arena slice, we can call `a.Realloc()` to grow it. However, this does not work if the slice’s base pointer is not the original address returned by `Alloc` or `Realloc`. It is an exercise for the reader to:

1.  Implement a `Slice[T]` type that uses an arena for allocation.
    
2.  Make this work for any value of `ptr` within the most recent allocation, not just the base offset. This requires extra book-keeping.
    

[All Together](#all-together)
-----------------------------

Here is the entirety of the code that we have developed, not including the reallocation function above.

```go
package arena

import (
  "math/bits"
  "reflect"
  "unsafe"
)

func New[T any](a *Arena, v T) *T {
  p := (*T)(a.Alloc(unsafe.Sizeof(v), unsafe.Alignof(v)))
  *p = v
  return p
}

type Arena struct {
  next      unsafe.Pointer
  left, cap uintptr
  chunks    []unsafe.Pointer
}

const (
  maxAlign uintptr = 8 // Depends on target, this is for 64-bit.
  minWords uintptr = 8
)

func (a *Arena) Alloc(size, align uintptr) unsafe.Pointer {
  // First, round the size up to the alignment of every object in the arena.
  mask := maxAlign - 1
  size = (size + mask) &^ mask
  // Then, replace the size with the size in pointer-sized words. This does not
  // result in any loss of size, since size is now a multiple of the uintptr
  // size.
  words := size / maxAlign

  // Next, check if we have enough space left for this chunk. If there isn't,
  // we need to grow.
  if a.left < words {
    // Pick whichever is largest: the minimum allocation size, twice the last
    // allocation, or the next power of two after words.
    a.cap = max(minWords, a.cap*2, nextPow2(words))
    a.next = a.allocChunk(a.cap)
    a.left = a.cap

    a.chunks = append(a.chunks, a.next)
  }

  // Allocate the chunk by incrementing the pointer.
  p := a.next
  a.next = unsafe.Add(a.next, size)
  a.left -= words

  return p
}

func (a *Arena) Reset() {
  a.next, a.left, a.cap = 0, 0, 0
}

var pools [64]sync.Pool

func init() {
  for i := range pools {
    pools[i].New = func() any {
      return reflect.New(reflect.StructOf([]reflect.StructField{
        {
          Name: "X0",
          Type: reflect.ArrayOf(1<<i, reflect.TypeFor[uintptr]()),
        },
        { Name: "X1", Type: reflect.TypeFor[unsafe.Pointer]() },
      })).UnsafePointer()
    }
  }
}

func (a *Arena) allocChunk(words uintptr) unsafe.Pointer {
  log := bits.TrailingZeros(uint(words))
  if len(a.chunks) > log {
    return a.chunks[log]
  }

  chunk := pools[log].Get().(unsafe.Pointer)

  // Offset to the end of the chunk, and write a to it.
  end := unsafe.Add(chunk, words*unsafe.Sizeof(uintptr(0)))
  *(**Arena)(end) = a

  // If this is the first chunk allocated, set a finalizer.
  if a.chunks == nil {
    runtime.SetFinalizer(a, (*Arena).finalize)
  }

  // Place the returned chunk at the offset in a.chunks that
  // corresponds to its log, so we can identify its size easily
  // in the loop above.
  a.chunks = append(a.chunks, make([]unsafe.Pointer, log+1-len(a.chunks))...)
  a.chunks[log] = chunk

  return chunk
}

func (a *Arena) finalize() {
  for log, chunk := range a.chunks {
    if chunk == nil {
      continue
    }

    words := uintptr(1) << log
    end := unsafe.Add(chunk, words*unsafe.Sizeof(uintptr(0)))
    *(**Arena)(end) = nil // Make sure that we don't leak the arena.

    pools[log].Put(chunk)
  }
}

func nextPow2(n uintptr) uintptr {
	return uintptr(1) << bits.Len(uint(n))
}
```

There are other optimizations that we could make here that I haven’t discussed. For example, arenas could be re-used; once an arena is done, it could be “reset” and placed into a `sync.Pool`. This arena would not need to go into the GC to request new chunks, re-using the ones previously allocated (and potentially saving on the cost of zeroing memory over and over again).

I did say that this relies very heavily on Go’s internal implementation details. Whats the odds that they get broken in the future? Well, the requirement that allocations know their shape is forced by the existence of `unsafe.Pointer`, and the requirement that a pointer into any part of an allocation keeps the whole thing alive essentially comes from slices being both sliceable and mutable; once a slice escapes to the heap (and thus multiple goroutines) coordinating copies for shrinking a slice would require much more complexity than the current write barrier implementation.

And in my opinion, it’s pretty safe to say that Hyrum’s Law has us covered here. ;)