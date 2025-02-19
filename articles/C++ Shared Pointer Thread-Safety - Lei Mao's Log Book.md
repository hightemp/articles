# C++ Shared Pointer Thread-Safety - Lei Mao's Log Book
[](#Introduction "Introduction")Introduction
--------------------------------------------

The C++ `std::shared_ptr` is a smart pointer that ensures the object it points to is automatically deallocated when the last `std::shared_ptr` pointing to the object is destroyed. The `std::shared_ptr` uses automatic reference counting to track the number of `std::shared_ptr` instances pointing to the object. The reference count increments and decrements are thread-safe because the it is implemented using atomic operations. However, accessing the object itself is not thread-safe if the object itself is not thread-safe. It’s the user’s responsibility to ensure the object access is thread-safe and mutual exclusion locks are often used.

In this blog post, I will implement a simplified custom version of the `std::shared_ptr`, explain how the reference counting is thread-safe, and discuss the thread safety for object access.

The following code implements a simplified custom version of the `std::shared_ptr`. The reference counting is thread-safe because the reference count is implemented using `std::atomic`. When accessing the objects from multiple threads, mutual exclusion `std::mutex` locks are used to ensure the object access is thread-safe.

```c++ hljs
#include <atomic>
#include <cassert>
#include <iostream>
#include <mutex>
#include <thread>
#include <vector>

template <typename T>
class SharedPtr
{
public:
    SharedPtr(T* ptr) : m_ptr{ptr}, m_ref_count(new std::atomic<size_t>{1}) {}

    SharedPtr(SharedPtr const& other)
        : m_ptr{other.m_ptr}, m_ref_count{other.m_ref_count}
    {
        m_ref_count->fetch_add(1);
    }

    SharedPtr& operator=(SharedPtr const& other)
    {
        if (this != &other)
        {
            if (m_ref_count->fetch_sub(1) == 1)
            {
                delete m_ptr;
                delete m_ref_count;
            }
            m_ptr = other.m_ptr;
            m_ref_count = other.m_ref_count;
            m_ref_count->fetch_add(1);
        }
        return *this;
    }

    ~SharedPtr()
    {
        if (m_ref_count->fetch_sub(1) == 1)
        {
            delete m_ptr;
            delete m_ref_count;
        }
    }

    T* get() const noexcept { return m_ptr; }
    size_t use_count() const noexcept { return *m_ref_count; }

private:
    T* m_ptr;
    std::atomic<size_t>* m_ref_count;
};

int main()
{
    SharedPtr<int> const ptr{new int{0}};
    size_t const num_threads{4};
    std::vector<std::thread> threads(num_threads);

    
    
    std::mutex mtx{};
    for (auto& thread : threads)
    {
        thread = std::thread(
            [ptr, &mtx]()
            {
                std::lock_guard<std::mutex> lock{mtx};
                ++(*ptr.get());
            });
    }
    for (auto& thread : threads)
    {
        thread.join();
    }

    assert(*ptr.get() == num_threads);

    return 0;
}
```

To build and run the program, please run the following commands.

```bash hljs
$ g++ custom_shared_ptr_thread_safe.cpp -o custom_shared_ptr_thread_safe
$ ./custom_shared_ptr_thread_safe
```

To ensure increasing or decreasing the reference count of a shared pointer is thread-safe, the reference count is implemented using `std::atomic`. Mutual exclusion locks can also be used for the implementation theoretically. However, because it’s usually less efficient than `std::atomic`, `std::atomic` is the preferred choice.

[](#Thread-Safety-for-Object-Destruction-and-Deallocation "Thread Safety for Object Destruction and Deallocation")Thread Safety for Object Destruction and Deallocation
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------

Based on the implementation of the destructor of the shared pointer, the object will only be destroyed when the reference count of the shared pointer is decreased to zero.

```c++ hljs
~SharedPtr()
{
    if (m_ref_count->fetch_sub(1) == 1)
    {
        delete m_ptr;
        delete m_ref_count;
    }
}
```

An interesting question is, will an object the shared pointer points to ever be destroyed and deallocated twice? The can only happen, before the object is destroyed and deallocated in one thread, the shared pointer is copied by another thread, and thus resulting in a shared pointer pointing to an invalid object. Specifically,

```c++ hljs
~SharedPtr()
{
    if (m_ref_count->fetch_sub(1) == 1)
    {
        
        delete m_ptr;
        delete m_ref_count;
    }
}
```

The answer is no. Because when the destructor of the last remaining shared pointer whose reference count is 1 is being called, the shared pointer has already become out of scope in the source code and no other threads can copy it anymore. Therefore, the object that the shared pointer points to will never be destroyed and deallocated twice.

For example, the following code will not cause the object to be destroyed twice.

```c++ hljs
{
    SharedPtr<int> const ptr{new int{0}};
    ...
}





```

[](#Thread-Safety-for-Objects-Access "Thread Safety for Objects Access")Thread Safety for Objects Access
--------------------------------------------------------------------------------------------------------

There is no thread safety for objects access. The shared pointer only ensures the reference count of the object is thread safe. The user needs to use mutex locks to ensure the objects access is thread safe if the object itself guarantees no thread safety.

```c++ hljs
std::mutex mtx{};
for (auto& thread : threads)
{
    thread = std::thread(
        [ptr, &mtx]()
        {
            std::lock_guard<std::mutex> lock{mtx};
            ++(*ptr.get());
        });
}
for (auto& thread : threads)
{
    thread.join();
}
```

[](#References "References")References
--------------------------------------

*   [`std::shared_ptr` - CPP Reference](https://en.cppreference.com/w/cpp/memory/shared_ptr)