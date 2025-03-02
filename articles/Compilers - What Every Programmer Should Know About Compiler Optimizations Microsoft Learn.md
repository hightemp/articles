# Compilers - What Every Programmer Should Know About Compiler Optimizations | Microsoft Learn
[Skip to main content](#main)

This browser is no longer supported.

Upgrade to Microsoft Edge to take advantage of the latest features, security updates, and technical support.

[](https://www.microsoft.com/)[Learn](https://learn.microsoft.com/en-us/)

*   *   [Documentation](https://learn.microsoft.com/en-us/docs/)
        
        In-depth articles on Microsoft developer tools and technologies
        
    *   [Training](https://learn.microsoft.com/en-us/training/)
        
        Personalized learning paths and courses
        
    *   [Credentials](https://learn.microsoft.com/en-us/credentials/)
        
        Globally recognized, industry-endorsed credentials
        
    *   [Q&A](https://learn.microsoft.com/en-us/answers/)
        
        Technical questions and answers moderated by Microsoft
        
    *   [Code Samples](https://learn.microsoft.com/en-us/samples/)
        
        Code sample library for Microsoft developer tools and technologies
        
    *   [Assessments](https://learn.microsoft.com/en-us/assessments/)
        
        Interactive, curated guidance and recommendations
        
    *   [Shows](https://learn.microsoft.com/en-us/shows/)
        
        Thousands of hours of original programming from Microsoft experts
        
    
    Microsoft Learn for Organizations
    
    [Boost your team's technical skills](https://learn.microsoft.com/en-us/training/organizations/)
    
    Access curated resources to upskill your team and close skills gaps.
    

[Sign in](#)

In this article
---------------

1.  [Defining Compiler Optimizations](#defining-compiler-optimizations)
2.  [Link-Time Code Generation](#link-time-code-generation)
3.  [The Debug Configuration](#the-debug-configuration)
4.  [The Compile-Time Code Generation Release Configuration](#the-compile-time-code-generation-release-configuration)
5.  [The Link-Time Code Generation Release Configuration](#the-link-time-code-generation-release-configuration)
6.  [Loop Optimizations](#loop-optimizations)
7.  [Controlling Optimizations](#controlling-optimizations)
8.  [Optimizations in .NET](#optimizations-in-net)
9.  [Wrapping Up](#wrapping-up)

February 2015

Volume 30 Number 2

* * *

By [Hadi Brais](https://learn.microsoft.com/en-us/archive/msdn-magazine/2015/february/%5Carchive%5Cmsdn-magazine%5Cauthors%5CHadi_Brais)

High-level programming languages offer many abstract programming constructs such as functions, conditional statements and loops that make us amazingly productive. However, one disadvantage of writing code in a high-level programming language is the potentially significant decrease in performance. Ideally, you should write understandable, maintainable code—without compromising performance. For this reason, compilers attempt to automatically optimize the code to improve its performance, and they’ve become quite sophisticated in doing so nowadays. They can transform loops, conditional statements, and recursive functions; eliminate whole blocks of code; and take advantage of the target instruction set architecture (ISA) to make the code fast and compact. It’s much better to focus on writing understandable code, than making manual optimizations that result in cryptic, hard-to-maintain code. In fact, manually optimizing the code might prevent the compiler from performing additional or more efficient optimizations.

Rather than manually optimizing code, you should consider aspects of your design, such as using faster algorithms, incorporating thread-level parallelism and using framework-specific features (such as using move constructors).

This article is about Visual C++ compiler optimizations. I’m going to discuss the most important optimization techniques and the decisions a compiler has to make in order to apply them. The purpose isn’t to tell you how to manually optimize the code, but to show you why you can trust the compiler to optimize the code on your behalf. This article is by no means a complete examination of the optimizations performed by the Visual C++ compiler. However, it demonstrates the optimizations you really want to know about and how to communicate with the compiler to apply them.

There are other important optimizations that are currently beyond the capabilities of any compiler—for example, replacing an inefficient algorithm with an efficient one, or changing the layout of a data structure to improve its locality. However, such optimizations are outside the scope of this article.

[](#defining-compiler-optimizations)

Defining Compiler Optimizations
-------------------------------

An optimization is the process of transforming a piece of code into another functionally equivalent piece of code for the purpose of improving one or more of its characteristics. The two most important characteristics are the speed and size of the code. Other characteristics include the amount of energy required to execute the code, the time it takes to compile the code and, in case the resulting code requires Just-in-Time (JIT) compilation, the time it takes to JIT compile the code.

Compilers are constantly improving in terms of the techniques they use to optimize the code. However, they’re not perfect. Still, instead of spending time manually tweaking a program, it’s usually much more fruitful to use specific features provided by the compiler and let the compiler tweak the code. 

There are four ways to help the compiler optimize your code more effectively:

1.  Write understandable, maintainable code. Don’t look at the object-oriented features of Visual C++ as the enemies of performance. The latest version of Visual C++ can keep such overhead to a minimum and sometimes completely eliminate it.
2.  Use compiler directives. For example, tell the compiler to use a function-calling convention that’s faster than the default one.
3.  Use compiler-intrinsic functions. An intrinsic function is a special function whose implementation is provided automatically by the compiler. The compiler has an intimate knowledge of the function and substitutes the function call with an extremely efficient sequence of instructions that take advantage of the target ISA. Currently, the Microsoft .NET Framework doesn’t support intrinsic functions, so none of the managed languages support them. However, Visual C++ has extensive support for this feature. Note that while using intrinsic functions can improve the performance of the code, it reduces its readability and portability.
4.  Use profile-guided optimization (PGO). With this technique, the compiler knows more about how the code is going to behave at run time and can optimize it accordingly.

The purpose of this article is to show you why you can trust the compiler by demonstrating the optimizations performed on inefficient but understandable code (applying the first method). Also, I’ll provide a short introduction to profile-guided optimization and mention some of the compiler directives that enable you to fine-tune some parts of your code.

There are many compiler optimization techniques ranging from simple transformations, such as constant folding, to extreme transformations, such as instruction scheduling. However, in this article, I’ll limit discussion to some of the most important optimizations—those that can significantly improve performance (by a double-digit percentage) and reduce code size: function inlining, COMDAT optimizations and loop optimizations. I’ll discuss the first two in the next section, then show how you can control the optimizations performed by Visual C++. Finally, I’ll take a brief look at optimizations in the .NET Framework. Throughout this article, I’ll be using Visual Studio 2013 to build the code.

[](#link-time-code-generation)

Link-Time Code Generation
-------------------------

Link-Time Code Generation (LTCG) is a technique for performing whole program optimizations (WPO) on C/C++ code. The C/C++ compiler compiles each source file separately and produces the corresponding object file. This means the compiler can only apply optimizations on a single source file rather than on the whole program. However, some important optimizations can be performed only by looking at the whole program. You can apply these optimizations at link time rather than at compile time because the linker has a complete view of the program.

When LTCG is enabled (by specifying the /GL compiler switch), the compiler driver (cl.exe) will invoke only the front end of the compiler (c1.dll or c1xx.dll) and postpone the work of the back end (c2.dll) until link time. The resulting object files contain C Inter­mediate Language (CIL) code rather than machine-dependent assembly code. Then, when the linker (link.exe) is invoked, it sees that the object files contain CIL code and invokes the back end of the compiler, which in turn performs WPO, generates the binary object files, and returns to the linker to stitch all object files together and produce the executable.

The front end actually performs some optimizations, such as constant folding, irrespective of whether optimizations are enabled or disabled. However, all important optimizations are performed by the back end of the compiler and can be controlled using compiler switches.

LTCG enables the back end to perform many optimizations aggressively (by specifying /GL together with the /O1 or /O2 and /Gw compiler switches and the /OPT:REF and /OPT:ICF linker switches). In this article, I’ll discuss only function inlining and COMDAT optimizations. For a complete list of LTCG optimizations, refer to the documentation. Note that the linker can perform LTCG on native object files, mixed native/managed object files, pure managed object files, safe managed object files and safe .netmodules.

I’ll build a program consisting of two source files (source1.c and source2.c) and a header file (source2.h). The source1.c and source2.c files are shown in **Figure 1** and **Figure 2**, respectively. The header file, which contains the prototypes of all functions in source2.c, is quite simple, so I won’t show it here.

Figure 1 The source1.c File

```
#include <stdio.h> // scanf_s and printf.
#include "Source2.h"
int square(int x) { return x*x; }
main() {
  int n = 5, m;
  scanf_s("%d", &m);
  printf("The square of %d is %d.", n, square(n));
  printf("The square of %d is %d.", m, square(m));
  printf("The cube of %d is %d.", n, cube(n));
  printf("The sum of %d is %d.", n, sum(n));
  printf("The sum of cubes of %d is %d.", n, sumOfCubes(n));
  printf("The %dth prime number is %d.", n, getPrime(n));
} 
```

Figure 2 The source2.c File

```
#include <math.h> // sqrt.
#include <stdbool.h> // bool, true and false.
#include "Source2.h"
int cube(int x) { return x*x*x; }
int sum(int x) {
  int result = 0;
  for (int i = 1; i <= x; ++i) result += i;
  return result;
}
int sumOfCubes(int x) {
  int result = 0;
  for (int i = 1; i <= x; ++i) result += cube(i);
  return result;
}
static
bool isPrime(int x) {
  for (int i = 2; i <= (int)sqrt(x); ++i) {
    if (x % i == 0) return false;
  }
  return true;
}
int getPrime(int x) {
  int count = 0;
  int candidate = 2;
  while (count != x) {
    if (isPrime(candidate))
      ++count;
  }
  return candidate;
} 
```

The source1.c file contains two functions: the square function, which takes an integer and returns its square, and the main function of the program. The main function calls the square function and all functions from source2.c except isPrime. The source2.c file contains five functions: the cube function returns the cube of a given integer; the sum function returns the sum of all integers from 1 to a given integer; the sumOfcubes function returns the sum of cubes of all integers from 1 to a given integer; the isPrime function determines whether a given integer is prime; and the getPrime function, which returns the xth prime number. I’ve omitted error checking because it’s not of interest in this article.

The code is simple but useful. There are a number of functions that perform simple computations; some require simple for loops. The getPrime function is the most complex because it contains a while loop and, within the loop, it calls the isPrime function, which also contains a loop. I’ll use this code to demonstrate one of the most important compiler optimizations, namely function inlining, and some other optimizations.

I’ll build the code under three different configurations and examine the results to determine how it was transformed by the compiler. If you follow along, you’ll need the assembler output file (produced with the /FA\[s\] compiler switch) to examine the resulting assembly code, and the map file (produced with the /MAP linker switch) to determine the COMDAT optimizations that have been performed (the linker can also report this if you use the /verbose:icf and /verbose:ref switches). So make sure these switches are specified in all of the following configurations I discuss. Also, I’ll be using the C compiler (/TC) so that the generated code is easier to examine. However, everything I discuss here also applies to C++ code.

The Debug configuration is used mainly because all back-end optimizations are disabled when you specify the /Od compiler switch without specifying the /GL switch. When building the code under this configuration, the resulting object files will contain binary code that corresponds exactly to the source code. You can examine the resulting assembler output files and the map file to confirm this. This configuration is equivalent to the Debug configuration of Visual Studio.

[](#the-compile-time-code-generation-release-configuration)

The Compile-Time Code Generation Release Configuration
------------------------------------------------------

This configuration is similar to the Release configuration in which optimizations are enabled (by specifying the /O1, /O2 or /Ox compile switches), but without specifying the /GL compiler switch. Under this configuration, the resulting object files will contain optimized binary code. However, no optimizations at the whole-program level are performed.

By examining the generated assembly listing file of source1.c, you’ll notice that two optimizations have been performed. First, the first call to the square function, square(n), in **Figure 1** has been completely eliminated by evaluating the computation at compile time. How did this happen? The compiler determined that the square function is small, so it should be inlined. After inlining it, the compiler determined that the value of the local variable n is known and doesn’t change between the assignment statement and the function call. Therefore, it concluded that it’s safe to execute the multiplication and substitute the result (25). In the second optimization, the second call to the square function, square(m), has been inlined, as well. However, because the value of m isn’t known at compile time, the compiler can’t evaluate the computation, so the actual code is emitted.

Now I’ll examine the assembly listing file of source2.c, which is much more interesting. The call to the cube function in sumOfCubes has been inlined. This in turn has enabled the compiler to perform significant optimizations on the loop (as you’ll see in the “Loop Optimizations” section). In addition, the SSE2 instruction set is being used in the isPrime function to convert from int to double when calling the sqrt function and also to convert from double to int when returning from sqrt. And sqrt is called only once before the loop starts. Note that if no /arch switch is specified to the compiler, the x86 compiler uses SSE2 by default. Most deployed x86 processors, as well as all x86-64 processors, support SSE2.

[](#the-link-time-code-generation-release-configuration)

The Link-Time Code Generation Release Configuration
---------------------------------------------------

The LTCG Release configuration is identical to the Release configuration in Visual Studio. In this configuration, optimizations are enabled and the /GL compiler switch is specified. This switch is implicitly specified when using /O1 or /O2. It tells the compiler to emit CIL object files rather than assembly object files. In this way, the linker invokes the back end of the compiler to perform WPO as described earlier. Now I’ll discuss several WPO optimizations to show the immense benefit of LTCG. The assembly code listings generated with this configuration are available online.

As long as function inlining is enabled (/Ob, which is turned on whenever you request optimizations), the /GL switch enables the compiler to inline functions defined in other translation units irrespective of whether the /Gy compiler switch (discussed a bit later) is specified. The /LTCG linker switch is optional and provides guidance for the linker only.

By examining the assembly listing file of source1.c, you can see that all function calls except for scanf\_s have been inlined. As a result, the compiler was able to execute the computations of the cube, sum and sumOfCubes. Only the isPrime function hasn’t been inlined. However, if it has been inlined manually in getPrime, the compiler would still inline getPrime in main.

As you can see, function inlining is important not only because it optimizes away a function call, but also because it enables the compiler to perform many other optimizations as a result. Inlining a function usually improves performance at the expense of increasing the code size. Excessive use of this optimization leads to a phenomenon known as code bloat. At every call site, the compiler performs a cost/benefit analysis and then decides whether to inline the function.

Due to the importance of inlining, the Visual C++ compiler provides much more support than what the standard dictates regarding inlining control. You can tell the compiler to never inline a range of functions by using the auto\_inline pragma. You can tell the compiler to never inline a specific function or method by marking it with \_\_declspec(noinline). You can mark a function with the inline keyword to give a hint to the compiler to inline the function (although the compiler may choose to ignore this hint if inlining would be a net loss). The inline keyword has been available since the first version of C++—it was introduced in C99. You can use the Microsoft-specific keyword \_\_inline in both C and C++ code; it’s useful when you’re using an old version of C that doesn’t support this keyword. Furthermore, you can use the \_\_forceinline keyword (C and C++) to force the compiler to always inline a function whenever possible. And last, but not least, you can tell the compiler to unfold a recursive function either to a specific or indefinite depth by inlining it using the inline\_recursion pragma. Note that the compiler currently offers no features that enable you to control inlining at the call site rather than at the function definition.

The /Ob0 switch disables inlining completely, which takes effect by default. You should use this switch when debugging (it’s automatically specified in the Visual Studio Debug Configuration). The /Ob1 switch tells the compiler to only consider functions for inlining that are marked with inline, \_\_inline or \_\_forceinline. The /Ob2 switch, which takes effect when specifying /O\[1|2|x\], tells the compiler to consider any function for inlining. In my opinion, the only reason to use the inline or \_\_inline keywords is to control inlining with the /Ob1 switch.

The compiler won’t be able to inline a function in certain conditions. One example is when calling a virtual function virtually; the function can’t be inlined because the compiler may not know which function is going to be called. Another example is when calling a function through a pointer to the function rather than using its name. You should strive to avoid such conditions to enable inlining. Refer to the MSDN documentation for a complete list of such conditions.

Function inlining isn’t the only optimization that’s more effec­tive when applied at the whole program level. In fact, most optimizations become more effective at that level. In the rest of this section, I’ll discuss a specific class of such optimizations called COMDAT optimizations.

By default, when compiling a translation unit, all code will be stored in a single section in the resulting object file. The linker operates at the section level. That is, it can remove sections, combine sections, and reorder sections. This precludes the linker from performing three optimizations that can significantly (double-digit percentage) reduce the size of the executable and improve its performance. The first is eliminating unreferenced functions and global variables. The second is folding identical functions and constant global variables. The third is reordering functions and global variables so those functions that fall on the same execution path and those variables that are accessed together are physically located closer in memory to improve locality.

To enable these linker optimizations, you can tell the compiler to package functions and variables into separate sections by specifying the /Gy (function-level linking) and /Gw (global data optimization) compiler switches, respectively. Such sections are called COMDATs. You can also mark a particular global data variable with \_\_declspec( selectany) to tell the compiler to pack the variable into a COMDAT. Then, by specifying the /OPT:REF linker switch, the linker will eliminate unreferenced functions and global variables. Also, by specifying the /OPT:ICF switch, the linker will fold identical functions and global constant variables. (ICF stands for Identical COMDAT Folding.) With the /ORDER linker switch, you can instruct the linker to place COMDATs into the resulting image in a specific order. Note that all of these optimizations are linker optimizations and don’t require the /GL compiler switch. The /OPT:REF and /OPT:ICF switches should be disabled while debugging for obvious reasons.

You should use LTCG whenever possible. The only reason not to use LTCG is when you want to distribute the resulting object and library files. Recall that these files contain CIL code rather than assembly code. CIL code can be consumed only by the compiler/linker of the same version that produced it, which can significantly limit the usability of the object files because developers have to have the same version of the compiler to use these files. In this case, unless you’re willing to distribute the object files for every compiler version, you should use compile-time code generation instead. In addition to limited usability, these object files are many times larger in size than the corresponding assembler object files. However, do keep in mind the huge benefit of CIL object files, which is enabling WPO.

The Visual C++ compiler supports several loop optimizations, but I’ll discuss only three: loop unrolling, automatic vectorization and loop-invariant code motion. If you modify the code in **Figure 1** so that m is passed to sumOfCubes instead of n, the compiler won’t be able to determine the value of the parameter, so it must compile the function to handle any argument. The resulting function is highly optimized and its size is rather large, so the compiler won’t inline it.

Compiling the code with the /O1 switch results in assembly code that’s optimized for space. In this case, no optimizations will be performed on the sumOfCubes function. Compiling with the /O2 switch results in code that’s optimized for speed. The size of the code will be significantly larger yet significantly faster because the loop inside sumOfCubes has been unrolled and vectorized. It’s important to understand that vectorization would not be possible without inlining the cube function. Moreover, loop unrolling would not be that effective without inlining. A simplified graphical representation of the resulting assembly code is shown in **Figure 3**. The flow graph is the same for both x86 and x86-64 architectures.

![](https://learn.microsoft.com/en-us/archive/msdn-magazine/2015/february/images/dn904673.brais_figure3new_hires(en-us,msdn.10).png)
  
**Figure 3 Control Flow Graph of sumOfCubes**

In **Figure 3**, the green diamond is the entry point and the red rectangles are the exit points. The blue diamonds represent conditions that are being executed as part of the sumOfCubes function at run time. If SSE4 is supported by the processor and x is larger than or equal to eight, then SSE4 instructions will be used to perform four multiplications at the same time. The process of executing the same operation on multiple values simultaneously is called vectorization. Also, the compiler will unroll the loop twice; that is, the loop body will be repeated twice in every iteration. The combined effect is that eight multiplications will be performed for every iteration. When x becomes less than eight, traditional instructions will be used to execute the rest of the computations. Note that the compiler has emitted three exit points containing separate epilogues in the function instead of just one. This reduces the number of jumps.

Loop unrolling is the process of repeating the loop body within the loop so that more than one iteration of the loop is executed within a single iteration of the unrolled loop. The reason this improves performance is that loop control instructions will be executed less frequently. Perhaps more important, it might enable the compiler to perform many other optimizations, such as vectorization. The downside of unrolling is that it increases the code size and register pressure. However, depending on the loop body, it might improve performance by a double-digit percentage.

Unlike x86 processors, all x86-64 processors support SSE2. Moreover, you can take advantage of the AVX/AVX2 instruction sets of the latest x86-64 microarchitectures from Intel and AMD by specifying the /arch switch. Specifying /arch:AVX2 enables the compiler to use the FMA and BMI instruction sets, as well.

Currently, the Visual C++ compiler doesn’t enable you to control loop unrolling. However, you can emulate this technique by using templates together with the \_\_ forceinline keyword. You can disable auto-vectorization on a specific loop using the loop pragma with the no\_vector option.

By looking at the generated assembly code, keen eyes would notice that the code can be optimized a bit more. However, the compiler has done a great job already and won’t spend much more time analyzing the code and applying minor optimizations.

someOfCubes is not the only function whose loop has been unrolled. If you modify the code so that m is passed to the sum function instead of n, the compiler won’t be able to evaluate the function and, therefore, it has to emit its code. In this case, the loop will be unrolled twice.

The last optimization I’ll discuss is loop-invariant code motion. Consider the following piece of code:

```
int sum(int x) {
  int result = 0;
  int count = 0;
  for (int i = 1; i <= x; ++i) {
    ++count;
    result += i;
  }
  printf("%d", count);
  return result;
} 
```

The only change here is that I have an additional variable that’s being incremented in each iteration and then printed. It’s not hard to see that this code can be optimized by moving the increment of the count variable outside the loop. That is, I can just assign x to the count variable. This optimization is called loop-invariant code motion. The loop-invariant part clearly indicates that this technique only works when the code doesn’t depend on any of the expressions in the loop header.

Now here’s the catch: If you apply this optimization manually, the resulting code might exhibit degraded performance in certain conditions. Can you see why? Consider what happens when x is nonpositive. The loop never executes, which means that in the unoptimized version, the variable count won’t be touched. How­ever, in the manually optimized version, an unnecessary assignment from x to count is executed outside the loop! Moreover, if x was negative, then count would hold the wrong value. Both humans and compilers are susceptible to such pitfalls. Fortunately, the Visual C++ compiler is smart enough to realize this by emitting the condition of the loop before the assignment, resulting in an improved performance for all values of x.

In summary, if you are neither a compiler nor a compiler optimizations expert, you should avoid making manual transformations to your code just to make it look faster. Keep your hands clean and trust the compiler to optimize your code.

[](#controlling-optimizations)

Controlling Optimizations
-------------------------

In addition to the compiler switches /O1, /O2 and /Ox, you can control optimizations for specific functions using the optimize pragma, which looks like this:

```
#pragma optimize( "[optimization-list]", {on | off} ) 
```

The optimization list can be either empty or contain one or more of the following values: g, s, t and y. These correspond to the compiler switches /Og, /Os, /Ot and /Oy, respectively.

An empty list with the off parameter causes all of these optimizations to be turned off regardless of the compiler switches that have been specified. An empty list with the on parameter causes the specified compiler switches to take effect.

The /Og switch enables global optimizations, which are those that can be performed by looking at the function being optimized only, not at any of the functions that it calls. If LTCG is enabled, /Og enables WPO.

The optimize pragma is useful when you want different functions to be optimized in different ways—some for space and others for speed. However, if you really want to have that level of control, you should consider profile-guided optimization (PGO), which is the process of optimizing the code by using a profile that contains behavioral information recorded while running an instrumented version of the code. The compiler uses the profile to make better decisions on how to optimize the code. Visual Studio provides the necessary tools to apply this technique on native and managed code.

There’s no linker involved in the .NET compilation model. However, there is a source code compiler (C# compiler) and a JIT compiler. The source code compiler performs only minor optimizations. For example, it doesn’t perform function inlining and loop optimizations. Instead, these optimizations are handled by the JIT compiler. The JIT compiler that ships with all versions of the .NET Framework up to 4.5 doesn’t support SIMD instructions. However, the JIT compiler that ships with the .NET Framework 4.5.1 and later versions, called RyuJIT, supports SIMD.

What’s the difference between RyuJIT and Visual C++ in terms of optimization capabilities? Because it does its work at run time, RyuJIT can perform optimizations that Visual C++ can’t. For example, at run time, RyuJIT might be able to determine that the condition of an if statement is never true in this particular run of the application and, therefore, it can be optimized away. Also RyuJIT can take advantage of the capabilities of the processor on which it’s running. For example, if the processor supports SSE4.1, the JIT compiler will only emit SSE4.1 instructions for the sumOfcubes function, making the generated code much more compact. However, it can’t spend much time optimizing the code because the time taken to JIT-compile impacts the performance of the application. On the other hand, the Visual C++ compiler can spend a lot more time to spot other optimization oppor­tunities and take advantage of them. A great new technology from Microsoft, called .NET Native, enables you to compile managed code into self-contained executables optimized using the Visual C++ back end. Currently, this technology supports only Windows Store apps.

The ability to control managed code optimizations is currently limited. The C# and Visual Basic compilers only provide the ability to turn on or off optimizations using the /optimize switch. To control JIT optimizations, you can apply the System.Runtime.Compiler­Services.MethodImpl attribute on a method with an option from MethodImplOptions specified. The NoOptimization option turns off optimizations, the NoInlining option prevents the method from being inlined, and the AggressiveInlining (.NET 4.5) option gives a recommendation (more than just a hint) to the JIT compiler to inline the method.

All of the optimization techniques discussed in this article can significantly improve the performance of your code by a double-digit percentage, and all of them are supported by the Visual C++ compiler. What makes these techniques important is that, when applied, they enable the compiler to perform other optimizations. This is by no means a comprehensive discussion of the compiler optimizations performed by Visual C++. However, I hope it has given you an appreciation of the capabilities of the compiler. Visual C++ can do more, much more, so stay tuned for Part 2.

* * *

**Hadi Brais** _is a Ph.D. scholar at the Indian Institute of Technology Delhi (IITD), researching compiler optimizations for the next-generation memory technology. He spends most of his time writing code in C/C++/C# and digging deep into the CLR and CRT. He blogs at [hadibrais.wordpress.com](https://hadibrais.wordpress.com/). Reach him at [hadi.b@live.com](mailto:hadi.b@live.com)._

Thanks to the following Microsoft technical expert for reviewing this article: Jim Hogg

Additional resources
--------------------

### In this article