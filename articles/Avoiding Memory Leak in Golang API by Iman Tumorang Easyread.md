# Avoiding Memory Leak in Golang API | by Iman Tumorang | Easyread
You must read this before releasing your Golang API into production. Based on our true story at Kurio, how we struggling for every release because we are not doing it in the right ways.
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

[

![](https://miro.medium.com/v2/resize:fill:88:88/1*g3y881vV3H30aoJnFNukEw.jpeg)






](https://imantumorang.medium.com/?source=post_page---byline--1843ef45fca8---------------------------------------)

[

![](https://miro.medium.com/v2/resize:fill:48:48/1*W6RANBrWKEZgobD3anAfaw.png)






](https://medium.easyread.co/?source=post_page---byline--1843ef45fca8---------------------------------------)

![](https://miro.medium.com/v2/resize:fit:700/1*4WK1t5y-D6WtwzAFvVg62A.jpeg)

laptop on fire taken from google image search

A few weeks ago, we are in [Kurio](https://kurio.co/) just fixing our weird and undetected bug in our main services. We have tried so many ways to debugging and fixing it. The bug is not with the business logic. Because it has been running on production for a few weeks. But we always saved by our auto-scaling mechanism, so it’s just like running well.

Until later, we figured out it, it is because our code, we are not doing it well.

Architecture
------------

Fyi, we are using a microservices pattern in our architecture. We have one gateway API — we call it `main API` — that serve API to our user (mobile, and web). Because of its role similar to API gateway, so its task is only handled request from the user, then call the required services, and build the response to user. This `main API`, written fully in Golang. The reason to choose golang is another story that I won’t tell it here.

If drawn in a picture, our system will look more like this.

![](https://miro.medium.com/v2/resize:fit:700/1*b8KqwAtasbTzt96hYntjMQ.png)

Kurio architecture

We have struggled for a long time with our main API, that always down and returning a long response to our mobile-apps and sometimes causing our API can’t be accessed. Our API dashboard monitor just turns to red — to be honest, when our API dashboard monitor goes red, it was a dangerous thing and causing stress and panic and crazy to us the engineer 😈.

Other things are, our CPU and memory usage are getting higher. If this happens we just restart it manually and wait until it runs again.

![](https://miro.medium.com/v2/resize:fit:605/1*bqsD1tLb4gAvHw4kJOnvjA.jpeg)

Our API response time up-to 86 seconds for a single request.

![](https://miro.medium.com/v2/resize:fit:700/1*hw-Mdt7ctshVu2SbsM4Vhw.png)

graph our API response time, and doing restart manually for safety.

This bug really makes us frustrated, because we don’t have any log that specifically telling about this bug. We just have that the response time is so long. The CPU and memory usage increasing. It just like a nightmare.

One thing we learn and really really learn when developing this service is, don’t trust the default config.

We use a customized `http.Client` , instead using the default one from the http’s package,

```
client:=http.Client{} //default
```

We add some config based on our need. Because we need to reuse the connection, we make some configuration in our transport and control max-idle reusable connection.

```
keepAliveTimeout:= 600 \* time.Second  
timeout:= 2 \* time.Second  
defaultTransport := &http.Transport{  
    Dial: (&net.Dialer{  
                     KeepAlive: keepAliveTimeout,}  
           ).Dial,  
    MaxIdleConns: 100,  
    MaxIdleConnsPerHost: 100,}client:= &http.Client{  
           Transport: defaultTransport,  
           Timeout:   timeout,  
}
```

This configuration can help us to reduce the maximum of time to be used to calling another service.

What we learn from this phase is: If we want to reuse our connection pool to another service, we must read the response body, and close it.

Because our `main API` is just calling another service, we make a fatal mistake. Our `main API` suppose to reuse the available connection from `http.Client` so whatever happens, we must read the response body, even we don’t need it. And also we must close the response body. Both of this used to avoid memory leak in our server.

We forgot to close our response body in our code. And this things can cause a huge disaster for our production.

The solution is: we close the response body and read it even we don’t need the data.

```
req, err:= http.NewRequest("GET","http://example.com?q=one",nil)  
if err != nil {  
  return err  
}resp, err:= client.Do(req)  
//=================================================  
// CLOSE THE RESPONSE BODY  
//=================================================  
if resp != nil {  
    defer resp.Body.Close() // MUST CLOSED THIS   
}  
if err != nil {  
  return err  
}//=================================================  
// READ THE BODY EVEN THE DATA IS NOT IMPORTANT  
// THIS MUST TO DO, TO AVOID MEMORY LEAK WHEN REUSING HTTP   
// CONNECTION  
//=================================================  
\_, err = io.Copy(ioutil.Discard, resp.Body) // WE READ THE BODYif err != nil {   
   return err  
}
```

We fix this after reading a great article here: [http://devs.cloudimmunity.com/gotchas-and-common-mistakes-in-go-golang/](http://devs.cloudimmunity.com/gotchas-and-common-mistakes-in-go-golang/) and here: [http://tleyden.github.io/blog/2016/11/21/tuning-the-go-http-client-library-for-load-testing/](http://tleyden.github.io/blog/2016/11/21/tuning-the-go-http-client-library-for-load-testing/)

Phase 1 and Phase 2 and with the help of auto scaling success to reduce this bug. Well, to be honest, it never happens anymore for even 3 months since the last year: 2017.

After a few months run well, this bug happens again. At the first week of January 2018, one of our service that called by our `main API`, let says: is down. For some reasons, it cannot be accessed.

So when our `content service` is down, our `main API` is going fired again. The API dashboard going red again, the API response time is going higher and slower. Our CPU and memory usage going very high even using the autoscaling.

Again, we trying to find the root problem again. Well, after re-running the `content service` we run well again.

For that’s case, we are curious, why this happens. Because we think, we have set the timeout deadline in `http.Client` , so in that case, this will never happen.

Searching for the potential issue in our code, then we found some dangerous code.

For more simple, the code more look like this  
\* ps: this function is just an example, but similar in pattern with ours

our code before fixed

If we look the above code, it’s like nothing wrong. But this function is the most accessed, and have the heaviest call in our `main API`. Because this function will do 3 API call with huge processing.

To improve this we make a new approachment using timeout-control on the channel. Because with the above style code — which using `WaitGroup` will wait until all the process done — we must wait for all the API call must finish so we can process and return the response to the user.

This is one of our big mistakes. This code can make a huge disaster when one of our services died. Because there will be a long waiting until the died service recovered. With 5K call/s, of course, this is a disaster.

**First attempt solution:**

We modify it with adding a timeout. So our user will not wait for so long, they will just get an internal server error.

trying to add timeout

After doing **Phase 3,** our problem still not fully solved. Our `main API` still consume high CPU and memory.

This happens because, even we already returning `Internal Server Error` to our user, but our goroutine has still existed. What we want is, if we already return the response, then all the resource is also cleared, no exception, including goroutine and API call that running in the background.

Later after reading this article:  
[http://dahernan.github.io/2015/02/04/context-and-cancellation-of-goroutines/](http://dahernan.github.io/2015/02/04/context-and-cancellation-of-goroutines/)

We found some interesting feature that we do not realize yet in golang. That was using `Context` to help cancellation in go-routine.

Instead of using `time.After` to use the timeout, we move to `context.Context` . With this new approachment, our service is more reliable.

Then we change our code structure again by adding context to function that related.

final fixed code. using context

So then we use `Context` for every goroutine call in our code. This helps us to release memory and cancel the goroutine call.

In addition, for more controlled and reliable, we also pass the context to our HTTP request.

using context on HTTP request

With all of this setting and timeout control, our system is more safe and controllable.

Lesson learned:
---------------

*   Never used the default option in production.  
    Just never used the default option. If you’re building a big concurrent A, just never use the default option.
*   Read a lot, tried a lot, failed a lot, and gain a lot.  
    We learn a lot from this experience, this experience only gained in real cases and real user. And I’m so happy being part of it when fixing this bug.

\*_last updated: 18 January 2018: fixing some of the typos_

_If you think this worth enough to read, give me a 👏  
also share this on your twitter, facebook etc, so other people can read this. If you have a question or something, you could put a response below or just_ [_email_](mailto:iman.tumorang@gmail.com) _me._