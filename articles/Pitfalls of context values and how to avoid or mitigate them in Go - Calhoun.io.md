# Pitfalls of context values and how to avoid or mitigate them in Go - Calhoun.io
Storing data in a [context.Context](https://golang.org/pkg/context/#Context), or as I refer to it - using context values, is one of the most contentious design patterns in Go. Storing values in a context appears to be fine with everyone, but what specifically should be stored as a context value receives a lot of heated discussion.

I’ll be honest - when I started using them I used them in the naive and somewhat inappropriate way that everyone complains about. I used them to store just about every request-specific piece of data that my web application’s handlers might need to access. There were some downsides to this, but overall it tended to work well enough and allowed me to write my applications quickly.

Over the past month I have tried to dive into learning about a more proper use of context values, and in doing that I have come across many articles, Reddit comments, mailing list responses, and everything in between that discuss the matter, but one thing continued to bug me. No matter how much I dug, it felt like nobody was willing to discuss truly viable alternatives.

Sure, everyone could come up with reasons why using context values was bad, but none of the alternatives were fully fleshed out. Instead they were handy-wavy; things like “use custom structs” or “use closures” without any discussion about how that might actually get implemented in a more complicated application, or how that might affect reusability of middleware.

Today I am going to give my take on the matter. In this post we will discuss why using context values can become problematic, some alternative approaches that don’t use context values and when they are appropriate, and then finally we will discuss ways that you _can_ use context values while avoiding or mitigating some of their potential downsides. But first, I want to start by discussing _why developers use context values in the first place_, as I think this it is important to understand the problem being solved before jumping to solutions.

Before we start, let’s lay out some ground rules
------------------------------------------------

I try to make this clear in my examples, but despite that I want to explicitly state that `context.Value()` should _NEVER_ be used for values that are not created and destroyed during the lifetime of the request. You shouldn’t store a logger there if it isn’t created specifically to be scoped to this request, and likewise you shouldn’t store a generic database connection in a context value.

It is possible for both of these to be request-specific; for instance, you might create a logger that prepends messages with a request ID, or you might create a single database transaction for each web request using your database connection and then attach that to the context. Both of these are closer to what I consider appropriate use of context values, but the key is that both only live in as long as the request does.

Why do people use context values in the first place?
----------------------------------------------------

Before most of this will make sense, we need to explore _why_ developers feel the need to start storing objects as context values in the first place. Surely if there were an easier way to do things they would be, so what is gained by using the untyped `context.WithValue()` function and the `context.Value()` method?

The short answer to that by using context values, we can easily create both reusable and interchangeable middleware functions. That is, we can define middleware that accepts an `http.Handler` and returns an `http.Handler` allowing us to use the results from any middleware with any routing library, or with any middleware library, or really with any libraries that help us work with http requests and accept the `http.Handler` interface. It also means that we can easily exchange one middleware function with another if we want to test out a different implementation, or if we simply want to add different functionality.

An example illustrates this much better than I could ever explain it, so let’s check one out. Imagine that you are building a web server and you need a way to add a unique ID to every web request. This is a fairly common requirement, and one way to fulfill this requirement is to write a function that generates a unique ID and then stores it in a context that is associated with the request.

```
var requestID = 0

func nextRequestID() int {
  requestID++
  return requestID
}

func addRequestID(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    ctx := context.WithValue(r.Context(), "request_id", nextRequestID())
    next.ServeHTTP(w, r.WithContext(ctx))
  })
}
```

Warning _This code isn’t production ready, but is instead intended to serve as a simple example._

We could then use this function with any routing package (like [chi](https://github.com/pressly/chi)), or we could use it with the standard library’s `http.Handle()` function as illustrated below.

```
func main() {
  http.Handle("/", addRequestID(http.HandlerFunc(printHi)))
  http.ListenAndServe(":3000", nil)
}

func printHi(w http.ResponseWriter, r *http.Request) {
  fmt.Fprintln(w, "Hi! Your request ID is:", r.Context().Value("request_id"))
}
```

Now you are probably asking yourself, “Can’t we just call the `nextRequestID()` function in our code when we need a request ID? This context value bit feels unnecessary.”

Technically, you are correct. We can do that, and with a relatively simple application that is what I would suggest you do, but what happens if that logic suddenly becomes more complicated and our application grows in scale? What if instead of a request ID we needed to handle validating that a user is signed in, redirecting them to the login page if they aren’t, and looking up their user object and storing it for later use if they are?

A _very_ simplified version of the logic needed for authentication might look like the code below.

```
user := lookupUser(r)
if user == nil {
  // No user so redirect to login   http.Redirect(w, r, "/login", http.StatusFound)
  return
}
```

Now instead of adding a single line to all of our handlers, we need to add five lines of code. That isn’t too bad by itself, but what happens if we have four or five different things we need to do in every handler? Like generating a unique request ID, creating a logger that utilizes that request ID, verifying that the user is logged in, and then validating that the user is an admin?

That is an awful lot of code to repeat across multiple handlers, and it is also very bug prone. Improper access controls shows up time and again on on lists like the [OWASP Top 10](https://www.owasp.org/index.php/Top_10_2013-Top_10), and in this case we appear to be making those mistakes even easier to make. All it takes is for a single developer to forget to verify that a user is an admin in a single handler, and we suddenly had an admin-only page being exposed to regular users. We certainly don’t want that to happen.

Rather than leaving this up to chance, many developers prefer to use middleware on a large subset of their routes to help avoid mistakes like this. It also helps make it very clear which routes require authentication and which don’t, or even which routes are admin-only vs which are not. As a result, it is much easier to reason about their code because you can easily determine when a user object is expected to be present.

The example below only shows how you might use the authentication logic from above to verify that when a user is logged in when visiting _any_ page with a path prefix of `/dashboard/`. A similar approach could be used to verify that a user is an admin before allowing them access to any page with a path prefix of `/admin/`.

```
 func requireUser(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    user := lookupUser(r)
    if user == nil {
      // No user so redirect to login       http.Redirect(w, r, "/login", http.StatusFound)
      return
    }
    ctx := context.WithValue(r.Context(), "user", user)
    next.ServeHTTP(w, r.WithContext(ctx))
  })
}

func main() {
  dashboard := http.NewServeMux()
  dashboard.HandleFunc("/dashboard/hi", printHi)
  dashboard.HandleFunc("/dashboard/bye", printBye)

  mux := http.NewServeMux()
  // ALL routes that start with /dashboard/ require that a   // user is authenticated using the requireUser middleware   mux.Handle("/dashboard/", requireUser(dashboard))
  mux.HandleFunc("/", home)

  http.ListenAndServe(":3000", addRequestID(mux))
} 
```

_You will have to run it locally - web servers don’t run on the Go Playground._

Where do context values come into play with our authentication middleware? Well, you might end up looking a user up when authenticating them (depending on your auth strategy), and it would be a shame to have to query the database again to retrieve data that you already looked up, so we can use context values to store the user object for future use.

Neat, right? So what is the big stink with context values if they allow us to do cool things like making a user object available to our handlers that need it?

Downsides to using context values
---------------------------------

The biggest downside to using `context.WithValue()` and `context.Value()` is that you are actively choosing to give up information and type checking at compile time. You do gain the ability to write more versatile code, but this is a major thing to consider. We use typed parameters in our functions for a reason, so any time we opt to give up information like this it is worth considering whether it is worth the benefits.

I can’t answer that question for you as it varies from project to project, but before you do make that decision you should make sure you truly understand what you are giving up.

#### Required data for functions is obscured

When using context values, my biggest concerns is that it makes it very hard to determine what data is required for a function to proceed. We don’t write functions that accept arbitrary maps and expect the user to set various keys for our function to work, and similarly we typically shouldn’t be writing handlers for our web applications that work the same way.

```
func bad(m map[interface{}]interface{}) {
  // we don't expect m to have the keys "user" and   // "request_id" for our code to work. If we needed those   // we would define our function like the one below. }

func good(user User, requestID int) {
  // Now it is clear that this function requires a user and   // a request ID. }
```

For some functions, like an `editUser()` function, it might be obvious that some data like a user object needs to be present, but most of the time the function definition isn’t enough, and as developers we shouldn’t be expecting others to discern what parameters are required from the function name. Instead, we should be stating it explicitly with our code so that it is easier to read and maintain. Our web application, especially functions that handlers and middleware rely on, shouldn’t be any different. We shouldn’t be passing them a `context` object and expecting them to pull whatever data they need out of it.

#### We lose type safety at compile time

Context values are stored in what is essentially an `interface{}, interface{}` pair (see [the source](https://github.com/golang/go/blob/986768de7fcf4def65cecd7eb0c34e2cdf92e78c/src/context/context.go#L480)). That is why we are permitted to store anything and everything on our inside this type without the compiler complaining - both the key and the value are defined as interfaces and will accept quite literally any value.

The upside to this is that any `context.Context` implementation can store data of types that are custom to your application. The downside is that we can’t easily count on our compiler to tell us when we make mistakes. Specifically, if we store a string instead of a `User` object our program will just continue along until we suddenly try to use a [type assertion](https://golang.org/doc/effective_go.html#interface_conversions) and it panics. There are ways to minimize this risk, but there is always the chance that some developer will make a mistake and this will lead to runtime errors.

What are some ways to avoid this? For starters, don’t set context values in your code like we did in the original examples, but instead use getters and setters that _are_ type specific. In addition to this, _“packages should define keys as an unexported type to avoid collisions.” - [Go Source](https://github.com/golang/net/blob/236b8f043b920452504e263bc21d354427127473/context/context.go#L100)_. That means any value you use for a key in a `context.WithValue()` or `context.Value()` call should be of a custom type that isn’t shared outside of the package that defines it. For example…

```
type userCtxKeyType string

const userCtxKey userCtxKeyType = "user"

func WithUser(ctx context.Context, user *User) context.Context {
  return context.WithValue(ctx, userCtxKey, user)
}

func GetUser(ctx context.Context) *User {
  user, ok := ctx.Value(userCtxKey).(*User)
  if !ok {
    // Log this issue     return nil
  }
  return user
}
```

In addition to using getters and settings and unexported keys, be sure to **ALWAYS** use the long form of type assertion (the one with two arguments, not just one). This will help you avoid unnecessary panics in your code, and will give you the opportunity to handle those situations as you see fit in your code.

If you stick with the advice presented here it should prevent most issues stemming from the lack of type safety from occurring, so we won’t discuss this particular problem much throughout the rest of this article, but remember to always be vigilant. This isn’t something the compiler will catch for you, so it instead falls on your shoulders as a developer, tester, and code reviewer to help catch these mistakes.

Alternative approaches to `context.Value()`
-------------------------------------------

At this point I suspect many people to be thinking “I use approach X and it works great. Why are you writing this article?”. I’m not trying to say that your approach is wrong, but I don’t truly believe that there is a one-size-fits-all solution, so the rest of this post is going to focus on a few alternatives that I find useful. I’ll also try to cover when they fall short, so that you know which might be appropriate for your particular use case.

#### Code duplication - look up data as you need it

We discussed this briefly when covering why developers use context values, but I wanted to cover it here as well so that it isn’t forgotten. When you are working on a relatively simple application, or even if you are building a more complicated application, you should almost always start by simply looking up data as you need it.

This is exactly what I teach in my book, [Web Development with Go](https://www.usegolang.com/). In the book, we start by writing the logic we need directly inside of our handler. After that we start to pull it out into reusable functions that we might use in each of our handlers. For example, rather than using the `requireUser()` middleware we discussed earlier, we would instead start by writing a function that can be used directly from an `http.Handler` like below.

```
func printHi(w http.ResponseWriter, r *http.Request) {
  user, err := requireUser(w, r)
  if err != nil {
    return
  }
  // do stuff w/ user }

func requireUser(w http.ResponseWriter, r *http.Request) (*User, error) {
  user := lookupUser(r)
  if user == nil {
    // No user so redirect to login     http.Redirect(w, r, "/login", http.StatusFound)
    return nil, errors.New("User isn't logged in")
  }
  return user, nil
}
```

This will result in a good bit of duplicate code, but that is okay. We limit the duplication to a few lines of code, and a little duplication is better than a little extra complexity. Where this becomes problematic is when it turns into a lot of duplication, or when we find ourselves calling five or six functions like this one in many different handlers. That is often a sign that you may be outgrowing this approach and are ready to look at alternatives.

#### Closures and custom function definitions

Another common solution to this problem is to write functions that look up any necessary data and then call your custom function with this data. To make this easier, we often use a closure that can wrap similar handlers that need the same data to create our `http.Handler`s.

```
func requireUser(fn func(http.ResponseWriter, *http.Request, *User)) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    user := lookupUser(r)
    if user == nil {
      // No user so redirect to login       http.Redirect(w, r, "/login", http.StatusFound)
      return
    }
    fn(w, r, user)
  }
}

func printUser(w http.ResponseWriter, r *http.Request, user *User) {
  fmt.Fprintln(w, "User is:", user)
}

func main() {
  http.HandleFunc("/user", requireUser(printUser))
  http.ListenAndServe(":3000", nil)
}
```

This makes it clear that `printUser()` expects a user object to be set, and by using the `requireUser()` function we can turn any function that matches `func(http.ResponseWriter, *http.Request, *User)` into an `http.Handler` with ease.

I find that this approach works exceptionally well when you need similar context-specific data in all of your handlers. For example, if you always need a request ID, a logger that uses that request ID, and a user object, you could use this approach to turn all of your functions into `http.Handler`s.

A very contrived example is shown below.

```
// requireUser and printUser don't change 
func printReqID(w http.ResponseWriter, r *http.Request, requestID int) {
  fmt.Fprintln(w, "RequestID is:", requestID)
}

func printUserAndReqID(w http.ResponseWriter, r *http.Request, requestID int, user *User) {
  printReqID(w, r, requestID)
  printUser(w, r, user)
}

func addRequestID(fn func(http.ResponseWriter, *http.Request, int)) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    fn(w, r, nextRequestID())
  }
}

func requireUserWithReqID(fn func(http.ResponseWriter, *http.Request, int, *User)) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    addRequestID(func(w http.ResponseWriter, r *http.Request, reqID int) {
      requireUser(func(w http.ResponseWriter, r *http.Request, user *User) {
        fn(w, r, reqID, user)
      })(w, r)
    })(w, r)
  }
}

func main() {
  http.HandleFunc("/user", requireUser(printUser))
  http.HandleFunc("/reqid", addRequestID(printReqID))
  http.HandleFunc("/both", requireUserWithReqID(printUserAndReqID))
  http.ListenAndServe(":3000", nil)
}
```

Where this approach falls short is when you need very different data in each of your handlers, and this often becomes more prevalent with larger applications. It also eliminates your ability to run middleware _before_ routing code is taken into account, making it harder to express things like “All paths that begin with `/dashboard/` require a user to be logged in.”

Despite those shortcomings, I still believe that this approach is worth considering until it actually starts to become problematic. That means you shouldn’t be saying, “We will eventually need route specific middleware” and skipping this approach; instead, you should try to use it until you actually run into a situation where it no longer works.

When that does finally happen, I have one more approach that I like to take.

Addressing the obscurity of context values
------------------------------------------

The final approach I turn to is what I consider a hybrid approach between using context values and the approach we just looked at. The basic idea is to use context values and `http.Handler` functions like at the very start of this article, but before we ever actually use data from context values we write a function to pull data from the context values and then pass that data into a function that explicitly states the data it requires. After doing this, the function that we call should _never_ need to pull additional data out of the context that affects the flow of our application.

By doing this, we help remove the obscurity that comes from using `context.Value()` to retrieve data. We don’t have to wonder, “Does some nested function call expect some value to be set on the context?” because all of that data will already be extracted from the context.

This is illustrated best with an example, so once again we will use the `addRequestID()` middleware function and a simple `home` handler. _It isn’t clear in this example, but `logger` is intended to be a request-scoped logger._

```
func main() {
  mux := http.NewServeMux()
  mux.HandleFunc("/", homeHandler)

  http.ListenAndServe(":3000", addRequestID(addLogger(mux)))
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
  ctx := r.Context()
  reqID := GetRequestID(ctx)
  logger := GetLogger(ctx)
  home(w, r, reqID, logger)
}

func home(w http.ResponseWriter, r *http.Request, requestID int, logger *Logger) {
  logger.Println("Here is a log")
  fmt.Fprintln(w, "Homepage...")
}
```

What makes this approach especially appealing to me is how easy it is to refactor code that already uses context values to take advantage of it. You don’t have to rip out a bunch of code or refactor everything at once, but can instead take it one function at a time by splitting what was once a single function into two - an `http.Handler` that gets data, and another function that uses that data and performs the same logic your handlers have been performing all along.

#### Is this really any different than the very first example?

Ultimately, this approach isn’t that different from some of the others we examined. Most notably, it looks nearly identical to the first examples we looked at that utilized context values, but the minor differences between the two are incredibly important.

By always using getters and setters along with unexported context keys we effectively avoid any risk of the wrong type being assigned to a context value, limiting our risk to data simply not being set. Even if data isn’t set, our getter functions can indeed handle that, or they could optionally return an error when they need to defer that logic to the handler that requests the data.

The second change is more subtle; by breaking our functions into two we are able to make it clear in our code what data we expect to be set. As a result, anyone looking at our `home` function would know exactly what data is expected to be there without having to read the code. This is a major improvement over simply expecting the data to be retrievable via `context.Value()` without giving others any indication of that expectation.

In short, simply breaking our handlers and middleware into two functions takes us from having obscure requirements to having ones that are clear and explicit, helping both newcomers become familiar with your code and making it easier for everyone to maintain the code.

In conclusion…
--------------

Want a free sample of my course, Web Development with Go? [Sign up for my mailing list](#subscribe) and I’ll send you a free sample, along with updates about new articles like this one.

There is one final approach that we didn’t discuss in this post, which is to create a custom `Context` type of your own and leverage that throughout your application and middleware. This tends to look somewhat similar to the “Closures and custom function definitions” section, but rather we have a semi-large context that we define and pass around to every handler.

The mega context (as I like to call it) has it’s own set of pros and cons and can often be useful, but I opted not to cover it here because I want to experiment a bit more with it before writing about it. I suspect I will eventually release a follow-up that covers it in more detail within the coming weeks.

In the meantime, remember that none of these approaches are without their flaws. Some result in code duplication, others defer type checks to runtime, and some limit your ability to easily insert middleware between multiple muxers. At the end of the day, you need to decide which works best for you.

Regardless of which route you take, just remember to be vigilant in your code reviews and ensure that others are sticking with them.

Learn Web Development with Go!
------------------------------

Sign up for my mailing list and I'll send you a FREE sample from my course - Web Development with Go. The sample includes 19 screencasts and the first few chapters from the book.

You will also receive emails from me about Go coding techniques, upcoming courses (including FREE ones), and course discounts.

©2024 Jonathan Calhoun. All rights reserved.