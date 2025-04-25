# Strings in Go -Go 101
[Go Optimizations 101](https://go101.org/optimizations/101.html), [Go Details & Tips 101](https://go101.org/details-and-tips/101.html) and [Go Generics 101](https://go101.org/generics/101.html) are all updated for Go 1.24 now. The most cost-effective way to get them is through [this book bundle](https://leanpub.com/b/go-optimizations-details-generics) in the Leanpub book store. [TapirMD](https://tmd.tapirgames.com/) - a powerful, next-generation markup language that simplifies content creation (much more powerful than markdown). You can experience it online [here](https://tmd.tapirgames.com/play.html).

Like many other programming languages, string is also one important kind of types in Go. This article will list all the facts of strings.

For the standard Go compiler, the internal structure of any string type is declared like:

```
type _string struct {
	elements *byte 
	len      int   
} 
```

From the declaration, we know that a string is actually a `byte` sequence wrapper. In fact, we can really view a string as an (element-immutable) byte slice.

Note, in Go, `byte` is a built-in alias of type `uint8`.

We have learned the following facts about strings from previous articles.

*   String values can be used as constants (along with boolean and all kinds of numeric values).
    
*   Go supports [two styles of string literals](https://go101.org/article/basic-types-and-value-literals.html#string-literals), the double-quote style (or interpreted literals) and the back-quote style (or raw string literals).
    
*   The zero values of string types are blank strings, which can be represented with `""` or   in literal.
    
*   Strings can be concatenated with `+` and `+=` operators.
    
*   String types are all comparable (by using the `==` and `!=` operators). And like integer and floating-point values, two values of the same string type can also be compared with `>`, `<`, `>=` and `<=` operators. When comparing two strings, their underlying bytes will be compared, one byte by one byte. If one string is a prefix of the other one and the other one is longer, then the other one will be viewed as the larger one.
    

Example:

```
package main

import "fmt"

func main() {
	const World = "world"
	var hello = "hello"

	
	var helloWorld = hello + " " + World
	helloWorld += "!"
	fmt.Println(helloWorld) 

	
	fmt.Println(hello == "hello")   
	fmt.Println(hello > helloWorld) 
} 
```

More facts about string types and values in Go.

*   Like Java, the contents (underlying bytes) of string values are immutable. The lengths of string values also can't be modified separately. An addressable string value can only be overwritten as a whole by assigning another string value to it.
    
*   The built-in `string` type has no methods (just like most other built-in types in Go), but we can
    
    *   call the built-in `len` function to get the length of a string (number of bytes stored in the string).
        
    *   use the element access syntax `aString[i]` introduced in [container element accesses](https://go101.org/article/container.html#element-access) to get the ith `byte` value stored in `aString`. The expression `aString[i]` is not addressable. In other words, value `aString[i]` can't be modified.
        
    *   use [the subslice syntax](https://go101.org/article/container.html#subslice) `aString[start:end]` to get a substring of `aString`. Here, `start` and `end` are both indexes of bytes stored in `aString`.
        
*   For the standard Go compiler, the destination string variable and source string value in a string assignment will share the same underlying byte sequence in memory. The result of a substring expression `aString[start:end]` also shares the same underlying byte sequence with the base string `aString` in memory.
    

Example:

```
package main

import (
	"fmt"
	"strings"
)

func main() {
	var helloWorld = "hello world!"

	var hello = helloWorld[:5] 
	
	fmt.Println(hello[0])         
	fmt.Printf("%T \n", hello[0]) 

	
	
	

	
	fmt.Println(len(hello), len(helloWorld),
			strings.HasPrefix(helloWorld, hello))
} 
```

Note, if `aString` and the indexes in expressions `aString[i]` and `aString[start:end]` are all constants, then out-of-range constant indexes will make compilations fail. And please note that the evaluation results of such expressions are always non-constants ([this might or might not change since a later Go version](https://github.com/golang/go/issues/28591)). For example, the following program will print `4 0`.

```
package main

import "fmt"

const s = "Go101.org" 

var a byte = 1 << len(s) / 128
var b byte = 1 << len(s[:]) / 128

func main() {
	fmt.Println(a, b) 
} 
```

Unicode standard specifies a unique value for each character in all kinds of human languages. But the basic unit in Unicode is not character, it is code point instead. For most code points, each of them corresponds to a character, but for a few characters, each of them consists of several code points.

Code points are represented as [rune values](https://go101.org/article/basic-types-and-value-literals.html#rune) in Go. In Go, `rune` is a built-in alias of type `int32`.

In applications, there are several encoding methods to represent code points, such as UTF-8 encoding and UTF-16 encoding. Nowadays, the most popularly used encoding method is UTF-8 encoding. In Go, all string constants are viewed as UTF-8 encoded. At compile time, illegal UTF-8 encoded string constants will make compilation fail. However, at run time, Go runtime can't prevent some strings from being illegally UTF-8 encoded.

For UTF-8 encoding, each code point value may be stored as one or more bytes (up to four bytes). For example, each English code point (which corresponds to one English character) is stored as one byte, however each Chinese code point (which corresponds to one Chinese character) is stored as three bytes.

In the article [constants and variables](https://go101.org/article/constants-and-variables.html#explicit-conversion), we have learned that integers can be explicitly converted to strings (but not vice versa).

Here introduces two more string related conversions rules in Go:

1.  a string value can be explicitly converted to a byte slice, and vice versa. A byte slice is a slice with element type's underlying type as `[]byte`.
    
2.  a string value can be explicitly converted to a rune slice, and vice versa. A rune slice is a slice whose element type's underlying type as `[]rune`.
    

In a conversion from a rune slice to string, each slice element (a rune value) will be UTF-8 encoded as from one to four bytes and stored in the result string. If a slice rune element value is outside the range of valid Unicode code points, then it will be viewed as `0xFFFD`, the code point for the Unicode replacement character. `0xFFFD` will be UTF-8 encoded as three bytes (`0xef 0xbf 0xbd`).

When a string is converted to a rune slice, the bytes stored in the string will be viewed as successive UTF-8 encoding byte sequence representations of many Unicode code points. Bad UTF-8 encoding representations will be converted to a rune value `0xFFFD`.

When a string is converted to a byte slice, the result byte slice is just a deep copy of the underlying byte sequence of the string. When a byte slice is converted to a string, the underlying byte sequence of the result string is also just a deep copy of the byte slice. A memory allocation is needed to store the deep copy in each of such conversions. The reason why a deep copy is essential is slice elements are mutable but the bytes stored in strings are immutable, so a byte slice and a string can't share byte elements.

Please note, for conversions between strings and byte slices,

*   illegal UTF-8 encoded bytes are allowed and will keep unchanged.
    
*   the standard Go compiler makes some optimizations for some special cases of such conversions, so that the deep copies are not made. Such cases will be introduced below.
    

Conversions between byte slices and rune slices are not supported directly in Go, We can use the following ways to achieve this goal:

*   use string values as a hop. This way is convenient but not very efficient, for two deep copies are needed in the process.
    
*   use the functions in [unicode/utf8](https://golang.org/pkg/unicode/utf8/) standard package.
    

Example:

```
package main

import (
	"bytes"
	"unicode/utf8"
)

func Runes2Bytes(rs []rune) []byte {
	n := 0
	for _, r := range rs {
		n += utf8.RuneLen(r)
	}
	n, bs := 0, make([]byte, n)
	for _, r := range rs {
		n += utf8.EncodeRune(bs[n:], r)
	}
	return bs
}

func main() {
	s := "Color Infection is a fun game."
	bs := []byte(s) 
	s = string(bs)  
	rs := []rune(s) 
	s = string(rs)  
	rs = bytes.Runes(bs) 
	bs = Runes2Bytes(rs) 
} 
```

Above has mentioned that the underlying bytes in the conversions between strings and byte slices will be copied. The standard Go compiler makes some optimizations, which are proven to still work in Go Toolchain 1.24.n, for some special scenarios to avoid the duplicate copies. These scenarios include:

*   a conversion (from string to byte slice) which follows the `range` keyword in a `for-range` loop.
    
*   a conversion (from byte slice to string) which is used as a map key in map element retrieval indexing syntax.
    
*   a conversion (from byte slice to string) which is used in a comparison.
    
*   a conversion (from byte slice to string) which is used in a string concatenation, and at least one of concatenated string values is a non-blank string constant.
    

Example:

```
package main

import "fmt"

func main() {
	var str = "world"
	
	
	for i, b := range []byte(str) {
		fmt.Println(i, ":", b)
	}

	key := []byte{'k', 'e', 'y'}
	m := map[string]string{}
	
	m[string(key)] = "value"
	
	
	
	fmt.Println(m[string(key)]) 
} 
```

Note, the last line might not output `value` if there are data races in evaluating `string(key)`. However, such data races will never cause panics.

Another example:

```
package main

import "fmt"
import "testing"

var s string
var x = []byte{1023: 'x'}
var y = []byte{1023: 'y'}

func fc() {
	
	
	
	
	if string(x) != string(y) {
		s = (" " + string(x) + string(y))[1:]
	}
}

func fd() {
	
	
	if string(x) != string(y) {
		
		
		s = string(x) + string(y)
	}
}

func main() {
	fmt.Println(testing.AllocsPerRun(1, fc)) 
	fmt.Println(testing.AllocsPerRun(1, fd)) 
} 
```

The `for-range` loop control flow applies to strings. But please note, `for-range` will iterate the Unicode code points (as `rune` values), instead of bytes, in a string. Bad UTF-8 encoding representations in the string will be interpreted as `rune` value `0xFFFD`.

Example:

```
package main

import "fmt"

func main() {
	s := "éक्षिaπ囧"
	for i, rn := range s {
		fmt.Printf("%2v: 0x%x %v \n", i, rn, string(rn))
	}
	fmt.Println(len(s))
} 
```

The output of the above program:

```
 0: 0x65 e
 1: 0x301 ́
 3: 0x915 क
 6: 0x94d ्
 9: 0x937 ष
12: 0x93f ि
15: 0x61 a
16: 0x3c0 π
18: 0x56e7 囧
21

```

From the output result, we can find that

1.  the iteration index value may be not continuous. The reason is the index is the byte index in the ranged string and one code point may need more than one byte to represent.
    
2.  the first character, `é`, is composed of two runes (3 bytes total)
    
3.  the second character, `क्षि`, is composed of four runes (12 bytes total).
    
4.  the English character, `a`, is composed of one rune (1 byte).
    
5.  the character, `π`, is composed of one rune (2 bytes).
    
6.  the Chinese character, `囧`, is composed of one rune (3 bytes).
    

Then how to iterate bytes in a string? Do this:

```
package main

import "fmt"

func main() {
	s := "éक्षिaπ囧"
	for i := 0; i < len(s); i++ {
		fmt.Printf("The byte at index %v: 0x%x \n", i, s[i])
	}
} 
```

Surely, we can also make use of the compiler optimization mentioned above to iterate bytes in a string. For the standard Go compiler, this way is a little more efficient than the above one.

```
package main

import "fmt"

func main() {
	s := "éक्षिaπ囧"
	
	for i, b := range []byte(s) {
		fmt.Printf("The byte at index %v: 0x%x \n", i, b)
	}
} 
```

From the above several examples, we know that `len(s)` will return the number of bytes in string `s`. The time complexity of `len(s)` is `%% O %%(1)`. How to get the number of runes in a string? Using a `for-range` loop to iterate and count all runes is a way, and using the [RuneCountInString](https://golang.org/pkg/unicode/utf8/#RuneCountInString) function in the `unicode/utf8` standard package is another way. The efficiencies of the two ways are almost the same. The third way is to use `len([]rune(s))` to get the count of runes in string `s`. Since Go Toolchain 1.11, the standard Go compiler makes an optimization for the third way to avoid an unnecessary deep copy so that it is as efficient as the former two ways. Please note that the time complexities of these ways are all `%% O %%(n)`.

Besides using the `+` operator to concatenate strings, we can also use following ways to concatenate strings.

*   The `Sprintf`/`Sprint`/`Sprintln` functions in the `fmt` standard package can be used to concatenate values of any types, including string types.
    
*   Use the `Join` function in the `strings` standard package.
    
*   The `Buffer` type in the `bytes` standard package (or the built-in `copy` function) can be used to build byte slices, which afterwards can be converted to string values.
    
*   Since Go 1.10, the `Builder` type in the `strings` standard package can be used to build strings. Comparing with `bytes.Buffer` way, this way avoids making an unnecessary duplicated copy of underlying bytes for the result string.
    

The standard Go compiler makes optimizations for string concatenations by using the `+` operator. So generally, using `+` operator to concatenate strings is convenient and efficient if all of the concatenated strings may present in a concatenation statement.

From the article [arrays, slices and maps](https://go101.org/article/container.html), we have learned that we can use the built-in `copy` and `append` functions to copy and append slice elements. In fact, as a special case, if the first argument of a call to either of the two functions is a byte slice, then the second argument can be a string (if the call is an `append` call, then the string argument must be followed by three dots `...`). In other words, a string can be used as a byte slice for the special case.

Example:

```
package main

import "fmt"

func main() {
	hello := []byte("Hello ")
	world := "world!"

	
	
	helloWorld := append(hello, world...) 
	fmt.Println(string(helloWorld))

	helloWorld2 := make([]byte, len(hello) + len(world))
	copy(helloWorld2, hello)
	
	
	copy(helloWorld2[len(hello):], world) 
	fmt.Println(string(helloWorld2))
} 
```

Above has mentioned that comparing two strings is comparing their underlying bytes actually. Generally, Go compilers will make the following optimizations for string comparisons.

*   For `==` and `!=` comparisons, if the lengths of the compared two strings are not equal, then the two strings must be also not equal (no needs to compare their bytes).
    
*   If their underlying byte sequence pointers of the compared two strings are equal, then the comparison result is the same as comparing the lengths of the two strings.
    

So for two equal strings, the time complexity of comparing them depends on whether or not their underlying byte sequence pointers are equal. If the two are equal, then the time complexity is `O(1)`, otherwise, the time complexity is `O(n)`, where `n` is the length of the two strings.

As above mentioned, for the standard Go compiler, in a string value assignment, the destination string value and the source string value will share the same underlying byte sequence in memory. So the cost of comparing the two strings becomes very small.

Example:

```
package main

import (
	"fmt"
	"time"
)

func main() {
	bs := make([]byte, 1<<26)
	s0 := string(bs)
	s1 := string(bs)
	s2 := s1

	
	
	
	
	
	

	startTime := time.Now()
	_ = s0 == s1
	duration := time.Now().Sub(startTime)
	fmt.Println("duration for (s0 == s1):", duration)

	startTime = time.Now()
	_ = s1 == s2
	duration = time.Now().Sub(startTime)
	fmt.Println("duration for (s1 == s2):", duration)
} 
```

Output:

```
duration for (s0 == s1): 10.462075ms
duration for (s1 == s2): 136ns

```

1ms is 1000000ns! So please try to avoid comparing two long strings if they don't share the same underlying byte sequence.

The **_Go 101_** project is hosted on [Github](https://github.com/go101/go101). Welcome to improve **_Go 101_** articles by submitting corrections for all kinds of mistakes, such as typos, grammar errors, wording inaccuracies, description flaws, code bugs and broken links.

If you would like to learn some Go details and facts every serveral days, please follow Go 101's official Twitter account [@zigo\_101](https://twitter.com/zigo_101).

Tapir, the author of Go 101, has been on writing the Go 101 series books and maintaining the go101.org website since 2016 July. New contents will be continually added to the book and the website from time to time. Tapir is also an indie game developer. You can also support Go 101 by playing [Tapir's games](https://www.tapirgames.com/) (made for both Android and iPhone/iPad):

*   [Color Infection](https://www.tapirgames.com/App/Color-Infection) (★★★★★), a physics based original casual puzzle game. 140+ levels.
*   [Rectangle Pushers](https://www.tapirgames.com/App/Rectangle-Pushers) (★★★★★), an original casual puzzle game. Two modes, 104+ levels.
*   [Let's Play With Particles](https://www.tapirgames.com/App/Let-Us-Play-With-Particles), a casual action original game. Three mini games are included.

Individual donations [via PayPal](https://paypal.me/tapirliu) are also welcome.