# Multithreading in C++: Mutexes | Ramtin's Blog
*   [Sharing data between threads](#sharing-data-between-threads)
*   [Race Conditions](#race-conditions)
*   [Deadlocks](#deadlocks)
*   [Importance of RAII with Mutexes](#importance-of-raii-with-mutexes)
*   [std::lock\_guard](#stdlock_guard)
*   [std::unique\_lock](#stdunique_lock)
*   [std::lock](#stdlock)
*   [std::recursive\_mutex](#stdrecursive_mutex)

One of the challenges of multithreaded programming is sharing data between multiple threads safely. Everything is fine if all the threads only read from the shared data; the problem arises when multiple threads want to modify a shared data structures simultaneously, which can break the invariants of that data structure if not done correctly. Let's consider a _linked list_ as an example.

```cpp
struct Node {
	int val;
	Node* next;

	Node(int v) : val(v), next(nullptr) {}

	void insert(Node* node) {
		Node* tmp = this->next;
		this->next = node; 
		node-next = tmp; 
	}
};

```

In the example above, in between lines _A_ and _B_, the linked list is broken in half and it won't be complete again until line _B_ executes. Now if another thread intercepts this write operation before line _B_, it can invalidate the entire data structure permanently. This is one example of a problematic race condition.

Race Conditions
---------------

A race condition occurs when two or more threads _race_ to access shared data and they try to change it simultaneously. This is one of the main sources of issues when writing multithreaded applications and can easily become the bane of a programmer's existence. Thankfully, there are a lot of ways to protect shared data in multithreaded applications. For instance, to fix the issue with the linked list example mentioned above, we can add a **mutex** in the data structure and have the `insert` method lock the mutex in the beginning and unlock it when the insertion is done.

```cpp
#include <mutex>

struct Node {
	int val;
	Node* next;
	std::mutex mtx; 

	Node(int v) : val(v), next(nullptr) {}

	void insert(Node* node) {
		mtx.lock(); 

		Node* tmp = this->next;
		this->next = node;
		node->next = tmp;

		mtx.unlock(); 
	}
};

```

Whenever a mutex is locked, it ensures **MUT**ual **EX**clusion for the code that follows it until the mutex is unlocked. So this means in the code above, only one thread can insert a new node at a time and every other thread that calls the `insert` method, has to wait until the mutex is unlocked to proceed.

So does that mean that we can write thread safe data structures by slapping a mutex lock in every member function? If it was that easy...

Sometimes the problem lies in the interface that the data structure exposes. let's go over an example:

```cpp
#include <mutex>
#include <queue>

class ThreadSafeQueue {
private:
	std::mutex mtx;
	std::queue<int> q;
public:
	bool empty() {
		std::lock_guard<std::mutex> lock(mtx);
		return q.empty();
	}

	int front() {
		std::lock_guard<std::mutex> lock(mtx);
		return q.front();
	}

	void pop() {
		std::lock_guard<std::mutex> lock(mtx);
		q.pop();
	}
};

```

Simple enough. We just wrote a wrapper around the STL queue data structure and added a mutex lock to each of the member functions for thread safety.

```cpp
ThreadSafeQueue queue;



if (!queue.empty()) {
	int value = queue.front(); 
	queue.pop(); 
}

```

Let's consider the situation where one thread reads the front value of the queue (`line A`) and before that thread can pop it from the queue (`line B`), another thread executes the same line (`line A`). Mutual exclusion only ensures that one thread can perform operations on the data structure at a time and it doesn't impose any other restrictions. So in this situation, the value in the front of the queue will be read twice by two different threads, and the second value will be discarded forever without being seen by any thread.

These types of problematic data races are harder to spot and fix. Because this time the problem can't be solved by only adding a simple mutex lock. But instead, we have to redesign the interface of the data structure to avoid such race conditions.

In this specific example, one possible fix is to remove the `front` method, and have the `pop` method both return the front value and remove it from the queue. This way another thread can't intercept between these two operations. Here is the actually thread safe version of the `pop` method:

```cpp

void pop(int& value) { 
	std::lock_guard<std::mutex> lock(mtx);
	if (queue.empty()) throw std::length_error("The queue is empty :(");
	value = queue.top();
	queue.pop();
}


```

Deadlocks
---------

Deadlocks are another common issue in multithreaded applications. A deadlock occurs when two or more threads are waiting for each other but none of them can make any progress because each is holding a lock that another one needs. Here is a simple example with two threads:

```cpp
#include <thread>
#include <mutex>
#include <chrono>

std::mutex mtx1;
std::mutex mtx2;

void thread1() {
	std::lock_guard<std::mutex> lock1(mtx1);
	std::cout << "Thread 1 acquired mutex 1" << std::endl;

	std::this_thread::sleep_for(std::milliseconds(50));

	std::lock_guard<std::mutex> lock2(mtx2);
	std::cout << "Thread 1 acquired mutex 2" << std::endl;
}

void thread2() {
	std::lock_guard<std::mutex> lock1(mtx2); 

	std::this_thread::sleep_for(std::milliseconds(100));

	std::lock_guard<std::mutex> lock2(mtx1);
}

int main(int argc, const char** argv) {
	thread t1(thread1);
	thread t2(thread2);

	t1.join();
	t2.join();

	return 0;
}

```

In the code above, thread 1 is waiting for `mtx2` while holding `mtx1`, and thread 2 is waiting for `mtx1` while holding `mtx2`. Therefore, none of them can proceed and the program will halt forever.

One way to prevent deadlocks, at least in this example, is to lock the mutexes in the same order. In the code above, the order of locking is reversed between the two threads and that's causing the deadlock.

Anthony Williams in his book _C++ Concurrency in Action_, recommends the following guidelines for preventing deadlocks:

*   **Avoid nested locks**: If we don't lock a mutex while holding another one, a deadlock is impossible to happen
*   **Avoid calling user-supplied code while holding a lock**: Since we have no control over what the user-supplied code might do, it is dangerous to call it while holding a lock.
*   **Use std::lock to acquire multiple locks**: I will show an example of this in an upcoming section of this article

Importance of RAII with Mutexes
-------------------------------

Explicitly locking and unlocking a mutex by calling `mtx.lock()` and `mtx.unlock()` is a bad practice for the following reasons:

*   **Exception Safety**: If an exception is thrown before the mutex is unlocked, the mutex will remain locked which could lead to a deadlock.

```cpp
std::mutex mtx;

void unsafeFunction() {
	mtx.lock();
	throw std::runtime_error("Error");
	mtx.unlock(): 
}

```

*   **Code Clarity and Readability**: If we manually lock and unlock mutexes in a function that has multiple exit routes, then we need to make sure that we unlock the mutex in all the branches which can lead to decreased code clarity and readability.
*   **Lock Composition**: manually locking multiple mutexes is dangerous and may lead to deadlocks

That's why we should adhere to the _Resource Acquisition is Initialization (RAII)_ principle and use either `std::lock_guard` or `std::unique_lock` which are provided by the C++ standard library.

### std::lock\_guard

the `std::lock_guard` class is an RAII style mutex wrapper that locks the provided mutex in its constructor and unlocks the mutex in its destructor. This ensures that the mutex will be unlocked when the the variable goes out of scope, even if an exception is thrown.

```cpp
std::mutex mtx;

void safeFunction() {
	std::lock_guard<std::mutex> lock(mtx);
	throw std::runtime_error("Error");
	
}

```

### std::unique\_lock

`std::unique_lock` has the same basic functionality as `std::lock_guard` with some additional features and more flexibility:

*   **Deffered locking**: Doesn't automatically locks the mutex upon construction. It's useful when it's used in conjunction with `std::lock` to lock multiple mutexes.

```cpp
std::mutex mtx;

std::unique_lock<std::mutex> lock(mtx, std::defer_lock); 

```

*   **Transferring Ownership**: The ownership of a lock can be transferred from one thread to another. This is not possible with `std::lock_guard`. An important use case of `std::unique_lock` is with _Condition Variables_ which are the focus of the next article.
*   **Time-constrained attempts at locking**: `try_lock_for` and `try_lock_until` will attempt to lock the mutex until a certain amount of time has passed.

The only downside of `std::unique_lock` is that it is slightly larger in size and less performant compared to `std::lock_guard` because it has to keep track and store more information to provide these additional features.

### std::lock

`std::lock` is used to lock multiple mutexes at once using a deadlock avoidance algorithm.

```cpp
void swapThreadSafe(Obj& o1, Obj& o2) {
	if (&o1 == &o2) return;
	std::unique_lock lock1(o1.mtx, std::defer_lock); 
	std::unique_lock lock2(o2.mtx, std::defer_lock);

	
	std::lock(lock1, lock2);

	std::swap(o1, o2);
}

```

Note that we used `std::defer_lock` in the constructors of the `std::unique_lock`s to let `std::lock` take care of locking and unlocking them.

### std::recursive\_mutex

Attempting to lock a mutex that's already locked in the same thread is _undefined behavior_. If we absolutely need to lock a single mutex multiple times, then we can use `std::recursive_mutex` instead of a regular `std::mutex`. As an example, let's say we want to add a method, `clear` that empties out our thread safe queue data structure:

```cpp
class ThreadSafeQueue {
private:
	std::recursive_mutex mtx;
public:
	
	void clear() {
		std::unique_lock<std::recursive_mutex> lock(mtx);
		while (!queue.empty()) {
			pop(); 
		}
	}
};

```

In the example above since `pop` is a member function that also locks the mutex, we had to use `std::recursive_mutex`, otherwise, it would have led to undefined behavior.