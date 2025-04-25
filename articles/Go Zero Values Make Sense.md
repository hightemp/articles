# Go Zero Values Make Sense
programming languages April 7, 2025

An attempt to visit the zero values Go in some depth

I’ve been writing [some Go code](https://github.com/pasqal-io/gousset) recently. Let’s face it: I don’t think that Go is a pragmatic language, at least by modern standards.

But in the interest of being constructive, I’ve decided to take the opposite stance and try and justify one of my sore points with the language: zero values. So, if you want to know why Go has zero values and why they make lots of sense, despite the pitfalls, you’re in the right place.

In Go, if you define a value and don’t fill it, it has a “zero value”

```null
var myString string
var myInt int
var myBool bool
var myFloat float32
var mySlice []bool
var myArray [3]bool
var myMap map[string]bool
var myPtr *bool

fmt.Println(myString) 
fmt.Println(myInt)    
fmt.Println(myBool)   
fmt.Println(myFloat)  
fmt.Println(mySlice)  
fmt.Println(myArray)  
fmt.Println(myMap)    
fmt.Println(myPtr)    

```

This expands to structs

```null
type MyStruct struct {
    SomeBool bool
    SomeInt  int
}
var myStruct MyStruct
fmt.Println(myStruct) 

```

(this, coupled with the lack of constructors in Go, is my main pain point with zero values)

This expands to interfaces

```null
type MyInterface interface {
    String() string
}
var myInterface MyInterface
fmt.Println(myInterface) 

```

(if you’ve ever written Go code, you’ll recall that `myInterface` is not exactly `nil`, it’s a fat pointer `nil`, which is something different, but that’s beyond of the scope of this blog entry)

This expands to deserialization

```null
err := json.Unmarshal([]byte(`{"SomeInt": 5}`), &myStruct)
if err != nil {
    panic(err)
}
fmt.Println(myStruct) 

```

(if you’re curious, that’s my second pain point with zero values)

This expands to reflection

```null
myType := reflect.TypeFor[MyStruct]()
myStruct := reflect.New(myType).(MyStruct)
fmt.Println(myStruct) 

```

For most types, zero values are regular values, the only exceptions I know of being `map` and `chan`.

```null
var mySlice []bool
fmt.Print(len(mySlice)) 
mySlice = append(mySlice, true)
fmt.Print(len(mySlice), " ", mySlice) 


var myMap map[string]bool
fmt.Print(len(myMap)) 
myMap["foo"] = true   

var myChan chan int
myChan <- 42 
foo := <-myChan 

```

Introducing zero values in the language is not something that the designers of Go have done accidentally. Other languages have different designs.

Non-zero values
---------------

Let’s start with C and C-like languages.

```null
#include "stdio.h"

int main() {
    int value;
    int value2;
    printf("%d %d\n", value, value2); 
                                      
}
```

In C or C++, since `value` and `value2` are uninitialized, they contain whatever laid at that place in memory for any reason.

Obviously, this is dangerous, in particular if you for some reason manipulate an uninitialized pointer (something that the C++ stdlib and recent-ish standards, for instance, do their best to eliminate).

None/undefined/null
-------------------

Now, in JavaScript and most dynamic languages, the situation is a bit different.

```null
var myValue
console.log(myValue) 

```

In JavaScript (also Java if we conveniently ignore non-reference values, etc.) the semantics of the language specify that all values are references (even if the VM doesn’t have to actually implement them as references). This gives all values a very simple default value: `undefined` (or `None` in Python, or `null` in Java).

For pointers, this is equivalent to what Go does. For structs/objects, it’s a bit different, as Go’s semantics have structs (behave as if they were) allocated on the stack, why JS, Java, …’s semantics have objects (behave as if they were) allocated on the heap.

Note that Java, just like Go, initializes the _memory_ to zero. So, a boolean that is declared but not filled will be `false` in both Java and Go. But, as mentioned, the _semantics_ of this initialization are different in the case of structs/objects.

No uninitialized values
-----------------------

Of course, Rust, Zig, C#, OCaml, Haskell, … (and yes, Java, too, depending on how you declare variables) make yet a different choice.

```null
let my_string: String;
println!("{}", my_string); 

```

In other words, you simply can’t read that memory if it hasn’t been initialized. So… is the memory zeroed (as in Java or Go) or uninitialized (as in C)? In practice, it doesn’t matter, since you cannot look at it.

If you’re really adventurous, Rust will let you check this out:

```null
use std::mem;

fn main() {
    let x: i32 = unsafe { mem::uninitialized() }; 
    println!("{}", x); 
                       
}
```

Yep, in Rust, the compiler won’t auto-initialize memory. Which, again, doesn’t matter, since you’re forced to initialize it yourself. And yes, if you’re curious, there are ways to manipulate uninitialized memory in Rust without triggering an undefined behavior (e.g. vectors delay initialization of the underlying buffer until it’s needed).

Let’s look at the following snippet:

```null
var myString *string

type MyStruct struct {
    SomeString *string
}
var myStruct MyStruct
```

In both `myString` and `myStruct`, you manipulate an uninitialized pointer. If Go adopted the C or C++ conventions, this pointer could point anywhere. This would have two pretty major consequences:

1.  The language would be much less safe, giving you the ability to accidentally read or write any place in memory.
2.  While tracing or copying the memory, the garbage-collector could end up following `myString` and accidentally end up in weird places, with consequences to both the performance of the GC (how many bogus pointers will it follow?) and its ability to reclaim unused memory.

In other words, being a garbage-collected language, at least in the case of pointers, Go could not adopt C or C++ conventions. From there, Go designers could either have decided to:

1.  force the users to initialize everything (as in Rust, Zig, C#, etc.);
2.  force the users to initialize pointers;
3.  default pointers to `nil` and adopt C or C++ conventions for everything else (as in recent versions of the C++ stdlib, if I followed correctly);
4.  default everything to zero.

So why did Go’s designers pick 4.?

If you try to implement 2. or 3., you’ll realize quickly that these are the most complex choices for a compiler or a standard library. Either the compiler would need to track which values are pointers and which aren’t (option 2. or 3.) and _initialize them differently_, or pointers would require some kind of constructors (alternative implementation of option 3.). The former is a big “no” for the design of Go, which aims to be as simple as possible (recall that by “simple”, the designers of Go mean “the language itself should focus on solving the minimal number of problems”, which translates to “short specifications”/“small compiler”, not “easy to use” – there’s an intersection, but the priority is on the former). The latter is also pretty much a “no” – the Go language works without constructors and as far as I understand, there is no plan to ever bring them in.

Also, I don’t know how high the objective of having a reflection package was in the design of Go (I kinda assume that it’s more of an accidental “look at what we can do with our vtables!” than an initial design goal), but recall that you can create values with reflection, which makes calling constructors (to properly initialize pointers to `nil` and/or properly require the user to initialize pointers)… well, at the very least much more complicated.

This left two choices: 1. or 4. Again, choice 1. required a more complex compiler, with a layer of static analysis that the Go designers didn’t want (in addition to the same difficulty with reflection). In addition, wherever possible, Go is optimized to reduce the time between the instant developers start writing code and the instant they can start debugging it. Time spent writing or fixing constructors was most likely considered an impediment to this, even if it reduced the number of reasons to start the debugger in the first place.

So they went with 4[1](#fn:1).

At some point in the design of Go, this rule of “zero everything” was enshrined.

> 1.  In Go, all values are zeroed.

How do you implement this in a compiler? Well, basically, you `memset` everything to the actual value `0`. That’s easy to do, that’s cheap[2](#fn:2), and that’s one problem solved.

> 2.  The zero value is actually represented by zero in memory.

The first consequence was that the memory value represented by a sequence of `0`s had to be valid for every type:

*   For pointers, this was obviously `nil`, as in pretty much every language.
*   For other flat values, there is a trivial mapping, since `false` is represented by `0` in memory, `0.00000` is represented by `0` in memory, etc.

The case of `struct`
--------------------

For `struct`, the designers had two possibilities.

First, they could have followed Java, Python, etc. and decided that all `struct`s behaved as pointers, and consequently that a zero `struct` is `nil`. Or they could have gone with zeroing the content of `struct`s, as… well, in fact, these same languages.

This is where the design of Go’s zero values intersects, I believe, with another design choice: the designers of Go wanted to favor performance, as long as it didn’t make the compiler more complex. Avoiding complexity meant that they did not want a JIT, nor a compiler that could alter the layout of data structures. Which meant that they needed to make memory layout explicit in the language, to let the developers optimize themselves. Which meant that they had to materialize the difference between a `struct` allocated within its container (e.g. on the stack, or within the space of a container `struct`) and a `struct` allocated somewhere (else) on the heap.

Which meant that they needed to make pointers explicit. Which meant that they could not zero `struct`s to `nil`.

So the design of Go went with zeroing the _content_ of `struct`s instead of treating all `struct`s as references and zeroing the reference itself.

> 3.  The zero value for `struct` is the `struct` filled with zeroes, rather than `nil`.

The case of `interface`
-----------------------

Now… what’s a zero interface?

If you have ever programmed in Go, you know that a zero interface can be… surprising.

```null
func IsNil(v any) bool {
	return v == nil
}

var a any
var b *int
fmt.Println(IsNil(a), IsNil(b)) 

```

It’s not that `v == nil` always fails when `v` is an interface, it’s that it doesn’t always work. Needless to say, that’s not my favorite part of Go. Part of this is a consequence of the zero value principle.

When we declare `var a any`, `a` is zero-ed. It literally contains a `nil` pointer. Similarly, when we declare `var b *int`, it contains a `nil` pointer. Now, when we cast `a` or `b` or any value to `any`, we need to store several pieces of information:

1.  we need the value of `a` or `b` itself;
2.  we need a pointer to any methods of `a` or `b`, to be able to call these methods (a vtable or itable);
3.  we need a pointer to the type of `a` or `b`, to be able to determine whether we can perform type conversions, such as converting back a `any` to a `*int`.

(actually, 2. and 3. are pretty much equivalent, so you only need one of these pointers).

But since `a` and `b` both MUST contain exactly a `nil` pointer, this means that the data cannot be stored on the stack when the stack is initialized. They MUST be added _by the compiler_ when a value is actually used as an `any` _and_ the call is not inline.

> 4.  Type information must be added dynamically.

Slices and strings
------------------

By opposition to `struct`, slices and strings are always pointers. So the designers of Go could have decided to make any operation on a zero slice or a zero string invalid. However, if you have programmed in Go, you know that this isn’t the case. The zero value of a slice is an empty slice and the zero value of a string is an empty string.

Why? I believe that there are two reasons.

First, whether you’re creating an API, a data structure or a programming language, in most cases, you’ll try to reduce as much as reasonably possible the space of possible failures. Making the program panic with any operation on an invalid slice or string is adding failure states, so removing the possibility of reaching these failure states makes the language… well, less fallible.

Note that, these are Go failure modes. For many applications, having an incorrect slice or string (for instance, the empty slice or string) is also a form of failure. In most applications I write, it’s a worse kind of failure than a panic, because it’s harder to detect and fix, but if you are writing log processors [3](#fn:3), having a processor that sometimes prints an empty string when the input data is incorrect is most likely less of a problem than having a processor that panics whenever it encounters data it doesn’t understand.

Second, the empty slice or the empty string are absolutely valid value. They’re even quite common values, especially for a slice that has just been created. By adopting the convention that the zero slice is the same thing[4](#fn:4) as the empty slice, the designers of Go have cut to zero the initialization time of an empty slice – all it takes is zeroing the memory, which is exactly what Go is doing in the first place.

**edit** In the first version of this blog post, I (wrongly) deduced that this was the reason for which strings were read-only and slices required `append`. But actually, that’s very likely not the case.

Maps
----

As slices and strings, maps are pointers. So Go’s designers could have decided that:

1.  a zero map is a valid empty map;
2.  a zero map is an invalid value that causes panics.

And they decided…

```null
var myMap map[string]bool
_, found := myMap["foo"]
fmt.Println(found) 

myMap["foo"] = false 

```

…a bit of both?

Let’s start with the panic at `myMap["foo"] = false`. For the purpose of this conversation, let’s remove the syntactic sugar and pretend that this is actually `maps.Set(myMap, "foo", false)`.

Could we rewrite this to let the map grow?

```null
func Set[K comparable, V any](container Map[K]V, key K, value V) {
    if container == nil {
        container = Make()
    }
    internals.Set(container, key, value)
}
```

This doesn’t work because we’ve mutated `container` locally, but never returned it. We could get around this, by making it:

```null
func Set[K comparable, V any](container* Map[K]V, key K, value V) {
    if container == nil {
        *container = Make()
    }
    internals.Set(container, key, value)
}
```

But now, `Set` is an operation that takes a pointer to a pointer (recall that `Map` is itself a pointer), instead of a single indirection. There is a fairly large performance penalty for that, which the designers of Go presumably didn’t want to pay. So they decided to panic instead. I believe that this is the right behavior, although the irregularity does chafe.

Now why doesn’t `_, found := myMap["foo"]` panic? One can only assume that this another attempt to limit the number of failure states in the language.

Channels
--------

As slices, strings and maps, chans are pointers. So Go’s designers could have decided that:

1.  a zero chan is a valid chan;
2.  a zero chan is an invalid value that causes panics;
3.  bit of both, as above.

And they decided…

```null
var myChan chan int
go func() {
    myChan <- 42 
}()
go func() {
    foo := <-myChan 
}
```

…none of the above?

Alright, this one baffles me. It’s clear that making zero channels valid is meaningless (so no 1. and no 3.), but I have no idea why the designers of Go decided that blocking forever is better than a panic, especially since writing to closed channels already cause panics. Maybe this comes from a specific school of thought? Maybe it simplifies some tests? After all, Obj-C had the same policy with NULL objects dropping messages instead of segfaulting.

If somebody manages to puzzle this out, I’m interested.

**edit** Ahah, a response was provided by /u/TheMerovius in a Reddit comment! If you `select` in a loop, this will let you easily disable some cases by zeroing some of the channels!

There’s a motto within the Go community that you should make zero values work for you, rather than fighting them.

So let’s take a look at a few cases in which you can benefit from zero values.

Trivializing constructors
-------------------------

Some data structures manage to be valid when they are zero. The empty slice and the empty string are examples, but the most quoted example is presumably `sync.Mutex`.

I haven’t found any guidelines on how to replicate this feat, but I’m sure that there are a few patterns for that. One I’ve seen essentially amounts to delaying construction:

```null
func MyStruct struct {
    isInitialized bool
    Field MyField
}

func (me *MyStruct) DoSomething() {
    if !me.isInitialized {
        
    }
    
}
```

To a large extent, this is what unmarshaling does:

```null
func (me *MyStruct) UnmarshalJSON(source []byte) error {
    
    if me == nil {
        me = &MyStruct {}
        me.Field = ...
    }
}
```

Error results
-------------

For better or for worse, Go doesn’t have sum values (this might be the topic of another blog entry). Since it also doesn’t have (or at least doesn’t recommend) stack unwinding, this means that every function that might return a result or an error must return both.

That’s probably the most noticeable pattern when looking at go code:

```null
func doSomething() Value, error {
    
}
value, err := doSomething()
if err != nil {
    return Stuff{}, fmt.Errorf("let's add some context: %w", err)
}
```

Some people (including yours truly) don’t particularly enjoy the idea of having to deal with a meaningless value that will presumably cause a failure state if we ever mistake it for a valid value. But if we have to deal with such meaningless values, zero values feel tailored for this kind of use. In this snippet, if we didn’t have the ability to return a zero-ed `Stuff{}`, the only alternatives would be to:

1.  Return a fully constructed `Stuff{}` (which is generally not possible – you’re bailing out early with an error, that’s usually because you can’t construct your `Stuff{}`).
2.  Return `nil, fmt.Errorf(...)`, which means that you’d need to always return pointers, which would often be bad for performance.
3.  Prepare an alternate constructor `stuff.MakeErrorStuff()` that returns an arbitrary and cheap-to-build value of `Stuff{}`, which would be a waste of time, lines of code and performance.

As I mentioned quite a few times by now, I don’t particularly like zero values. They regularly creep into my data structures and produce weird results much later, which increases the time I spend debugging. I don’t debug for fun.

But if one looks harder, the problem isn’t with the zero values themselves. It’s with the fact that Go doesn’t support constructors (as in “being able to define functions that you must call to construct a value of the given type”) – constructors would remove ~100% of the problems that materialize as zero values in my data structures. Why doesn’t Go support constructors? Presumably because the language works without constructors and the designers Go simply didn’t want to complicate the specifications. Also, Go relies a lot on reflection, and it feels like adding constructors would break reflection as it exists – either that, or reflection would break the constructors.

Well, writing this blog entry gave me the opportunity to dive a little bit deeper into zero values, the problems I have with them and confirm that no, the designers of the Go language are not crazy or lazy, they just have priorities different than mine. Go is a language of the worse-is-better design philosophy, much as Unix, and this is a design philosophy that has delivered in many occasions.

I don’t think I’ll ever fall in love with Go (at least not while it’s Go 1.x), but it’s definitely a language that has its uses.