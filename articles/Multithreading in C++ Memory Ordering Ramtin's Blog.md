# Multithreading in C++: Memory Ordering | Ramtin's Blog
*   [Memory Model and Enforced Ordering](#memory-model-and-enforced-ordering)
*   [Sequenced-before](#sequenced-before)
*   [Synchronizes-with](#synchronizes-with)
*   [Inter-thread happens-before](#inter-thread-happens-before)
*   [Happens-before](#happens-before)
*   [Sequencing Models](#sequencing-models)
*   [Sequentially Consistent Ordering](#sequentially-consistent-ordering)
*   [Relaxed Ordering](#relaxed-ordering)
*   [Acquire/Release Ordering](#acquirerelease-ordering)
*   [Behind the Scenes](#behind-the-scenes)
*   [x86 vs ARM](#x86-vs-arm)
*   [Further Readings](#further-readings)

Both the Compiler and the CPU can reorder memory accesses, meaning that they can happen in a different order from what's specified in the code. These reordering happen for optimization purposes and we don't really care about them in single threaded applications However, this can become problematic in multithreaded applications where multiple threads may need to read from and write to shared memory simultaneously.

There are three different memory ordering models each offering different levels of restrictions and rules. They determine the degree of freedom that the CPU and the compiler have to reorder the operations in one thread, and to propagate changes between multiple threads. Here is a brief description of each model:

*   **Sequentially Consistent**: This is the most strict and straightforward ordering model. It guarantees that all the threads will agree on the same order of events, meaning that they will establish a _single total modification order_ of all atomic operations that are tagged with `memory_order_seq_cst`.
*   **Relaxed**: This ordering poses no constraints on the CPU and the compiler. The only guarantee with this ordering is that the operations will be carried out atomically. This ordering applies to operations tagged with `memory_order_relaxed`.
*   **Acquire/Release**: If the result of a _release atomic store_ (`atomicVar.store(value, std::memory_order_release)`) is read by an _acquire atomic load_ (`atomicVar.load(std::memory_order_acquire)`) in another thread, the second thread is guaranteed to see everything that happened before the _atomic store_. This ordering model is a middle ground between the other two in terms of constraints and it has better performance than **Sequentially Consistent** ordering.

Before diving deep into each of these models, let's go over some formal definitions and examples.

### Sequenced-before

When evaluation A happens before evaluation B in the same thread, A is _sequenced-before_ B.

### Synchronizes-with

```cpp

atomicFlag.store(true, std::memory_order_release);


while (!atomicFlag.load(std::memory_order_acquire));

```

In this example, the _atomic store_ in Thread 1 is _synchronized with_ the _atomic load_ in Thread 2. The use case of this will become clear when we go over the **Acquire/Release** ordering in more detail.

### Inter-thread happens-before

Evaluation A inter-thread happens-before B in the following situations:

*   A _synchronizes-with_ B

```cpp

atomicNum.store(20, std::memory_order_release); 


while (atomicNum.load(std::memory_order_acquire) != 20); 

```

*   A _synchronizes-with_ X and X is _sequenced-before_ B

```cpp

atomicFlag.store(true, std::memory_order_release); 


while (!atomicFlag.load(std::memory_order_acquire)); 
std::cout << "Hello"; 

```

*   A is _sequenced-before_ X, and X _inter-thread happens-before_ B

```cpp

atomicNum.store(20, std::memory_order_relaxed); 
atomicFlag.store(true, std::memory_order_release); 


while (!atomicFlag.load(std::memory_order_acquire));
int value = atomicNum.load(std::memory_order_relaxed); 

```

*   A _inter-thread happens-before_ X, and X _inter-thread happens-before_ B (transitive property).

```cpp

atomicNum.store(20, std::memory_order_relaxed); 
flag1.store(true, std::memory_order_release);


while (!flag1.load(std::memory_order_acquire)); 
flag2.store(true, std::memory_order_release);


while (!flag2.load(std::memory_order_acquire));
int value = atomicNum.load(std::memory_order_relaxed); 

```

### Happens-before

We say A _happens-before_ B if either A is _sequenced-before_ B or A _inter-thread happens-before_ B.

Sequentially Consistent Ordering
--------------------------------

In the absence of any explicit ordering, `memory_order_seq_cst` is the default. The sequentially consistent ordering is the most restrictive ordering out of all the options, and it's the most intuitive one. It guarantees that all the threads will agree on the same sequence of events between the atomic operations, and the atomic `stores` are _synchronized with_ subsequent atomic `loads`.

There is only one downside with this approach. This restriction and the guarantee of ordering comes at the cost of performance. In multicore systems, different cores may need to perform additional expensive synchronization instructions in order to guarantee sequential consistency between each other. One such instruction is `XCHG` which is discussed later on in this article.

Let's go over an example of what sequentially consistent ordering means:

```cpp



atomicNumber.store(20, std::memory_order_seq_cst); 
flag.store(true, std::memory_order_seq_cst); 


while (!flag.load(std::memory_order_seq_cst)); 
assert(atomicNumber.load() == 20); 

```

In this example, the assertion on line 4 will _never_ fail. This is because the atomic store on line 2 in Thread 1 is _synchronized with_ the atomic load on line 3 in Thread 2 and in Thread 1, the atomic store in the `atomicNumber` variable, _happens before_ the atomic store on the flag. Due to the transitive property of the _happens before_ relationship, line 1 happens before line 4 and therefore, the assertion will always succeed.

This example is very intuitive and is what we would expect to happen. This is exactly why `memory_order_seq_cst` is the default mode for all the atomic operations. Unless we have a good reason not to, we can usually stick with this memory ordering model. As we will see in a bit, the assertion above _may fail_ if we used `memory_order_relaxed` instead.

Relaxed Ordering
----------------

`memory_order_relaxed` is the exact opposite side of the coin. Minimal to no guarantee is made on the ordering of the atomic operations used with this model. Another interesting thing with relaxed ordering is that different threads **may not** agree on the same order of events. Meaning that 2 threads may see 2 different values for the same atomic variable at the exact same time.

Let's see an example of what's totally valid but unexpected when `memory_order_relaxed` is used:

```cpp

std::atomic<int> num(0);
std::atomic<bool> flag(false);


num.store(10, std::memory_order_relaxed);
num.store(20, std::memory_order_relaxed);
num.store(30, std::memory_order_relaxed);
num.store(40, std::memory_order_relaxed);
num.store(50, std::memory_order_relaxed);
flag.store(true, std::memory_order_relaxed);


while (!flag.load(std::memory_order_relaxed));
int value = num.load(std::memory_order_relaxed);

```

In Thread 2, `value` can be 10, 20, 30, 40, or 50. All of these are valid outcomes because we used `memory_order_relaxed` and there is no guarantee that both threads will see the same value for the atomic variable `num`. Some rules still apply, even with relaxed ordering. For instance, let's assume that thread 2 sees the value 30 the first time it calls `num.load(std::memory_order_relaxed)`. In this situation, the subsequent calls to `num.load(std::memory_order_relaxed)` in thread 2 cannot see any of the previous atomic stores on num, so they will either still see 30, or they will see the subsequent atomic stores in thread 1 which are 40 and 50.

The benefit of using a relaxed ordering is that it has the best performance but it's also the trickiest to get right. Due to the looseness of the rules enforced by `memory_order_relaxed`, it shouldn't be used often unless performance if of utmost importance. A common application of `memory_order_relaxed` is incrementing a counter because we don't really care about the order in which the counter gets incremented, as long as it does eventually and atomically.

Acquire/Release Ordering
------------------------

The _Acquire/Release_ ordering model is a middle ground between the _sequentially consistent_ and _relaxed_ models. It has better performance than _sequentially consistent_, and it provides useful synchronization guarantees in multithreaded programs.

If a _load atomic_ operation tagged with `memory_order_acquire` in Thread B, reads a value stored in the same atomic variable with an _atomic store_ tagged with `memory_order_release` in Thread A, then Thread A _synchronizes with_ Thread B, and they will participate in a release sequence. This means that all **atomic and non-atomic** memory accesses before the _release store_ are visible after the _acquire load_. In terms of the definitions we had earlier, every memory access that appears before the _store_ tagged with `memory_order_release`, _happens before_ the instructions that appear after the _load_ tagged with `memory_order_acquire`.

This synchronization is only established between the threads _releasing_ and _acquiring_ the same atomic variable. Memory accesses may still propagate in a different order to other threads that don't perform an _acquire_ operation on the same atomic variable.

```cpp

nonAtomicNum = 20
atomicNum.store(40, std::memory_order_relaxed);
flag.store(true, std::memory_order_release); 


while (!flag.load(std::memory_order_acquire)); 
assert(nonAtomicNum == 20); 
assert(atomicNum.load(std::memory_order_relaxed) == 40); 

```

In the example above, Thread 1 _synchronizes with_ Thread 2 on flag, which is an atomic boolean. Therefore, all the writes before the store tagged with `memory_order_release` are going to be visible in Thread 2 after the synchronization. As a result, both the asserts are always guaranteed to succeed.

x86 vs ARM
----------

In strongly ordered architectures like x86, _release-acquire_ is the default and it is the minimum amount of constraint imposed by the CPU on the ordering of the instructions. No additional instruction is generated for `memory_order_release` and `memory_order_acquire` as opposed to `memory_order_relaxed` in these architectures.

```cpp
atomicNum.store(10, std::memory_order_release); 
atomicNum.store(10, std::memory_order_relaxed); 

```

Lines A and B in the example above produce the exact same assembly code. The `mov` instruction guarantees _release-acquire_ ordering in the x86 architecture (compiled with x86 GCC 13.2):

```armasm
mov DWORD PTR atomicNum[rip], 10

```

in weakly ordered systems like ARM however, the CPU may reorder the operations that are tagged with `memory_order_release`. In these systems, additional instructions are required to enforce _release-acquire_ ordering. Line A in the example above generates the following arm assembly (compiled with ARM GCC 13.2.0):

whereas Line B generates the following:

`dmb` stands for Data Memory Barrier which according to the _arm documentation_, "ensures that all explicit memory accesses that appear in program order before the `DMB` instruction are observed before any explicit memory accesses that appear in program after the `DMB` instruction". This is exactly the behavior we would expect from `memory_order_release`. For operations that are tagged with `memory_order_acquire`, the data memory barrier (`dmb`) will be placed after the main instruction. and with `memory_order_seq_cst`, the main instruction will be wrapped with two data memory barriers:

```armasm

dbm ish
movs r2, #10
dmb ish

```

To ensure sequential consistency in x86 architectures, the compiler either uses `mov` +`mfence` or `mov` + `xchg`. The `mov` by itself is not enough since it only has _release_ semantics. `xchg` has an implicit lock prefix which makes it a full memory barrier. I got the following assembly when compiling with x86 GCC 13.2:

```armasm

mov eax, 10
xchg eax, DWORD PTR counter[rip]

```

These additional instructions explain the performance difference between different memory models and why they work the way they do.

Further Readings
----------------

*   [std::memory\_order on cppreference.com](https://en.cppreference.com/w/cpp/atomic/memory_order)
*   [Order of Evaluation on cppreference.com](https://en.cppreference.com/w/cpp/language/eval_order)
*   [Jeff Preshing's blog post: This is Why They Call it a Weakly-ordered CPU](https://preshing.com/20121019/this-is-why-they-call-it-a-weakly-ordered-cpu/#:~:text=Nothing%20drives%20the%20point%20home,than%20another%20core%20wrote%20them.)
*   [Section 5.3 of the book C++ Concurrency in Action by Anthony Williams](https://www.manning.com/books/c-plus-plus-concurrency-in-action)