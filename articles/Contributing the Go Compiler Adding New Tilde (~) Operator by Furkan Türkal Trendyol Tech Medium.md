# Contributing the Go Compiler: Adding New Tilde (~) Operator | by Furkan Türkal | Trendyol Tech | Medium
[

![](https://miro.medium.com/v2/resize:fill:44:44/1*oCyql7xWUiEhSocUVI6jSg.jpeg)






](https://medium.com/@furkan.turkal?source=post_page---byline--f66d0c6cff7---------------------------------------)

[

![](https://miro.medium.com/v2/resize:fill:24:24/1*posh7DaGCQA8Ku-qkxrdyQ.jpeg)






](https://medium.com/trendyol-tech?source=post_page---byline--f66d0c6cff7---------------------------------------)

Compilers have always had challenges to be solved, even today. Go is not so different too. There are so many things to do, so many problems to solve, so many features to implement… That’s why there is no such thing as “OK, this compiler is fully completed.”. It is almost impossible to say. In these years, we are actually so lucky that we have the opportunity to witness how legacy compiler structures are being restructured, improved, and increased efficiently together with the applying of modern approaches and solutions.

My obsession with compilers began while trying to write a simple memory reader with AutoIt for Silkroad Online. Something was somehow working perfectly integrated with the grace of God. So, how do they do it? I knew it would take me years to answer this question. But, it shouldn’t have been left unanswered. There are so many things to learn before digging into compilers. Missing or not knowing any of this information may be a major obstacle to our learning process. From CPU scheduling to Memory management, from logic design to instruction set architecture… Remember that we are trying to climb an enormous tree with an infinite number of branches. The soil of this tree is physics, obviously. I have learned that I still have a lot to learn.

Especially in the last two years, I had the opportunity to think a lot about compilers due to the pandemic. I have read many articles, papers, took a lot of notes, lot of trying. Monkey, which is one of the sources that inspired me. Do you like Monkey? Thorsten Ball did. Somehow, I came across an excellent book called “Writing A Compiler In Go”. After implementing the whole book in Rust, I immediately found the opportunity to clone the Go source code to examine further and strengthen the knowledge. In this learning process, an idea came to my mind that could answer questions such as “What have I learned?, What will I learn?, What I would like to learn?” and that I would enjoy sharing what I learned with you. Then I tried to write this article as much as I could. Do not forget to bring your coffee and background music with you. It is going to be a bit long journey.

This study conceptualizes, examines, and aims the implementation process for a bitwise complement operator `~` _(pronounced as tilde)_ in Go. Even though this article does not follow any official Go proposal, it will provide a guideline for writing a technical proposal for this operator initially. This article will describe a set of specific instructions for the step-by-step learning of the full implementation process.  The first chapters will provide a brief introduction about Compiler Front-Ends and Compiler Back-Ends and describe the Tokenizer, Abstract Syntax Tree (AST), Parser, Scanner and deep-dives to more Compiler Back-End parts of Op-Code, Intermediate Representation (IR), Static Single Assignment (SSA), architecture-based code generation, architecture based optimizer rules, and finally introduces a brand-new tilde operator. This background information lays the groundwork for the implementation of the operator in subsequent chapters.

Currently, Go [does not have support](https://golang.org/ref/spec#Operators) for the`~` unary operator. Neither implemented in the [original frontend](https://github.com/golang/gofrontend/blob/master/go/operator.h). I could find neither an actively discussing [issue](https://github.com/golang/go/issues?q=tilde) nor a [PR](https://github.com/golang/go/pulls?q=tilde). If you would ask why humankind on Earth who writes Go code needs an `~` operator: Why not? It is a great opportunity to learn compiler theory and start contributing to Go.

I have never contributed to Go before. Together, we will learn how to contribute. In doing so, we will follow Go’s official documentation step by step. We _will_ get feedback from the proposal that we are going to open up. Or maybe it will just be closed. But what we are aiming for is not whether the proposal we are doing got accepted or not. The point is to be able to do something educational and learn the process.

Actually, I do not know if we are going to do it correctly. But we can improve our implementation by getting feedback from the maintainers and the contributors.

**P.S.:** _While I started writing this work, there is no such operator called Tilde. I just wanted to pull the latest commits from the master branch. What did I see? This operator_ [_has been added_](https://github.com/golang/go/commit/4bbe046aad2ca27f25d3811b061fb8f7926b8695) _by_ [_griesemer_](https://github.com/griesemer)_. :( Yep, I couldn’t first :) So, I updated this post consequently._

1.⠀Introduction  
⠀1.1.⠀Becoming a Contributor  
⠀1.2.⠀Preparing Environment  
⠀1.3.⠀Writing Proposal  
2.⠀Compiler Front-End  
⠀2.1.⠀go/\* (Legacy)  
⠀⠀2.1.1.⠀Token  
⠀⠀⠀2.1.1.1. Operator Precedence  
⠀⠀2.1.2.⠀AST  
⠀⠀2.1.3.⠀Scanner  
⠀⠀2.1.4.⠀Parser  
⠀⠀2.1.5.⠀Constant  
⠀⠀2.1.6.⠀Math  
⠀⠀2.1.6.1.⠀big.Int  
⠀2.2.⠀cmd/compile  
⠀⠀2.2.1.⠀Differences with go/\*  
⠀⠀2.2.2.⠀Creating Test Script  
⠀⠀2.2.3.⠀Token  
⠀⠀⠀2.2.3.1.⠀Operator String  
⠀⠀⠀2.2.3.2.⠀[Stringer](https://pkg.go.dev/golang.org/x/tools/cmd/stringer#pkg-overview)  
⠀⠀2.2.4.⠀Scanner  
⠀⠀2.2.5.⠀Parser  
3\. Compiler Middle-End  
⠀3.1.⠀Intermediate Representation  
⠀⠀3.1.1.⠀Node  
⠀⠀3.1.2.⠀Expr  
⠀3.2.⠀Escape Analysis  
⠀3.3.⠀Walk  
⠀3.4.⠀Constant  
⠀3.5.⠀Math  
⠀⠀3.5.1.⠀big.Int  
4.⠀Compiler Back-End  
⠀4.1.⠀Introduction  
⠀4.2.⠀Static Single Assignment (SSA)  
⠀4.3.⠀Go’s SSA Backend  
⠀4.3.1.⠀Generic OPs  
⠀4.3.2.⠀Rewrite Rules  
5.⠀Result  
⠀5.1.⠀Trying New Operator  
⠀5.2.⠀Test & Build Go Compiler  
6.⠀Conclusion  
7.⠀Furthermore  
8.⠀References  
⠀8.1.⠀Normative  
⠀8.2.⠀Informative

Programming languages are not magical. They were built by blood, sweat, and tears. We _may_ do not know what kind of difficulties they had been going through. What we know about them is that every single language “just works”. Have you ever asked yourself “how”? Well, never mind, neither did I. But instead, I rather keep telling myself, “It is more important the know how something can be created _from scratch_” rather than “How it works?”. If we knew _“How to create something”_, it would be easier for us to understand _“How it works?”._ Moreover, we can have the skills and knowledge to answer this question ourselves. Let’s move on to what we’re going to do without too much noisy talk. We are not going to release a book at the end of the day, are we?

What we will be achieving in this article is such a brand-new _tilde_ `~` operator in Go. So, first things first, we are going to write an educational [proposal](https://github.com/golang/proposal) by opening an issue at GitHub. Then, we will prepare our build environment, and we follow the Go contribution guideline, open-source culture, and standards.

We can consider this article in two parts in general: Compiler Front-End and Compiler Back-End. In the Compiler Frond-End section, we will see what an _Abstract Syntax Tree (AST)_ is, extract AST using Scanner, what _Tokens_ are, how tokens are read by _Parser_ and create meaningful statements… In the Compiler Back-End section, we will start implementing core logic, a.k.a. One’s Complement _(bitwise not)_, Op-Code with auto code generation. Then, we will touch SSA a bit for creating architecture-based optimizer rules (i.e., RISCV64, Generic). Finally, we will deep dive into the Go Compiler universe for the final touches. Let the party begin!

1.1. Becoming a Contributor
---------------------------

The Go project welcomes all contributors. The first step is registering as a Go contributor and configuring your environment. Here is a checklist of the required steps to follow: [\[0\]](https://golang.org/doc/contribute#contributor)

*   **Step 0**: Decide on a single Google Account you will be using to contribute to Go. Use that account for all the following steps and make sure that `git` is configured to create commits with that account's e-mail address.

```
$ git config --global user.email name@example.com
```

*   **Step 1**: [Sign and submit](https://cla.developers.google.com/clas) a CLA (Contributor License Agreement).
*   **Step 2**: Configure authentication credentials for the Go Git repository. Visit [go.googlesource.com](https://go.googlesource.com/), click “Generate Password” in the page’s top-right menu bar, and follow the instructions.
*   **Step 3**: Register for Gerrit, the code review tool used by the Go team, by [visiting this page](https://go-review.googlesource.com/login/). The CLA and the registration need to be done only once for your account.
*   **Step 4**: Install `git-codereview` by running `go get -u golang.org/x/review/git-codereview`

1.2. Preparing Environment
--------------------------

*   **Step 1:** Clone the source code

```
$ git clone https://go.googlesource.com/go  
$ cd go
```

_Clone anywhere you want as long as it’s outside your_ `_$GOPATH_` _. Clone from go.googlesource.com (not GitHub)._

*   **Step 2:** Prepare changes in a new branch

```
$ git checkout -b feature/new-operator-tilde
```

_We will work on the_ `_feature/new-operator-tilde_` _branch that checked out from the default working branch._

*   **Step 3:** Verify the compilation succeed

```
$ cd ./src  
$ ./make.bash # use ./all.bash to run the all testsBuilding Go cmd/dist using /usr/local/Cellar/go/1.16.3/libexec. (go1.16.3 darwin/amd64)  
Building Go toolchain1 using /usr/local/Cellar/go/1.16.3/libexec.  
Building Go bootstrap cmd/go (go\_bootstrap) using Go toolchain1.  
Building Go toolchain2 using go\_bootstrap and Go toolchain1.  
Building Go toolchain3 using go\_bootstrap and Go toolchain2.  
Building packages and commands for darwin/amd64.  
\---  
Installed Go for darwin/amd64 in /Users/furkan/src/public/go  
Installed commands in /Users/furkan/src/public/go/bin\# gtime: 253.04user 40.64system 0:58.38elapsed 503%CPU
```

_Make sure_ `_go_` _is installed in your shell path so that the go toolchain uses the Go compiler itself._

The project welcomes code patches, but you should discuss any significant change before starting the work to ensure things are well coordinated. [\[1\]](https://golang.org/doc/contribute#before_contributing)

So, this is exactly what we will do as a next step.

1.3. Proposing
--------------

The crucial step is that before we start doing anything, we need to write down what we will achieve at the end of the day. It may not be right to work and make decisions alone. We can not do random walks on such a large company or community-driven big open-source projects, right?. We cannot just randomly write a sloppy proposal. Since the Go project’s development process is _design-driven_, we must follow the [proposal design document](https://github.com/golang/proposal) standards.

We can create an issue to discuss the feature idea just before we start writing the _actual_ proposal. Since we will not do compiler change but small implementation, it's OK to create the proposal as an issue by following the [TEMPLATE](https://github.com/golang/proposal/blob/master/design/TEMPLATE.md).

> **Title:** proposal: spec: add built-in tilde `~` (bitwise not) unary operator  
> **Description:**_TL;DR: I propose adding built-in support for_ `_~_`(bitwise not) unary _operator._
> 
> **_Abstract_**_The_ `_~_` _operator_ (pronounced as tilde) _is_ complement (unary) operator_, performs a_ [bitwise NOT operation](http://en.wikipedia.org/wiki/Bitwise_operators#NOT)_. It takes one bit operand and returns its complement. If the operand is 1, it returns 0, and if it is 0, it returns 1. When applied on numbers, represented by_ [bitwise not](https://en.wikipedia.org/wiki/Bitwise_operation#NOT)_, it changes the number’s sign and then subtracts one._ [_\[2\]_](https://stackoverflow.com/a/3952128/5685796)
> 
> _For example:  
> _`_10101000 11101001 // Original (-22,295 in 16-bit one's complement)_``_01010111 00010110 // ~Original (22,294 in 16-bit one's complement)_`
> 
> I propose the addition of a new built-in `~` operator.
> 
> **_Motivation_**  
> _Currently, Go_ [_does not have support_](https://golang.org/ref/spec#Operators) _for_ `_~_` _operator. I could find neither an actively discussing_ [_issue_](https://github.com/golang/go/issues?q=tilde) _nor a_ [_PR_](https://github.com/golang/go/pulls?q=tilde)_. It is a great opportunity to learn compiler theory and get used to Go compiler internals._
> 
> **_Backgroud_**_Tilde_ `_~_` _operator widely implemented and used by some programming languages. (i.e._ [_Python_](https://blog.finxter.com/tilde-python/)_,_ [_C/C++_](https://www.cplusplus.com/reference/ciso646/)_,_ [_Java_](https://www.tutorialspoint.com/java/java_bitwise_operators_examples.htm)_,_ [_Rust (!)_](https://doc.rust-lang.org/stable/std/ops/trait.Not.html)_,_ [_etc._](https://en.wikipedia.org/wiki/Tilde#Computing)_). Can be used for_ [_different purposes_](https://en.wikipedia.org/wiki/Tilde#Computing) _in every programming language. We can start implementing this as a unary operator. In the some programming languages, the tilde character is used as_ [_bitwise NOT_](https://en.wikipedia.org/wiki/Bitwise_NOT)  [_operator_](https://en.wikipedia.org/wiki/Operators_in_C_and_C%2B%2B)_, following the notation in logic:_ `_~p_`  not _means_ `_not p_`_, where_ `_p_` _is a_ [_proposition_](https://en.wikipedia.org/wiki/Proposition)_._
> 
> **_Proposal  
> _**_I propose that_ `_~_` _should work like any other bitwise operator as described in the spec. We will only support_ [prefix notation](https://en.wikipedia.org/wiki/Prefix_notation) _usage on integers. i.e._ `_~EXPR_` . _Following codes should compile successfully:_\* `_~1997 // returns -1998_`_\*_ `_a := 7 and ~a // returns -8  
> _`_\*_ `~-15 _// returns_ 14`_\*_ `-~15 _// returns 16_`_\*_ `_foo := func(x int) int { return ~x } and ~foo(707) // returns_ -708`_\*_ `_if ~7 < 5 { // true }  
> _`_\*_ `_~3.1415 // INVALID_`_\*_ `_x ~= y // INVALID  
> _`_\*_ `_~bool // INVALID_`_\*_ `_5~7 // INVALID_`_\*_ `_7~ // INVALID  
> _`_Since the bitwise logical and shift operators apply to integers only,_ [_\[3\]_](https://golang.org/ref/spec#Arithmetic_operators) _I propose that we will support only integers._
> 
> **_Compatibility  
> _**_This change is fully backwards compatible._
> 
> **_Complexity  
> _**_Since we will add just another single unary operator to the compiler, I think it will not cause even the tiny complexity. Tilde_ `_~_` _just one of the unary operation standards in mathematics. The compiler already supports other bitwise operations. (i.e._ `&`, `|` ,`^`, `&^`_)_
> 
> **_Implementation_**_At a minimum this will impact:  
> \* spec: add operator to relevant part  
> \* compiler frontend: add new Token, update Scanner and Parser  
> \* compiler backend: add OpCode, update SSA and GC  
> \* optimization: i.e._ `_~(~7) = 7_`_  
> \* docs: the tour, all educational resources_We will be implementing this operator on a \[W.I.P\] PR simultaneously by writing a “Contribution the Compiler Guide” on Medium.
> 
> **_Furthermore  
> _**_After implemented for integers, we_ may _also add different features for this operator, in the future:  
> \*_ indicating type equality or lazy pattern match  
> \* object comparison  
> \* [array](https://en.wikipedia.org/wiki/Array_data_structure) [concatenation](https://en.wikipedia.org/wiki/Concatenation)  
> \* … and so on.

We all know that _almost_ every website has a back-end service architecture. Compilers are not so different either, just like we humans read the texts with our eyes and send them back to the visual cortex in our brains. We are not going to go deep into technical details here. Let’s take a brief overview of some important parts. We will explain them all individually.

![](https://miro.medium.com/v2/resize:fit:1000/1*mfz_IhrDTW9QCFP5E4YPlg.png)

High-Level Overview of Compiler Front-End

All front-end analyzers _(i.e., lexical, syntax)_ analyze the source code to build an _Intermediate Representation (IR)_ program. An Intermediate Representation is the data structure used internally by a compiler to represent source code, which is conducive to further processing, such as optimization and translation.

> [The frontend](https://github.com/golang/gofrontend) was originally developed at Google, and was released in November 2009. It was originally written for GCC. It was originally written by [Ian Lance Taylor](https://www.airs.com/ian/)

Now we can choose our favorite Go editor _(i.e., Vim, GoLand, etc.)_ to move forward. I will go with [Emacs](https://github.com/hlissner/doom-emacs/) in this demo.

Find the Go spec packages under `./src/go`. We will start implementing the `token` package.

![](https://miro.medium.com/v2/resize:fit:700/1*PXeEZR29WQRwaK9UypWOXQ.png)

Editor Overview in Package of token

2.1.⠀go/\* (Legacy)
-------------------

2.1.1. [Token](https://github.com/golang/go/tree/master/src/go/token)
---------------------------------------------------------------------

[ELI5:](https://www.reddit.com/r/explainlikeimfive/) Tokens are the smallest cornerstone in the compiler design. Those units add _meaning_ to the source code that we are writing. This is the most important difference that distinguishes programming languages from our daily speaking languages.

Speaking Language:

![](https://miro.medium.com/v2/resize:fit:700/1*kVCbahfVSBjBbalFF7b48Q.png)

Programming Language:

![](https://miro.medium.com/v2/resize:fit:700/1*JbayHoUIgxCM1izhq2piwg.png)

Tokens are highlighted in blue. Tokens themselves are small, easily categorizable data structures that are then fed to the _parser._

Let’s suppose we replace these _words_ with the Go correspondences:

```
The: func  
quick: foo  
brown: var1  
fox: string  
jumps: var2  
over: int  
the: error  
lazy: bool  
dog: true
```

Yes, just like you thought! We created _meaning_ by using tokens in the sentence we wrote following the above. The tokens we use here are: `“‘(‘, ‘,’, ‘)’, ‘{‘, ‘}’”` , respectively.

OK, we are going to write our first code in this section. Let’s change the current directory to the `[token](https://github.com/golang/go/tree/master/src/go/token)`. In the `[token.go](https://github.com/golang/go/blob/master/src/go/token/token.go)`, we have to define our new token as a _const_ variable:

We will define it as `TILDE`, as [CPython](https://github.com/python/cpython/blob/master/Parser/token.c#L104) did.

```
const (  
 // Special tokens  
 ILLEGAL Token = iota  
 ...  
 SHR     // >>  
 AND\_NOT // &^  
 TILDE   // ~  
 ...  
)var tokens = \[...\]string{  
 ILLEGAL: "ILLEGAL",  
 ...  
 SHR:     ">>",  
 AND\_NOT: "&^",  
 TILDE:   "~",  
 ...  
}
```

2.1.1.1. Operator Precedence
----------------------------

Operator Precedence represents the _order of operations,_ which should make clearer what operator precedence describes: which priority do different operators have.

A canonical example:

`1 + 3 – 5 * 7 / ~9`

Which will become:

`1 + (3 — ((5 * 7) / (~9)))`

That’s because the `*` and `/` operators have higher precedence _(rank)_. It means that these are _more significant_ than the `+` and `—` operators. These must get evaluated before the other operators do.

Operators that have the same precedence are bound to their arguments in the direction of their associativity. For example, the expression `a = b = c` is parsed as `a = (b = c)`And not as `(a = b) = c` because of _right-to-left_ [associativity of assignment](https://en.wikipedia.org/wiki/Operator_associativity), but `a + b — c` is parsed `(a + b) — c` and not `a + (b — c)` because of the _left-to-right_ associativity of addition and subtraction. [\[5\]](https://en.cppreference.com/w/cpp/language/operator_precedence)

![](https://miro.medium.com/v2/resize:fit:700/1*3lxz-5dZOyFIoDsHDFQu6Q.png)

[Go Operator Precedence](https://github.com/golang/go/blob/fe26dfadc3630617d133b8c94bcb2ccb2e85dc1b/src/go/token/token.go#L259-L277)

Python has [defined at the FACTOR](https://github.com/python/cpython/blob/503cdc7c124cebbd777008bdf7bd9aa666b25f07/Lib/ast.py#L1318) level in the [_unary operator precedence table_](https://github.com/python/cpython/blob/503cdc7c124cebbd777008bdf7bd9aa666b25f07/Lib/ast.py#L1315-L1321). Unary [FACTOR level](https://github.com/python/cpython/blob/503cdc7c124cebbd777008bdf7bd9aa666b25f07/Lib/ast.py#L657) simply means:

`-7, +7, ~7`

We can define `TILDE` at level 5:

```
func (op Token) Precedence() int {  
 switch op {  
 ...  
 case MUL, QUO, REM, SHL, SHR, AND, AND\_NOT, TILDE:  
  return 5  
 ...  
}
```

2.1.2. Abstract Syntax Tree (AST)
---------------------------------

Abstract Syntax Tree (AST) is a tree that represents the syntactic structure of a language construct according to our grammar definition. It basically shows how your parser recognized the language construct, that said, it shows how the start symbol of your grammar derives a certain string in the programming language.

Let’s write a simple Go snippet:

![](https://miro.medium.com/v2/resize:fit:360/1*Z4yOjNihMT3UbsXdfT9FgQ.png)

Go Code Snippet

If we wanted to get the _AST_ at high-level, we would get something like the following:

![](https://miro.medium.com/v2/resize:fit:700/1*c4UV17U7RJZKaC0vD-lpGg.png)

High-Level Overview of AST

It is not the real world equivalent; we ignored and simplified many things in the tree. You can think of it as a _pseudo-AST_. If we wanted to get a real representation of AST for this code snippet:

```
_package_ main  
_func_ main() {  
   x := 5  
   y := 3  
   _for_ x > y {  
      _if_ x == 5 {  
         z := 3 + (5 \* 7)  
      }  
   }  
}
```

Then you can use either an AST viewer (i.e., [_goast-viewer_](https://github.com/yuroyoro/goast-viewer)) or Go’s official `parser` package _(in the next section, we will see what the parser is)_ to dump the whole AST into stdout manually:

```
package main

import (  
    "go/ast"  
    "go/parser"  
    "go/token"  
    "os"  
)

func main() {  
    fset := new(token.FileSet)  
    f, \_ := parser.ParseFile(fset, "your\_source\_code.go", nil, 0)  
    ast.Print(fset, f)  
}


```

This code will print out approximately ~170 lines of AST. I wrapped some object references and positions in the following picture:

![](https://miro.medium.com/v2/resize:fit:700/1*Y5meRQOhu52onXTjdUpoHA.png)

Output of GoAst Viewer

2.1.3. [Scanner](https://github.com/golang/go/tree/master/src/go/scanner)
-------------------------------------------------------------------------

This is where your _syntax error_ messages throwing from. Scanner, scans the next token and returns the token position, the token, and the literal string if applicable. The scanner initializes from the _Parser_. Scanner does not create any _AST_ structure; all it does is read tokens and catch any semantic _(syntax)_ errors.

Let’s jump to `./scanner/scanner.go` file:

```
func (s \*Scanner) Scan() (pos token.Pos, tok token.Token, lit string) {  
 ...  
 switch ch := s.ch; {  
 ...  
 default:  
  ...  
  case '|':  
   tok = s.switch3(token.OR, token.OR\_ASSIGN, '|', token.LOR)  
  case '~':  
   tok = token.TILDE  
  default:  
   ...  
  }  
 }  
}
```

The `swtich2`, `swtich3`, and `swtich4` [functions](https://github.com/golang/go/blob/690a8c3fb136431d4f22894c545ea99278758570/src/go/scanner/scanner.go#L762-L796) are for scanning multi-byte tokens such as `>>` , `+=` , `>>` , `=` . Different routines recognize different length tokens based on matches of the _n-th_ character.

*   `%` is a `swtich2` , because only allowed: `%`, `%=`
*   `+` is a `swtich3` , because only allowed: `+`, `+=`, `++`
*   `>` is a `swtich4` , because only allowed: `>`, `≥`, `>>`, `>≥`

Adding only two lines completes our work here. Let’s write some test in `./scanner/scanner_test.go` to test our new token.

Update the `tokens`:

```
var tokens = \[…\]elt {  
 ...  
 // Operators and delimiters  
 {token.SHR, ">>", operator},  
 {token.AND\_NOT, "&^", operator},  
 {token.TILDE, "~", operator},  
 ...  
}
```

Update the `lines`:

```
var lines = \[\]string {  
 "",  
 "\\ufeff#;", // first BOM is ignored  
 ...  
 ">>\\n",  
 "&^\\n",  
 "~\\n",  
 ...  
}
```

Run the tests:

![](https://miro.medium.com/v2/resize:fit:700/1*pNCkM8TG_dC_pkrmmI_t8Q.png)

Scanner Tests

Yay! Our tests are passing!

2.1.4. [Parser](https://github.com/golang/go/tree/master/src/go/parser)
-----------------------------------------------------------------------

Go parser converts this list of tokens into a Tree-like object to represent how the tokens fit together to form a cohesive whole. Input may be provided in various forms; the output is an _Abstract Syntax Tree (AST)_ representing the Go source.

> A **parser** is a software component that takes input data (frequently text) and builds a [data structure](https://en.wikipedia.org/wiki/Data_structure) — often some kind of P[arse Tree](https://en.wikipedia.org/wiki/Parse_tree), A[bstract Syntax Tree](https://en.wikipedia.org/wiki/Abstract_syntax_tree) or other hierarchical structure, giving a structural representation of the input while checking for correct syntax. The parsing may be preceded or followed by other steps, or these may be combined into a single step. The parser is often preceded by a separate [lexical analyser](https://en.wikipedia.org/wiki/Lexical_analysis), which creates tokens from the sequence of input characters; alternatively, these can be combined in [scannerless parsing](https://en.wikipedia.org/wiki/Scannerless_parsing). [\[4\]](https://en.wikipedia.org/wiki/Parsing#Parser)

Wait… The last sentence _may_ a _bit_ important for us.

> **Scannerless parsing** performs tokenization (breaking a stream of characters into words) and parsing (arranging the words into phrases) in a single step, rather than breaking it up into a [pipeline](https://en.wikipedia.org/wiki/Pipeline_(software)) of a [lexer](https://en.wikipedia.org/wiki/Lexical_analysis) followed by a [parser](https://en.wikipedia.org/wiki/Parser), executing [concurrently](https://en.wikipedia.org/wiki/Concurrent_computation).

Go does use a built-in scanner, which means that Go does a separate lexical analysis already.

Let’s assume that we have the necessary compiler front-end components that _somehow_ communicate with each other. Usually, the _basic_ overall structure will look something like the following:

![](https://miro.medium.com/v2/resize:fit:700/1*Wmr1EE83IToLP0QaNn9WsQ.png)

Medium Level Overview of The Parser Interface

At the beginning of this section, we have drawn a high-level overview of Compiler Front-End flow, as you remember. But this… is a medium-level overview of the [Parser Interface](https://github.com/golang/go/blob/master/src/go/parser/interface.go) that describes how Scanner and Parser communicate through exported functions. Parser Interface contains the exported entry points for invoking the parser. We shall not dwell in detail since this is a good topic for deep-diving in the source code.

Let’s jump to `parseUnaryExpr` function in the `./parser/parser.go`:

```
func (p \*parser) parseUnaryExpr() ast.Expr {  
 ...  
 switch p.tok {  
 case token.ADD, token.SUB, token.NOT, token.XOR, token.AND, token.TILDE:  
  pos, op := p.pos, p.tok  
  p.next()  
  x := p.parseUnaryExpr()  
  return &ast.UnaryExpr{OpPos: pos, Op: op, X: p.checkExpr(x)}  
 ...  
 }  
}
```

Jump to `parseStmt` function to define the new operator:

```
func (p \*parser) parseStmt() (s ast.Stmt) {  
 ...  
 switch p.tok {  
 ...  
 case  
  // tokens that may start an expression  
  token.IDENT, ..., token.NOT, token.TILDE // unary operators}
```

Out of context, I noticed that a function called `TestParse` included in `parser_test.go` file. I like the idea of how the parser tester using itself as a test case scenario. I could not go forward without mentioning this detail. It’s cool, isn’t it:

```
_var_ validFiles = \[\]string{  
   "parser.go",  
   "parser\_test.go"  
}

_func TestParse_(t \*testing.T) {  
   _for_ \_, filename := _range_ validFiles {  
      \_, err := ParseFile(token.NewFileSet(), filename, nil, _DeclarationErrors_)  
      ...  
   }  
}


```

2.1.5. [Constant](https://github.com/golang/go/tree/master/src/go/constant)
---------------------------------------------------------------------------

Package constant implements Values representing untyped Go constants and their corresponding operations.

Jump to `constant/value.go` file

```
// UnaryOp returns the result of the unary expression op y.  
// The operation must be defined for the operand.  
// If prec > 0 it specifies the ^ (xor) result size in bits.  
// If y is Unknown, the result is Unknown.  
//  
func UnaryOp(op token.Token, y Value, prec uint) Value {  
 switch op {  
 case token.ADD:  
 ...  
 ...  
 case token.NOT:  
 ...  
 case token.TILDE:  
  switch y := y.(type) {  
  case unknownVal:  
   return y  
  case intVal:  
   return makeInt(newInt().Com(y.val))  
  case int64Val:  
   return makeInt(newInt().Com(big.NewInt(int64(y))))  
  default:  
   goto Error  
  }  
}
```

`NEG` reserved for _negative_ operation and stands for `sets z to -x and returns z`. We can go with `COM` for now.

Find the `constant/value_test.go` file and jump to `opTests` table:

```
var opTests = \[\]string{  
 // unary operations  
 \`+ 0 = 0\`,  
 ...  
 \`^ ? = ?\`,  
 \`~ 2 = -3\`,  
 \`~ 60 = -61\`,  
 ...  
}
```

One more step to define in `optab` struct.

```
var optab = map\[string\]token.Token{  
 "!": token.NOT,  
 ...  
 "&^": token.AND\_NOT,  
 "~":  token.TILDE,  
 ...  
}
```

By doing this, we will ensure the operation that we stored in `opTest` is also defined in the`optab` table. Find this function:

```
func TestOps(t \*testing.T) {  
 for \_, test := range opTests {  
  a := strings.Split(test, “ “)  
  i := 0 // operator index   
  ...  
  op, ok := optab\[a\[i\]\]  
  if !ok {  
   panic(“missing optab entry for “ + a\[i\])  
  }  
  ...  
  got := doOp(x, op, y)  
  ...  
}
```

We know that unary operators only work with one value. So cannot be used between two values, but others can be. _(Such as:_ `_||_`_,_ `_>>_`_,_ `_!=_`_,_ `_≥_`_, etc.)._

```
func doOp(x Value, op token.Token, y Value) (z Value) {  
 ...  
 if x == nil {  
  return UnaryOp(op, y, 0)  
 }  
 ...  
}
```

As you noticed, we called the`UnaryOp` function here, which we want to write the test for.

It is NOT OK to run the test since we do not implement brand-new `Com` function in the`math/big.Int` package, yet.

2.1.6 [Math](https://github.com/golang/go/tree/master/src/math)
---------------------------------------------------------------

Match package implements a collection of common math functions. It provides a suite of arithmetic, geometric, complex, and so on functionalities to perform basic math operations for the compiler itself. In addition, you can see some platform-based assembly instructions. Some of the algorithms just implemented a simplified version from the C sources. Especially most are adopted from C implementations from [Netlib Repository](http://netlib.org/), which is a collection of mathematical software, papers, and databases. If you want to implement a mathematical function, then this package is where your address.

2.1.6.1. [big.Int](https://github.com/golang/go/blob/master/src/math/big/int.go)
--------------------------------------------------------------------------------

`big.Int` package implements signed multi-precision integers. Find the `math/big/int.go` file. We will write our `COM` function here.`COM` will replace the value of a register or memory operand with its one_’s complement_. We can define it by`sets z to ~x and returns z`_._ Simply, we want to implement the mathematical equivalent of the _bitwise not_ algorithm.

So, easy peasy:

```
_// Com sets z to ~x and returns z.  
func_ (z \*Int) _Com_(x \*Int) \*Int {  
   z.Set(x)  
   z.neg = !z.neg  
   _if_ z.neg {  
      z.abs = z.abs.add(x.abs, natOne)  
   } _else_ {  
      z.abs = z.abs.sub(x.abs, natOne)  
   }  
   _return_ z  
}
```

We could have traversed binary bits from least significant to most significant and reverse every bit. Still, adding an unnecessary loop here may complicate things since we already got the correct results.

Let’s write some tests for that in the `int_test.go` file:

```
_func TestCom_(t \*testing.T) {  
   _var_ z Int  
   _for_ \_, test := _range_ \[\]_struct_ {  
       n    int64  
       want string  
   }{  
      {-7, "6"},  
      {-2, "1"},  
      {-1, "0"},  
      {0, "-1"},  
      {4, "-5"},  
      {5, "-6"},  
      {6, "-7"},  
      {7, "-8"},  
      {8, "-9"},  
      {15, "-16"},  
      {-15, "14"},  
   } {  
       v := NewInt(test.n)  
       _if_ got := z.Com(v).String(); got != test.want {  
           t.Errorf("Com(%+v) = %s; want %s", v, got, test.want)  
       }  
   }  
}
```

Wow! Our tests are passing! We just implemented the`bitwise not` operator. _(You can try to reverse bits by walking each bit in a for loop!)_ Now let’s run the all of `math` tests:

```
$ go test ./big/.. -v...  
\=== RUN   TestCom  
\--- PASS: TestCom (0.00s)  
...  
PASS  
ok      math/big        2.647s
```

Cool! Now we can able to compile the Go! Jump the root directory and just run:

```
$ ./all.bashBuilding Go cmd/dist using /usr/local/go. (go1.16.3 darwin/amd64)  
Building Go toolchain1 using /usr/local/go.  
\# bootstrap/go/constant  
/Users/furkan.turkal/src/public/go/src/go/constant/value.go:1003: undefined: token.TILDE  
go tool dist: FAILED: /usr/local/go/bin/go install -gcflags=-l -tags=math\_big\_pure\_go compiler\_bootstrap bootstrap/cmd/...: exit status 2
```

**WAIT, WHAT!?**We just got `undefined: token.TILDE` error? 😱 But… We have defined it? How is this even possible? OK, let me explain the reason why the _toolchain_ threw this error:

The problem is that `go/constant` is a bootstrap package. From `/src/cmd/dist/buildtool.go` .

`bootstrapDirs` is a list of directories holding code that must be compiled with a **Go 1.4** toolchain to produce the `bootstrapTargets`. Names beginning with `cmd/` no other slashes, which are _commands_, and other paths, which are _packages_ supporting the commands.

```
_var_ bootstrapDirs = \[\]string{  
   ...  
   "cmd/compile",  
   "cmd/compile/internal/...",  
   ...  
   "go/constant",  
   ...  
   "math/big",  
   "math/bits",  
   "sort",  
   "strconv",  
}
```

This means that `go/constant` needs to be compilable by the bootstrapping toolchain (but we need to support down to go1.4). But since we added a `case token.TILDE:` to `value.go`, `go/constant` is no longer compilable with an older toolchain, and the bootstrapping process fails. [\[15\]](https://github.com/golang/go/issues/45673#issuecomment-824219940)

This is the side effect of commit [742c05e](https://github.com/golang/go/commit/742c05e3bce2cf2f4631762cb5fb733d2a92bc91). And [mdempsky](https://github.com/mdempsky) said:

> Some packages support build tags for building simplified variants during bootstrap. E.g., math/big has `math_big_pure_go` and strconv and math/bits have `compiler_bootstrap`. It might be possible to do something similar for go/constant, if you're particularly pressed for this to work today.
> 
> But I think like [@ianlancetaylor](https://github.com/ianlancetaylor) points out, waiting for [#44505](https://github.com/golang/go/issues/44505) seems like the simplest/surest solution. [\[16\]](https://github.com/golang/go/issues/45673#issuecomment-824374682)

So, 🤷‍♂️. There is nothing to do except waiting. We can save the stash and wait for the fix for that issue:

```
$ git stash save go\_tilde\_issue\_44505  
$ git stash show "stash@{0}" -p > go\_tilde\_issue\_44505.patch
```

It’s time to move on to the **NEW**`cmd/compiler` package, which is including the _real_ compiler internals.

2.2. cmd/compile
----------------

> `cmd/compile`contains the main packages that form the Go compiler. The compiler may be logically split in four phases, which we will briefly describe alongside the list of packages that contain their code.
> 
> You may sometimes hear the terms _front-end_ and _back-end_ when referring to the compiler. Roughly speaking, these translate to the first two and last two phases we are going to list here. A third term, _middle-end_, often refers to much of the work that happens in the second phase.
> 
> It should be clarified that the name `gc` stands for `Go compiler`, and has little to do with uppercase `GC`, which stands for `garbage collection`.

2.2.1.⠀Differences with go/\*
-----------------------------

> Note that the `_go/*_` family of packages, such as `_go/parser_` and `_go/types_`,  
> _have no relation to the compiler._ Since the compiler was initially written in C,  
> the `_go/*_` packages were developed to enable writing tools working with Go code, such as _gofmt_ and _vet_. [\[6\]](https://github.com/golang/go/tree/master/src/cmd/compile#introduction-to-the-go-compiler)

We learned what should we do during implementation for `go/*` package, same as here…

2.2.2. Creating Test Script
---------------------------

…Before going forward, what we need to do is create a minimal `neg.go` file to make some test for our new`~` token. What we want to achieve is that simply make this minimal code run:

```
package main  
func main() {  
 println(~15)  
}
```

Now compile and run:

```
$ cd ./src  
$ ./make.bash  
$ cd ..  
$ ./bin/go run neg.go./neg.go:4:13: syntax error: unexpected ~, expecting expression
```

**NIT:** To avoid run in order these 4 lines of code every time, we can create simple `test.sh` script at parent directory to handle this process easily:

```
#!/bin/bash  
pushd ./src  
./make.bash  
popd  
./bin/go run neg.go
```

_Do not forget to give executable access:_ `$ chmod +x ./test.sh`

Now let’s jump to `./cmd/compile/internal/snytax` folder.

2.2.3. Token
------------

We are going to make this `Tilde` token part to the `const` of `tokens.go`:

```
_const_ (  
 \_ Operator = iota  
 _...  
 Recv  // <-  
 Tilde // ~  
 ...  
)_
```

2.2.3.1. Operator String
------------------------

As you noticed, there is a statement top of the `operator_string.go` file that says:

`// Code generated by “stringer -type Operator -linecomment tokens.go”; DO NOT EDIT.`

```
func \_() {  
 var x \[1\]struct{}  
 \_ = x\[Def-1\]  
 \_ = x\[Not-2\]  
 \_ = x\[Recv-3\]  
 \_ = x\[OrOr-4\]  
 \_ = x\[AndAnd-5\]  
 \_ = x\[Eql-6\]  
 \_ = x\[Neq-7\]  
 \_ = x\[Lss-8\]  
 \_ = x\[Leq-9\]  
 \_ = x\[Gtr-10\]  
 \_ = x\[Geq-11\]  
 \_ = x\[Add-12\]  
 \_ = x\[Sub-13\]  
 \_ = x\[Or-14\]  
 \_ = x\[Xor-15\]  
 \_ = x\[Mul-16\]  
 \_ = x\[Div-17\]  
 \_ = x\[Rem-18\]  
 \_ = x\[And-19\]  
 \_ = x\[AndNot-20\]  
 \_ = x\[Shl-21\]  
 \_ = x\[Shr-22\]  
}
```

There is a nameless function `_()` here that enforces every single constant is defined by order.

```
const \_Operator\_name = “:!<-||&&==!=<<=>>=+-|^\*/%&&^<<>>”var \_Operator\_index = \[…\]uint8{0, 1, 2, 4, 6, 8, 10, 12, 13, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30, 32}func (i Operator) String() string {  
 i -= 1  
 if i >= Operator(len(\_Operator\_index)-1) {  
 return “Operator(“ + strconv.FormatInt(int64(i+1), 10) + “)”  
 }  
 return \_Operator\_name\[\_Operator\_index\[i\]:\_Operator\_index\[i+1\]\]  
}
```

This is how Go handles operator to string converts efficiently. We need to add our Tilde operator here. To do that, we need to fill index struct as compiler enforces us, by running `$ go generate` command, which it will call `stringer`command in the background.

2.2.3.2. [**Stringer**](https://pkg.go.dev/golang.org/x/tools/cmd/stringer#pkg-overview)
----------------------------------------------------------------------------------------

Stringer is a tool to automate the creation of methods that satisfy the `fmt.Stringer` interface. Given the name of a (signed or unsigned) integer type `T` that has constants defined. Stringer will create a new self-contained Go source file implementing

> Stringer works best with constants that are consecutive values such as created using iota, but creates good code regardless. In the future it might also provide custom support for constant sets that are bit patterns.

```
$ ./bin/go generate ./src/cmd/compile/internal/syntax
```

![](https://miro.medium.com/v2/resize:fit:700/1*uCcwzm8tfaEkx3TIc2qDOw.png)

Code Generated by Stringer

Our operator successfully placed at the 4th line.

2.2.4. Scanner
--------------

Same operations here like we already did in section 2.1.1.

Open `./scanner.go` and jump to `next()` function:

```
_func_ (s \*scanner) next() {  
 ...  
 _switch_ s.ch {  
 ...  
 _case_ '!':  
 ...  
 _case_ '~':  
   s.nextch()  
   s.op, s.prec = _Tilde_, 0  
   s.tok = \_Operator  
 ...  
 }  
}
```

Writing for the scanner is straightforward. We just added one line to `sampleTokens` struct.

```
_var_ sampleTokens = \[...\]_struct_ {  
 ...  
}{  
 ...  
 {\_Literal, "\`\\r\`", 0, 0},  
 ...  
 {\_Operator, "~", _Tilde_, 0},  
 ...  
}
```

Run the tests:

![](https://miro.medium.com/v2/resize:fit:700/1*T5yXuRU3t7pBnfyxixM7jw.png)

Running Scanner Tests

2.2.5. Parser
-------------

Find the `./parser.go` file and jump to `unaryExpr()` function, and add Tilde token inside the`_Operator, _Star` case:

```
_func_ (p \*parser) unaryExpr() Expr {  
 ...  
 _switch_ p.tok {  
 _case_ \_Operator, \_Star:  
  _switch_ p.op {  
  _case Mul_, _Add_, _Sub_, _Not_, _Xor_, Tilde:  
   x := new(Operation)  
   x.pos = p.pos()  
   x.Op = p.op  
   p.next()  
   x.X = p.unaryExpr()  
   _return_ x  
  ...  
 ...  
 }  
}
```

OK, so far, so good. Go _actually_ knows what the `Tilde`operator is and how to parse by scanners, et does not know how to use it and operate it during the compile phase. So it will fail to compile in the`gc`package. So let’s build Go and see what error it throws.

Run the `test.sh` to see what would happen:

```
panic: invalid Operatorgoroutine 1 \[running\]:  
cmd/compile/internal/noder.(\*noder).unOp(...)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/noder/noder.go:1383  
cmd/compile/internal/noder.(\*noder).expr(0x100cc5b, 0x1a71318, 0xc00039e0c0)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/noder/noder.go:744 +0x1baa  
cmd/compile/internal/noder.(\*noder).exprs(0x2319400, 0xc000064030, 0x1, 0x203000)
```

Panic has thrown because compile did not know how to convert Tilde to Abstract syntax representation yet. Therefore, we need to declare an [Intermediate Representation](https://en.wikipedia.org/wiki/Intermediate_representation) for the operator in the Middle-End section.

The middle-end, also known as an _optimizer,_ performs optimizations on the Intermediate Representation to improve the performance and the quality of the produced machine code. The middle end contains those optimizations that are independent of the CPU architecture being targeted. [\[11\]](https://en.wikipedia.org/wiki/Compiler#Middle_end)

The main phases of the middle end include the following:

*   [Analysis](https://en.wikipedia.org/wiki/Compiler_analysis): This gathers program information from the intermediate representation derived from the input; [data-flow analysis](https://en.wikipedia.org/wiki/Data-flow_analysis) is used to build [use-define chains](https://en.wikipedia.org/wiki/Use-define_chain), together with [dependence analysis](https://en.wikipedia.org/wiki/Dependence_analysis), [alias analysis](https://en.wikipedia.org/wiki/Alias_analysis), [pointer analysis](https://en.wikipedia.org/wiki/Pointer_analysis), [escape analysis](https://en.wikipedia.org/wiki/Escape_analysis), etc.
*   [Optimization](https://en.wikipedia.org/wiki/Compiler_optimization): the intermediate language representation is transformed into functionally equivalent but faster or smaller forms. Popular optimizations are [inline expansion](https://en.wikipedia.org/wiki/Inline_expansion), [dead code elimination](https://en.wikipedia.org/wiki/Dead_code_elimination), [constant propagation](https://en.wikipedia.org/wiki/Constant_propagation), [loop transformation](https://en.wikipedia.org/wiki/Loop_transformation), and even [automatic parallelization](https://en.wikipedia.org/wiki/Automatic_parallelization).

**3.1. Intermediate Representation (IR)**

![](https://miro.medium.com/v2/resize:fit:700/1*EgFEXbBGbouH6Og94CBSWw.png)

High-Level Overview of IR [\[8\]](https://youtu.be/D2-gaMvWfQY?t=216)

_^ Here’s the_ [_30,000-foot view_](https://nanoglobals.com/glossary/30000-foot-view/) _of how Machine Code is generating._

> An **intermediate representation** is the [data structure](https://en.wikipedia.org/wiki/Data_structure) or code used internally by a [compiler](https://en.wikipedia.org/wiki/Compiler) or [virtual machine](https://en.wikipedia.org/wiki/Virtual_machine) to represent [source code](https://en.wikipedia.org/wiki/Source_code). An IR is designed to be conducive for further processing, such as [optimization](https://en.wikipedia.org/wiki/Compiler_optimization) and [translation](https://en.wikipedia.org/wiki/Program_transformation).
> 
> An **intermediate language** is the language of an [abstract machine](https://en.wikipedia.org/wiki/Abstract_machine) designed to aid in the analysis of [computer programs](https://en.wikipedia.org/wiki/Computer_program). The term comes from their use in [compilers](https://en.wikipedia.org/wiki/Compiler), where the source code of a program is translated into a form more suitable for code-improving transformations before being used to generate [object](https://en.wikipedia.org/wiki/Object_file) or [machine](https://en.wikipedia.org/wiki/Machine_language) code for a target machine.
> 
> Use of an intermediate representation allows compiler systems like the [GNU Compiler Collection](https://en.wikipedia.org/wiki/GNU_Compiler_Collection) and [LLVM](https://en.wikipedia.org/wiki/LLVM) to be used by many different source languages to [generate code](https://en.wikipedia.org/wiki/Code_generation_(compiler)) for many different target [architectures](https://en.wikipedia.org/wiki/Instruction_set). [\[7\]](https://en.wikipedia.org/wiki/Intermediate_representation)

All _Abstract Syntax Representation_ related stuff stored under `./src/cmd/compile/internal/ir/` as `ir` package.

**3.1.1. Node**

Node is the abstract interface to an IR node.

![](https://miro.medium.com/v2/resize:fit:700/1*Iow9izb6dY3zw80jMy0Mfg.png)

We need to define the new opcode as `OCOM` under `consts`:

```
_type_ Op uint8

_// Node ops.  
const_ (  
 _OXXX_ Op = iota  
 ...  
 OPLUS  // +X  
 ONEG   // -X  
 OCOM   // ~X  
 ...  
)


```

After we declared new Node here, we need to run `$ stringer -type=Op -trimprefix=O node.go` again to automatically generate `OCOM` OpCode and do update to `./ir/op_string.go` file:

![](https://miro.medium.com/v2/resize:fit:700/1*S9-mQX6bCV9eQWlQGVKElw.png)

Stringer to ir/op\_string.go

By doing so, now we can easily convert the OpCode to String using `[1]_struct_{}` map:

```
_func_ (i Op) _String_() string {  
   _if_ i >= Op(_len_(\_Op\_index)-1) {  
      _return_ "Op(" + strconv.FormatInt(int64(i), 10) + ")"  
   }  
   _return_ \_Op\_name\[\_Op\_index\[i\]:\_Op\_index\[i+1\]\]  
}
```

Now what we need to do here is that we have to update the unary map table that declared under `./noder/noder.go`.

Find the `unOps` table:

```
var unOps = \[...\]ir.Op {  
 syntax.Recv: ir.ORECV,  
 ...  
 syntax.Tilde: ir.OCOM  
}
```

We defined new a Syntax token here, and thus compiler will not throw `invalid Operator` panic anymore:

```
_func_ (p \*noder) unOp(op syntax.Operator) ir.Op {  
   _if_ uint64(op) >= uint64(_len_(unOps)) || unOps\[op\] == 0 {  
      _panic_("invalid Operator")  
   }  
   _return_ unOps\[op\]  
}
```

I think it’s a good checkpoint to see how the error is changed after we implemented those. Run the `./test.sh` file:

```
panic: cannot SetOp COM on XXXgoroutine 1 \[running\]:  
cmd/compile/internal/ir.(\*UnaryExpr).SetOp(0xc000076230, 0x1a682e0)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/ir/expr.go:672 +0x10c  
cmd/compile/internal/ir.NewUnaryExpr(…)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/ir/expr.go:665  
cmd/compile/internal/noder.(\*noder).expr(0x100cc5b, 0x1a71358, 0xc0004000c0)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/noder/noder.go:751 +0x1887  
cmd/compile/internal/noder.(\*noder).exprs(0x231d000, 0xc000064030, 0x1, 0x203000)
```

Wow, the panic message is changed. Let’s investigate that where the error is coming from.

**3.1.2. Expr**

Expr is a Node that can appear as an expression.

```
_type Expr interface_ {  
   Node  
   isExpr()  
}
```

We initialize the unary operator at `./ir/expr.go` in a function called `NewUnaryExpr()`:

```
_// A UnaryExpr is a unary expression Op X,  
// or Op(X) for a builtin function that does not end up being a call.  
type_ UnaryExpr _struct_ {  
   miniExpr  
   X Node  
}

_func NewUnaryExpr_(pos src.XPos, op Op, x Node) \*UnaryExpr {  
   n := &UnaryExpr{X: x}  
   n.pos = pos  
   n.SetOp(op)  
   _return_ n  
}


```

But `n.SetOp(op)` function throw error here because it falls into the default case, which is throwing panic:

```
_func_ (n \*UnaryExpr) _SetOp_(op Op) {  
 _switch_ op {  
 _default_:  
  _panic_(n.no("SetOp " + op.String()))  
 _case OBITNOT_, _ONEG_, _OCOM_, _..._, ..., _OVARLIVE_:  
   n.op = op  
}
```

Adding `OCOM` to the just right of `ONEG` will fix the problem. Now jump to `SameSafeExpr()` function and add `OCOM`to `UnaryExpr` casting case.

```
_// SameSafeExpr checks whether it is safe to reuse one of l and r  
// instead of computing both. SameSafeExpr assumes that l and r are  
// used in the same statement or expression.  
func SameSafeExpr_(l Node, r Node) bool {  
 _if_ l.Op() != r.Op() || !types.Identical(l.Type(), r.Type()) {  
  _return_ false  
 }  
 ...  
 _case ONOT_, _OBITNOT_, _OPLUS_, _ONEG_, _OCOM_:  
  l := l.(\*UnaryExpr)  
  r := r.(\*UnaryExpr)  
  _return_ SameSafeExpr(l.X, r.X)  
 ...  
}
```

Rerun the tests:

```
typecheck \[0xc0001398b0\]  
.   COM tc(2) # neg.go:4  
.   .   LITERAL-15 untyped int # neg.go:4  
./neg.go:4:13: internal compiler error: typecheck COMgoroutine 1 \[running\]:  
runtime/debug.Stack()  
 /Users/furkan.turkal/src/public/go/src/runtime/debug/stack.go:24 +0x65  
cmd/compile/internal/base.FatalfAt(0xc0001398b0, 0x191d86a, 0x1a7fb48, 0xc000146be0, 0x1824634, 0x188e860)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/base/print.go:227 +0x157  
cmd/compile/internal/base.Fatalf(...)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/base/print.go:196  
cmd/compile/internal/typecheck.typecheck1(0x1a7fb48, 0xc0001398b0, 0x12)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/typecheck/typecheck.go:484 +0x298a  
cmd/compile/internal/typecheck.typecheck(0x1a7fb48, 0xc0001398b0, 0x12)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/typecheck/typecheck.go:371 +0x4b0  
cmd/compile/internal/typecheck.typecheckslice(0xc0001028c0, 0x1, 0x11ab40a, 0x1a7eba8)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/typecheck/typecheck.go:177 +0x68
```

What we need to do here is simply define our new syntax token in the `typecheck.go` file. Then, find the `typecheck1()` function, and jump to the`unaryExpr` case.

```
_// typecheck1 should ONLY be called from typecheck.  
func_ typecheck1(n ir.Node, top int) ir.Node {  
 ...  
 _case_ ir._OBITNOT_, ir._ONEG_, ir._ONOT_, ir._OPLUS_, ir._OCOM_:  
   n := n.(\*ir.UnaryExpr)  
   _return_ tcUnaryArith(n)  
 ...  
}
```

So we may want to know what happens in the function called `tcUnaryArith(n)`. So let’s investigate it:

```
_// tcUnaryArith typechecks a unary arithmetic expression.  
func_ tcUnaryArith(n \*ir.UnaryExpr) ir.Node {  
 ...  
 _if_ !okfor\[n.Op()\]\[defaultType(t).Kind()\] {  
  base.Errorf("invalid operation: %v (operator %v not defined on %s)", n, n.Op(), typekind(t))  
  n.SetType(nil)  
  _return_ n  
 }  
 ...  
}
```

If we’d rerun the test, we’d have panicked here due to this check:`!okfor[n.Op()][defaultType(t).Kind()]`

Jump to `./typecheck/universe.go` file. You will see two vars at the top of the file:

```
_var_ (  
   okfor \[ir._OEND_\]\[\]bool  
   iscmp \[ir._OEND_\]bool  
)
```

I was really impressed when I first saw this file. We are defining the OpCodes what operations they will do.

```
_var_ (  
   okforeq    \[types._NTYPE_\]bool  
   okforadd   \[types._NTYPE_\]bool  
   okforand   \[types._NTYPE_\]bool  
   okfornone  \[types._NTYPE_\]bool  
   okforbool  \[types._NTYPE_\]bool  
   okforcap   \[types._NTYPE_\]bool  
   okforlen   \[types._NTYPE_\]bool  
   okforarith \[types._NTYPE_\]bool  
)
```

The OpCode we created `OCOM` should able to do some arithmetic operations as we mentioned in the proposal:

*   We should not allow `~` for `bool`s. i.e. `~true` _(since Go already support this with_ `!true`_)_ So, `not okforbool`
*   We should allow `~` for arithmetics. i.e. `~7`. So, `okforarith`
*   There are no such things called `!~`, `~~`, `~>` or `<~`, So, eliminate all the others but `okforarith`

Let’s do a little operation on the `InitUniverse()` function as we mentioned above:

```
_// InitUniverse initializes the universe block.  
func InitUniverse_() {  
 ...  
 ...  
 ...  
 _// unary_ okfor\[ir._OBITNOT_\] = okforand\[:\]  
 okfor\[ir._ONEG_\] = okforarith\[:\]  
 okfor\[ir._OCOM_\] = okforarith\[:\]  
 ...  
}
```

So, the `okfor[n.Op()][defaultType(t).Kind()]` function will never return false once we put the `OCOM` in `okfor` map.

Run the `./test.sh` again:

```
./neg.go:4:12: internal compiler error: unexpected untyped expression: <node COM>goroutine 1 \[running\]:  
runtime/debug.Stack()  
 /Users/furkan.turkal/src/public/go/src/runtime/debug/stack.go:24 +0x65  
cmd/compile/internal/base.FatalfAt(0xc0004101e0, 0x1930ce3, 0x9844128, 0xc00011eeb8, 0x12200e8, 0x1a7fb68)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/base/print.go:227 +0x157  
cmd/compile/internal/base.Fatalf(…)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/base/print.go:196  
cmd/compile/internal/typecheck.convlit1(0x1a7fb68, 0xc0004101e0, 0x8, 0x203000, 0x0)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/typecheck/const.go:123 +0xb8c
```

Whops, we forgot the modify `./typecheck/const.go` file.

We did not define the Token inside the `tokenForOp` map:

```
_var_ tokenForOp = \[...\]token.Token {  
 ...  
}
```

Find the `convlit1` function:

```
_// convlit1 converts an untyped expression n to type t. If n already  
// has a type, convlit1 has no effect.  
//  
func_ convlit1(n ir.Node, t \*types.Type, explicit bool, context _func_() string) ir.Node {  
 ...  
 ...  
 ...  
 _case_ ir._OPLUS_, ir._ONEG_, ir.OCOM, ...:  
 ...  
 ...  
 ...  
}
```

Run the `./test.sh` again:

```
./neg.go:4:13: internal compiler error: unexpected expr: COM <node COM>goroutine 1 \[running\]:  
runtime/debug.Stack()  
 /Users/furkan.turkal/src/public/go/src/runtime/debug/stack.go:24 +0x65  
cmd/compile/internal/base.FatalfAt(0x1942672, 0x19273d4, 0x8, 0xc00011efa8, 0x100cc5b, 0x116fff9)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/base/print.go:227 +0x157  
cmd/compile/internal/base.Fatalf(…)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/base/print.go:196  
cmd/compile/internal/escape.(\*escape).exprSkipInit(0xc0004101e0, 0xc0004181c0, 0x0, 0x0, 0xc000410000, 0x1a7fb68, 0xc0004101e0)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/escape/escape.go:590 +0x2025
```

Wow, it looks like it’s time to move on to Escape Analysis.

3.2. Escape Analysis
--------------------

[Escape analysis](https://en.wikipedia.org/wiki/Escape_analysis), one of the phases of the Go compiler. It analyses the source code and determines what variables should be allocated on the stack and which ones should escape to the heap. Go statically defines what should be heap or stack-allocated during the compilation phase. This analysis is available via the flag `-gcflags="-m"` when compiling and/or running your code. [\[12\]](https://medium.com/a-journey-with-go/go-introduction-to-the-escape-analysis-f7610174e890)

> Here we analyze functions to determine which Go variables can be allocated on the stack. The two key invariants we have to ensure are: (1) pointers to stack objects cannot be stored in the heap, and (2) pointers to a stack object cannot outlive that object (e.g., because the declaring function returned and destroyed the object’s stack frame or its space is reused across loop iterations for logically distinct variables).
> 
> We implement this with static data-flow analysis of the AST. First, we construct a directed weighted graph where vertices (termed “locations”) represent variables allocated by statements and expressions, and edges represent assignments between variables (with weights representing addressing/dereference counts).
> 
> Next, we walk the graph looking for assignment paths that might violate the invariants stated above. If a variable v’s address is stored in the heap or elsewhere that may outlive it, then v is marked as requiring heap allocation.
> 
> To support interprocedural analysis, we also record data-flow from each function’s parameters to the heap and to its result parameters. This information is summarized as “parameter tags”, which are used at static call sites to improve escape analysis of function arguments. [\[13\]](https://github.com/golang/go/blob/15a374d5c1336e9cc2f8b615477d5917e9477440/src/cmd/compile/internal/escape/escape.go#L20-L46)

Find the `exprSkipInit` function:

```
_func_ (e \*escape) exprSkipInit(k hole, n ir.Node) {  
 ...  
 _switch_ n.Op() {  
 _default_:  
  base.Fatalf("unexpected expr: %s %v", n.Op().String(), n)  
 ...  
 _case_ ir._OPLUS_, ir._ONEG_, ir._OCOM_, ir._OBITNOT_:  
  n := n.(\*ir.UnaryExpr)  
  e.unsafeValue(k, n.X)  
 ...  
}
```

Find the `unsafeValue` function:

```
_// unsafeValue evaluates a uintptr-typed arithmetic expression looking  
// for conversions from an unsafe.Pointer.  
func_ (e \*escape) unsafeValue(k hole, n ir.Node) {  
 ...  
 _switch_ n.Op() {  
 ...  
 _case_ ir._OPLUS_, ir._ONEG_, ir._OCOM_, ir._OBITNOT_:  
  n := n.(\*ir.UnaryExpr)  
  e.unsafeValue(k, n.X)  
 ...  
}
```

Find the `mayAffectMemory` function:

```
_// mayAffectMemory reports whether evaluation of n may affect the program's  
// memory state. If the expression can't affect memory state, then it can be  
// safely ignored by the escape analysis.  
func_ mayAffectMemory(n ir.Node) bool {  
 ...  
 _switch_ n.Op() {  
 ...  
 _case_ ir._OLEN_, _..._, ir._ONEG_, ir._OCOM_, ir._OALIGNOF_, _..._:  
   n := n.(\*ir.UnaryExpr)  
   _return_ mayAffectMemory(n.X)
```

Run the `./test.sh` again:

```
walk \[0xc0004101e0\]  
. COM tc(1) int # neg.go:4 int  
. . LITERAL-15 tc(1) int # neg.go:4  
./neg.go:4:13: internal compiler error: walkExpr: switch 1 unknown op COMgoroutine 1 \[running\]:  
runtime/debug.Stack()  
 /Users/furkan.turkal/src/public/go/src/runtime/debug/stack.go:24 +0x65  
cmd/compile/internal/base.FatalfAt(0xc0004101e0, 0x1930e0c, 0x1a7fb68, 0xc0001272a0, 0xc00009d2b0, 0xc00009d2b0)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/base/print.go:227 +0x157  
cmd/compile/internal/base.Fatalf(…)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/base/print.go:196  
cmd/compile/internal/walk.walkExpr1(0x1a7fb68, 0xc0004101e0, 0xc0004101e0)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/walk/expr.go:82 +0xe9f
```

3.3. Walk
---------

We walk the given `ir.Func` and their all statements here.

```
_func Walk_(fn \*ir.Func) {  
   ir.CurFunc = fn  
   ...  
   order(fn)  
   ...  
   walkStmtList(ir.CurFunc.Body)  
   ...  
}
```

> A Func corresponds to a single function in a Go program (and vice versa: each function is denoted by exactly one \*Func).
> 
> There are multiple nodes that represent a Func in the IR:  
> \* The ONAME node (Func.Nname) is used for plain references to it.  
> \* The ODCLFUNC node (the Func itself) is used for its declaration code.  
> \*The OCLOSURE node (Func.OClosure) is used for a reference to a function literal.

```
_type_ Func _struct_ {  
   miniNode  
   Body Nodes

   Nname    \*Name        _// ONAME node_ OClosure \*ClosureExpr _// OCLOSURE node_  
   _// ONAME nodes for all params/locals for this func/closure, does NOT include closurevars until transforming closures during walk._ Dcl \[\]\*Name

   _// ClosureVars lists the free variables that are used within a  
   // function literal_ ClosureVars \[\]\*Name

   _// Enclosed functions that need to be compiled, populated during walk._ Closures \[\]\*Func  
   ...  
   _// Parents records the parent scope of each scope within a  
   // function._ Parents \[\]ScopeID  
   ...  Pragma PragmaFlag _// go:xxx function annotation._ ...  
   NumDefers  int32 _// number of defer calls in the function_ NumReturns int32 _// number of explicit returns in the function.  
   ...  
_}

_func NewFunc_(pos src.XPos) \*Func {  
   f := new(Func)  
   f.pos = pos  
   f.op = _ODCLFUNC  
   ...  
   return_ f  
}


```

Jump to `./walk/expr.go` file and find `walkExpr1` function:

```
_func_ walkExpr1(n ir.Node, init \*ir.Nodes) ir.Node {  
 _switch_ n.Op() {  
 _default_:  
  ir.Dump("walk", n)  
  base.Fatalf("walkExpr: switch 1 unknown op %+v", n.Op())  
  _panic_("unreachable")  
 ...  
 _case_ ir._ONOT_, ir._ONEG_, ir._OCOM_, ir._OPLUS_, ..., ir._OIDATA_:  
  n := n.(\*ir.UnaryExpr)  
  n.X = walkExpr(n.X, init)  
  _return_ n  
 ...  
}
```

Just to `./walk/walk.go` file and find `mayCall` function:

```
_// mayCall reports whether evaluating expression n may require  
// function calls, which could clobber function call arguments/results  
// currently on the stack.  
func_ mayCall(n ir.Node) bool {  
 ...  
 _return_ ir.Any(n, _func_(n ir.Node) bool {  
  ...  
  _switch_ n.Op() {  
  ...  
  _// When using soft-float, these ops might be rewritten to function calls  
  // so we ensure they are evaluated first.  
  case_ ir._OADD_, ir._OSUB_, ir._OMUL_, ir._ONEG_, ir._OCOM_:  
   _return_ ssagen.Arch.SoftFloat && isSoftFloat(n.Type())  
  ...  
 ...  
}
```

Run the `./test.sh`:

```
./neg.go:4:13: internal compiler error: ‘main’: unhandled expr COMgoroutine 9 \[running\]:  
runtime/debug.Stack()  
 /Users/furkan.turkal/src/public/go/src/runtime/debug/stack.go:24 +0x65  
cmd/compile/internal/base.FatalfAt(0xc00002414c, 0xc00009ef70, 0x10, 0xc0003cb780, 0x10, 0x2094108)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/base/print.go:227 +0x157  
cmd/compile/internal/base.Fatalf(…)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/base/print.go:196  
cmd/compile/internal/ssagen.(\*ssafn).Fatalf(0xc00039c1e0, 0x0, 0x1922c8b, 0x0, 0xc000064570, 0x1, 0x0)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/ssagen/ssa.go:7481 +0x187  
cmd/compile/internal/ssagen.(\*state).Fatalf(…)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/ssagen/ssa.go:976  
cmd/compile/internal/ssagen.(\*state).expr(0xc0003f8100, 0x1a7fb68, 0xc00039c1e0)  
 /Users/furkan.turkal/src/public/go/src/cmd/compile/internal/ssagen/ssa.go:3198 +0x8c44
```

Here we are. The SSA. Let’s see what SSA means exactly in the next section. It’s time to move on to Compiler Back-End.

![](https://miro.medium.com/v2/resize:fit:1000/1*HpzzpEpMW0OA_TkHyP5BXg.png)

Medium-Level Overview of Compiler Back-End of Go

Compiler back-end is responsible for the CPU architecture-specific optimizations and code generation.

4.1. Introduction
-----------------

The main phases of the back-end _may_ include the following:

*   [**Machine-dependent optimizations**](https://www.themagicalidea.com/machine-dependent-code-optimization-in-compiler-design/)**:** optimizations that depend on the details of the CPU architecture that the compiler targets.
*   [**Code generation**](https://en.wikipedia.org/wiki/Code_generation_(compiler))**:** the transformed intermediate language is translated into the output language, usually the native [machine language](https://en.wikipedia.org/wiki/Machine_language) of the system.

There are several production compilers for Go: [\[14\]](https://golang.org/doc/faq#What_compiler_technology_is_used_to_build_the_compilers)

*   `Gc` is written in Go with a recursive descent parser and uses a custom loader, also written in Go but based on the Plan 9 loader, to generate ELF/Mach-O/PE binaries.
*   The `Gccgo` compiler is a front end written in C++ with a recursive descent parser coupled to the standard GCC back end.

_You can find the compiler entry point_ [_here_](https://github.com/golang/go/blob/master/src/cmd/compile/internal/gc/main.go#L52-L330)_._

**4.2. Static Single Assignment (SSA)**
---------------------------------------

**SSA** is a property of an [intermediate representation](https://en.wikipedia.org/wiki/Intermediate_representation) (IR), which requires that each variable be [assigned](https://en.wikipedia.org/wiki/Assignment_(computer_science)) exactly once, and every variable is defined before it is used. Existing variables in the original IR are split into _versions_, new variables typically indicated by the original name with a subscript in textbooks. Every definition gets its own version. In SSA form, [use-def chains](https://en.wikipedia.org/wiki/Use-define_chain) are explicit, and each contains a single element.

![](https://miro.medium.com/v2/resize:fit:700/1*W7jwk-Dr2c3V6ybh_MCmXg.png)

Simple SSA Conversation For Straight Line Code

Essentially means that each register is assigned exactly once. This property simplifies data flow analysis. To handle variables that are assigned more than once in the source code, a notion of [phi](https://llvm.org/docs/LangRef.html#phi-instruction) instructions are used:

![](https://miro.medium.com/v2/resize:fit:580/1*MipKnkCVQmW09sgzvLNhaw.png)

φ instruction

The `phi` instruction, which is an _implicit merge point_, is used to implement the `φ` node in the SSA graph representing the function and takes _a list of pairs_ as arguments, with one pair for each predecessor basic block of the current block, and models the set of possible incoming values as distinct assignment statements. [\[9\]](https://llvm.org/docs/LangRef.html#phi-instruction)

SSA enables fast, accurate optimization algorithms for: [\[10\]](https://www.youtube.com/watch?v=uTMvKVma5ms)

*   [Common Subexpression Elimination](https://en.wikipedia.org/wiki/Common_subexpression_elimination)
*   [Dead Code Elimination](https://en.wikipedia.org/wiki/Dead_code_elimination)
*   [Dead Store Elimination](https://en.wikipedia.org/wiki/Dead_store)
*   [Nil Check Elimination](https://jpbempel.github.io/2013/09/03/null-check-elimination.html)
*   [Bounds Check Elimination](https://en.wikipedia.org/wiki/Bounds-checking_elimination)
*   [Register Allocation](https://en.wikipedia.org/wiki/Register_allocation)
*   [Instruction Scheduling](https://en.wikipedia.org/wiki/Instruction_scheduling)

_You can find the list of passes for the SSA compiler_ [_here_](https://github.com/golang/go/blob/6c1c055d1ea417d050503efe92c1eead0da68cef/src/cmd/compile/internal/ssa/compile.go#L431-L486)_._

You should able to dump your code to SSA using [ssadump](https://pkg.go.dev/golang.org/x/tools/cmd/ssadump) tool:

```
$ go get golang.org/x/tools/cmd/ssadump
```

To display and interpret the SSA form of your Go program:

```
package main  
func main() {  
 x := 1  
 y := 2  
 y += x  
 x = x + y  
 println(x)  
}
```

Set your [BuilderMode](https://pkg.go.dev/golang.org/x/tools/go/ssa#BuilderMode), give a path, and run the following command:

```
$ ssadump -build=F main.go
```

It will generate something like:

```
\# Name: command-line-arguments.main  
func main():  
0:                              entry P:0 S:0  
   t0 = 2:int + 1:int                     int  
   t1 = 1:int + t0                        int  
   t2 = println(t1)                        ()  
   return\# Name: command-line-arguments.init  
func init():  
0:                              entry P:0 S:2  
   t0 = \*init$guard                      bool  
   if t0 goto 2 else 1  
1:                         init.start P:1 S:1  
   \*init$guard = true:bool  
   jump 2  
2:                          init.done P:2 S:0  
   return
```

**P**, stands for _predecessors._ How many blocks come into this block.  
**S,** stands for successors. How many blocks it flows out to.

_When Go meets Assembly._[_\*_](https://www.youtube.com/watch?v=D2-gaMvWfQY&t=564s)

Let’s create another example:

```
package main  
func main() {  
 x := 1  
 y := 2  
 z := x  
 x = y + z  
 y = x + z  
 z = y + x  
 x = z  
 y = x  
 x = x + z  
 println(x)  
}
```

Rerun the _ssadump_ tool, and we will have the following kind of assembly:

![](https://miro.medium.com/v2/resize:fit:700/1*qOYPUBSGtVAoOobNDy2R8A.png)

Output of ssadump

We can see how they start to flow, how certain variables turn into other variables and compose into other pieces. Which versions of which variables are used where. We can construct the flow through this graph of where our data is going.

**4.3. Go’s SSA Backend**

![](https://miro.medium.com/v2/resize:fit:700/1*jvCMGB_t0VEUJrbRiFeBBw.png)

Picture of SSA Flow

> In this phase, the AST is converted into Static Single Assignment (SSA) form, a  
> lower-level intermediate representation with specific properties that make it  
> easier to implement optimizations and to eventually generate machine code from  
> it.
> 
> During this conversion, function intrinsics are applied. These are special  
> functions that the compiler has been taught to replace with heavily optimized  
> code on a case-by-case basis.
> 
> Certain nodes are also lowered into simpler components during the AST to SSA  
> conversion, so that the rest of the compiler can work with them. For instance,  
> the copy builtin is replaced by memory moves, and range loops are rewritten into  
> for loops. Some of these currently happen before the conversion to SSA due to  
> historical reasons, but the long-term plan is to move all of them here.
> 
> Then, a series of machine-independent passes and rules are applied. These do not  
> concern any single computer architecture, and thus run on all `_GOARCH_`  variants.
> 
> Some examples of these generic passes include dead code elimination, removal of  
> unneeded nil checks, and removal of unused branches. The generic rewrite rules  
> mainly concern expressions, such as replacing some expressions with constant  
> values, and optimizing multiplications and float operations.

SSA IR actually implemented at [Go 1.17](https://golang.org/doc/go1.7#compiler) version, proposed by [Keith Randall](https://github.com/randall77)  
at _2/10/2015_, titled [New SSA Backend for the Go Compiler](https://docs.google.com/document/d/1szwabPJJc4J-igUZU4ZKprOrNRNJug2JPD8OYi3i1K0/).

I strongly recommend that you should watch [_GopherCon 2017: Keith Randall — Generating Better Machine Code with SSA_](https://www.youtube.com/watch?v=uTMvKVma5ms) before we move on next.

Find the `./internal/ssagen/ssa.go` file and jump to the `expr` function:

```
_/ expr converts the expression n to ssa, adds it to s and returns the ssa result.  
func_ (s \*state) expr(n ir.Node) \*ssa.Value {  
 ...  
 _switch_ n.Op() {  
 ...  
 ...  
 ...  
 _case_ ir._ONOT_, ir._OBITNOT_, ir._OCOM_:  
  n := n.(\*ir.UnaryExpr)  
  a := s.expr(n.X)  
  _return_ s.newValue1(s.ssaOp(n.Op(), n.Type()), a.Type, a)  
 ...  
 ...  
 ...  
 _default_:  
  s.Fatalf("unhandled expr %v", n.Op())  
  _return_ nil  
 }  
}
```

Append the `OCOM` to `ir, types: ssa` mapping table:

```
_type_ opAndType _struct_ {  
   op    ir.Op  
   etype types.Kind  
}_var_ opToSSA = _map_\[opAndType\]ssa.Op {  
 ...  
 opAndType{ir._OBITNOT_, types._TINT64_}:  ssa._OpCom64_,  
 opAndType{ir._OBITNOT_, types._TUINT64_}: ssa._OpCom64_,  
 ...  
 opAndType{ir._OCOM_, types._TINT8_}:   ssa._OpCom8_,  
 opAndType{ir._OCOM_, types._TUINT8_}:  ssa._OpCom8_,  
 opAndType{ir._OCOM_, types._TINT16_}:  ssa._OpCom16_,  
 opAndType{ir._OCOM_, types._TUINT16_}: ssa._OpCom16_,  
 opAndType{ir._OCOM_, types._TINT32_}:  ssa._OpCom32_,  
 opAndType{ir._OCOM_, types._TUINT32_}: ssa._OpCom32_,  
 opAndType{ir._OCOM_, types._TINT64_}:  ssa._OpCom64_,  
 opAndType{ir._OCOM_, types._TUINT64_}: ssa._OpCom64_,  
 ...  
}
```

What! 😶 Did you see what I saw? 🥲 There was an operator that was defined as OpCom! 😱 This means that `OBITNOT` operator `^` exactly does what we want to implement. I genuinely did not know that even exist! 😞 Oh, man… I just realized it while writing this article along with the code. I decided to go with `COM` because `NEG` [was reserved](https://github.com/golang/go/blob/15a374d5c1336e9cc2f8b615477d5917e9477440/src/cmd/compile/internal/ir/node.go#L226) for the`_-_` _operator_. 🤔 It _may_ be more accurate to use `NEG` instead of `COM` for `~`. I thought that way because that’s how I saw on [AVR Instruction Set Manual](http://ww1.microchip.com/downloads/en/devicedoc/atmel-0856-avr-instruction-set-manual.pdf) at the college _(Microprocessors lecture)._ Thus_,_ I wanted to go with `OCOM` `(One’s [COM]plement)` for now.🤷‍♂️

![](https://miro.medium.com/v2/resize:fit:700/1*JMv25k-g-y-1XRmYQ3axmw.png)

Atmel AVR Instruction Set Manual — NEG

Using `^x` in languages such as _Python, C_, etc. causes an invalid compile and throws a _syntax error_. I should have implemented this myself first before I wrote this article. I have scolded myself already.

In this situation, we _may_ have two things to do:

*   Changing the proposal slightly and propose the remove the use of `^x`. We should no longer allow that usage. _Not because of to complete our own job_ — to be more aligned with the usage of the unary syntax just like in other languages. (which will cause [l_anguage change_](https://github.com/golang/go/issues?q=is%3Aissue+label%3ALanguageChange)_)_
*   How could we add a new operator to `ssa` package ourselves if there is no such thing `ssa.OpCom`? We will dive into Op generators and architecture rules.
*   It seemed more consistent to use `NEG` instead of `COM` for the `~` operator. But `NEG` was already reserved for `-` . We should mention that in the proposal to swap OpCodes.

No demoralizing! The important thing is to learn something here! We can easily change the title of our proposal to something like:

> proposal: spec: add a built-in tilde `~` (bitwise not) unary operator (op: OCOM), **deprecate** `**^x**` **(XOR) usage**

Yes, I know. We **have to** replace all the `^x` usages with the `~x` in the compiler itself. Sounds like a Ba Dum Tss!

**4.3.1. Generic OPs**

Generic opcodes typically specify a width. The inputs and outputs of that op are the given number of bits wide. There is no notion of _sign_, so Add32 can be used both for signed and unsigned 32-bit addition.

Signed/unsigned is explicit with the extension ops (SignExt\*/ZeroExt\*) and implicit as the arg to some opcodes (e.g., the second argument to shifts is unsigned). If not mentioned, all args take signed inputs or don’t care whether their inputs are signed or unsigned.

Find the `./ssa/gen/genericOps.go` and jump to `genericOps` struct:

```
_var_ genericOps = \[\]opData {  
 _// 2-input arithmetic  
 // Types must be consistent with Go typing. Add, for example, must take two values of the same type and produces that same type._ {name: "Add8", argLength: 2, commutative: true}, _// arg0 + arg1_ {name: "Add16", argLength: 2, commutative: true},  
 ...  
 ...  
 ...  
 _// 1-input ops_ {name: "Neg8", argLength: 1}, _// -arg0_ {name: "Neg16", argLength: 1},  
 ...  
 {name: "Com8", argLength: 1}, _// ^arg0_ {name: "Com16", argLength: 1},  
 ...  
 {name: "Test8", argLength: 1}, _// ~arg0_ {name: "Test16", argLength: 1},  
 ...  
}
```

In this supposing, we created a new OpCode called `Test` . We will not use `Test` OpCode since `Neg` and `Com` already defined there. It’s just for educational purposes to wrap up this article.

Jump to `./ssa/opGen.go` , we need to implement new `Test` OpCode by calling `$ go generate` as already described in the `./ssa/gen/README` file. So, run the following command inside the `./ssa/gen` directory:

```
$ ../../../../../../bin/go run \*.go
```

![](https://miro.medium.com/v2/resize:fit:700/1*evYf09lPDcqQ3bXpsxcuMw.png)

Here is the diff:

![](https://miro.medium.com/v2/resize:fit:700/1*yuZXnpnxECwXU11o03FVLw.png)

**4.3.2. Rewrite Rules**
------------------------

Many optimizations can be specified using rewrite rules on the SSA form.

![](https://miro.medium.com/v2/resize:fit:700/1*itWL6oxv-K5Ze3xZEBmj1g.png)

Simple Review Rule for x-x=0

If we have a subtract _64-bit_ subtract of a value itself, we can just replace the with constant `0`. Go has a [bunch of optimizations in a big review rule file](https://github.com/golang/go/tree/master/src/cmd/compile/internal/ssa/gen) in the compiler.

![](https://miro.medium.com/v2/resize:fit:700/1*PO2Uz1WM5CwTa89KVWKicA.png)

Rewrite Rule Example

You can find more examples in the [_generic.rules_](https://github.com/golang/go/blob/master/src/cmd/compile/internal/ssa/gen/generic.rules) file, or in the `[src/cmd/compile/internal/ssa/gen](https://github.com/golang/go/tree/master/src/cmd/compile/internal/ssa/gen)` package:

![](https://miro.medium.com/v2/resize:fit:700/1*GLNV4H1_YQHDGPkm2ohmIw.png)

CLOC of \*.rules

Rewrite rules are also used to lower machine-independent operations to machine-independent operations.

*   The OpCodes on the **left** are the **Go** OpCodes. _(written in lowercase)_
*   The OpCodes on the **right** are the **ARCH** OpCodes. _(machine instructions)_

[386:](https://github.com/golang/go/blob/master/src/cmd/compile/internal/ssa/gen/386.rules)

```
(Neq64F x y) => (SETNEF (UCOMISD x y))
```

[RISCV64:](https://github.com/golang/go/blob/master/src/cmd/compile/internal/ssa/gen/RISCV64.rules)

```
(Neq64  x y) => (SNEZ (SUB x y))
```

[ARM64:](https://github.com/golang/go/blob/master/src/cmd/compile/internal/ssa/gen/ARM64.rules)

```
(Neq64 x y) => (NotEqual (CMP x y))
```

[MIPS64:](https://github.com/golang/go/blob/master/src/cmd/compile/internal/ssa/gen/MIPS64.rules)

```
(Neq64 x y) => (SGTU (XOR x y) (MOVVconst \[0\]))
```

[Review rules can get pretty complicated:](https://github.com/golang/go/blob/d4bfe006155ea0d9c2970e22fca5a027125c8a98/src/cmd/compile/internal/ssa/gen/AMD64.rules#L1638-L1653)

![](https://miro.medium.com/v2/resize:fit:700/1*3nJT8m2JSrYVkYCP39xtqQ.png)

It takes two 8-bit loads and replaces them with one 16-bit load if it can. So, this rule sort of checks all possible conditions under which this rewrite rule can apply. If so, it does the rewrite; and uses one 16-bit load instead. [\[10\]](https://youtu.be/uTMvKVma5ms?t=1735)

Converting the compiler to use an SSA IR led to substantial improvements in the generated code:

![](https://miro.medium.com/v2/resize:fit:700/1*MC29Gey3rMag4Sgw17TVAQ.png)

We can write some optimizations for the`~` operator like the following:

![](https://miro.medium.com/v2/resize:fit:700/1*oxTdC6zwqGNVrBNwE9qUMw.png)

Python Interpreter

*   `~~x == x`

```
(Com(64) (Com(64) x)) => x
```

*   `-~x == x+1`

```
(Neg(64) (Com(64) x)) => (Add(64) (Const(64) \[1\]) x)
```

*   `~(x-1) == -x`

```
(Com(64) (Add(64) (Const(64) \[-1\]) x)) => (Neg(64)
```

*   `~x+1 == -x`

```
(Add(64) (Const(64) \[1\]) (Com(64) x)) => (Neg(64) x)
```

Find the `generic.rules` file and add these instructions to gain some optimizations. We _may_ have to use all power of two values inside the OpCode. Use `Com(64|32|16|8)` instead `Com(64)` .

The big moment has come. I think there is nothing left we have to do except testing. Have you tried this yet?

5.1. Trying New Operator
------------------------

It is time to lift the curtain, run the `./test.sh` script:

```
\-16
```

And, boom! It _just_ worked. That’s pretty amazing! Isn’t it?

Let’s do small modifications to the `neg.go` snippet:

```
package main  
func main() {  
 x := -15  
 fn := func() int {  
  return x  
 }  
 println(~fn())  
}
```

It prints `14`, which means this works beautifully too. Our `~` operator is now fully functional.

5.2. Test & Build Go Compiler
-----------------------------

One more thing before running the tests. Remember Griesemer added Tilde operator with [this commit](https://go-review.googlesource.com/c/go/+/307370). So, we need to update the `./test/fixedbugs/issue23587.go` file, which is no more a _failing_ test case. We have to update the [Issue 23587](https://github.com/golang/go/issues/23587) test file like the following:

```
_// errorcheck  
package_ p  
_func_ \_(x int) {  
   \_ = ~x  
   \_ = x~ _// ERROR "unexpected ~ at end of statement"  
_}  
_func_ \_(x int) {  
   \_ = x ~ x _// ERROR "unexpected ~ at end of statement"  
_}
```

We want to assert the error the compiler will throw. Thus, we used `_errorcheck_`  action  here_._ We can run the given test file:

```
$ ./bin/go run ./test/run.go — ./test/fixedbugs/issue23587.go
```

This test passes. Yay! Let’s see if we broke any functionality in the compiler. Jump to the `./src` directory and simply run:

```
$ ./all.bashBuilding Go cmd/dist using /usr/local/go. (go1.16.3 darwin/amd64)  
Building Go toolchain1 using /usr/local/go.  
Building Go bootstrap cmd/go (go\_bootstrap) using Go toolchain1.  
Building Go toolchain2 using go\_bootstrap and Go toolchain1.  
Building Go toolchain3 using go\_bootstrap and Go toolchain2.  
Building packages and commands for darwin/amd64.\##### Testing packages.  
ok   archive/tar 2.021s  
ok   archive/zip 1.937s  
...  
...  
...  
ok   cmd/compile/internal/dwarfgen 6.948s  
ok   cmd/compile/internal/importer 1.919s  
ok   cmd/compile/internal/ir 0.424s  
ok   cmd/compile/internal/logopt 2.288s  
ok   cmd/compile/internal/noder 0.862s  
ok   cmd/compile/internal/ssa 1.226s  
ok   cmd/compile/internal/ssagen 0.801s  
ok   cmd/compile/internal/syntax 0.368s  
ok   cmd/compile/internal/test 25.796s  
ok   cmd/compile/internal/typecheck 13.242s  
ok   cmd/compile/internal/types 0.336s  
ok   cmd/compile/internal/types2 6.691s  
...  
...  
...  
ALL TESTS PASSED  
\---  
Installed Go for darwin/amd64 in /Users/furkan.turkal/src/public/go  
Installed commands in /Users/furkan.turkal/src/public/go/bin  
...
```

They pass! So, that means… We did a great job! We are done.

You can find the [full patch](https://github.com/Dentrax/go-tilde-operator/blob/main/0001.patch) on the [GitHub repository](https://github.com/Dentrax/go-tilde-operator).

I know _less is more_. Obviously, we do not like reading lots of text in a tutorial in general. I could have kept these brief and make our diagrams talk instead. I was furious at myself after I completed the article. If I was going to ask myself, “What could I do better?” I would definitely start writing this article after I implemented and tried it myself first. I really did not know that `^` is handling the `~` thing.

In this article, we tried to address many compiler subjects at the 201 level. That’s why some of the subjects remained open-ended. Although almost every subject is a completely different world, our goal here was to give a middle-level perspective to the compilers. I do not doubt that feedback will come from the maintainers and contributors for the issue and PR we have opened. Comments such as “we do the exact same thing with the `^` operator. Why we need this?” can be written, and both PR & issue _may_ be closed; or, it can also be considered in terms of _aligning_ with other languages.

I generally think I am a result-oriented person. But not for what we did here; not today at least… We have learned some good things today. I learned different new things about the technical details of the Go compiler while writing this article. Although I am not on the road to being a compiler expert, trying to learn the technical details of compilers gives me confidence. And I am inquisitive about these compiler habitats! Deep diving is beautiful. Much more logical, objective, and scientific. My love will never end! Maybe I will not be a compiler contributor, but I do not doubt that I will keep reading all of their changelogs one by one.

If we are on the way to becoming engineers  of the future, and we just do not want to be _consumers_ or end-users but creators, I think we also need to know how the products we use are created.

I am not sure that knowing a programming language down to its deepest details will teach anything to us. Technology changes all the time; our knowledge is becoming obsolete. We _have to_ keep up with the latest technology changes and updates. So let’s _understand_ instead of _memorizing_, let’s _see_ instead of _hearing_, let’s _learn_ instead of _ignoring_, let’s _demonstrate_ instead of _assuming_.

If you are fascinated by compilers as I do, if you want to know how it works, you should definitely do not postpone it off. We are not talking about creating a compiler from scratch while sitting and writing code for long hours like zombies. We try to learn new perspectives and knowledge by understanding compiler concepts. [There](https://github.com/aalhour/awesome-compilers) [are](https://www.reddit.com/r/learnprogramming/comments/5hwo3x/whats_the_best_resource_to_walk_me_through_making/) [some](https://news.ycombinator.com/item?id=136875) [great](https://gcc.gnu.org/wiki/ListOfCompilerBooks) [resources](https://stackoverflow.com/questions/1669/learning-to-write-a-compiler) out there that should not be missed.

Feature implementation to a compiler is not limited only to Go. Do give it a try on any compiler you want to! So, why not create a brand-new operator for Go, just as we did in this article? What about `§` operator?

If you spot a typo, find something wrong with the article, have a suggestion to make, or just a question, feel free to contact me: `furkan.turkal@hotmail.com`

Also, feel free to ping me on [Twitter](https://twitter.com/furkanturkaI) or [GitHub](https://github.com/Dentrax/) anytime.

![](https://miro.medium.com/v2/resize:fit:146/1*puO9QPsENQ5ww1QKNuf6tw.gif)

> “Thank you, and have a very safe and productive day!”