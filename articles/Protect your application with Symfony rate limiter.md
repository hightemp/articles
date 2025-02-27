# Protect your application with Symfony rate limiter
Brut force or enumeration attack are not limited to login form. An easy way to fix this is to rate limit usage of your application. There are many solution out there to achieve that, in this post I show you how to do it with Symfony rate limiter component.

Protect your app against attacks  

-----------------------------------

For example purpose, let's say we are working on financial Saas project. It's (2020 style) modern application with frontend application using an API written with Symfony. After analysis we know that a normal user does not visit more that 60 pages/hour. So it's seems good to have a 10 pages/minutes as rate limit. It should not be a problem for user and it will limit usage of bot.

if you don't already have the RateLimiter component, you can install via composer:

```
composer require symfony/rate-limiter
```

Let's start by creating a new rate limiter in config/packages/rate\_limiter\_yaml file.

```
framework: rate\_limiter: authenticated\_request: policy: 'token\_bucket' limit: 25 rate: {interval: '1 minute', amount: 10}
```

I create a rate limiter with token bucket policy. I prefer this policy because it's allow users to have burst usage and still limit them. [Symfony documentation](https://symfony.com/doc/current/rate_limiter.html) explain very well all the available policies.  

Once we have our rate limiter we need to hook on kernel events to check if user has reached his limit. An EventSubscriber on event request will do.

```
<?php
 
declare(strict\_types\=1);
 
namespace Security\\Infrastucture\\Event;
 
use Security\\Infrastucture\\RateLimiting\\RequesterIdentifierProvider;
use Symfony\\Component\\EventDispatcher\\EventSubscriberInterface;
use Symfony\\Component\\HttpKernel\\Event\\RequestEvent;
use Symfony\\Component\\HttpKernel\\KernelEvents;
use Symfony\\Component\\RateLimiter\\RateLimiterFactory;
use Symfony\\Component\\RateLimiter\\Exception\\RateLimitExceededException;
 
class RateLimiterSubscriber implements EventSubscriberInterface
{
    public function \_\_construct(
        private readonly RateLimiterFactory $authenticatedRequestLimiter,
        private readonly RequesterIdentifierProvider $identifierProvider
    ) {
    }
 
    public static function getSubscribedEvents(): array
    {
        return \[
            KernelEvents::REQUEST \=> 'onRequest',
        \];
    }
 
    public function onRequest(RequestEvent $event): void
    {
        $request \= $event\->getRequest();
        $identifier \= $this\->identifierProvider\->getIdentifier($request);
 
        if (null \=== $identifier) {
            return;
        }
 
        $limiter \= $this\->authenticatedRequestLimiter\->create($identifier)\->consume(1);
        $limiter\->ensureAccepted());
    }
}
```

Isn't it simple? Thanks to autowire naming the RateLimiterFactory var $authenticatedRequestLimiter will inject the correct instance. The class RequesterIdentifierProvider allow me to create an user identifier from the request. In my case, I'm extracting username from the JWT token present in Authorization header + user IP. You would ask why it could be null. Because, I have other project that consume this API, based on the scope including in the JWT token, I can return null to bypass the rate limiter for these projects.

Protect your infra against overwhelming  

------------------------------------------

Now we have a simple rate limiter in place. I would like to add more control on some specific route. At the beginning of the month, users come to the application and ask for a report activity of previous month. This report is a very slow process (of course it's done asynchronously) but I don't want users to overwhelmed the servers with duplicate request. So I want to add another rate limiter to 1 request a day on this specific request.

```
framework: rate\_limiter: authenticated\_request: policy: 'token\_bucket' limit: 25 rate: {interval: '1 minute', amount: 10}
 report\_request: policy: 'fixed\_window' limit: 1 interval: '1 day'
 
```

With 2 rate limiters (and more tomorrow), I need to refactor the subscriber.  
First I create a RateLimiterInterface with 2 implementations that will allow me to get the rate limiter according to the request.  

```
<?php
declare(strict\_types\=1);
 
namespace Security\\Infrastucture\\RateLimiting;
 
use Symfony\\Component\\HttpFoundation\\Request;
use Symfony\\Component\\RateLimiter\\LimiterInterface;
 
interface RateLimiterInterface
{
    public function support(Request $request): bool;
 
    public function getLimiter(string $identifier): LimiterInterface;
}
```

One for the first limiter that will match all API route.  

```
<?php
declare(strict\_types\=1);
 
namespace Security\\Infrastucture\\RateLimiting;
 
use Symfony\\Component\\HttpFoundation\\Request;
use Symfony\\Component\\RateLimiter\\LimiterInterface;
use Symfony\\Component\\RateLimiter\\RateLimiterFactory;
 
class AuthenticatedRequestRateLimiter implements RateLimiterInterface
{
    public function \_\_construct(private readonly RateLimiterFactory $authenticatedRequestLimiter)
    {
    }
 
    public function support(Request $request): bool
    {
        $uri \= $request\->getRequestUri();
 
        return 0 \=== stripos($uri, '/api');
    }
 
    public function getLimiter(string $identifier): LimiterInterface
    {
        return $this\->authenticatedRequestLimiter\->create($identifier);
    }
}
```

One for the second limiter that will only match the report uri.

```
<?php
declare(strict\_types\=1);
 
namespace Security\\Infrastucture\\RateLimiting;
 
use Symfony\\Component\\HttpFoundation\\Request;
use Symfony\\Component\\RateLimiter\\LimiterInterface;
use Symfony\\Component\\RateLimiter\\RateLimiterFactory;
 
class ReportRequestRateLimiter implements RateLimiterInterface
{
    public function \_\_construct(private readonly RateLimiterFactory $reportRequestLimiter)
    {
    }
 
    public function support(Request $request): bool
    {
        $uri \= $request\->getRequestUri();
 
        return preg\_match('#^/api/activity/export#', $uri) && $request\->isMethod(Request::METHOD\_POST);
    }
 
    public function getLimiter(string $identifier): LimiterInterface
    {
        return $this\->reportRequestLimiter\->create($identifier);
    }
}
```

Then I create a provider to ease the retrieving of matching rate limiters.

```
<?php
declare(strict\_types\=1);
 
namespace Security\\Infrastucture\\RateLimiting;
 
use Symfony\\Component\\HttpFoundation\\Request;
use Webmozart\\Assert\\Assert;
 
class RateLimiterProvider
{
    private array $rateLimiters \= \[\];
 
    public function \_\_construct(iterable $rateLimiters)
    {
        foreach ($rateLimiters as $rateLimiter) {
            Assert::isInstanceOf($rateLimiter, RateLimiterInterface::class);
            $this\->rateLimiters\[\] \= $rateLimiter;
        }
    }
 
    /\*\*
     \* @return RateLimiterInterface\[\]
     \*/
    public function findByRequest(Request $request): array
    {
        return \\array\_filter(
            $this\->rateLimiters,
            fn (RateLimiterInterface $rateLimiter): bool \=> $rateLimiter\->support($request)
        );
    }
}
```

Thanks to Symfony DI, it's easy to inject the rate limiters in the provider.

```
services: \_defaults: autowire: true autoconfigure: true public: false
 Security\\: resource: '%kernel.project\_dir%/src/Security/\*'
 \_instanceof: Security\\Infrastucture\\RateLimiting\\RateLimiterInterface: tags: \['api.rate\_limiter'\]
 Security\\Infrastucture\\RateLimiting\\RateLimiterProvider: arguments: $rateLimiters: !tagged\_iterator api.rate\_limiter
```

Now I need to update the EventSubscriber to use the provider.

```
<?php
 
declare(strict\_types=1);
 
namespace Security\\Infrastucture\\Event;
 
use Security\\Infrastucture\\RateLimiting\\RateLimiterProvider;
use Security\\Infrastucture\\RateLimiting\\RequesterIdentifierProvider;
use Symfony\\Component\\EventDispatcher\\EventSubscriberInterface;
use Symfony\\Component\\HttpKernel\\Event\\RequestEvent;
use Symfony\\Component\\HttpKernel\\KernelEvents;
use Symfony\\Component\\RateLimiter\\Exception\\RateLimitExceededException;
 
class RateLimiterSubscriber implements EventSubscriberInterface
{
    public function \_\_construct(
        private readonly RateLimiterProvider $limiterProvider,
        private readonly RequesterIdentifierProvider $identifierProvider
    ) {
    }
 public static function getSubscribedEvents(): array
    {
        return \[
            KernelEvents::REQUEST => 'onRequest',
        \];
    }
 public function onRequest(RequestEvent $event): void
    {
        $request = $event->getRequest();
 
        $rateLimiters = $this->limiterProvider->findByRequest($request);
 
        if (empty($rateLimiters)) {
            return;
        }
 
        $identifier = $this->identifierProvider->getIdentifier($request);
 
        if (null === $identifier) {
            return;
        }
 
        $failedLimiter = null;
        foreach ($rateLimiters as $rateLimiter) {
            $limiter = $rateLimiter->getLimiter($identifier)\->consume(1);
            if (false === $limiter->isAccepted()) {
                $failedLimiter = $limiter;
            }
        }
 
        if (null === $failedLimiter) {
            return;
        }
 
        throw new RateLimitExceededException($failedLimiter);
    }
}
 
```

I don't use anymore ensureAccepted() method of rate limiter, I'm using isAccepted(). I want to consume a token on every rate limiter that match the request, so I need to throw the exception later.  
There is one problem here, if multiple rate limiter reject the request, I'm using the last one to throw the exception and add its rate limit headers to the response. I'm good with that, but it can be a problem on some project.

With this solution, I can defined more rate limiter matching more uri. Now, you don't have anymore excuses to let your user overwhelmed your application or trying to expose your customers by enumeration attack.

PS: if you are looking for DDOS protection don't use this code, you have to start a PHP process on each request.