# The method to epoll’s madness. My previous post covered the… | by Cindy Sridharan | Medium
[

![](https://miro.medium.com/v2/resize:fill:44:44/1*Ax4WQg8mEn52zFP-qHibig.jpeg)






](https://copyconstruct.medium.com/?source=post_page---byline--d9d2d6378642---------------------------------------)

[My previous post](https://medium.com/@copyconstruct/nonblocking-i-o-99948ad7c957) covered the fundamentals of file descriptors as well as some of the most commonly used forms on non-blocking I/O operations on Linux and BSD. I had [some people](https://twitter.com/bascule) wonder why it didn’t cover **epoll** at all, but I’d mentioned in the conclusion of that post that **epoll** is by far the most interesting of all and as such warranted a separate post in its own right.

**_epoll_** stands for _event poll_ and is a Linux specific construct. It allows for a process to monitor multiple file descriptors and get notifications when I/O is possible on them. It allows for both _edge-triggered_ as well as _level-triggered_ notifications. Before we look into the bowels of _epoll_, first let’s explore the syntax.

Unlike [_poll_](http://man7.org/linux/man-pages/man2/poll.2.html)_, epoll_ itself is not a system call. It’s a kernel data structure that allows a process to multiplex I/O on multiple file descriptors.

![](https://miro.medium.com/v2/resize:fit:492/1*k-PycQSwivn-jIoEhXsvxg.png)

This data structure can be created, modified and deleted by three system calls.

[**1) epoll\_create**](http://man7.org/linux/man-pages/man2/epoll_create.2.html)
--------------------------------------------------------------------------------

The _epoll_ instance  is created by means of the `[epoll_create](http://man7.org/linux/man-pages/man2/epoll_create.2.html)` system call, which returns a file descriptor to the _epoll_ instance. The signature of _epoll\_create_ is as follows:

```
**#include <sys/epoll.h>**  
**int epoll\_create(int** _size_**);**
```

The **_size_**  argument is an indication to the kernel about the number of file descriptors a process wants to monitor, which helps the kernel to decide the size of the _epoll_ instance. Since Linux 2.6.8, this argument is ignored because the _epoll_ data structure dynamically resizes as file descriptors are added or removed from it.

The **_epoll\_create_**  system call returns a file descriptor to the newly created _epoll_ kernel data structure. The calling process can then use this file descriptor to add, remove or modify _other_ file descriptors it wants to monitor for I/O to the _epoll_ instance.

![](https://miro.medium.com/v2/resize:fit:546/1*o21hEWChu-cNHDj49xgCkg.jpeg)

There is another system call **_epoll\_create1_**  which is defined as follows:

```
**int epoll\_create1(int** _flags_**);**
```

The **_flags_**  argument can either be 0 or **EPOLL\_CLOEXEC.**

When set to 0, _epoll\_create1_ behaves the same way as _epoll\_create_.

When the **EPOLL\_CLOEXEC** flag  is  set**,** any child process forked by the current process will close the _epoll_ descriptor before it _execs,_ so the child process won’t have access to the _epoll_ instance anymore.

It’s important to note that the file descriptor associated with the _epoll_ instance needs to be released with a _close()_ system call. Multiple processes might hold a descriptor to the same _epoll_ instance, since, for example, a _fork_ without the **EPOLL\_CLOEXEC** flag will duplicate the descriptor to the _epoll_ instance in the child process). When all of these processes have relinquished their descriptor to the _epoll_ instance (by either calling _close()_ or by exiting), the kernel destroys the _epoll_ instance.

2) epoll\_ctl
-------------

A process can add file descriptors it wants monitored to the _epoll_ instance  by calling `[epoll_ctl](http://man7.org/linux/man-pages/man2/epoll_ctl.2.html)`. All the file descriptors registered with an _epoll_ instance  are collectively called an **_epoll set_** or the  **_interest list_**_._

![](https://miro.medium.com/v2/resize:fit:546/1*Abjr5spvjK56w1p7PszWVw.jpeg)

In the above diagram, process 483 has registered file descriptors **_fd1_**, **_fd2_**, **_fd3_**, **_fd4_** and **_fd5_** with the _epoll_ instance. This is the **_interest list_** or the **_epoll set_** of that particular _epoll_ instance. Subsequently, when any of the file descriptors registered become ready for I/O, then they are considered to be in the **_ready list_**_._

The **_ready list_** is a subset of the **_interest list_**.

![](https://miro.medium.com/v2/resize:fit:546/1*24HukCwzdkH0Vb8n-RHlFw.jpeg)

The signature of the `epoll_ctl` syscall is as follows:

```
**#include <sys/epoll.h>**  
**int epoll\_ctl(int** _epfd_**, int** _op_**, int** _fd_**, struct epoll\_event \***_event_**);**
```

![](https://miro.medium.com/v2/resize:fit:546/1*tBVMbOp11Iy-ctCZItRHaw.jpeg)

**_epfd —_** is the file descriptor returned by `epoll_create` which identifies the _epoll_ instance in the kernel.

**_fd —_** is the file descriptor we want to add to the **_epoll_** **_list_**/**_interest_** **_list_**.

**_op —_** refers to the operation to be performed on the file descriptor _fd_. In general, three operations are supported:

— **Register** **_fd_** with the _epoll_ instance (**EPOLL\_CTL\_ADD**) and get notified about events that occur on **_fd_**  
— **Delete**/deregister **_fd_** from the _epoll_ instance. This would mean that the process would no longer get any notifications about events on that file descriptor (**EPOLL\_CTL\_DEL**). If a file descriptor has been added to multiple _epoll_ instances, then closing it will remove it from all of the _epoll_ interest lists to which it was added.  
— **Modify** the events **_fd_** is monitoring (**EPOLL\_CTL\_MOD**)

![](https://miro.medium.com/v2/resize:fit:546/1*oZMBCl_zVPqyOfbGLSkcjA.jpeg)

**_event —_**  is a pointer to a structure called **_epoll\_event_** which stores the _event_ we actually want to monitor **_fd_** for.

![](https://miro.medium.com/v2/resize:fit:546/1*KDk1AVzQJegkcWKJQURYfw.jpeg)

The first field **_events_** of the _epoll\_event_ structure is a _bitmask_ that indicates which events **_fd_** is being monitored for.

Like so, if **_fd_**  is a socket, we might want to monitor it for the arrival of new data on the socket buffer (**EPOLLIN).** We might also want to monitor **_fd_**  for edge-triggered notifications which is done by OR-ing **EPOLLET** with **EPOLLIN.** We might also want to monitor **_fd_** for the occurrence of a registered event but only _once_ and stop monitoring **_fd_** for subsequent occurrences of that event. This can be accomplished by OR-ing the other flags (**EPOLLET, EPOLLIN)** we want to set for descriptor **_fd_** with the flag for only-once notification delivery **EPOLLONESHOT.** [All possible flags](http://man7.org/linux/man-pages/man2/epoll_ctl.2.html) can be found in the man page.

The second field of the _epoll\_event_ struct is a union field.

3) epoll\_wait
--------------

A thread can be notified of events that happened on the **_epoll set/interest set_** of an _epoll_ instance by calling the `[epoll_wait](http://man7.org/linux/man-pages/man2/epoll_wait.2.html)` system call, which blocks until any of the descriptors being monitored becomes _ready_ for I/O.

The signature of `epoll_wait` is as follows:

```
#include <sys/epoll.h>  
int **epoll\_wait**(int _epfd_, struct epoll\_event \*_evlist_, int _maxevents_, int _timeout_);
```

**epfd** — is the file descriptor returned by `epoll_create` which identifies the _epoll_ instance in the kernel.

**evlist** — is an array of **_epoll\_event_** structures. **_evlist_** is allocated by the calling process and when **_epoll\_wait_** returns, this array is modified to indicate information about the subset of file descriptors in the interest list that are in the _ready_ state (this is called the **_ready list_**)

**_maxevents_** — is the length of the evlist array

**_timeout_** — this argument behaves the same way as it does for **_poll_** _or_ **_select_**. This value specifies for how long the **_epoll\_wait_** system  call will block:

— when the **_timeout_** is set to 0, **_epoll\_wait_** does not block but returns immediately after checking which file descriptors in the interest list for _epfd_ are _ready_  
— when **_timeout_** is set to -1, **_epoll\_wait_** will block “forever”. When **_epoll\_wait_** blocks, the kernel can put the process to sleep until **_epoll\_wait_** returns. **_epoll\_wait_** will block until 1) one or more descriptors specified in the interest list for _epfd_ become ready or 2) the call is interrupted by a signal handler  
— when **_timeout_** is set to a non negative and non zero value, then **_epoll\_wait_** will block until 1) one or more descriptors specified in the interest list for _epfd_ becomes ready or 2) the call is interrupted by a signal handler or 3) the amount of time specified by **_timeout_** milliseconds have expired

The return values of **_epoll\_wait_**  are the following:

— if an error ([EBADF](https://www.gnu.org/software/libc/manual/html_node/Error-Codes.html) or EINTR or EFAULT  or  EINVAL) occurred, then the return code is -1  
— if the call timed out before any file descriptor in the interest list became ready, then the return code is 0  
— if one or more file descriptors in the interest list became _ready_, then the return code is a positive integer which indicates the total number of file descriptors in the _evlist_ array. The _evlist_ is then examined to determine which events occurred on which file descriptors.

To fully understand the nuance behind **_epoll_**, it’s important to understand how **_file descriptors_** really work. This was explored in my previous post, but it’s worth restating again.

A process references I/O streams with the help of **_descriptors._** Every process maintains a table of file descriptors which it has access to. Every entry in this table has two fields:

— flags controlling the operation of the file descriptor (the only such flag is the _close on exec_ flag)  
— a pointer to an underlying kernel data structure we’ll explore in a bit

Descriptors are either created explicitly by system calls like _open, pipe, socket_ and so forth or are **_inherited from the parent process_** during a _fork_. Descriptors are also “duplicated” with a _dup/dup2_ system call.

![](https://miro.medium.com/v2/resize:fit:546/1*_VtZwJShbVWNP0q3gjjf7g.png)

Descriptors are released when:

— the process exits  
— by calling the **_close_** system call  
— when a process forks, all the descriptors are “duplicated” in the child process. If any of the descriptors are marked **close-on-exec**, then after the parent [**forks**](http://man7.org/linux/man-pages/man2/fork.2.html) but before the child [**execs**](http://man7.org/linux/man-pages/man2/execve.2.html), the descriptors in the child marked as **close-on-exec** are closed and will no longer be available to the child process. The parent can still continue using the descriptor but the child wouldn’t be able to use it once it has **exec**_\-ed._

Let us assume in the above example process A has descriptor 3 marked with the **_close-on-exec_** flag. If process A forks process B, then immediately after the fork, process A and process B are identical, and as such process B will have “access” to file descriptors 0, 1, 2 and 3.

But since descriptor 3 is marked as _close-on-exec,_ before process B [**execs**](http://man7.org/linux/man-pages/man2/execve.2.html)_,_ this descriptor will be marked as “inactive”, and process B won’t be able to access it anymore.

![](https://miro.medium.com/v2/resize:fit:546/1*Q4p7cRAsPO5viq4RPPA1Fg.png)

To really understand what this means, it becomes important to understand that a descriptor really is just a _per process_ pointer to an underlying kernel data structure called (confusingly) the **_file description_**.

The kernel maintains a table of all open **_file descriptions_** called the **_open file table_**.

![](https://miro.medium.com/v2/resize:fit:546/1*3HKXhvJG2A8iWpRAbK74sw.png)

Let’s assume **_fd3_** of process A was created as a result of a _dup_ or an _fcntl_ system call on descriptor **_fd0_**. Both the original descriptor **_fd0_** and the “_duplicated”_ descriptor **_fd3_** point to the same **_file description_** in the kernel.

If process A then forks process B and **_fd3_** is marked with the **_close-on-exec_** flag, then the child process B will inherit all of the parent process A’s descriptors _but cannot use_ **_fd3_**.

It’s important to note that **_fd0_** in the child process B will also **_point to the same open file description_** in the kernel’s open file table.

![](https://miro.medium.com/v2/resize:fit:546/1*qxKUGjL7dNAmLx9zc8aEHA.png)

We have three descriptors — **_fd0_** and **_fd3_** in Process A and **_fd0_** in Process B — that all point to the same underlying kernel open file description. Hold this thought, because this has some important implications for _epoll_. All other file descriptors in both processes A and B also point to an entry in the open file table, but have been omitted from the diagram.

**_Note_** - File descriptions aren’t just shared by two processes when one forks the other. If one process passed a file descriptor to another process over a Unix Domain Socket socket, then the descriptors of both processes again point to the same underlying kernel open file description.

Finally, it becomes important to understand what the _inode pointer_ field of a _file description_ is. But prior to that, it’s important to understand what an _inode_ is.

An inode is file system data structure that contains information about a filesystem object like a file or a directory. This information includes:

— the location of the _blocks_ on disk where the file or directory data is stored  
— the _attributes_ of the file or directory  
— additional _metadata_ about the file or directory, such as access time, owner, permissions and so forth.

Every file (and directory) in the file system has an **_inode_** entry, which is a number that refers to the file. This number is also called the **_inode number_**. On many file systems, the maximum number of _inodes_ is capped to a certain value, meaning the total number of files that can be stored on the system is capped too.

There’s an **_inode table_** entry on disk that maintains a map of the **_inode number_** to the actual _inode_ data structure on disk. Most file systems are accessed via the kernel’s file system driver. This driver uses the **_inode_ _number_** to access the information stored in the _inode_. Thus in order to know the location of a file or any metadata pertaining to the file, the kernel’s file system driver needs to access the **_inode table_**.

Let’s assume _after_ process A forks process B, process A has created two more file descriptors **_fd4_** and **_fd5_**. These aren’t duplicated in process B.

Let’s assume **_fd5_** is created as a result of process A calling `open` on file `abc.txt` for _reading_. Let us assume process B also calls `open`on `abc.txt` but for _writing_ and the file descriptor the `open` call returns to process B is **_fd10_**.

Then process A’s **_fd5_** and process B’s **_fd10_** point to different open file descriptions in the open file table, _but they point to the same_ **_inode table_** _entry_ (or in other words, the same file).

![](https://miro.medium.com/v2/resize:fit:546/1*zwsANOj2UkICip9FhDzl_Q.png)

This has two very important implications:

— Since **_fd0_** in both process A and process B refer to the same open file description, they share the **_file offset_**. This means that if process A advances the file offset (by calling `read()`or `write()` or `lseek()`), then the offset changes for process B as well. This is also applicable to **_fd3_** belonging to process A, since **_fd3_** refers to the same open file description as **_fd0_**.  
— This is also applicable to modifications made by a file descriptor in one process to an open file status flag ( O\_ASYNC, O\_NONBLOCK, O\_APPEND). So if process B sets **_fd0_** to the non blocking mode by setting the `O_NONBLOCK`flag via the `fcntl`system call, then descriptors **_fd0_** and **_fd3_** belonging to process A will also start observing non-blocking behavior.

Let us assume a process A has two open file descriptors **_fd0_** and **_fd1_**, that have two open _file descriptions_ in the open file table. Let is assume both these file descriptions point to different _inodes_.

![](https://miro.medium.com/v2/resize:fit:546/1*scf0ApLpoBZtH9Ahnyn4rQ.png)

`epoll_create` creates a new _inode entry_ (the _epoll_ instance) as well as an open _file description_ for it in the kernel, and returns to the calling process a file descriptor (**_fd9_**) to this open file description.

![](https://miro.medium.com/v2/resize:fit:546/1*TP1smt6FsYqSVmW7Yi_foA.png)

When we use `epoll_ctl` to add a file descriptor (say **_fd0_**) to the epoll instance’s _interest list_, we’re **_actually fd0’s underlying file description_** to the _epoll_ instance’s interest list.

![](https://miro.medium.com/v2/resize:fit:546/1*ObWegZ_IDTqGVH2KLYxPSA.png)

Thus the _epoll_ instance actually monitors the _underlying file description_, and **_not the per process file descriptor_**. This has some interesting implications.

— If process A forks a child process B, then B inherits all of A’s descriptors, including **_fd9_**, the epoll descriptor. However, process B’s descriptors **_fd0_**, **_fd1_** and **_fd9_** still refer to the same underlying kernel data structures. Process B’s _epoll_ descriptor (**_fd9_**) _shares the same interest list_ with process A.

If after the fork, if process A creates creates a new descriptor **fd8** (non-duplicated in process B) to its _epoll_ interest list via `epoll_ctl`, then it’s not just process A that gets notifications about events on **fd8** when calling `epoll_wait()`

If process B calls `epoll_wait()`, then process B gets the notification about **fd8** (which belongs to process A and wasn’t duplicated during the fork) as well. This is also applicable when the _epoll_ file descriptor is duplicated by means if a call to `dup/dup2` or if the _epoll_ file descriptor is passed to another process over a Unix Domain Socket.

![](https://miro.medium.com/v2/resize:fit:546/1*oYdvrj-gPPkycZdTFqb3fA.png)

Let’s assume process B opens the file pointed to by **_fd8_** with a new `open` call, and gets a new file descriptor (**_fd15_**) as a result. Let’s now assume process A closes **_fd8_**. One would assume that since process A has closed **_fd8_**, it will no longer get notifications about events on **_fd8_** when calling `epoll_wait`. This, however, isn’t the case, since the interest list monitors the _open file description._ Since **_fd15_** points to the same description as **_fd8_** (since they are both the same underlying file), process A gets notifications about events on **_fd15_**. It’s safe to say that once a file descriptor has been registered by a process with the epoll instance, then the process will continue getting notifications about events on the descriptor even if it closes the descriptor, so long as the underlying open file description is still referenced by at least one other descriptor (belonging to the same or a different process).

As stated in the previous post, the cost of **_select_**/**_poll_** is O(N), which means when N is very large (think of a web server handling tens of thousands of mostly sleepy clients), every time **_select_**/**_poll_** is called, even if there might only be a small number of events that actually occurred, the kernel still needs to scan every descriptor in the list.

Since epoll _monitors the underlying file description_, every time the open file description becomes ready for I/O, the kernel adds it to the ready list without waiting for a process to call `epoll_wait` to do this. **_When_**  a process does call `epoll_wait`, then at that time the kernel doesn’t have to do any additional work to respond to the call, but instead returns all the information about the _ready list_ it’s been maintaining all along.

Furthermore, with every call to _select/poll_ requires passing the kernel the information about the descriptors we want to monitored. This is obvious from the signature to both calls. The kernel returns the information about all the file descriptors passed in which the process again needs to examine (by scanning all the descriptors) to find out which ones are _ready_ for I/O.

```
**int** **poll(struct** **pollfd** **\***fds**,** **nfds\_t** nfds**,** **int** timeout**);****int** **select(int** nfds**,** **fd\_set** **\***readfds**,** **fd\_set** **\***writefds**, fd\_set** **\***exceptfds**,** **struct** **timeval** **\***timeout**);**
```

With _epoll_, once we add the file descriptors to the epoll instance’s **_interest list_** using the `epoll_ctl` call, then when we call `epoll_wait`in the future, we don’t need to subsequently pass the file descriptors whose _readiness_ information we wish to find out. The kernel again only returns back information about those descriptors which are ready for I/O, as opposed to the _select_/_poll_ model where the kernel returns information about **_every descriptor passed in_**.

As a result, the cost of epoll is **O(number of events that have occurred)** and not **O(number of descriptors being monitored)** as was the case with _select_/_poll_.

By default, epoll provides _level-triggered_ notifications. Every call to `epoll_wait` only returns the subset of file descriptors belonging to the interest list that are _ready._

So if we have four file descriptors (**_fd1_**, **_fd2_**, **_fd3_** and **_fd4_**) registered, and only two (**_fd2_** and **_fd3_**) are _ready_ at the time of calling `epoll_wait`, then only information about these two descriptors are returned.

![](https://miro.medium.com/v2/resize:fit:410/1*QYNlpDwBT6qNXCROU3At7A.jpeg)

It’s also interesting to note that in the default _level-triggered_ case, the nature of the descriptors (_blocking_ versus _non-blocking_) in _epoll’s_ interest won’t really affect the result of an `epoll_wait`call, since _epoll_ only ever updates its _ready list_ when the underlying open file description becomes _ready._

Sometimes we might just want to find the status of _any descriptor_ (say **_fd1_**, for example) in the interest list, irrespective of whether it’s ready or not. _epoll_ allows us to find out whether I/O is possible on any particular file descriptor (**_even if it’s not ready_** at the time of calling `epoll_wait`) by means of supporting **_edge-triggered_** notifications. If we want information about whether there has been any I/O activity on a file descriptor since the previous call to `epoll_wait` (or since the descriptor was opened, if there was no previous `epoll_wait` call made by the process), we can get _edge-triggered_ notifications by ORing the **EPOLLET** flag while calling `epoll_ctl` while registering a file descriptor with the _epoll_ instance.

Perhaps it becomes more helpful to see this in action in code [from a real project](https://github.com/cablehead/levee/blob/a135315bfc55a5b1b0ad36fd3e08baeb0360aef5/levee/_/poller/linux.lua#L121-L132) where a file descriptor is being registered with an _epoll_ instance with `epoll_ctl` where the **EPOLLET** flag is **_OR_**ed along with some other flags.

```
function Poller:register(fd, r, w)  
	local ev = self.ev\[0\]  
	ev.events = bit.bor(C.EPOLLET, C.EPOLLERR, C.EPOLLHUP)  
	if r then  
		ev.events = bit.bor(ev.events, C.EPOLLIN)  
	end  
	if w then  
		ev.events = bit.bor(ev.events, C.EPOLLOUT)  
	end  
	ev.data.u64 = fd  
	local rc = C.epoll\_ctl(self.fd, C.EPOLL\_CTL\_ADD, fd, ev)  
	if rc < 0 then errors.get(rc):abort() end  
end
```

Perhaps an illustrative example can better help understand how edge-triggered notifications work with _epoll_. Let’s use the example used previously, where a process has registered four descriptors with the _epoll_ instance. Let’s assume that **fd3** is a socket.

Let’s assume that at time **t1**, an input byte stream arrives on the socket referenced by **fd3**.

![](https://miro.medium.com/v2/resize:fit:410/1*3ewSn4PlgC9LArnaz6_7Tg.jpeg)

At **t0**, input arrives on the socket.

Let’s now assume that at time **_t4_**, the process calls `epoll_wait()`.

If at time **_t4_**, file descriptors **fd2** and **fd3** are ready, then the `epoll_wait` call reports **fd2** and **fd3** as _ready._

![](https://miro.medium.com/v2/resize:fit:410/1*W38B7SKlDRIxGcLlzswfYA.jpeg)

At time **t4**, the process calls epoll\_wait

Let’s assume that the process calls `epoll_wait` again at time **_t6_**. Let’s assume **fd1** is ready. Let’s also assume that _no_ input arrived on the socket referenced by **_fd3_** between times **_t4_** and **_t6_**.

In the _level-triggered_ case, a call to `epoll_wait` will return **_fd1_** to the process, since **_fd1_** is the only descriptor that is _ready._ However in the _edge-triggered case_, this call will _block_, since no new data has arrived on the socket referenced by **_fd3_** between times **t4** and **t6**.

![](https://miro.medium.com/v2/resize:fit:410/1*oDU5xip6MNnd0hgPzRDcpw.jpeg)

At time **t6**, the process calls **epoll\_wait** again

This post aimed to capture the “method” part. In order to understand the “madness” wrecked by these semantics of _epoll_, a good reference would be the following two blog posts:

**epoll is fundamentally broken** — [parts 1](https://idea.popcount.org/2017-02-20-epoll-is-fundamentally-broken-12/) and [2](https://idea.popcount.org/2017-03-20-epoll-is-fundamentally-broken-22/).