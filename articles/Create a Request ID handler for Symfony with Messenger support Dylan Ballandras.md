# Create a Request ID handler for Symfony with Messenger support | Dylan Ballandras
In this post, we'll look at how to add a unique request ID to a Symfony application, using Monolog and Symfony Messenger.

It can be useful if you want to be able to follow logs in a requests and async messages generated by a request with an unique request ID.

We're going to do it step by step. This tutorial assumes that you're familiar with Symfony and Monolog.

Step 1: Install necessary dependencies
--------------------------------------

If you want to use an UUID, you can require the Symfony UID library for generating unique request IDs. To install it, run:

```
composer require symfony/uid 
```

Step 2: Create the RequestId Generator service
----------------------------------------------

First, you'll create a service that generates unique request IDs. Create a new interface and a service class:

```
<?php

namespace App\Request;

interface RequestIdGeneratorInterface
{
    public function generate(): string;
} 
```

```
<?php

namespace App\Request;

use Symfony\Component\Uid\Uuid;

class RequestUuidGenerator implements RequestIdGeneratorInterface
{
    public function generate(): string
    {
        return Uuid::v4()->toRfc4122(); 
    }
} 
```

This service will generate a unique request ID using the UUID v4 standard.

Step 3: Create a RequestId middleware
-------------------------------------

Now you'll create a middleware that sets the request ID on the request and response. This middleware will call the RequestUuidGenerator service to generate an ID if one is not already set.

```
<?php

namespace App\Request\Listener;

use App\Request\RequestIdGeneratorInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

class RequestIdSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private RequestIdGeneratorInterface $requestIdGenerator
    ) {
    }

    public static function getSubscribedEvents()
    {
        return [
            KernelEvents::REQUEST => ['onKernelRequest'],
            KernelEvents::RESPONSE => ['onKernelResponse'],
        ];
    }

    public function onKernelRequest(RequestEvent $event)
    {
        $request = $event->getRequest();
        if (! $request->headers->has('X-Request-ID')) {
            $request->headers->set('X-Request-ID', $this->requestIdGenerator->generate());
        }
    }

    public function onKernelResponse(ResponseEvent $event)
    {
        $response = $event->getResponse();
        $request = $event->getRequest();
        if (! $response->headers->has('X-Request-ID') && $request->headers->has('X-Request-ID')) {
            $response->headers->set('X-Request-ID', $request->headers->get('X-Request-ID'));
        }
    }
} 
```

This middleware will listen to the kernel.request and kernel.response events, and set a `X-Request-ID` header in both the request and response if one is not already present.

Step 5: Create Monolog Processor
--------------------------------

You'll need to create a Monolog Processor that will add the request ID to every log record:

```
<?php

namespace App\Monolog;

use Monolog\Attribute\AsMonologProcessor;
use Monolog\LogRecord;
use Symfony\Component\HttpFoundation\RequestStack;

class RequestIdProcessor implements \Monolog\Processor\ProcessorInterface
{
    public function __construct(
        private RequestStack $requestStack
    ) {
    }

    public function __invoke(LogRecord $record): LogRecord
    {
        $request = $this->requestStack->getCurrentRequest();
        if ($request && $request->headers->has('X-Request-ID')) {
            $record->extra['request_id'] = $request->headers->get('X-Request-ID');
        }

        return $record;
    }
} 
```

Step 6: Handle Symfony Messenger
--------------------------------

For Symfony Messenger, you'll need to pass the request ID through the Envelope and read it in a middleware. This involves updating your Messenger configuration and creating a new middleware.

```
<?php

namespace App\Messenger;

use App\Messenger\Stamp\RequestIdStamp;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Messenger\Envelope;
use Symfony\Component\Messenger\Middleware\MiddlewareInterface;
use Symfony\Component\Messenger\Middleware\StackInterface;
use Symfony\Component\Messenger\Stamp\ConsumedByWorkerStamp;

class RequestIdMiddleware implements MiddlewareInterface
{
    public function __construct(
        private RequestStack $requestStack
    ) {
    }

    public function handle(Envelope $envelope, StackInterface $stack): Envelope
    {
        $request = $this->requestStack->getCurrentRequest();
        if (! $envelope->last(ConsumedByWorkerStamp::class) && $request && $request->headers->has('X-Request-ID')) {
            $envelope = $envelope->with(new RequestIdStamp($request->headers->get('X-Request-ID')));
        }

        return $stack->next()->handle($envelope, $stack);
    }
} 
```

Also, you need to create RequestIdStamp:

```
<?php

namespace App\Messenger\Stamp;

use Symfony\Component\Messenger\Stamp\StampInterface;

class RequestIdStamp implements StampInterface
{
    public function __construct(
        private string $requestId
    ) {
    }

    public function getRequestId(): string
    {
        return $this->requestId;
    }
} 
```

Register the middleware in `messenger.yaml`:

```
 framework:
  messenger:
    buses:
      command.bus:
        middleware:
          
          - 'App\Messenger\RequestIdMiddleware' 
```

Now, all your requests and Symfony Messenger messages will have a unique request ID that will be logged with Monolog. You can use this request ID to follow logs for specific requests and messages.

Let's continue with handling the RequestIdStamp in the messenger's consumer and keeping the request-id through to the logs.

First, we need to create a new processor for Monolog to pull the request-id from the envelope's stamps.

Step 7: Create a Monolog Processor for the Messenger's Consumer
---------------------------------------------------------------

This processor will get the request-id from the RequestIdStamp when a message is being consumed.

```
<?php

namespace App\Monolog;

use App\Messenger\Stamp\RequestIdStamp;
use Monolog\Attribute\AsMonologProcessor;
use Monolog\LogRecord;

class MessengerRequestIdProcessor
{
    private ?string $requestId = null;

    public function setStamp(?RequestIdStamp $stamp): void
    {
        $this->requestId = $stamp?->getRequestId();
    }

    public function __invoke(LogRecord $record): LogRecord
    {
        if ($this->requestId !== null) {
            $record->extra['request_id'] = $this->requestId;
        }

        return $record;
    }
} 
```

Step 8: Update the Messenger Middleware
---------------------------------------

Update the RequestIdMiddleware to use MessengerRequestIdProcessor and set the request-id from the envelope's stamps.

```
<?php

namespace App\Messenger;

use App\Messenger\Stamp\RequestIdStamp;
use App\Monolog\MessengerRequestIdProcessor;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Messenger\Envelope;
use Symfony\Component\Messenger\Middleware\MiddlewareInterface;
use Symfony\Component\Messenger\Middleware\StackInterface;
use Symfony\Component\Messenger\Stamp\ConsumedByWorkerStamp;

class RequestIdMiddleware implements MiddlewareInterface
{
    private ?RequestIdStamp $currentRequestIdStamp = null;

    public function __construct(
        private RequestStack $requestStack,
        private MessengerRequestIdProcessor $messengerRequestIdProcessor
    ) {
    }

    public function handle(Envelope $envelope, StackInterface $stack): Envelope
    {
        if ($stamp = $envelope->last(RequestIdStamp::class)) {
            $this->messengerRequestIdProcessor->setStamp($stamp);
            $this->currentRequestIdStamp = $stamp;

            try {
                return $stack->next()->handle($envelope, $stack);
            } finally {
                $this->messengerRequestIdProcessor->setStamp(null);
                $this->currentRequestIdStamp = null;
            }
        }

        $request = $this->requestStack->getCurrentRequest();
        if (! $envelope->last(ConsumedByWorkerStamp::class) && $request && $request->headers->has('X-Request-ID')) {
            $envelope = $envelope->with(new RequestIdStamp($request->headers->get('X-Request-ID')));
        } elseif (! $envelope->last(ConsumedByWorkerStamp::class) && $this->currentRequestIdStamp !== null) {
            $envelope = $envelope->with($this->currentRequestIdStamp);
        }

        return $stack->next()->handle($envelope, $stack);
    }
} 
```

With these updates, your logs should now include the request-id for messages consumed by the messenger's worker. This request-id will persist from the original HTTP request that dispatched the message, through the messenger's dispatch process, and finally into the worker that consumes the message.

You can find a Symfony 6.3 app with this code and tests available here: [https://github.com/kayneth/symfony-messenger-request-id-demo](https://github.com/kayneth/symfony-messenger-request-id-demo).