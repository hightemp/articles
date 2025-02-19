# Understanding the inner workings of C++ smart pointers - The shared_ptr - Andreas Fertig's Blog
After last months [Understanding the inner workings of C++ smart pointers - The unique\_ptr with custom deleter](https://andreasfertig.com/blog/2024/08/understanding-the-inner-workings-of-cpp-smart-pointers-the-unique_ptr-with-custom-deleter/) you're curious about how the `shared_ptr` is implemented? Great! Here we go.

### A minimalistic `shared_ptr` implementation

Well, minimalistic is a simple word. A `shared_ptr` is _a little_ more complex than a `unique_ptr`. Below is the implementation of a `shared_ptr`.

| 

 1
 2
 3
 4
 5
 6
 7
 8
 9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68



 | 

`template<typename T>
class shared_ptr {
  ctrl_blk_base* ctrl_blk_{};
  T*             t_{};

  shared_ptr(ctrl_blk_with_storage<T>* cb)
  : shared_ptr{cb, cb->get()}
  {}

  shared_ptr(ctrl_blk_base* cb, T* t)
  : ctrl_blk_{cb}
  , t_{t}
  {}

  template<typename U, typename... Args>
  friend shared_ptr<U> make_shared(Args&&... vals);

public:
  shared_ptr() = default;

  shared_ptr(T* t)
  : shared_ptr{new ctrl_blk<T>{t}, t}
  {}

  ~shared_ptr()
  {
    if(ctrl_blk_) { ctrl_blk_->release_shared(); }
  }

  shared_ptr(const shared_ptr& rhs)
  : ctrl_blk_{rhs.ctrl_blk_}
  , t_{rhs.t_}
  {
    if(ctrl_blk_) { ctrl_blk_->add_shared(); }
  }

  shared_ptr(shared_ptr&& rhs)
  : ctrl_blk_{rhs.ctrl_blk_}
  , t_{rhs.t_}
  {
    rhs.ctrl_blk_ = nullptr;
    rhs.t_        = nullptr;
  }

  shared_ptr& operator=(const shared_ptr& rhs)
  {
    shared_ptr{rhs}.swap(*this);  // forward to copy ctor
    return *this;
  }

  shared_ptr& operator=(shared_ptr&& rhs)
  {
    shared_ptr{std::move(rhs)}.swap(*this);  // forward to move-ctor
    return *this;
  }

  void swap(shared_ptr& rhs)
  {
    std::swap(t_, rhs.t_);
    std::swap(ctrl_blk_, rhs.ctrl_blk_);
  }
};

template<typename T, typename... Args>
shared_ptr<T> make_shared(Args&&... vals)
{
  return new ctrl_blk_with_storage<T>(std::forward<Args>(vals)...);
}` 



 |

A `shared_ptr` needs to track the use count. This tracking is done via a control block. Since multiple `shared_ptr` that point to the same data must use the same control block, the `shared_ptr` implementation stores only a pointer to that control block, next to the data pointer.

When you create a new `shared_ptr` by passing an already allocated pointer to the constructor, the first thing the `shared_ptr` does is allocate a new control block where it also stores the data pointer. If you look closely, you can see that in my implementation, `shared_ptr` has a data member of type `ctrl_blk_base`. At the same time, a `ctrl_blk` is allocated in the constructor. I will show you that implementation later. For now, it is safe to assume that inheritance is used.

In the destructor, `release_shared` is called on the control block if the latter isn't a `nullptr`.

The next thing are the copy and move operations. They use one clever trick. They create a new temporary `shared_ptr` object and call `swap`. That's an easy and robust way to maintain the use count.

The `shared_ptr` is special due to its control block. You can see this in the implementation of `make_shared` as well. I'm returning a dynamically allocated object of type `ctrl_blk_with_storage`, which triggers another `shared_ptr` constructor. Hopefully, obviously, `ctrl_blk_with_storage` is also derived from `ctrl_blk_base`.

### Peaking into `shared_ptr`s control block implementation

Below, you will find the control block base class `ctrl_blk_base` and the two derived classes `ctrl_blk` and `ctrl_blk_with_storage` you've seen earlier.

| 

 1
 2
 3
 4
 5
 6
 7
 8
 9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46



 | 

`struct ctrl_blk_base {
  std::atomic_uint64_t shared_ref_count_{1};

  void add_shared() { ++shared_ref_count_; }
  auto dec() { return --shared_ref_count_; }

  virtual void release_shared() = 0;
};

template<typename T>
struct ctrl_blk : ctrl_blk_base {
  T* data_;

  explicit ctrl_blk(T* data)
  : ctrl_blk_base{}
  , data_{data}
  {}

  void release_shared() override
  {
    if(0 == dec()) {
      delete data_;
      delete this;  // self delete
    }
  }
};

template<typename T>
struct ctrl_blk_with_storage : ctrl_blk_base {
  T in_place_;

  template<typename... Args>
  explicit ctrl_blk_with_storage(Args&&... vals)
  : ctrl_blk_base{}
  , in_place_{std::forward<Args>(vals)...}
  {}

  T* get() { return &in_place_; }

  void release_shared() override
  {
    if(0 == dec()) {
      delete this;  // self delete
    }
  }
};` 



 |

The base class `ctrl_blk_base` contains an atomic unsigned long data member and the three member functions `add_shared`, `dec`, and `release_shared`. The first two are helpers to maintain the use count. More interesting is `release_shared` since it is `virtual`, pure `virtual` to be precise. The virtuality here is necessary because the two derived classes have different implementations.

Let's start by looking at `ctrl_blk`. This class has a pointer data member that contains the original data. If the use count reaches zero in `release_shared`, the function first deletes the payload data before deleting itself. The last step is necessary because the `shared_ptr` destructor cannot do this.

If you now switch to `ctrl_blk_with_storage`, you can see that this class brings its own storage space for the `T` it is constructed with. This is what `make_shared` uses. In `release_shared`, it is enough to perform a self-delete. This also invokes the destructor of `T`.

You just saw a minimalistic example of a `shared_ptr`. I ignored the `weak_ptr` and its implications. However, I hope this helps you understand the two smart pointers better.

### More about smart pointers

I will continue writing about smart pointers in my next post.

Andreas