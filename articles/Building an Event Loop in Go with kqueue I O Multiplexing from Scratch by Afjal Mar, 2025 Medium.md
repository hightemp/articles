# Building an Event Loop in Go with kqueue: I/O Multiplexing from Scratch | by Afjal | Mar, 2025 | Medium
Learn how to handle thousands of connections without threads using Go’s runtime and BSD’s kqueue system.
--------------------------------------------------------------------------------------------------------

[

![](https://miro.medium.com/v2/resize:fill:44:44/1*Kt20oIXqpE3aSZkB_vuHmA@2x.jpeg)






](https://medium.com/@smafjal?source=post_page---byline--14917eb4258f---------------------------------------)

![](https://miro.medium.com/v2/resize:fit:700/0*vFju5lvFbyKqoA-m)

Photo by [Erinada Valpurgieva](https://unsplash.com/@fairycarousel?utm_source=medium&utm_medium=referral) on [Unsplash](https://unsplash.com/?utm_source=medium&utm_medium=referral)

I/O multiplexing is a technique used in computer programming to manage multiple input/output (I/O) streams, such as files, network sockets, or devices, simultaneously within a single thread. It allows a program to monitor multiple sources of I/O and react to events (such as data becoming available to read or a socket being ready to accept more data for writing) without blocking on any single source.

Key Concepts of I/O Multiplexing:
---------------------------------

1.  **Non-blocking I/O**: Normally, a program might block (pause) when performing I/O operations like reading or writing. I/O multiplexing uses non-blocking techniques so that a program can continue to run while it waits for data.
2.  **Event-driven programming**: Instead of waiting for an I/O operation to complete, I/O multiplexing is event-driven. The program waits for notifications about the state of I/O operations (e.g., when a file or socket is ready for reading or writing).
3.  **Single-threaded model**: Instead of creating separate threads to handle multiple I/O sources, I/O multiplexing allows one thread to monitor and respond to many I/O events.

Common I/O Multiplexing Methods:
--------------------------------

`**select()**`:

*   It monitors multiple file descriptors (like sockets) and waits for one or more of them to become ready for I/O operations (read/write).
*   You provide a list of file descriptors to the `select()` system call, and it returns the ones that are ready.
*   Limits: The number of file descriptors that can be monitored at once is usually limited, and its performance decreases as the number of monitored descriptors grows.

`**poll()**`:

*   Similar to `select()`, but it scales better with a large number of file descriptors.
*   Instead of using fixed-size bit arrays (like `select()`), `poll()` uses a dynamic list of file descriptors, which improves performance when handling many connections.

`**epoll()**` (Linux-specific):

*   More efficient than `select()` and `poll()` for handling large numbers of file descriptors.
*   It allows you to register interest in a set of file descriptors and get notified when events occur on any of them.
*   `epoll` avoids the need to repeatedly pass the file descriptor list to the kernel, leading to better performance for high-concurrency scenarios.

`**kqueue()**` (BSD, macOS):

*   Similar to `epoll()`, but available on BSD-based systems like macOS and FreeBSD.
*   It is highly efficient and uses kernel queues to track events, allowing for high-performance I/O multiplexing.

Golang Default IO Multiplexer
-----------------------------

In Golang, `netpoll` (network polling) is an internal mechanism used by the runtime to efficiently manage network I/O operations. It is based on **epoll** (Linux), **kqueue** (macOS, BSD), or **IOCP** (Windows) to handle asynchronous I/O events.

_How Golang’s Netpoll Works by Default_
---------------------------------------

> **Goroutine-Based Concurrency**

*   Each network connection (TCP, UDP, etc.) in Go is handled by a goroutine.
*   The goroutine blocks on **syscalls** (e.g., `read`, `write`).
*   Instead of using a thread per connection (which is inefficient), Go uses a **poller thread** to wait for multiple network events.

> **Non-Blocking Syscalls**

*   When a goroutine makes a network call (`net.Conn.Read`, `net.Conn.Write`), Go sets the file descriptor to **non-blocking mode**.
*   The actual I/O is performed asynchronously using **epoll/kqueue/IOCP**, reducing CPU usage.

> **Polling in a Dedicated Thread**

*   Go’s runtime has a dedicated **network poller thread** that waits for events on multiple file descriptors.
*   If a goroutine attempts a read but data is not available, it gets parked (blocked) and the file descriptor is registered with netpoll.
*   Once data is available, the network poller wakes up and schedules the goroutine to run again.

> **_Integration with Go Scheduler (GMP Model)_**

*   When the poller detects I/O readiness, it **wakes up** the corresponding goroutine.
*   The goroutine is then rescheduled by Go’s runtime **M:N scheduler**, which maps many goroutines onto fewer OS threads.

Event Loop from scratch using kqueue (BSD)
------------------------------------------

Today, let’s dive into building an event loop from scratch using I/O multiplexing with `kqueue`. This hands-on approach will be an exciting way to understand how to manage multiple I/O events. By leveraging `kqueue`, we'll explore how to monitor multiple file descriptors and react to events without blocking, providing a deeper insight into system-level event handling.

```


package main

import (  
 "fmt"  
 "log"  
 "net"  
 "syscall"  
)

func main() {  
 listener, err := createNonBlockingListener("0.0.0.0:8080")  
 if err != nil {  
  log.Fatalf("Failed to create listener: %v", err)  
 }  
 defer syscall.Close(listener)

   
 kq, err := syscall.Kqueue()  
 if err != nil {  
  log.Fatalf("Failed to create kqueue: %v", err)  
 }  
 defer syscall.Close(kq)

   
 err = registerFD(kq, listener)  
 if err != nil {  
  log.Fatalf("Failed to register listener: %v", err)  
 }

 fmt.Println("Server started on 0.0.0.0:8080")  
 eventLoop(kq, listener)  
}

  
func createNonBlockingListener(addr string) (int, error) {  
 lc := net.ListenConfig{Control: setNonBlocking}  
 ln, err := lc.Listen(nil, "tcp", addr)  
 if err != nil {  
  return 0, err  
 }  
 tcpListener, ok := ln.(\*net.TCPListener)  
 if !ok {  
  return 0, fmt.Errorf("failed to assert to TCPListener")  
 }  
 fd, err := tcpListener.File()  
 if err != nil {  
  return 0, err  
 }  
 return int(fd.Fd()), nil  
}

  
func setNonBlocking(network, address string, c syscall.RawConn) error {  
 var err error  
 err = c.Control(func(fd uintptr) {  
  err = syscall.SetNonblock(int(fd), true)  
 })  
 return err  
}

  
func registerFD(kq int, fd int) error {  
 event := syscall.Kevent\_t{  
  Ident:  uint64(fd),  
  Filter: syscall.EVFILT\_READ,   
  Flags:  syscall.EV\_ADD | syscall.EV\_ENABLE,  
 }  
 \_, err := syscall.Kevent(kq, \[\]syscall.Kevent\_t{event}, nil, nil)  
 return err  
}

  
func eventLoop(kq int, listenerFD int) {  
 events := make(\[\]syscall.Kevent\_t, 10)

 for {  
  n, err := syscall.Kevent(kq, nil, events, nil)  
  if err != nil {  
   log.Printf("Kevent error: %v", err)  
   continue  
  }

  for i := 0; i < n; i++ {  
   fd := int(events\[i\].Ident)

   if fd == listenerFD {   
    connFD, err := acceptConnection(listenerFD)  
    if err != nil {  
     log.Printf("Error accepting connection: %v", err)  
     continue  
    }  
    registerFD(kq, connFD)  
   } else {   
    handleClient(fd)  
   }  
  }  
 }  
}

  
func acceptConnection(listenerFD int) (int, error) {  
 clientFD, \_, err := syscall.Accept(listenerFD)  
 if err != nil {  
  return 0, err  
 }  
 syscall.SetNonblock(clientFD, true)  
 fmt.Printf("New client connected: FD %d\\n", clientFD)  
 return clientFD, nil  
}

  
func handleClient(fd int) {  
 buf := make(\[\]byte, 1024)  
 n, err := syscall.Read(fd, buf)  
 if err != nil {  
  fmt.Printf("Client FD %d disconnected\\n", fd)  
  syscall.Close(fd)  
  return  
 }  
 fmt.Printf("Received: %s\\n", string(buf\[:n\]))

   
 message := fmt.Sprintf("system: %s", string(buf\[:n\]))  
 syscall.Write(fd, \[\]byte(message))  
}


```

How it Works
------------

*   **Starts a non-blocking listener** (`createNonBlockingListener()`)
*   **Uses** `**kqueue**` to monitor multiple file descriptors.
*   **Event loop waits** for activity (`syscall.Kevent()`)
*   **Handles events:  
    —** Accepts new clients  
    — Reads & writes data  
    — Closes inactive clients

eventLoop — deep explanation
----------------------------

*   **Initialize event array**: `events := make([]syscall.Kevent_t, 10)` to hold up to 10 events.
*   **Infinite loop**: Continuously waits for events with `syscall.Kevent(kq, nil, events, nil)`.
*   **Check for errors**: If there’s an error while waiting for events, log and continue.
*   **Iterate over events**: Loop through triggered events (`n` events).
*   **Handle new connections**:  
    — If event is from listener socket (`listenerFD`), accept new connection with `acceptConnection(listenerFD)`.  
    — Register new connection file descriptor (`connFD`) with `registerFD(kq, connFD)`
*   **Handle client messages**:  
    — If event is from a client socket, call `handleClient(fd)` to read and process data.
*   **Non-blocking I/O**: Handles multiple clients simultaneously without blocking on I/O operations.

Run this Code
-------------

*   Create a file named `iomul.go` and copy the provided code into it.
*   Open a terminal and run the following command: `go run iomul.go`
*   In another terminal window, start a **netcat** session to the server: `nc localhost 8080`
*   Once connected, you’ll be in an interactive session where you can send messages to the server. The server will echo your messages in the format: “_system: msg”_

Happy Learning ✌️
-----------------