# Type-Unsafe Pointers -Go 101
[Go Optimizations 101](https://go101.org/optimizations/101.html), [Go Details & Tips 101](https://go101.org/details-and-tips/101.html) and [Go Generics 101](https://go101.org/generics/101.html) are all updated for Go 1.24 now. The most cost-effective way to get them is through [this book bundle](https://leanpub.com/b/go-optimizations-details-generics) in the Leanpub book store. [TapirMD](https://tmd.tapirgames.com/) - a powerful, next-generation markup language that simplifies content creation (much more powerful than markdown). You can experience it online [here](https://tmd.tapirgames.com/play.html).

We have learned Go pointers from the article [pointers in Go](https://go101.org/article/pointer.html). From that article, we know that, comparing to C pointers, there are many restrictions made for Go pointers. For example, Go pointers can't participate arithmetic operations, and for two arbitrary pointer types, it is very possible that their values can't be converted to each other.

The pointers explained in that article are called type-safe pointers actually. Although the restrictions on type-safe pointers really make us be able to write safe Go code with ease, they also make some obstacles to write efficient code for some scenarios.

In fact, Go also supports type-unsafe pointers, which are pointers without the restrictions made for safe pointers. Type-unsafe pointers are also called unsafe pointers in Go. Go unsafe pointers are much like C pointers, they are powerful, and also dangerous. For some cases, we can write more efficient code with the help of unsafe pointers. On the other hand, by using unsafe pointers, it is easy to write bad code which is too subtle to detect in time.

Another big risk of using unsafe pointers comes from the fact that the unsafe mechanism is not protected by [the Go 1 compatibility guidelines](https://golang.org/doc/go1compat). Code depending on unsafe pointers works today could break since a later Go version.

If you really desire the code efficient improvements by using unsafe pointers for any reason, you should not only know the above mentioned risks, but also follow the instructions written in the official Go documentation and clearly understand the effect of each unsafe pointer use, so that you can write safe Go code with unsafe pointers.

Go provides a special [kind of types](https://go101.org/article/type-system-overview.html#type-kinds) for unsafe pointers. We must import [the `unsafe` standard package](https://golang.org/pkg/unsafe/) to use unsafe pointers. The `unsafe.Pointer` type is defined as

```
type Pointer *ArbitraryType 
```

Surely, it is not a usual type definition. Here the `ArbitraryType` just hints that a `unsafe.Pointer` value can be converted to any safe pointer values in Go (and vice versa). In other words, `unsafe.Pointer` is like the `void*` in C language.

Go unsafe pointers mean the types whose underlying types are `unsafe.Pointer`.

The zero values of unsafe pointers are also represented with the predeclared identifier `nil`.

Before Go 1.17, the `unsafe` standard package has already provided three functions.

*   `func Alignof(variable ArbitraryType) uintptr`, which is used to get the address alignment of a value. Please notes, the aligns for struct-field values and non-field values of the same type may be different, though for the standard Go compiler, they are always the same. For the gccgo compiler, they may be different.
    
*   `func Offsetof(selector ArbitraryType) uintptr`, which is used to get the address offset of a field in a struct value. The offset is relative to the address of the struct value. The return results should be always the same for the same corresponding field of values of the same struct type in the same program.
    
*   `func Sizeof(variable ArbitraryType) uintptr`, which is used to get the size of a value (a.k.a., the size of the type of the value). The return results should be always the same for all values of the same type in the same program.
    

Note,

*   the types of the return results of the three functions are all `uintptr`. Below we will learn that uintptr values can be converted to unsafe pointers (and vice versa).
    
*   although the return results of calls of any of the three functions are consistent in the same program, they might be different crossing operating systems, crossing architectures, crossing compilers, and crossing compiler versions.
    
*   calls to the three functions are always evaluated at compile time. The evaluation results are typed constants with type `uintptr`.
    
*   the argument passed to a call to the `unsafe.Offsetof` function must the struct field selector form `value.field`. The selector may denote an embedded field, but the field must be reachable without implicit pointer indirections.
    

An example of using the three functions.

```
package main

import "fmt"
import "unsafe"

func main() {
	var x struct {
		a int64
		b bool
		c string
	}
	const M, N = unsafe.Sizeof(x.c), unsafe.Sizeof(x)
	fmt.Println(M, N) 

	fmt.Println(unsafe.Alignof(x.a)) 
	fmt.Println(unsafe.Alignof(x.b)) 
	fmt.Println(unsafe.Alignof(x.c)) 

	fmt.Println(unsafe.Offsetof(x.a)) 
	fmt.Println(unsafe.Offsetof(x.b)) 
	fmt.Println(unsafe.Offsetof(x.c)) 
} 
```

An example which demonstrates the last note mentioned above.

```
package main

import "fmt"
import "unsafe"

func main() {
	type T struct {
		c string
	}
	type S struct {
		b bool
	}
	var x struct {
		a int64
		*S
		T
	}

	fmt.Println(unsafe.Offsetof(x.a)) 
	
	fmt.Println(unsafe.Offsetof(x.S)) 
	fmt.Println(unsafe.Offsetof(x.T)) 
	
	
	
	fmt.Println(unsafe.Offsetof(x.c)) 
	
	
	
	
	
	
	
	fmt.Println(unsafe.Offsetof(x.S.b)) 
} 
```

Please note, the print results shown in the comments are for the standard Go compiler version 1.24.n on Linux AMD64 architecture.

Go 1.17 introduces one new type and two new functions into the `unsafe` package. The new type is `IntegerType`, The following is its definition. This type doesn't denote a specified type. It just represents any arbitrary integer type. We can view it as a generic type.

```
type IntegerType int 
```

The two functions introduced in Go 1.17 are:

*   `func Add(ptr Pointer, len IntegerType) Pointer`. This function adds an offset to the address represented by an unsafe pointer and return a new unsafe pointer which represents the new address. This function partially covers the usages of the below introduced unsafe pointer use pattern 3.
    
*   `func Slice(ptr *ArbitraryType, len IntegerType) []ArbitraryType`. This function is used to derive a slice with the specified length from a safe pointer, where `ArbitraryType` is the element type of the result slice.
    

Go 1.20 further introduced three more functions:

*   `func String(ptr *byte, len IntegerType) string`. This function is used to derive a string with the specified length from a safe `byte` pointer.
    
*   `func StringData(str string) *byte`. This function is used to get the pointer to the underlying byte sequence of a string. Please note, don't pass empty strings as arguments to this function.
    
*   `func SliceData(slice []ArbitraryType) *ArbitraryType`. This function is used to get the pointer to the underlying element sequence of a slice.
    

These functions introduced since Go 1.17 have certain dangerousness. They need to be used with caution. This following is an example using the two functions introduced in Go 1.17.

```
package main

import (
	"fmt"
	"unsafe"
)

func main() {
	a := [16]int{3: 3, 9: 9, 11: 11}
	fmt.Println(a)
	eleSize := int(unsafe.Sizeof(a[0]))
	p9 := &a[9]
	up9 := unsafe.Pointer(p9)
	p3 := (*int)(unsafe.Add(up9, -6 * eleSize))
	fmt.Println(*p3) 
	s := unsafe.Slice(p9, 5)[:3]
	fmt.Println(s) 
	fmt.Println(len(s), cap(s)) 

	t := unsafe.Slice((*int)(nil), 0)
	fmt.Println(t == nil) 

	
	
	
	_ = unsafe.Add(up9, 7 * eleSize)
	_ = unsafe.Slice(p9, 8)
} 
```

The following two functions may be used to do conversions between strings and byte slices, in type unsafe manners. Comparing with type safe manners, the type unsafe manners don't duplicate underlying byte sequences of strings and byte slices, so they are more performant.

```
import "unsafe"

func String2ByteSlice(str string) []byte {
	if str == "" {
		return nil
	}
	return unsafe.Slice(unsafe.StringData(str), len(str))
}

func ByteSlice2String(bs []byte) string {
	if len(bs) == 0 {
		return ""
	}
	return unsafe.String(unsafe.SliceData(bs), len(bs))
} 
```

Currently (Go 1.24), Go compilers allow the following explicit conversions.

*   A safe pointer can be explicitly converted to an unsafe pointer, and vice versa.
    
*   An uintptr value can be explicitly converted to an unsafe pointer, and vice versa. But please note, a nil unsafe.Pointer shouldn't be converted to uintptr and back with arithmetic.
    

By using these conversions, we can convert a safe pointer value to an arbitrary safe pointer type.

However, although these conversions are all legal at compile time, not all of them are valid (safe) at run time. These conversions defeat the memory safety the whole Go type system (except the unsafe part) tries to maintain. We must follow the instructions listed in a later section below to write valid Go code with unsafe pointers.

Before introducing the valid unsafe pointer use patterns, we need to know some facts in Go.

Each of non-nil safe and unsafe pointers references another value. However uintptr values don't reference any values, they are just plain integers, though often each of them stores an integer which can be used to represent a memory address.

Go is a language supporting automatic garbage collection. When a Go program is running, Go runtime will [check which memory blocks are not used by any value any more and collect the memory](https://go101.org/article/memory-block.html#when-to-collect) allocated for these unused blocks, from time to time. Pointers play an important role in the check process. If a memory block is unreachable from (referenced by) any values still in use, then Go runtime thinks it is an unused value and it can be safely garbage collected.

As uintptr values are integers, they can participate arithmetic operations.

The example in the next subsection shows the differences between pointers and uintptr values.

At run time, the garbage collector may run at an uncertain time, and each garbage collection process may last an uncertain duration. So when a memory block becomes unused, it may be [collected at an uncertain time](https://go101.org/article/memory-block.html#when-can-collect).

For example:

```
import "unsafe"

func createInt() *int {
	return new(int)
}

func foo() {
	p0, y, z := createInt(), createInt(), createInt()
	var p1 = unsafe.Pointer(y)
	var p2 = uintptr(unsafe.Pointer(z))

	
	
	
	
	
	
	

	
	p2 += 2; p2--; p2--

	*p0 = 1                         
	*(*int)(p1) = 2                 
	*(*int)(unsafe.Pointer(p2)) = 3 
} 
```

In the above example, the fact that value `p2` is still in use can't guarantee that the memory block ever hosting the `int` value referenced by `z` has not been garbage collected yet. In other words, when `*(*int)(unsafe.Pointer(p2)) = 3` is executed, the memory block may be collected, or not. It is dangerous to dereference the address stored in value `p2` to an `int` value, for it is possible that the memory block has been already reallocated for another value (even for another program).

Please read the article [memory blocks](https://go101.org/article/memory-block.html#where-to-allocate) for details (see the end of the hyperlinked section). Here, we should just know that when the size of the stack of a goroutine changes, the memory blocks allocated on the stack will be moved. In other words, the addresses of the values hosted on these memory blocks will change.

In the following example, the fact value `t` is still in use can't guarantee that the values referenced by value `t.y` are still in use.

```
type T struct {
	x int
	y *[1<<23]byte
}

func bar() {
	t := T{y: new([1<<23]byte)}
	p := uintptr(unsafe.Pointer(&t.y[0]))

	... 

	
	
	

	
	

	
	println(t.x)
} 
```

Yes, `*unsafe.Pointer` is a safe pointer type. Its base type is `unsafe.Pointer`. As it is a safe pointer, according the conversion rules listed above, it can be converted to `unsafe.Pointer` type, and vice versa.

For example:

```
package main

import "unsafe"

func main() {
	x := 123                
	p := unsafe.Pointer(&x) 
	pp := &p                
	p = unsafe.Pointer(pp)
	pp = (*unsafe.Pointer)(p)
} 
```

The `unsafe` standard package documentation lists [six unsafe pointer use patterns](https://golang.org/pkg/unsafe/#Pointer). Following will introduce and explain them one by one.

As mentioned above, by using the unsafe pointer conversion rules above, we can convert a value of `*T1` to type `*T2`, where `T1` and `T2` are two arbitrary types. However, we should only do such conversions if the size of `T1` is no smaller than `T2`, and only if the conversions are meaningful.

As a result, we can also achieve the conversions between type `T1` and `T2` by using this pattern.

One example is the `math.Float64bits` function, which converts a `float64` value to an `uint64` value, without changing any bit in the `float64` value. The `math.Float64frombits` function does reverse conversions.

```
func Float64bits(f float64) uint64 {
	return *(*uint64)(unsafe.Pointer(&f))
}

func Float64frombits(b uint64) float64 {
	return *(*float64)(unsafe.Pointer(&b))
} 
```

Please note, the return result of the `math.Float64bits(aFloat64)` function call is different from the result of the explicit conversion `uint64(aFloat64)`.

In the following example, we use this pattern to convert a `[]MyString` slice to type `[]string`, and vice versa. The result slice and the original slice share the underlying elements. Such conversions are impossible through safe ways,

```
package main

import (
	"fmt"
	"unsafe"
)

func main() {
	type MyString string
	ms := []MyString{"C", "C++", "Go"}
	fmt.Printf("%s\n", ms)  
	
	ss := *(*[]string)(unsafe.Pointer(&ms))
	ss[1] = "Zig"
	fmt.Printf("%s\n", ms) 
	
	ms = *(*[]MyString)(unsafe.Pointer(&ss))
	
	
	
	ss = unsafe.Slice((*string)(&ms[0]), len(ms))
	ms = unsafe.Slice((*MyString)(&ss[0]), len(ms))
} 
```

By the way, since Go 1.17, we may also use the `unsafe.Slice` function to do the conversions:

```
func main() {
	...
	
	ss = unsafe.Slice((*string)(&ms[0]), len(ms))
	ms = unsafe.Slice((*MyString)(&ss[0]), len(ss))
} 
```

A practice by using the pattern is to convert a byte slice, which will not be used after the conversion, to a string, as the following code shows. In this conversion, a duplication of the underlying byte sequence is avoided.

```
func ByteSlice2String(bs []byte) string {
	return *(*string)(unsafe.Pointer(&bs))
} 
```

This is the implementation adopted by the `String` method of the `Builder` type supported since Go 1.10 in the `strings` standard package. The size of a byte slice is larger than a string, and [their internal structures](https://go101.org/article/value-part.html#internal-definitions) are similar, so the conversion is valid (for main stream Go compilers). However, despite the implementation may be safely used in standard packages now, it is not recommended to be used in general user code. Since Go 1.20, in general user code, we should try to use the implementation which uses the `unsafe.String` function, mentioned above in this article.

The converse, converting a string to a byte slice in the similar way, is invalid, for the size of a string is smaller than a byte slice.

```
func String2ByteSlice(s string) []byte {
	return *(*[]byte)(unsafe.Pointer(&s)) 
} 
```

In the pattern 6 section below, a valid implementation to do the same job is introduced.

Note: when using the just introduced unsafe way to convert a byte slice to a string, please make sure not to modify the bytes in the byte slice if the result string still survives.

This pattern is not very useful. Usually, we print the result uintptr values to check the memory addresses stored in them. However, there are other both safe and less verbose ways to this job. So this pattern is not much useful.

Example:

```
package main

import "fmt"
import "unsafe"

func main() {
	type T struct{a int}
	var t T
	fmt.Printf("%p\n", &t)                          
	println(&t)                                     
	fmt.Printf("%x\n", uintptr(unsafe.Pointer(&t))) 
} 
```

The outputted addresses might be different for each run.

#### Pattern 3: convert unsafe pointer to uintptr, do arithmetic operations with the uintptr value, then convert it back

In this pattern, the result unsafe pointer must continue to point into the original allocated memory block. For example:

```
package main

import "fmt"
import "unsafe"

type T struct {
	x bool
	y [3]int16
}

const N = unsafe.Offsetof(T{}.y)
const M = unsafe.Sizeof(T{}.y[0])

func main() {
	t := T{y: [3]int16{123, 456, 789}}
	p := unsafe.Pointer(&t)
	
	ty2 := (*int16)(unsafe.Pointer(uintptr(p)+N+M+M))
	fmt.Println(*ty2) 
} 
```

In fact, since Go 1.17, it is more recommended to use the above introduced `unsafe.Add` function to do such address offset operations.

Please note, in this specified example, the conversion `unsafe.Pointer(uintptr(p) + N + M + M)` shouldn't be split into two lines, like the following code shows. Please read the comments in the code for the reason.

```
func main() {
	t := T{y: [3]int16{123, 456, 789}}
	p := unsafe.Pointer(&t)
	
	addr := uintptr(p) + N + M + M
	
	
	
	
	
	
	
	
	
	
	
	ty2 := (*int16)(unsafe.Pointer(addr))
	fmt.Println(*ty2)
} 
```

Such bugs are very subtle and hard to detect, which is why the uses of unsafe pointers are dangerous.

The intermediate uintptr value may also participate in `&^` bitwise clear operations to do address alignment, as long as the result unsafe pointer and the original one point into the same allocated memory block.

Another detail which should be also noted is that, it is not recommended to store the end boundary of a memory block in a pointer (either safe or unsafe one). Doing this will prevent another memory block which closely follows the former memory block from being garbage collected, or crash program if that boundary address is not valid for any allocated memory blocks (depending on compiler implementations). Please read [this FAQ item](https://go101.org/article/unofficial-faq.html#final-zero-size-field) to get more explanations.

From the explanations for the last pattern, we know that the following function is dangerous.

```
 func DoSomething(addr uintptr) {
	
} 
```

The reason why the above function is dangerous is that the function itself can't guarantee the memory block at the passed argument address is not garbage collected yet. If the memory block is collected or is reallocated for other values, then the operations made in the function body are dangerous.

However, the prototype of the `Syscall` function in the `syscall` standard package is as

```
func Syscall(trap, a1, a2, a3 uintptr) (r1, r2 uintptr, err Errno) 
```

How does this function guarantee that the memory blocks at the passed addresses `a1`, `a2` and `a3` are still not garbage collected yet within the function internal? The function can't guarantee this. In fact, compilers will make the guarantee. It is the privilege of calls to `syscall.Syscall` alike functions.

We can think that, compilers will automatically insert some instructions for each of the unsafe pointer arguments who are converted to `uintptr`, like the third argument in the following `syscall.Syscall` call, to prevent the memory block referenced by that argument from being garbage collected or moved.

Please note that, before Go 1.15, it was okay the conversion expressions `uintptr(anUnsafePointer)` act as sub-expressions of the talked arguments. Since Go 1.15, the requirement becomes a bit stricter: the talked arguments must present exactly as the `uintptr(anUnsafePointer)` form.

The following call is safe:

```
syscall.Syscall(SYS_READ, uintptr(fd),
			uintptr(unsafe.Pointer(p)), uintptr(n)) 
```

But the following calls are dangerous:

```
u := uintptr(unsafe.Pointer(p))

syscall.Syscall(SYS_READ, uintptr(fd), u, uintptr(n))

syscall.Syscall(SYS_XXX, uintptr(uintptr(fd)),
			uint(uintptr(unsafe.Pointer(p))), uintptr(n)) 
```

Again, never use this pattern when calling other functions.

The methods `Pointer` and `UnsafeAddr` of the `Value` type in the `reflect` standard package both return a result of type `uintptr` instead of `unsafe.Pointer`. This is a deliberate design, which is to avoid converting the results of calls (to the two methods) to any safe pointer types without importing the `unsafe` standard package.

The design requires the return result of a call to either of the two methods must be converted to an unsafe pointer immediately after making the call. Otherwise, there will be small time window in which the memory block allocated at the address stored in the result might lose all references and be garbage collected.

For example, the following call is safe.

```
p := (*int)(unsafe.Pointer(reflect.ValueOf(new(int)).Pointer())) 
```

On the other hand, the following call is dangerous.

```
u := reflect.ValueOf(new(int)).Pointer()

p := (*int)(unsafe.Pointer(u)) 
```

Please note that, Go 1.19 introduces a new method, `reflect.Value.UnsafePointer()`, which returns a `unsafe.Pointer` value and is preferred over the two just mentioned functions. That means, the old deliberate design is thought as not good now.

For the same reason mentioned for the last subsection, the `Data` fields of the struct type `SliceHeader` and `StringHeader` in the `reflect` standard package are declared with type `uintptr` instead of `unsafe.Pointer`.

We can convert a string pointer to a `*reflect.StringHeader` pointer value, so that we can manipulate the internal of the string. The same, we can convert a slice pointer to a `*reflect.SliceHeader` pointer value, so that we can manipulate the internal of the slice.

An example of using `reflect.StringHeader`:

```
package main

import "fmt"
import "unsafe"
import "reflect"

func main() {
	a := [...]byte{'G', 'o', 'l', 'a', 'n', 'g'}
	s := "Java"
	hdr := (*reflect.StringHeader)(unsafe.Pointer(&s))
	hdr.Data = uintptr(unsafe.Pointer(&a))
	hdr.Len = len(a)
	fmt.Println(s) 
	
	
	a[2], a[3], a[4], a[5] = 'o', 'g', 'l', 'e'
	fmt.Println(s) 
} 
```

An example of using `reflect.SliceHeader`:

```
package main

import (
	"fmt"
	"unsafe"
	"reflect"
)

func main() {
	a := [6]byte{'G', 'o', '1', '0', '1'}
	bs := []byte("Golang")
	hdr := (*reflect.SliceHeader)(unsafe.Pointer(&bs))
	hdr.Data = uintptr(unsafe.Pointer(&a))

	hdr.Len = 2
	hdr.Cap = len(a)
	fmt.Printf("%s\n", bs) 
	bs = bs[:cap(bs)]
	fmt.Printf("%s\n", bs) 
} 
```

In general, we should only get a `*reflect.StringHeader` pointer value from an actual (already existed) string, or get a `*reflect.SliceHeader` pointer value from an actual (already existed) slice. We shouldn't do the contrary, such as creating a string from a new allocated `StringHeader`, or creating a slice from a new allocated `SliceHeader`. For example, the following code is dangerous.

```
var hdr reflect.StringHeader
hdr.Data = uintptr(unsafe.Pointer(new([5]byte)))

hdr.Len = 5
s := *(*string)(unsafe.Pointer(&hdr)) 
```

The following is an example which shows how to convert a string to a byte slice, by using the unsafe way. Different from the safe conversion from a string to a byte slice, the unsafe way doesn't allocate a new underlying byte sequence for the result slice in each conversion.

```
package main

import (
	"fmt"
	"reflect"
	"strings"
	"unsafe"
)

func String2ByteSlice(str string) (bs []byte) {
	strHdr := (*reflect.StringHeader)(unsafe.Pointer(&str))
	sliceHdr := (*reflect.SliceHeader)(unsafe.Pointer(&bs))
	sliceHdr.Data = strHdr.Data
	sliceHdr.Cap = strHdr.Len
	sliceHdr.Len = strHdr.Len
	return
}

func main() {
	
	
	
	
	
	str := strings.Join([]string{"Go", "land"}, "")
	s := String2ByteSlice(str)
	fmt.Printf("%s\n", s) 
	s[5] = 'g'
	fmt.Println(str) 
} 
```

Note, when using the just introduced unsafe way to convert a string to a byte slice, please make sure not to modify the bytes in the result byte slice if the string still survives (for demonstration purpose, the above example violates this principle).

It is also possible to convert a byte slice to a string in a similar way, which is a bit safer (but a bit slower) than the way shown in pattern 1.

```
func ByteSlice2String(bs []byte) (str string) {
	sliceHdr := (*reflect.SliceHeader)(unsafe.Pointer(&bs))
	strHdr := (*reflect.StringHeader)(unsafe.Pointer(&str))
	strHdr.Data = sliceHdr.Data
	strHdr.Len = sliceHdr.Len
	return
} 
```

Similarly, please make sure not to modify the bytes in the argument byte slice if the result string still survives.

BTW, let's view a bad example which violates the principle of pattern 3 (the example is borrowed from one slack comment posted by Bryan C. Mills):

```
package main

import (
	"fmt"
	"reflect"
	"unsafe"
)

func Example_Bad() *byte {
	var str = "godoc"
	hdr := (*reflect.StringHeader)(unsafe.Pointer(&str))
	pbyte := (*byte)(unsafe.Pointer(hdr.Data + 2))
	return pbyte 
}

func main() {
	fmt.Println(string(*Example_Bad()))
} 
```

Two correct implementations:

```
func Example_Good1() *byte {
	var str = "godoc"
	hdr := (*reflect.StringHeader)(unsafe.Pointer(&str))
	pbyte := (*byte)(unsafe.Pointer(
		uintptr(unsafe.Pointer(hdr.Data)) + 2))
	return pbyte
}

func Example_Good2() *byte {
	var str = "godoc"
	hdr := (*reflect.StringHeader)(unsafe.Pointer(&str))
	pbyte := (*byte)(unsafe.Add(unsafe.Pointer(hdr.Data), 2))
	return pbyte
} 
```

Tricky? Yes.

[The docs](https://golang.org/pkg/reflect/#SliceHeader) of the `SliceHeader` and `StringHeader` types in the `reflect` standard package are similar in that they say the representations of the two struct types may change in a later release. So the above valid examples using the two types may become invalid even if the unsafe rules keep unchanged. Fortunately, at present (Go 1.24), the two available mainstream Go compilers (the standard Go compiler and the gccgo compiler) both recognize the representations of the two types declared in the `reflect` standard package.

The Go core development team also realized that the two types are inconvenient and error-prone, so the two types have been not recommended any more since Go 1.20 and they have been deprecated since Go 1.21. Instead, we should try to use the `unsafe.String`, `unsafe.StringData`, `unsafe.Slice` and `unsafe.SliceData` functions described earlier in this article.

From the above contents, we know that, for some cases, the unsafe mechanism can help us write more efficient Go code. However, it is very easy to introduce some subtle bugs which have very low possibilities to produce when using the unsafe mechanism. A program with these bugs may run well for a long time, but suddenly behave abnormally and even crash at a later time. Such bugs are very hard to detect and debug.

We should only use the unsafe mechanism when we have to, and we must use it with extreme care. In particular, we should follow the instructions described above.

And again, we should aware that the unsafe mechanism introduced above may change and even become invalid totally in later Go versions, though no evidences this will happen soon. If the unsafe mechanism rules change, the above introduced valid unsafe pointer use patterns may become invalid. So please keep it easy to switch back to the safe implementations for you code depending on the unsafe mechanism.

In the end, it is worth mentioning that a dynamic analysis compiler option `-gcflags=all=-d=checkptr` is supported since Go Toolchain 1.14 (it is recommended to use this option on Windows with Go Toolchain 1.15+). When this option is used, some (but not all) incorrect unsafe pointer uses will be detected at run time. Once such an incorrect use is detected, a panic will occur. Thanks to Matthew Dempsky for implementing this [great feature](https://github.com/golang/go/issues/22218)!

The **_Go 101_** project is hosted on [Github](https://github.com/go101/go101). Welcome to improve **_Go 101_** articles by submitting corrections for all kinds of mistakes, such as typos, grammar errors, wording inaccuracies, description flaws, code bugs and broken links.

If you would like to learn some Go details and facts every serveral days, please follow Go 101's official Twitter account [@zigo\_101](https://twitter.com/zigo_101).

Tapir, the author of Go 101, has been on writing the Go 101 series books and maintaining the go101.org website since 2016 July. New contents will be continually added to the book and the website from time to time. Tapir is also an indie game developer. You can also support Go 101 by playing [Tapir's games](https://www.tapirgames.com/) (made for both Android and iPhone/iPad):

*   [Color Infection](https://www.tapirgames.com/App/Color-Infection) (★★★★★), a physics based original casual puzzle game. 140+ levels.
*   [Rectangle Pushers](https://www.tapirgames.com/App/Rectangle-Pushers) (★★★★★), an original casual puzzle game. Two modes, 104+ levels.
*   [Let's Play With Particles](https://www.tapirgames.com/App/Let-Us-Play-With-Particles), a casual action original game. Three mini games are included.

Individual donations [via PayPal](https://paypal.me/tapirliu) are also welcome.