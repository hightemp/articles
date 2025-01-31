# How to use events listeners in Symfony
How event listening works in Symfony
------------------------------------

The concept of events and listeners is a fundamental part of many frameworks and programming languages. If you've ever used JavaScript, you might be familiar with the scenario where a user clicks a button, triggering the execution of some code. Symfony implements a similar concept, but instead of listening to user interactions, it focuses on listening to Symfony itself or its underlying components.

This post will concentrate on Symfony and how you can implement custom events for your services. While these events are essential, they don't encompass all possibilities. There are numerous events associated with other components and bundles, such as Doctrine, Console, Forms, and many others. However, understanding the event mechanism outlined here will prepare you to adopt additional events with ease.

The Symfony framework orchestrates a specific data flow related to the Request and Response cycle. There are [eight built-in events](https://symfony.com/doc/current/reference/events.html) within this flow where you can attach your custom functions. Without event listeners, your code would typically only execute within controllers. However, these events allow you to intervene at various points—before the request reaches the controller or after the response is generated.

You can modify the request, halt its execution, alter the controller or the response, call external APIs, send emails, log activities, intercept exceptions, and much more. Moreover, this is just the beginning, as your services can generate custom events for further customization, not to mention the potential integrations with other components and bundle

Events might seem daunting at first, but the Symfony web profiler offers an excellent tool to analyze their occurrence within your application. By navigating to the performance tab and setting the threshold to 0, you can observe at least a few built-in events in the timeline for any request. All default HTTP events are associated with the kernel (specifically the HttpKernel component), which is why their IDs begin with 'kernel' (e.g., 'kernel.request').

![](https://storage.googleapis.com/blowstack-d3322.appspot.com/images/blog/posts/performance_tab_symfony_profiler.jpg)

Performance tab profiler in Symfony

Additionally, events can pass specific objects related to the events to your hook-up functions, allowing you to easily apply your changes to the data flow. In Symfony, there are two ways to implement listeners: Event Listeners and Event Subscribers. Let's take a closer look at how they differ and how to use them.

Event Listeners vs Event Subscribers
------------------------------------

Both serve the same purpose but have different implementations, and you can use them interchangeably in most cases. Both trigger functions at specific points in the data processing flow by Symfony.

### Event subscriber

Personally, I prefer to use event subscribers whenever possible, as they are easier to implement. To create a new subscriber, simply use the console command:

```null
symfony console make:subscriber
```

You will be prompted to name it and specify the event to listen for. It's recommended to start with kernel events, such as `**kernel.request**`. The following template is generated:

```null
<?php

namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;

class MyFirstSubscriber implements EventSubscriberInterface
{
    public function onKernelRequest(RequestEvent $event)
    {
        
    }

    public static function getSubscribedEvents()
    {
        return [
            'kernel.request' => 'onKernelRequest',
        ];
    }
}
```

By exploring the performance tab in the Symfony profiler, you'll notice `**kernel.request**` is the first event you can hook into. The generated code is divided into two parts: a static function for registering events and the event handling function itself. You can name the handler differently, but ensure to update the mapping accordingly.

To test, try echoing something when the `**kernel.request**` event occurs:

```null
public function onKernelRequest(RequestEvent $event)
{
    echo 'I am echo from kernel.request event';
}
```

When you access any route, this output should be visible at the top of the page. This demonstrates the basics of how event subscribers work.

To see what `**RequestEvent**` offers:

```null
public function onKernelRequest(RequestEvent $event)
{
    dd(event);
}
```

This will allow you to inspect the Request, which can be modified or checked as needed. For example, blocking requests from specific IP addresses:

```null
public function onKernelRequest(RequestEvent $event) {
    if ($event->getRequest()->server->get('REMOTE_ADDR') != '127.0.0.1') {
        $event->setResponse(new Response('Access denied.'));
    }
}
```

### Event Listener

Unlike subscribers, Symfony does not provide a console command to generate listener templates, so you must create them manually. First, create an `**EventListener**` folder in `**src**`. Then, add a new class, ideally ending with `**Listener**`, like `**MyFirstListener**`.

```null
namespace App\EventListener;

use Symfony\Component\HttpKernel\Event\RequestEvent;

class MyFirstListener
{
    public function onKernelRequest(RequestEvent $event) {
        
    }
    
    public function onKernelRequestBlocker(RequestEvent $event) {
        
    }
    
    public function onKernelException(ExceptionEvent $event) {
        
    }
}
```

Listeners must be configured in the `**services.yaml**` file, with tags mapping their events. You can trigger many functions by different events, but if you want multiple functions per event, specify the method in the tags as well.

```null

App\EventListener\MyFirstListener:
    tags:
        - { name: kernel.event_listener, event: kernel.request }
        - { name: kernel.event_listener, method: onKernelRequestBlocker, event: kernel.request }
        - { name: kernel.event_listener, event: kernel.exception }
```

Custom events allow you to listen to your own services, extending their functionality without the need to modify the class itself. This approach is especially useful when inheritance is not ideal or the new functionality falls outside the service's core responsibilities.

Let's illustrate this with a hypothetical `**SentenceChecker**` service that filters out prohibited words from a string:

```null
<?php

namespace App\Service;

class SentenceChecker
{
    public const NOT_ALLOWED_WORDS = [
        '/uncensored word 1/',
        '/uncensored word 2/',
        '/uncensored word 3/',
    ];

    public function parse(string $str): string
    {
        return preg_replace(self::NOT_ALLOWED_WORDS, '***', $str);
    }
}
```

If a string contains prohibited words, you might want to log this event and send an email notification. Instead of overloading the service or controller with additional responsibilities, you can create and dispatch a custom event whenever prohibited words are detected.

First, define the custom event, typically within an `**Event**` directory:

```null
<?php

namespace App\Event;

use Symfony\Contracts\EventDispatcher\Event;

class RestrictedWordEvent extends Event
{
    public const NAME = 'restricted.word';
    
    protected $str;

    public function __construct(string $str)
    {
        $this->str = $str;
    }

    public function getStr(): string
    {
        return $this->str;
    }
}
```

Next, modify the `**SentenceChecker**` service to dispatch the event when necessary. This requires injecting Symfony's `**EventDispatcherInterface**`:

```null
<?php

namespace App\Service;

use App\Event\RestrictedWordEvent;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;

class SentenceChecker
{
    private $eventDispatcher;

    public function __construct(EventDispatcherInterface $eventDispatcher)
    {
        $this->eventDispatcher = $eventDispatcher;
    }

    public function parse(string $str): string
    {
        $count = 0;
        $str = preg_replace(self::NOT_ALLOWED_WORDS, '***', $str, -1, $count);
        
        if ($count > 0) {
            $this->eventDispatcher->dispatch(new RestrictedWordEvent($str), RestrictedWordEvent::NAME);
        }

        return $str;
    }
}
```

Finally, listen to this custom event by adding a listener or subscriber. For example, update an existing subscriber to handle the `**RestrictedWordEvent**`:

```null
<?php

namespace App\EventSubscriber;

use App\Event\RestrictedWordEvent;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class MyFirstSubscriber implements EventSubscriberInterface
{
    public function onRestrictedWord(RestrictedWordEvent $event)
    {
        
    }

    public static function getSubscribedEvents(): array
    {
        return [
            RestrictedWordEvent::NAME => 'onRestrictedWord',
        ];
    }
}
```

Inject the `**SentenceChecker**` service into a controller to use it:

```null
<?php

namespace App\Controller;

use App\Service\SentenceChecker;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class MainController extends AbstractController
{
    
    public function index(string $str, SentenceChecker $checker): Response
    {
        $checker->parse($str);
        
        return $this->render('main/index.html.twig');
    }
}
```