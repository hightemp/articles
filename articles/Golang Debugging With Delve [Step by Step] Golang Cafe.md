# Golang Debugging With Delve [Step by Step] | Golang Cafe
In this article we are going to see how to debug Go (Golang) programs using Delve. Delve is a third-party debugger for the Go programming language and it’s available on github [https://github.com/go-delve/delve](https://github.com/go-delve/delve). It’s a valid alternative to the GDB golang debugger ([https://golang.org/doc/gdb](https://golang.org/doc/gdb)) as it’s more feature rich as mentioned in the official [Go GDB website](https://golang.org/doc/gdb)

> Note that [Delve](https://github.com/go-delve/delve) is a better alternative to GDB when debugging Go programs built with the standard toolchain. It understands the Go runtime, data structures, and expressions better than GDB. Delve currently supports Linux, OSX, and Windows on `amd64`. For the most up-to-date list of supported platforms, please see [the Delve documentation](https://github.com/go-delve/delve/tree/master/Documentation/installation).

Objective
---------

By the end of this article you are going to be able to easily debug and inspect Go programs using the delve debugger command line tool. We are going to see how to view, add and change breakpoints in a Go program, navigate the program line by line or through breakpoints, inspect variables, functions and expressions values and finally analyse all our programs in detail.

Download and Install Go Delve
-----------------------------

Go delve can be downloaded and installed by just using the `go get` command

**Linux, Windows, OSX**

```
$ go get github.com/go-delve/delve/cmd/dlv 
```

*   If you are using Go modules you might want to execute this command outside your project directory to avoid delve being added as a dependency in your go.mod file

The following should already be setup if you have a working Go installation:

*   Make sure GOBIN env variable is properly set, which will indicate the directory where the `dlv` (delve) command will be stored. You can check by typing `go env GOBIN`
*   Make sure PATH contains GOBIN which will allow you to run Go binary executables without specifying the absolute path

**OSX**  
In mac OS you might also need to enable developer tools by typing the following

```
xcode-select --install 
```

Check Your Installation
-----------------------

Once you have finalised your installation you can check that delve has been installed successfully by checking the version

```
$ dlv version
Delve Debugger
Version: 1.5.1
Build: $Id: bca418ea7ae2a4dcda985e623625da727d4525b5 $ 
```

This means you have successfully installed delve. Let’s get cracking with the debugging now.

Start Debugging (Delve Server)
------------------------------

When we start debugging we usually mean, we start a “debugging session”. To start a debugging session you can use one of the commands that are made available from the dlv command line help

```
$ dlv help
...

Usage:
dlv [command]

Available Commands:

attach  Attach to running process and begin debugging.
connect Connect to a headless debug server.
core  Examine a core dump.
dap [EXPERIMENTAL] Starts a TCP server communicating via Debug Adaptor Protocol (DAP).
debug Compile and begin debugging main package in current directory, or the package specified.
exec  Execute a precompiled binary, and begin a debug session.
help  Help about any command
run Deprecated command. Use 'debug' instead.
test  Compile test binary and begin debugging program.
trace Compile and begin tracing program.
version Prints version. 
```

The commands that are interesting to us are `dlv debug` and `dlv exec` which are both used to start a debugging session, the only difference is that one (dlv debug) does also compile the binary from source, the other (dlv exec) expects to have a compiled binary.

The `test` command is also useful if we want to debug a Go test.

Golang Debugging Code Example
-----------------------------

The below code snippet represents the code example we are going to use for our debugging session, it’s a fibonacci implementation.

```
package main

import "fmt"

var m = make(map[int]int, 0)

func main() {
    for _, n := range []int{5, 1, 9, 98, 6} {
        x := fib(n)
        fmt.Println(n, "fib", x)
    }
}

func fib(n int) int {
    if n < 2 {
        return n
    }

    var f int
    if v, ok := m[n]; ok {
        f = v
    } else {
        f = fib(n-2) + fib(n-1)
        m[n] = f
    }

    return f
} 
```

You can check and run this code snippet in the [Go playground](https://play.golang.org/p/PZ5b_-_K1b5)

We need to pass a main package which wil be compiled and executed for debugging.

```
dlv debug main.go
Type 'help' for list of commands.
(dlv) 
```

This will start the debugging session. This is also known as delve server as it’s a running process waiting for instructions.

The Delve Client
----------------

Once our debugging session has started, we have compiled and attached to a Go binary we can start debugging our program. We are now presented with a new repl which is just a delve interpreter, which you can also call a “delve client”, that will send debugging instructions to our previously created delve server.

We can see all available commands by typing the following.

```
Type 'help' for list of commands.
(dlv) help
The following commands are available:

Running the program:
call ------------------------ Resumes process, injecting a function call (EXPERIMENTAL!!!)
continue (alias: c) --------- Run until breakpoint or program termination.
next (alias: n) ------------- Step over to next source line.
rebuild --------------------- Rebuild the target executable and restarts it. It does not work if the executable was not built by delve.
restart (alias: r) ---------- Restart process.
step (alias: s) ------------- Single step through program.
step-instruction (alias: si)  Single step a single cpu instruction.
stepout (alias: so) --------- Step out of the current function.

Manipulating breakpoints:
break (alias: b) ------- Sets a breakpoint.
breakpoints (alias: bp)  Print out info for active breakpoints.
clear ------------------ Deletes breakpoint.
clearall --------------- Deletes multiple breakpoints.
condition (alias: cond)  Set breakpoint condition.
on --------------------- Executes a command when a breakpoint is hit.
trace (alias: t) ------- Set tracepoint.

Viewing program variables and memory:
args ----------------- Print function arguments.
display -------------- Print value of an expression every time the program stops.
examinemem (alias: x)  Examine memory:
locals --------------- Print local variables.
print (alias: p) ----- Evaluate an expression.
regs ----------------- Print contents of CPU registers.
set ------------------ Changes the value of a variable.
vars ----------------- Print package variables.
whatis --------------- Prints type of an expression.

  

Listing and switching between threads and goroutines:
goroutine (alias: gr) -- Shows or changes current goroutine
goroutines (alias: grs)  List program goroutines.
thread (alias: tr) ----- Switch to the specified thread.
threads ---------------- Print out info for every traced thread.

Viewing the call stack and selecting frames:
deferred --------- Executes command in the context of a deferred call.
down ------------- Move the current frame down.
frame ------------ Set the current frame, or execute command on a different frame.
stack (alias: bt)  Print stack trace.
up --------------- Move the current frame up.

  
Other commands:
config --------------------- Changes configuration parameters.
disassemble (alias: disass)  Disassembler.
edit (alias: ed) ----------- Open where you are in $DELVE_EDITOR or $EDITOR
exit (alias: quit | q) ----- Exit the debugger.
funcs ---------------------- Print list of functions.
help (alias: h) ------------ Prints the help message.
libraries ------------------ List loaded dynamic libraries
list (alias: ls | l) ------- Show source code.
source --------------------- Executes a file containing a list of delve commands
sources -------------------- Print list of source files.
types ---------------------- Print list of types

Type help followed by a command for full documentation. 
```

There are a few available commands but we can easily split them in different focus areas to better understand how to approach the delve client.

### General Delve commands

The first command I would bring to your attention is the `list` command which allows us to list the source code of a given location. We can specify a location by passing a package name and a function or a file path and a line. For example

**List**  
shows source code by package and function name

```
(dlv) list main.main
Showing /workspace/tutorials/delve/main.go:7 (PC: 0x10d145b)
2:
3: import "fmt"
4:
5: var m = make(map[int]int, 0)
6:
7: func main() {
8:   for _, n := range []int{5, 1, 9, 98, 6} {
9:     x := fib(n)
10:    fmt.Println(n, "fib", x)
11:  }
12: }
(dlv) 
```

**List**  
shows source code by file name and line number

```
(dlv) list ./main.go:14
Showing /workspace/tutorials/delve/main.go:14 (PC: 0x10d1713)
9:      x := fib(n)
10:     fmt.Println(n, "fib", x)
11:   }
12: }
13:
14: func fib(n int) int {
15:   if n < 2 {
16:     return n
17:   }
18:
19:   var f int
(dlv) 
```

There is also a command to search for functions given a pattern

**Funcs**

```
(dlv) funcs fib
main.fib 
```

**Exit**

if you are stuck in the debugging session you can exit

```
(dlv) exit 
```

### Adding Breakpoints with Delve

Once you know how to display on screen a section of your source code using the delve **list** command, you might want to start adding breakpoints in your program, in the areas where you want then to stop and inspect variables and other expressions values.  
For this basic example let’s say that we want to add a breakpoint at line 10 in the main.go file, which we have seen already in the previous **list** example. This will be done by using the **break** keyword followed by the location where you want to add the breakpoint.

**break**  
This will add a breakpoint to the specified location and also listing where this breakpoint will be used in line 10

```
(dlv) break ./main.go:10
Breakpoint 1 set at 0x10d155d for main.main() ./main.go:10
(dlv) list ./main.go:10
Showing /workspace/tutorials/delve/main.go:10 (PC: 0x10d155d)
5: var m = make(map[int]int, 0)
6:
7: func main() {
8:   for _, n := range []int{5, 1, 9, 98, 6} {
9:     x := fib(n)
10:    fmt.Println(n, "fib", x)
11:  }
12: }
13:
14: func fib(n int) int {
15:   if n < 2 {
(dlv) 
```

**breakpoints**  
To list all current breakpoints for this debugging session

```
(dlv) breakpoints
Breakpoint runtime-fatal-throw at 0x10388c0 for runtime.fatalthrow() /usr/local/go/src/runtime/panic.go:1162 (0)
Breakpoint unrecovered-panic at 0x1038940 for runtime.fatalpanic() /usr/local/go/src/runtime/panic.go:1189 (0)
print runtime.curg._panic.arg
Breakpoint 1 at 0x10d155d for main.main() ./main.go:10 (0) 
```

In this example we can see 3 breakpoints. The first 2 are automatically added by delve and used as safeguard for panics and fatal errors so that we are able to pin point the status of our program and inspect variables, stack trace and status.

The third breakpoint which says _Breakpoint 1_ is the one we have added at line 10.

> Try add new breakpoints and see how are then displayed in the list here!

**clear**  
To remove a specific breakpoint from the debugging session

```
(dlv) clear 1
Breakpoint 1 cleared at 0x10d155d for main.main() ./main.go:10 
```

This is useful if you want to remove a specific breakpoint that you added by mistake or just because you needed to remove and start debugginig some other area of the same program.

**clearall**  
To cleanup all manually added breakpoints

```
(dlv) break ./main.go:8
Breakpoint 1 set at 0x10d1472 for main.main() ./main.go:8
(dlv) break ./main.go:9
Breakpoint 2 set at 0x10d154a for main.main() ./main.go:9
(dlv) break ./main.go:10
Breakpoint 3 set at 0x10d155d for main.main() ./main.go:10
(dlv) breakpoints
Breakpoint runtime-fatal-throw at 0x10388c0 for runtime.fatalthrow() /usr/local/go/src/runtime/panic.go:1162 (0)
Breakpoint unrecovered-panic at 0x1038940 for runtime.fatalpanic() /usr/local/go/src/runtime/panic.go:1189 (0)
print runtime.curg._panic.arg
Breakpoint 1 at 0x10d1472 for main.main() ./main.go:8 (0)
Breakpoint 2 at 0x10d154a for main.main() ./main.go:9 (0)
Breakpoint 3 at 0x10d155d for main.main() ./main.go:10 (0)
(dlv) clearall
Breakpoint 1 cleared at 0x10d1472 for main.main() ./main.go:8
Breakpoint 2 cleared at 0x10d154a for main.main() ./main.go:9
Breakpoint 3 cleared at 0x10d155d for main.main() ./main.go:10 
```

In the example above we have created **3 breakpoints**, at **line 8, 9 and 10**. We display all breakpoints and then we clear all breakpoints at once. This can be quite handy when you want to **cleanup all the breakpoints at once** and move to debug another area of the same program.

### Running and Navigating the program with Delve

Once we have setup all breakpoints and we are able to inspect any part of our source code by using list, we can now see how we can actually “debug” and run our program in debug mode by using a set of very powerful commands.

**continue**  
Runs the program until the next breakpoint or until the program terminates

```
(dlv) break ./main.go:10
Breakpoint 1 set at 0x10d155d for main.main() ./main.go:10
(dlv) continue
> main.main() ./main.go:10 (hits goroutine(1):1 total:1) (PC: 0x10d155d)
    5: var m = make(map[int]int, 0)
    6:
    7: func main() {
    8:   for _, n := range []int{5, 1, 9, 98, 6} {
    9:     x := fib(n)
=> 10:     fmt.Println(n, "fib", x)
   11:   }
   12: }
   13:
   14: func fib(n int) int {
   15:   if n < 2 { 
```

After setting a breakpoint to line 10 in the main.go file, we can just run **continue** and our debugger will run the program up until the next breakpoint, which in our case is just the breakpoint 1 at line 10. At this point we can do quite a few things, like inspecting and changing variables contents. But first let’s see what other commands we can use to navigate our Go program.

**next**  
Goes to the next source line

```
(dlv) next
5 fib 5
> main.main() ./main.go:8 (PC: 0x10d1693)
   3: import "fmt"
   4:
   5: var m = make(map[int]int, 0)
   6:
   7: func main() {
=> 8:   for _, n := range []int{5, 1, 9, 98, 6} {
   9:     x := fib(n)
  10:     fmt.Println(n, "fib", x)
  11:   }
  12: }
  13: 
```

As simple as that! The **next** command just allows us to go ahead one instruction at a time as specified in the source code, regardless of whether there are breakpoints or not. This is quite useful if you want to analyse a program step by step

**step**  
Step or as I like to call it “step in” is used to tell the debugger to go inside a function call, it’s like next, but used to go a level deeper when encoutering function calls.

```
(dlv) next
> main.main() ./main.go:9 (PC: 0x10d154a)
   4:
   5: var m = make(map[int]int, 0)
   6:
   7: func main() {
   8:   for _, n := range []int{5, 1, 9, 98, 6} {
=> 9:     x := fib(n)
  10:     fmt.Println(n, "fib", x)
  11:   }
  12: }
  13:
  14: func fib(n int) int {
(dlv) step
> main.fib() ./main.go:14 (PC: 0x10d1713)
    9:     x := fib(n)
   10:     fmt.Println(n, "fib", x)
   11:   }
   12: }
   13:
=> 14: func fib(n int) int {
   15:   if n < 2 {
   16:     return n
   17:   }
   18:
   19:   var f int 
```

With **step** we can then go **inside** a function definition instead of just calculating it’s value and moving on. This is quite useful when following the logic of multiple function calls that return results we want to investigate the nature and origins of. When using **step** on lines that are not function calls, it will behave just like a **next** delve instruction. It proceeds line by line.

**stepout**  
The reason why I like to call **step**, stepin is because its counterpart, **stepout** is exactly the opposite of step. It brings us back to the caller of the function we are at.

```
(dlv) stepout
> main.main() ./main.go:9 (PC: 0x10d1553)
Values returned:
~r1: 1
   4:
   5: var m = make(map[int]int, 0)
   6:
   7: func main() {
   8:   for _, n := range []int{5, 1, 9, 98, 6} {
=> 9:     x := fib(n)
  10:     fmt.Println(n, "fib", x)
  11:   }
  12: }
  13:
  14: func fib(n int) int { 
```

**restart**  
Restart will allows us to restart the program in case the program terminates and we still want to debug. This is especially useful if we don’t want to lose all our breakpoints and don’t want to exit and create a new delve debugging server from scratch

```
(dlv) clearall
Breakpoint 4 cleared at 0x10d155d for main.main() ./main.go:10
(dlv) continue
1 fib 1
9 fib 34
98 fib 6174643828739884737
6 fib 8
Process 39014 has exited with status 0
(dlv) restart
Process restarted with PID 39050 
```

In our example, we just cleanup all breakpoints, continue so that the program runs all the way to termination and restart the process again. Now we can have a fresh go and start debugging again withouth having to restart the debugging from scratch.

### How to view program variables with Delve

So far we have seen how to add and manage breakpoints, how to navigate easily everywhere in the program using delve. Now we just need to be able to view and edit program variables and memory, which is a fundamental part of the debugging process. There are a bunch of very useful delve commands that we can use for this purpose.

**print**  
Print is the easiest one and allows us to see variables content and evaluate expressions

```
(dlv) break ./main.go:10
Breakpoint 1 set at 0x10d155d for main.main() ./main.go:10
(dlv) continue
> main.main() ./main.go:10 (hits goroutine(1):1 total:1) (PC: 0x10d155d)
    5: var m = make(map[int]int, 0)
    6:
    7: func main() {
    8:   for _, n := range []int{5, 1, 9, 98, 6} {
    9:     x := fib(n)
=> 10:     fmt.Println(n, "fib", x)
   11:   }
   12: }
   13:
   14: func fib(n int) int {
   15:   if n < 2 {
(dlv) print x
5 
```

In the example above we have just set the breakpoint to our main.go at line 10 and printed the value of the variable x which is the fibonacci value for the sequence at position 5 as denoted in the above code.

> You can now try to navigate inside the fib function and try to print various values, such as `n` or the `m` map variable!

**locals**  
The locals command can be quite useful to investigate the contents of all local variables

```
(dlv) list
> main.main() ./main.go:10 (hits goroutine(1):1 total:1) (PC: 0x10d155d)
    5: var m = make(map[int]int, 0)
    6:
    7: func main() {
    8:   for _, n := range []int{5, 1, 9, 98, 6} {
    9:     x := fib(n)
=> 10:     fmt.Println(n, "fib", x)
   11:   }
   12: }
   13:
   14: func fib(n int) int {
   15:   if n < 2 {
(dlv) locals
n = 5
x = 5 
```

Conclusions
-----------

This set of commands should be more than enough for you to go and debug your Go applications with confidence. The Go delve debugger is also available for use in all major Go editors and IDEs, you can check the list of available integrations here [https://github.com/go-delve/delve/blob/master/Documentation/EditorIntegration.md](https://github.com/go-delve/delve/blob/master/Documentation/EditorIntegration.md).

If you master the use of the Go Delve command line debugger it will be even easier to work with the other editor integrated versions which follow the same concepts and structure.

I am planning to release a second part of the Go Delve debugging guide exclusively dedicated to goroutine debugging. Thanks for reading and I hope you liked this content!

Go Debugging with Delve YouTube Tutorial
----------------------------------------

[![](https://img.youtube.com/vi/a1SneuI65O0/0.jpg)
](https://www.youtube.com/watch?v=a1SneuI65O0)