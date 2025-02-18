# C++ Condition Variable - Lei Mao's Log Book
[](#Introduction "Introduction")Introduction
--------------------------------------------

In a multi-threading C++ program, if each thread is working independently, such a program is usually easy to implement and the code is easy to understand.

However, it’s common that the tasks in different threads have dependencies on each other. Thus, some threads will have to wait for other threads to complete the modification of one or more shared variables and notify the threads. In this case, we will have to use `std::condition_variable` for for scheduling in multi-threading.

In this blog post, I would like to quickly discuss `std::condition_variable` and some of its caveats.

[](#Example "Example")Example
-----------------------------

In this example, we have a master thread and a worker thread that run concurrently. There are some dependencies between the jobs that the two threads are working on.

The master thread will complete some preliminary work and notify the worker thread. The worker thread will then continue the work based on what the master thread has completed. One worker thread has done the work, it will notify the master thread and the master thread will continue to complete all the rest of the work.

```c++ hljs
#include <chrono>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>

std::mutex m;
std::condition_variable cv;
std::string data;
bool ready = false;
bool processed = false;

void worker_thread()
{
    std::cout << "Worker thread start" << std::endl;
    std::unique_lock lk(m);
    cv.wait(lk, [] { return ready; });

    
    std::cout << "Worker thread is processing data" << std::endl;
    data += " after processing";

    
    processed = true;
    std::cout << "Worker thread signals data processing completed" << std::endl;

    
    
    lk.unlock();
    
    
    cv.notify_one();
}

void master_thread()
{
    std::cout << "Master thread start" << std::endl;
    data = "Example data";
    
    {
        std::lock_guard lk(m);
        ready = true;
        std::cout << "Master thread signals data ready for processing"
                  << std::endl;
    }
    
    
    cv.notify_one();

    
    {
        std::unique_lock lk(m);
        cv.wait(lk, [] { return processed; });
    }
    std::cout << "Back in master thread, data = " << data << std::endl;
}

int main()
{
    std::thread worker(worker_thread), master(master_thread);
    
    
    worker.join();
    master.join();
}
```

The program will run and the expected output will look like this.

```bash hljs
$ g++ wait_notify.cpp -o wait_notify -std=c++17
$ ./wait_notify
Worker thread start
Master thread start
Master thread signals data ready for processing
Worker thread is processing data
Worker thread signals data processing completed
Back in master thread, data = Example data after processing
```

[](#FAQ "FAQ")FAQ
-----------------

### [](#What-If-Condition-Variable-Is-Notified-Before-Before-Wait "What If Condition Variable Is Notified Before Before Wait?")What If Condition Variable Is Notified Before Before Wait?

According to the [notes](https://en.cppreference.com/w/cpp/thread/condition_variable/notify_one) of `notify_one`, “This makes it impossible for notify\_one() to, for example, be delayed and unblock a thread that started waiting just after the call to notify\_one() was made.”

Therefore, to unblock a thread from wait, the condition variable has to be notified after it starts to wait.

For example, the following program will hang forever because the condition variable missed the notification, unless there occurs a spurious wakeup.

```c++ hljs
#include <chrono>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>

std::mutex m;
std::condition_variable cv;
std::string data;
bool ready = false;
bool processed = false;

void worker_thread()
{
    
    
    
    std::this_thread::sleep_for(std::chrono::seconds(1));
    std::cout << "Worker thread start" << std::endl;
    std::unique_lock lk(m);
    
    
    cv.wait(lk);

    
    std::cout << "Worker thread is processing data" << std::endl;
    data += " after processing";

    
    processed = true;
    std::cout << "Worker thread signals data processing completed" << std::endl;

    
    
    lk.unlock();
    cv.notify_one();
}

void master_thread()
{
    std::cout << "Master thread start" << std::endl;
    data = "Example data";
    
    {
        std::lock_guard lk(m);
        ready = true;
        std::cout << "Master thread signals data ready for processing"
                  << std::endl;
    }
    
    
    cv.notify_one();

    
    {
        std::unique_lock lk(m);
        
        
        cv.wait(lk);
    }
    std::cout << "Back in master thread, data = " << data << std::endl;
}

int main()
{
    std::thread worker(worker_thread), master(master_thread);
    worker.join();
    master.join();
}
```

The program will hang forever.

```bash hljs
$ g++ notify_before_wait.cpp -o notify_before_wait -std=c++17
$ ./notify_before_wait
Master thread start
Master thread signals data ready for processing
Worker thread start

```

There is a trick to workaround the condition variable notification missing. Instead of calling `wait(lock)`, we could call `wait(lock, stop_waiting)`. The conditional variable will only try waiting if the predicate `stop_waiting` returns `false`.

Therefore, even if the condition variable in the worker thread missed the notification, the thread will not be blocked.

The implementation will be just the same as the first example presented in the article.

```c++ hljs
#include <chrono>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>

std::mutex m;
std::condition_variable cv;
std::string data;
bool ready = false;
bool processed = false;

void worker_thread()
{
    
    
    
    std::this_thread::sleep_for(std::chrono::seconds(1));
    std::cout << "Worker thread start" << std::endl;
    std::unique_lock lk(m);
    
    
    cv.wait(lk, [] { return ready; });
    
    
    
    
    

    
    std::cout << "Worker thread is processing data" << std::endl;
    data += " after processing";

    
    processed = true;
    std::cout << "Worker thread signals data processing completed" << std::endl;

    
    
    lk.unlock();
    cv.notify_one();
}

void master_thread()
{
    std::cout << "Master thread start" << std::endl;
    data = "Example data";
    
    {
        std::lock_guard lk(m);
        ready = true;
        std::cout << "Master thread signals data ready for processing"
                  << std::endl;
    }
    
    
    cv.notify_one();

    
    {
        std::unique_lock lk(m);
        cv.wait(lk, [] { return processed; });
    }
    std::cout << "Back in master thread, data = " << data << std::endl;
}

int main()
{
    std::thread worker(worker_thread), master(master_thread);
    worker.join();
    master.join();
}
```

The program will run normally.

```bash hljs
$ g++ notify_before_wait_workaround.cpp -o notify_before_wait_workaround -std=c++17
$ ./notify_before_wait_workaround
Master thread start
Master thread signals data ready for processing
Worker thread start
Worker thread is processing data
Worker thread signals data processing completed
Back in master thread, data = Example data after processing
```

### [](#What-Is-Spurious-Wakeup "What Is Spurious Wakeup?")What Is Spurious Wakeup?

Spurious wakeup, by definition, is the blocking thread caused by condition variable wait can be unblocked even without receiving notifications in some situations. This sounds weird and can cause some unexpected behaviors in our program.

To mitigate spurious wakeup, `wait(lock, stop_waiting)` is very often used because spurious wakeup cannot change the predicate. It is equivalent to

```c++ hljs
while (!stop_waiting())
{
    wait(lock);
}
```

If the predicate is still `false`, even if there is a spurious wakeup, the condition variable will wait again.

[](#References "References")References
--------------------------------------

*   [std::condition\_variable - CPP Reference](https://en.cppreference.com/w/cpp/thread/condition_variable)
*   [Spurious Wakeup](https://en.wikipedia.org/wiki/Spurious_wakeup)