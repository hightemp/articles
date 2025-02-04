# Implementing The Fieldalignment Bundle in Go - SwitchUpCB
This simple optimization improves the performance of a Go program with minimal effort. It also has never been implemented until now. The **fieldalignment bundle** is a technique that you can use to minimize the amount of memory your application uses during runtime. This can result in a performance improvement due to the semantics of the Go Garbage Collector.

A system’s architecture (32-bit, 64-bit) defines the size (in bits) of each _word_ and how the memory of the system is aligned. The first factor serves as the basis for the size of primitive types _(i.e string, int, uint, etc)_ in the Go programming language. As an example, the sizes of basic types can be found in [`go/types/sizes.go:131`](https://cs.opensource.google/go/go/+/master:src/go/types/sizes.go;l=131?q=sizes.go).

The second factor serves as the basis for **struct padding**, which aligns the fields of structs to addresses in memory. This is done by padding — adding extra — bytes to a struct so it’s size is a multiple of a valid word size _(i.e 8 bytes \* multiple on 64-bit systems)_. The purpose of struct padding is to improve the performance of memory usage and prevent numerous other issues on a system's architecture.

_For more information on memory alignment, read_ [_Memory Layouts (Go)_](https://go101.org/article/memory-layout.html) _and_ [_Dealing With Maligned Structs_](https://medium.com/@sebassegros/golang-dealing-with-maligned-structs-9b77bacf4b97)_._

**Fieldalignment** is the process of aligning the fields in Go structs in order to minimize the size of the struct (in memory). As an example, reorganizing the order of a struct’s fields can reduce its size from 24 bytes to 16 bytes. In the Go programming language, issues with fieldalignment can be fixed using the [fieldalignment tool](https://pkg.go.dev/golang.org/x/tools/go/analysis/passes/fieldalignment) which is installed using `go install golang.org/x/tools/go/analysis/passes/fieldalignment/cmd/fieldalignment@latest`.

Using the `fieldalignment` command will tell you where misaligned fields are in your program. Using the `-fix` flag will fix these issues for you while using `-json` will print out diagnostics in the JSON format. As a **WARNING**, running `fieldalignment -fix ./…` may remove comments from your fields due to the underlying difficulty in manipulating free-floating comments within the Go Abstract Syntax Tree. This problem is being resolved in [https://github.com/golang/go/issues/20744](https://github.com/golang/go/issues/20744), but it has taken Go's creators 5 years to make any progress.

```
file.go:17:14: struct with 64 pointer bytes could be 56
```

What are the benefits?
----------------------

The benefits of fieldalignment are observed in bulk. If your application saves _8 bytes per struct_ through fieldalignment, this will save you **8 MB** of memory for every struct that is used within 1 MILLION requests. That allows you to save money on memory resources, and may even reduce the amount of peaks within the [Go Garbage Collector](https://agrim123.github.io/posts/go-garbage-collector.html) _(which improves performance over time)_. To be specific, Go uses a _Stop The World Garbage Collector_ which triggers at a target heap size. Garbage Collector latency can be reduced by maintaining the smallest heap possible at a consistent pace.

_This is also the rationale behind using zero-allocation libraries._

Caveat
------

Alan Donovan is a software engineer at Google and the co-author of the Go programming language. What does he have to say about fieldalignment?

> "The fixes applied by fieldalignment should be reviewed, since in some cases they may [degrade performance](https://cs.opensource.google/go/x/tools/+/refs/tags/v0.3.0:go/analysis/passes/fieldalignment/fieldalignment.go;l=45-48) and they can certainly cause tests that rely on field order (via reflection) to fail."
> 
> Alan Donovan ([comment](https://github.com/golang/go/issues/57091#issuecomment-1338150430))

Fieldalignment can result in performance degradation as a compact field order can cause two variables (in separate goroutines) that are updated at the same time to occupy the same CPU cache line: This results in a form of memory contention called [false sharing](https://en.wikipedia.org/wiki/False_sharing). When false sharing occurs, the first variable that is being updated is forced to reload a CPU cache block even though it's not required. Thus, both goroutines updating each variable are slowed down.

_Due to this caveat, it's recommended to benchmark your fieldaligned code._

In the context of software development, a bundle represents a collection of files or sources. In the context of this article, a bundle represents a single-file version of an entire source package. Therefore, a bundle is achieved by combining all the source (`.go`) files of your application into a single `.go` file. This may be done for many reasons; such as the one in this article. Bundling can be achieved in Go by using the [`bundle`](https://pkg.go.dev/golang.org/x/tools/cmd/bundle) tool which is installed using `go install golang.org/x/tools/cmd/bundle@latest`. 

Using the `bundle` command bundles the application into a single file. However, this can generate a file that contains collisions in its imports. Fixing imports in the file's output is possible through the `-import new=old` flag, but there are other cases that you have to fix manually. An issue ([https://github.com/golang/go/issues/57088](https://github.com/golang/go/issues/57088)) is being worked on in order to address these cases.

Caveat
------

Due to "[shadowing](https://cs.opensource.google/go/x/tools/+/refs/tags/v0.3.0:cmd/bundle/main.go;l=259)", there is a possibility for bundled code to compile successfully but maintain different behavior from the original package.

_Due to this caveat, it's imperative that you test your bundled code in a CICD pipeline._

The **fieldalignment bundle** technique involves bundling your source code, then fieldaligning it. However, this must be completed in a way that still allows developers to maintain the codebase in an easy manner. Instead of converting your codebase to a bundle or fieldaligning it directly, you must create a copy of the codebase and modify that copy. This allows you to maintain a human readable version that developers can work on.

It's recommended to define the **fieldalignment bundle** in its own module, such that a build will _never_ include both. The other benefit to defining another module is realized while testing: Instead of forcing developers to switch modules in tests via `find and replace` operation _(i.e module/a to b)_, one can swap between each module by using a single line replace directive ([module](https://go.dev/ref/mod#go-mod-file-replace)/[workspace](https://go.dev/ref/mod#go-work-file-replace)).

_This implementation also makes using the fieldalignment bundle within CICD pipelines easy, since no extra work will be required to test the code. _

An Implementation
-----------------

[Disgo](https://github.com/switchupcb/disgo) is the first open source repository to implement the **fieldalignment bundle** in a documented manner. Disgo uses the technique since it is based on an API Types Library ([Dasgo](https://github.com/switchupcb/dasgo)), which defines how types are ordered. The entire code generator process of Disgo is described in `[_gen/README.md](https://github.com/switchupcb/disgo/blob/v10/_gen/README.md)`. The bundle file (`disgo.go`) code generator is located in `[_gen/bundle](https://github.com/switchupcb/disgo/tree/v10/_gen/bundle)`.

Due to bugs within the bundle command code (from `x/tools/cmd`), a `go generate` workaround must be implemented. As a result, the following steps are used to implement a fieldalignment bundle in Go.

1.  Clear the bundle file.
2.  Add the go generate comment to the file.
3.  Call go generate.
4.  Resolve the bundle file imports.
5.  Fieldalign the code. You must call the fieldalignment executable from your code multiple times due to the following reasons.
    *   In certain cases, fieldalignment must be run multiple times in order to be applied in full. This is indicated by an exit code 3 when the `-json` flag is not used.
    *   Using the `-json` flag while calling fieldalignment in this manner can result in an exit code 1 _(analysis errors)_ without suggested fixes _(as opposed to the statement in [https://github.com/golang/go/issues/57091](https://github.com/golang/go/issues/57091))_.
    *   None of the `golang.org/x/tools` use exported functions.

### Fixing Removed Comments

When you use a version control software such as Git, you may notice within the _diff_ that certain fields have their comments removed. In certain cases, a fix is as simple as reordering the fields _(such that they are not modified by the fieldalignment tool)_. In other cases, reordering fields ruins the quality of your documentation. While there are are many ways to resolve the outlined problem, the most simplistic is to use a `find and replace` function within the bundle file code generator.

A simple `strings.Replace` function call won't work since the amount of spaces _(padding)_ within a line may differ. Disgo solves this issue in a [multi-step process](https://github.com/switchupcb/disgo/tree/v10/_gen#comments) that involves defining the fielaligned struct _(without comments)_ to the fieldaligned struct _(with comments)_ in a text file. Prior to string comparison, these text files and the bundled file are stripped of space, such that text spanning multiple lines can be compared. Once this has occurred, a replace operation can be used without error.