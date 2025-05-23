# There is no pass-by-reference in Go | Dave Cheney
[My post on pointers](https://dave.cheney.net/2017/04/26/understand-go-pointers-in-less-than-800-words-or-your-money-back) provoked a lot of debate about maps and pass by reference semantics. This post is a response to those debates.

To be clear, Go does not have reference variables, so Go does not have pass-by-reference function call semantics.

In languages like C++ you can declare an _alias_, or an _alternate name_ to an existing variable. This is called a _reference variable_.

#include <stdio.h>

int main() {
        int a = 10;
        int &b = a;
        int &c = b;

        printf("%p %p %p\\n", &a, &b, &c); // 0x7ffe114f0b14 0x7ffe114f0b14 0x7ffe114f0b14
        return 0;
}

You can see that `a`, `b`, and `c` all refer to the same memory location. A write to `a` will alter the contents of `b` and `c`. This is useful when you want to declare reference variables in different scopes–namely function calls.

Unlike C++, each variable defined in a Go program occupies a unique memory location.

package main

import "fmt"

func main() {
        var a, b, c int
        fmt.Println(&a, &b, &c) // 0x1040a124 0x1040a128 0x1040a12c
}

It is not possible to create a Go program where two variables share the same storage location in memory. It is possible to create two variables whose contents _point_ to the same storage location, but that is not the same thing as two variables who share the same storage location.

package main

import "fmt"

func main() {
        var a int
        var b, c = &a, &a
        fmt.Println(b, c)   // 0x1040a124 0x1040a124
        fmt.Println(&b, &c) // 0x1040c108 0x1040c110
}

In this example, `b` and c hold the same value–the address of `a`–however, `b` and `c` themselves are stored in unique locations. Updating the contents of `b` would have no effect on `c`.

Wrong. Maps and channels are not references. If they were this program would print `false`.

package main

import "fmt"

func fn(m map\[int\]int) {
        m = make(map\[int\]int)
}

func main() {
        var m map\[int\]int
        fn(m)
        fmt.Println(m == nil)
}

If the map `m` was a C++ style reference variable, the `m` declared in `main` and the `m` declared in `fn` would occupy the same storage location in memory. But, because the assignment to `m` inside `fn` has no effect on the value of `m` in main, we can see that maps are not reference variables.

Go does not have pass-by-reference semantics because Go does not have reference variables.

Next: [If a map isn’t a reference variable, what is it?](https://dave.cheney.net/2017/04/30/if-a-map-isnt-a-reference-variable-what-is-it)