# Perfect locality and three epic SystemTap scripts
In a recent blog post we discussed [epoll behavior causing uneven load](https://blog.cloudflare.com/the-sad-state-of-linux-socket-balancing/) among NGINX worker processes. We suggested a work around - the REUSEPORT socket option. It changes the queuing from "combined queue model" aka Waitrose (formally: [M/M/s](http://people.revoledu.com/kardi/tutorial/Queuing/MMs-Queuing-System.html)), to a dedicated accept queue per worker aka "the Tesco superstore model" (formally: [M/M/1](http://people.revoledu.com/kardi/tutorial/Queuing/MMs-Queuing-System.html)). With this setup the load is spread more evenly, but in certain conditions the latency distribution might suffer.

After reading that piece, a colleague of mine, John, said: _"Hey Marek, don't forget that REUSEPORT has an additional advantage: it can improve packet locality! Packets can avoid being passed around CPUs!"_

John had a point. Let's dig into this step by step.

In this blog post we'll explain the REUSEPORT socket option, how it can help with packet locality and its performance implications. We'll show three advanced SystemTap scripts which we used to help us understand and measure the packet locality.

The standard BSD socket API model is rather simple. In order to receive new TCP connections a program calls bind() and then listen() on a fresh socket. This will create a single accept queue. Programs can share the file descriptor - pointing to one kernel data structure - among multiple processes to spread the load. As we've [seen in a previous blog post](https://blog.cloudflare.com/the-sad-state-of-linux-socket-balancing/) connections might not be distributed perfectly. Still, this allows programs to scale up processing power from a limited single-process, single-CPU design.

![](https://cf-assets.www.cloudflare.com/zkvhlag99gkb/71jaXye3QUzA1zqSVuZRmQ/63baa3f7fd5e645911631646312d8b59/mms-1.jpeg.jpeg)

Modern network cards split the inbound packets across multiple RX queues, allowing multiple CPUs to share interrupt and packet processing load. Unfortunately in the standard BSD API the new connections will all be funneled back to single accept queue, causing a potential bottleneck.

This bottleneck was identified at Google, where a reported application was dealing with 40,000 connections per second. Google kernel hackers fixed it by [adding a TCP support for SO\_REUSEPORT socket option](https://lwn.net/Articles/542629/) in Linux kernel 3.9.

![](https://cf-assets.www.cloudflare.com/zkvhlag99gkb/5B2G4N5rR8U4TrLkekzX9g/fbb42fc0ba73ec2b244e8be84e8741f8/mm1-1.jpeg.jpeg)

REUSEPORT allows the application to set multiple accept queues on a single TCP listen port. This removes the central bottleneck and enables the CPUs to do more work in parallel.

Initially there was no way to influence the load balancing algorithm. While REUSEPORT allowed setting up a dedicated accept queue per each worker process, it wasn't possible to influence what packets would go into them. New connections flowing into the network stack would be distributed using only the usual 5-tuple hash. Packets from any of the RX queues, hitting any CPU, might flow into any of the accept queues.

This changed in Linux kernel 4.4 with the introduction of the [SO\_INCOMING\_CPU settable socket option](https://patchwork.ozlabs.org/patch/528071/). Now a userspace program could add a hint to make the packets received on a specific CPU go to a specific accept queue. With this improvement the accept queue won't need to be shared across multiple cores, improving CPU cache locality and fixing lock contention issues.

![](https://cf-assets.www.cloudflare.com/zkvhlag99gkb/3qVKKTNlhoSvrjKN2peAYH/a193a7185a4b1cb09f82fd9707df1206/mm1-local-1.jpeg.jpeg)

There are other benefits - with proper tuning it is possible to keep the processing of packets belonging to entire connections local. Think about it like that: if a SYN packet was received on some CPU it is likely that further packets for this connection will also be delivered to the same CPU[\[1\]](#fn1). Therefore, making sure the worker on the same CPU called the accept() has strong advantages. With the right tuning all processing of the connection might be performed on a single CPU. This can help keep the CPU cache warm, reduce cross-CPU interrupts and boost the performance of memory allocation algorithms.

SO\_INCOMING\_CPU interface is pretty rudimentary and was deemed unsuitable for more complex usage. It was superseded by the more powerful [SO\_ATTACH\_REUSEPORT\_CBPF option](https://lwn.net/Articles/675043/) (and it's extended variant: SO\_ATTACH\_REUSEPORT\_EBPF) in kernel 4.6. These flags allow a program to specify a fully functional BPF program as a load balancing algorithm.

Beware that the introduction of SO\_ATTACH\_REUSEPORT\_\[CE\]BPF broke SO\_INCOMING\_CPU. Nowadays there isn't a choice - you have to use the BPF variants to get the intended behavior.

NGINX in "reuseport" mode doesn't set the advanced socket options increasing packet locality. John suggested that improving packet locality is beneficial for performance. We must verify such a bold claim!

We wanted to play with setting couple of SO\_ATTACH\_REUSEPORT\_CBPF BPF scripts. We didn't want to hack the NGINX sources though. After some tinkering we decided it would be easier to write a SystemTap script to set the option from _outside_ the server process. This turned out to be a big mistake!

After plenty of work, numerous kernel panics caused by our buggy scripts (running in "guru" mode), we finally managed to get it into working order. The SystemTap script that calls "setsockopt" with right parameters. It's one of the most complex scripts we've written so far. Here it is:

*   [setcbpf.stp](https://github.com/cloudflare/cloudflare-blog/blob/master/2017-11-perfect-locality/setcbpf.stp)
    

We tested it on kernel 4.9. It sets the following CBPF (classical BPF) load balancing program on the REUSEPORT socket group. Sockets received on Nth CPU will be passed to Nth member of the REUSEPORT group:

```null
A = #cpu
A = A % <reuseport group size>
return A
```

The SystemTap script takes three parameters: pid, file descriptor and REUSEPORT group size. To figure out the pid of a process and a file descriptor number use the "ss" tool:

```null
$ ss -4nlp -t 'sport = :8181' | sort
LISTEN  0   511    *:8181  *:*   users:(("nginx",pid=29333,fd=3),...
LISTEN  0   511    *:8181  *:*   ...
...
```

In this listing we see that pid=29333 fd=3 points to REUSEPORT descriptor bound to port tcp/8181. On our test machine we have 24 logical CPUs (including HT) and we run 12 NGINX workers - the group size is 12. Example invocation of the script:

```null
$ sudo stap -g setcbpf.stp 29333 3 12
```

Unfortunately on Linux it's pretty hard to verify if setting CBPF actually does anything. To understand what's going on we wrote another SystemTap script. It hooks into a process and prints all successful invocations of the accept() function, including the CPU on which the connection was delivered to kernel, and current CPU - on which the application is running. The idea is simple - if they match, we'll have good locality!

The script:

*   [accept.stp](https://github.com/cloudflare/cloudflare-blog/blob/master/2017-11-perfect-locality/accept.stp)
    

Before setting the CBPF socket option on the server, we saw this output:

```null
$ sudo stap -g accept.stp nginx|grep "cpu=#12"
cpu=#12 pid=29333 accept(3) -> fd=30 rxcpu=#19
cpu=#12 pid=29333 accept(3) -> fd=31 rxcpu=#21
cpu=#12 pid=29333 accept(3) -> fd=32 rxcpu=#16
cpu=#12 pid=29333 accept(3) -> fd=33 rxcpu=#22
cpu=#12 pid=29333 accept(3) -> fd=34 rxcpu=#19
cpu=#12 pid=29333 accept(3) -> fd=35 rxcpu=#21
cpu=#12 pid=29333 accept(3) -> fd=37 rxcpu=#16
```

We can see accept()s done from a worker on CPU #12 returning client sockets received on some other CPUs like: #19, #21, #16 and so on.

Now, let's run CBPF and see the results:

```null
$ sudo stap -g setcbpf.stp `pidof nginx -s` 3 12
[+] Pid=29333 fd=3 group_size=12 setsockopt(SO_ATTACH_REUSEPORT_CBPF)=0

$ sudo stap -g accept.stp nginx|grep "cpu=#12"
cpu=#12 pid=29333 accept(3) -> fd=30 rxcpu=#12
cpu=#12 pid=29333 accept(3) -> fd=31 rxcpu=#12
cpu=#12 pid=29333 accept(3) -> fd=32 rxcpu=#12
cpu=#12 pid=29333 accept(3) -> fd=33 rxcpu=#12
cpu=#12 pid=29333 accept(3) -> fd=34 rxcpu=#12
cpu=#12 pid=29333 accept(3) -> fd=35 rxcpu=#12
cpu=#12 pid=29333 accept(3) -> fd=36 rxcpu=#12
```

Now the situation is perfect. All accept()s called from the NGINX worker pinned to CPU #12 got client sockets received on the same CPU.

But does it actually help with the performance?

Sadly: no. We've run a number of tests (using the setup introduced in previous blog post) but we weren't able to record any significant performance difference. Compared to other costs incurred by running a high level HTTP server, a couple of microseconds shaved by keeping connections local to a CPU doesn't seem to make a measurable difference.

### Measuring packet locality

But no, we didn't give up!

Not being able to measure an end to end performance gain, we decided to try another approach. Why not try to measure packet locality itself!

Measuring locality is tricky. In certain circumstances a packet can cross multiple CPUs on its way down the networking stack. Fortunately we can simplify the problem. Let's define "packet locality" as the probability of a packet (to be specific: the Linux sock\_buff data structure, skb) being allocated and freed on the same CPU.

For this, we wrote yet another SystemTap script:

*   [locality.stp](https://github.com/cloudflare/cloudflare-blog/blob/master/2017-11-perfect-locality/locality.stp)
    

When run without the CBPF option the script gave us this results:

```null
$ sudo stap -g locality.stp 12
rx= 21%   29kpps tx=  9%  24kpps
rx=  8%  130kpps tx=  8% 131kpps
rx= 11%  132kpps tx=  9% 126kpps
rx= 10%  128kpps tx=  8% 127kpps
rx= 10%  129kpps tx=  8% 126kpps
rx= 11%  132kpps tx=  9% 127kpps
rx= 11%  129kpps tx= 10% 128kpps
rx= 10%  130kpps tx=  9% 127kpps
rx= 12%   94kpps tx=  8%  90kpps
```

During our test the HTTP server received about 130,000 packets per second and transmitted about as much. 10-11% of the received and 8-10% of the transmitted packets had good locality - were allocated and freed on the same CPU.

Achieving good locality is not that easy. On the RX side, this means the packet must be received on the same CPU as the application that will read() it. On the transmission side it's even trickier. In case of TCP, a piece of data must all: be sent() by application, get transmitted, and receive back an ACK from the other party, all on the same CPU.

We performed a bit of tuning, which included inspecting:

*   number of RSS queues and their interrupts being pinned to right CPUs
    
*   the indirection table
    
*   correct XPS settings on the TX path
    
*   NGINX workers being pinned to right CPUs
    
*   NGINX using the REUSEPORT bind option
    
*   and finally setting CBPF on the REUSEPORT sockets
    

We were able to achieve almost perfect locality! With all tweaks done the script output looked better:

```null
$ sudo stap -g locality.stp 12
rx= 99%   18kpps tx=100%  12kpps
rx= 99%  118kpps tx= 99% 115kpps
rx= 99%  132kpps tx= 99% 129kpps
rx= 99%  138kpps tx= 99% 136kpps
rx= 99%  140kpps tx=100% 134kpps
rx= 99%  138kpps tx= 99% 135kpps
rx= 99%  139kpps tx=100% 137kpps
rx= 99%  139kpps tx=100% 135kpps
rx= 99%   77kpps tx= 99%  74kpps
```

Now the test runs at 138,000 packets per second received and transmitted. The packets have a whopping 99% packet locality.

As for performance difference in practice - it's too small to measure. Even though we received about 7% more packets, the end-to-end tests didn't show a meaningful speed boost.

We weren't able to prove definitely if improving packet locality actually improves performance for a high-level TCP application like an HTTP server. In hindsight it makes sense - the added benefit is minuscule compared to the overhead of running an HTTP server, especially with logic in a high level language like Lua.

This hasn't stopped us from having fun! We (myself, Gilberto Bertin and David Wragg) wrote three pretty cool SystemTap scripts, which are super useful when debugging Linux packet locality. They may come handy for demanding users, for example running high performance UDP servers or doing high frequency trading.

Most importantly - in the process we learned a lot about the Linux networking stack. We got to practice writing CBPF scripts, and learned how to measure locality with hackish SystemTap scripts. We got reminded of the obvious - out of the box Linux is remarkably well tuned.

* * *

_Dealing with the internals of Linux and NGINX sound interesting? Join our_ [_world famous team_](https://boards.greenhouse.io/cloudflare/jobs/589572) _in London, Austin, San Francisco and our elite office in Warsaw, Poland_.

* * *

* * *

1.  We are not taking into account aRFS - accelerated RFS. [↩︎](#fnref1)