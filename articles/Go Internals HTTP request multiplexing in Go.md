# Go Internals HTTP request multiplexing in Go
The article assumes you have a basic understanding of concurrency and how the Go scheduler works.

The article also assumes our Go server runs on Linux since the internal implementation for some network APIs can differ, per operating system. Nevertheless, the concepts should remain the same.

Now let's dive in to take a look at how network I/O works in the world of M:N scheduling in Go.

I find it difficult to remember all the characters and their motives when reading a book 😅. Having a list of characters at the end of the book always helps.

Following are the entities we'll be looking at in this article, each interacting with one another directly or indirectly(like in a good thriller novel):

1.  **goroutines:** They are lightweight threads of execution that run _concurrently_ within a Go program. The go runtime manages them compared to actual OS threads, which are managed by the OS kernel.
    
2.  **scheduler:** The Go scheduler is the conductor of your Go program. It manages goroutines, decides when a goroutine is created, and picks which goroutine to run at any given time.
    
3.  **sysmon:** Go’s standard library provides a separate thread to monitor the user application and identify bottlenecks. This thread is called sysmon(system monitor). It runs independently of the Go scheduler. It is responsible for running goroutines blocked during network or disk operations.
    
4.  **netpoller:** It is a behind-the-scenes worker that efficiently manages network I/O. It listens for network events and wakes up waiting goroutines when data is ready to be processed. _We'll discuss more about it in the next section._
    
5.  **epoll**: It is an I/O event notification mechanism used in Linux. It allows a program to efficiently monitor multiple network requests for events such as connection requests and incoming data. On BSD, we have kqueue; on Windows, we have IOCompletionPort for the same stuff. _We'll discuss more about it in this article._
    

[Permalink](#heading-why-do-we-need-it "Permalink")Why do we need it?
---------------------------------------------------------------------

### [Permalink](#heading-blocking-vs-non-blocking-interfaces "Permalink")Blocking v/s non-blocking interfaces

In some languages such as JavaScript or Dart, I/O operations are handled concurrently through **non-blocking** paradigms like callbacks, or futures(promises in JS).  
This results in inversion of control, where your program delegates the responsibility of determining what to do (the code to run) after the I/O operation is finished, to the runtime or a library. Meanwhile, the rest of your code continues executing in a non-blocking fashion.

Go is different. In Go, the I/O operations are inherently **blocking**. You make things concurrent by using primitives like goroutines and channels. This (in my opinion) makes your program much cleaner by having a singular flow of steps to execute. It is also easy to both read and write.

Simple API call examples in JS and Go to show the difference:

```
function fetchData() {
  return new Promise((resolve, reject) => {
    fetch('https://example.com/data')
      .then(response => response.json())
      .then(data => resolve(data))
      .catch(error => reject(error));
  });
}

fetchData()
  .then(data => { 
    
  })
  .catch(error => {
    console.error('Error fetching data:', error);
  });

```

```
func fetchData(url string, ch chan string) {
    response, err := http.Get(url)
    if err != nil {
        ch <- fmt.Sprintf("Error fetching data from %s: %v", url, err)
        return
    }
    defer response.Body.Close()

    data, err := response.Body.Read([]byte{})
    if err != nil {
        ch <- fmt.Sprintf("Error reading data from %s: %v", url, err)
        return
    }

    ch <- string(data)
}

func main() {
    url1 := "https://example.com/data1"
    url2 := "https://example.com/data2"

    ch := make(chan string)

    go fetchData(url1, ch)
    go fetchData(url2, ch)

    for i := 0; i < 2; i++ {
        data := <-ch 
        fmt.Println(data) 
    }
}

```

If you're interested in this topic and want to dig a bit more, do check out Bob Nystrom's [article](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/).

**But this poses one problem:**  
We know goroutines can get blocked for various reasons, like waiting for read/write to channels, waiting for a mutex to be unlocked, syscalls, etc.  
Syscalls are a little special, since not only do they block the goroutine, but they also block the underlying OS thread.

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1711824136061/c6b80759-7d3d-48c1-af6c-5006f919d3f0.png?auto=compress,format&format=webp)

Considering the GMP model of the Go scheduler, whenever a goroutine is blocked for I/O, the scheduler creates a new OS thread.  
Then it copies the blocked thread's remaining runqueue to the new thread and continues running the remaining goroutines on it, while the previous goroutine and the thread it was running on, are blocked for I/O.

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1711820884991/6e0e3952-07ba-4a20-ba73-863640cd0750.png?auto=compress,format&format=webp)

Imagine this happening for thousands of requests coming to your server application every second. Each request would effectively create a new thread, blocked on I/O to be completed.  
That's like having most of the waiters, stuck waiting for the customers to finish their meals, and not doing anything else in the meantime, like serving other customers.

Also, hundreds of threads would try to acquire the lock for the local runqueues once they're ready to resume after I/O completion, causing a bottleneck.

The barebones GMP model, won't cut. We need something more. This is where netpoller comes into the picture.

[Permalink](#heading-what-is-it "Permalink")What is it?
-------------------------------------------------------

So what do we need to tackle the above problem? We need to:

1.  park the blocked goroutines when they're blocked and wake them up when the I/O operation is ready to proceed.
    
2.  free up the OS thread for other tasks(goroutines) while the current goroutine is blocked.
    
3.  be notified by the operating system when the I/O stream is ready so that the blocked goroutine can be again moved to ready-state.
    

If we read the last point carefully, what we need is an **event-driven**, **non-blocking / asynchronous** interface for managing network I/O. That my friend, is what netpoller essentially is.

> network poller(netpoller) converts blocking I/O into asynchronous I/O.

[Permalink](#heading-when-does-it-act-the-netpollers-lifecycle "Permalink")When does it act? The netpoller's lifecycle
----------------------------------------------------------------------------------------------------------------------

Let's consider the below simple Go code to handle network requests.

```
import (
    "fmt"
    "net/http"
)

func handle(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello friend")
}

func main() {
    http.HandleFunc("/", handle)
    err := http.ListenAndServe(":8080", nil)
    if err != nil {
        
    }
}

```

In the above example, we create an HTTP server using methods from the "net/http" package.  
One important thing to remember is that, whenever the application accepts a connection, it will create a new goroutine to handle all the requests that will happen on that connection.

### [Permalink](#heading-linux-network-apis-a-quick-look "Permalink")Linux Network APIs: a quick look

You can skip this part if you're not interested in going this deep or if you already know how the operating system handles network requests.

Ultimately, your application relies on the operating system to do the grunt work of establishing a TCP connection, creating a packet, and sending it over the internet.  
We'll quickly gloss over the APIs provided by Linux for user programs to do networking.

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1711875567040/180b1c36-fb9c-40b0-87cf-ff57356dddad.png?auto=compress,format&format=webp)

In Linux, EVERYTHING is a file! Even your network connections are treated as files you can read or write to.

A **File Descriptor(FD)** in Linux is a unique identifier associated with an open file, network connection, other input/output devices, etc. They provide a convenient and standardized way for our programs to manage I/O resources like files, devices, and network connections.  
A **Socket** is a file descriptor for the network resource, allowing you to use standard file I/O operations (like `read`, `write`) for network communication.

To put it simply, sockets are like unique keys that grant access to specific rooms in the building used for network communication.

Sockets can be created in 2 modes: blocking and non-blocking.

*   In **blocking mode**, when a socket is created, any attempt by the operating system thread to read from or write to the socket will cause the thread to pause, or block, until the socket is ready to perform the I/O operation.
    
*   Conversely, in **non-blocking mode**, if a process or thread attempts to perform I/O on the socket and it's not yet ready, instead of blocking, the operation returns immediately with a special error message indicating the socket's unavailability. The thread can then be parked, or put into a waiting state until the socket is ready for I/O streaming.
    

In Go, we create sockets in non-blocking mode. The reason will be clear in some time.

* * *

Additionally, communication via sockets can occur in two ways: _client_ and _server_. In the former, a connection request is initiated, while in the latter, connections are received.

Since this article concerns the server side of things, so we'll focus on the latter.

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1711271575869/6a1729d9-cd98-40c3-a6e3-5071af9a9bec.png?auto=compress,format&format=webp)

The above diagram summarizes the APIs provided by Linux to create and handle network requests. Let me explain what each method does:

1.  `getaddrinfo()`: is used to figure out what our IP address and hostname is.
    
2.  `socket()`: creates a file descriptor(FD) for network I/O. The key thing to note is the socket created here is only used to receive requests from clients for establishing a connection.
    
3.  `bind()`: associates the FD returned from `socket` with a specified IP address and port. We make a reservation to the OS that we'll use the given IP/Port combination to receive requests.
    
4.  `listen()`: tells the OS we're ready to receive network requests on this socket.
    
    We don't immediately start listening after bind, since we might need to do some initialization after successfully reserving a port.  
    In `http.ListenAndServe()` the method in the net package, this is what the _listen_ part means.
    
5.  `accept()`: it is called by the runtime when a client initiates a connection request to our server application. It creates a new socket that will be used to communicate with an individual client.  
    In the `http.ListenAndServe()` in Go, this is what the _serve_ part means. As mentioned earlier, serve creates a new goroutine for each connection.
    

In the above diagram, I have 2 pink dotted boxes beside methods `listen` and `accept`. Both with the prefix epoll. You can think of `listen` and `accept` as virtual functions, and `epoll_create` and `epoll_ctl` being their actual implementation.

You may ask, but what is **epoll**?

**epoll** is a kernel data structure. Its responsibility is to act as an event notification mechanism. It handles multiple file descriptors and monitors their readiness for I/O operations (reading or writing).  
In fact, the netpoller, kind of encapsulates epoll, serving as a bridge between the realm of the OS and our user-space server application.

*   `epoll_create()`: creates an epoll instance. It will be used to track the n/w connections and notify user space once a socket is ready to read from or write to.
    
*   `epoll_ctl()`: add the file descriptor for the new network request by a client using this method.
    

On a side note, there are 2 different ways Linux handles I/O multiplexing.

*   In legacy systems, we had something called _select & poll_, but its performance wasn't great.
    
*   epoll on the other hand, can manage large numbers of file descriptors(network requests) efficiently. netpoll package in Go uses epoll for this reason.
    

In different operating systems, netpoll uses the notification system provided by the OS, instead of epoll. On BSD and MacOS, netpoll uses kqueue, on Windows it uses IOCompletionPort.

epoll maintains an internal data structure called **Interest List** that keeps track of all FDs (sockets, pipes, etc.) a process is interested in monitoring for I/O events. It uses a red-black tree for efficient operations.

Within this list lies a subset known as the **Ready List**, comprising sockets ready and awaiting I/O streaming.

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1711812603772/b47d35ae-07b0-4256-b210-19869b84ad27.png?auto=compress,format&format=webp)

### [Permalink](#heading-netpoller-in-action-journey-of-an-http-request "Permalink")Netpoller in action: Journey of an HTTP request

Upon receiving a request from a client, our HTTP server creates a dedicated socket for I/O streaming with the client. At the same time, the netpoller registers the socket with the epoll instance by calling the `epoll_ctl` function.

At the same time, the netpoller also spawns a goroutine per socket as we discussed earlier, to run the handler for processing incoming HTTP requests. The netpoller maintains the association between the socket and goroutines using a data structure called `net.FD`.

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1711812055320/aa3c7eb2-5d70-48cb-a0a8-1c58ec2f4cd5.png?auto=compress,format&format=webp)

**1\. FD (File Descriptor):** Represents a network socket or file descriptor used for communication. Some of the fields it contains are:

*   File descriptor number
    
*   Reference to relevant system resources
    
*   Flags indicating socket type (TCP, UDP, etc.) and I/O events (read, write) of interest
    

**2\. PollDesc (Poll Descriptor):** Captures information about the desired I/O events for a specific FD. Some of the fields it contains are:

*   Reference to the associated FD

**3\. RuntimeCtx (Runtime Context):** Stores context information for the network connection. Some of the fields it contains are:

*   rg/wg: Goroutine associated with the connection (for handling requests)
    
*   User data or application-specific details relevant to the connection, like cookies
    

When the goroutine tries to read/write to the I/O stream using the socket, two things can happen:

1.  the I/O stream has data to read or has a buffer to write to, the operation is successful and the goroutine can return
    
2.  the I/O stream is not ready or blocked. In this case, the socket returns a special error indicating it is not ready.
    

Note: We encounter the second case when a goroutine uses the socket for the first time to read or write to the I/O stream. The operation will not succeed since the resources are not yet ready yet.

When the second case happens, the netpoller changes the state of the goroutine from running to waiting and parks it along with other goroutines. The thread executing the goroutine can continue with other goroutines without being blocked.

All of the above makes sure, we do not block the OS thread while waiting for the I/O stream to be ready. We have successfully converted our blocking I/O operation into a non-blocking one.

In the background, the operating system will **monitor the network activity**(e.g., data received, ready to write, connection established, etc.).

* * *

So when does our goroutine get a chance to run again?

The next time the Go scheduler runs to assign goroutines to OS threads, in one of the steps it will ask the netpoller if a goroutine is waiting to be run.

The Go scheduler uses the below algorithm, to pick goroutines to run on OS threads periodically.

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1711880565123/45320700-13ba-41dc-ae40-188af65354ab.png?auto=compress,format&format=webp)

1.  At specific intervals (1 in 61 times), the scheduler checks the global run queue for runnable goroutines. This is to make sure goroutines in the global runqueue aren't starved.
    
2.  Pick one goroutine from the local runqueue.
    
3.  In case the runqueue is empty, loop through the below steps, continuously searching for runnable goroutines to be assigned:
    
    1.  check finalizer goroutines responsible for cleaning up abandoned resources. These have high priority.
        
    2.  check the local runqueue again and pick one goroutine from the local runqueue.
        
    3.  check global runqueue for goroutines. Here the scheduler checks the global queue without the _1 in 61 times_ condition.
        
    4.  If there are goroutines that are waiting for network I/O (netpollWaiters), the scheduler attempts a non-blocking check.
        
    5.  If no runnable goroutines are found locally, it actively tries to steal work from other worker threads' local queues. This helps balance the workload across available threads.
        
    6.  check for idle GC marker goroutines. These are low-priority background tasks and are considered only if no other runnable options exist.
        

If the scheduler gets a runnable goroutine in any one of the steps, it skips the rest of the steps, until the next iteration.

In step 4 in the loop above, the Go scheduler checks with netpoller for network I/O when both the global and local run queues are empty. However, it only does this if no other worker thread is already handling network I/O, avoiding redundant checks.

the `netpoller` utilizes `epoll_wait` method on epoll to query and fetch the the sockets registered with epoll that are currently ready for I/O streaming (the socket in the ready list).  
Based on the list of ready sockets returned by `epoll_wait`, the `netpoller` identifies the associated goroutines. These previously blocked goroutines waiting for network events are marked as runnable again.

The `netpoller` then returns the list of ready goroutines back to the scheduler as a linked list. The scheduler selects the first goroutine (head of the list) for immediate execution.  
Any remaining ready goroutines from the `netpoller` are added to the global run queue. These goroutines might be scheduled for execution later based on the scheduler's selection criteria.

The sysmon also picks up goroutines from netpoller in case a goroutine has to be preempted(maybe it ran for more than 10ms).

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1711810354505/c2e05a1a-1213-4e34-a602-c541ca077ce8.png?auto=compress,format&format=webp)

The process continues for all the network requests we receive.

We learned how Go handles network I/O efficiently:

1.  **Encapsulating the Wait:** Go uses a system-specific mechanism (like `epoll` on Linux) to create a "system event" that represents the pending I/O operation. This event essentially tracks the waiting process.
    
2.  **Yielding the CPU:** Since the actual I/O operation might take some time, Go cleverly "parks" the currently running goroutine, freeing up the CPU for other goroutines to run concurrently.
    
3.  **Event Completion:** When the I/O operation finishes (e.g., data arrives or stream is ready), the system notifies the `epoll` mechanism.
    
4.  **Checking for Ready Events:**`netpoll` then interacts with OS(`epoll`) to see if any parked goroutines that were waiting for the I/O event can resume.
    
5.  **Resuming Execution:** If a parked goroutine is associated with the socket that is ready for I/O streaming, it's un-parked and made ready to run again.
    

1.  [https://youtu.be/xwlo3xigknI?si=Lmz5HFgCcbHp\_TkJ](https://youtu.be/xwlo3xigknI?si=Lmz5HFgCcbHp_TkJ)
    
2.  [https://morsmachine.dk/netpoller](https://morsmachine.dk/netpoller)
    
3.  [https://youtu.be/XXfdzwEsxFk?si=k3xiM9TCswSPuVTl](https://youtu.be/XXfdzwEsxFk?si=k3xiM9TCswSPuVTl)
    
4.  [https://groups.google.com/g/golang-codereviews/c/q-G\_4lpx4ps](https://groups.google.com/g/golang-codereviews/c/q-G_4lpx4ps)