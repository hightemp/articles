# Symfony Messenger Component step by step · PhiloBlog
1.  [PhiloBlog](https://www.blog.philodev.one/)/
2.  [Posts](https://www.blog.philodev.one/posts/)/
3.  [Symfony Messenger Component step by step](https://www.blog.philodev.one/posts/2024-01-symfony-queues/)/

How does the Symfony Messenger Component work; How can I hook into the process; and how can I use it for my own needs?

Symfony Messages and Symfony Events [#](#symfony-messages-and-symfony-events)
-----------------------------------------------------------------------------

Coming from Laravel, and knowing how Laravel handles Events, I hat quite some bits to learn when I dived into the Symfony world [1](#fn:1). The most obvious change is while Laravel has Events, Symfony has Messages and Events.

The Symfony Events are synchronous, and are used to communicate between different parts of the application [2](#fn:2). This simple property makes it easy to decide if an event or a messages can solve your problem, events are the better choice if you need the result of the event to be communicated back, or if you don’t have the time/thread requirements to implement a queue. This Post will not Cover Events, but Messages only.

Stepping through Symfony Dispatcher and Consumer [#](#stepping-through-symfony-dispatcher-and-consumer)
-------------------------------------------------------------------------------------------------------

Frameworks can seem magical in the beginning, but the more a developer knows about their inner workings, the better it can be used. If a developer is aware of the posible hooks and tricks very often very easy solutions for common problems can be implemented. To discover a framework, I go for a scribbled test and the debugger. In this case I wanted to know how the Symfony queue is consumed, and so I dispatched a command using a dependency injected CommandBus and stepped into every function on my way to my command handler.

![](https://www.blog.philodev.one/images/2024-02-messanges.png)

### Dispatching a job and adding Stamps [#](#dispatching-a-job-and-adding-stamps)

The first step leads to the `Symfony\Component\Messenger\MessageBusInterface`, which leads to three possible Symfony implementation, which might add context but all end up in the same `Symfony\Component\Messenger\MessageBus::dispatch()` function. The dispatch method also allows to add Stamps, little pieces of meta information about the Message. The dispatch function then creates a `Symfony\Component\Messenger\Envelope`, which is a wrapper for the Message and the Stamps.

✉️ I’ll give you a moment to be amazed by the naming - because I find it so cute! If you want a piece of your code to know some bits of information and act upon it, you put that info in an envelope, and than attach some stamps on it; the framework will look at the stamps and know how to route it to the right piece of code 💌.

The Stamps are also a way to transport context over to the worker. One use case could be tracing an entity through your application.

### Middlewares [#](#middlewares)

Still in the dispatch methods, the Envelope is passed to the MiddlewareStack. The MiddlewareStack is a collection of Classes following the Pipeline Pattern. Pipeline Pattern is a way to execute a list of operations on a given input, where the result of each of the operations is passed to the next operation. In this case the input is the Envelope, and each Middleware adds or acts upon the mentioned Stamps; e.g. if the envelope needs to be sent (and where), if it failed, or if it’s received and needs to be handled.

The Middlewares are walked through in the same order both when the message is sent to a queue and when the message is consumed from a queue. The order of the Middlewares is important, the default order of the implemented Symfony Middlewares is:

*   `TraceableMiddleware`: which traces and tracks the execution of the middlewares
*   `AddBusNameStampMiddleware`: which adds the name of the bus to the message
*   `AddDispatchAfterCurrentBusMiddleware`: messages with a DispatchAfterCurrentBusStamp are handled once the current dispatching is fully handled.
*   `FailedMessageProcessingMiddleware`: If the Message doesn’t have the `ReceivedStamp` but a `SentToFailureTransportStamp`, it adds the `ReceivedStamp` to ensure the envelope is not sent to the failing transport again.
*   Your own collection of Middlewares: Could add Logging Context, Metrics, Tracing Information…
*   `SendMessageMiddleware`: if there is no `ReceivedStamp` and routing is configured for the transport, this sends messages to that transport
*   `HandleMessageMiddleware`: calls the message handler(s) for the given message.

Simplified example of one of the Middlewares `SendMessageMiddleware` [3](#fn:3):

```
class SendMessageMiddleware implements MiddlewareInterface {  public function handle(Envelope $envelope, StackInterface $stack): Envelope { $sender = null;   //  check if the envelope is already received if ($envelope->all(ReceivedStamp::class)) { // it's a received message, do not send it back } else { // send the message to all senders foreach ($this->sendersLocator->getSenders($envelope) as $sender) { $envelope = $sender->send($envelope->with(new SentStamp($sender::class))); } }   // if there is no sender, call the next middleware if (null === $sender) { return $stack->next()->handle($envelope, $stack); }   // message should only be sent and not be handled by the next middleware return $envelope; } } 
```

SideQuest-Question: How are the Middlewares set up and how are custom Middlewares added? Symfony does a great job in dependency injection. In the `config/packages/messenger.yaml` is the place to add additional Middlewares. To also understand how the Middlewares are configured, I dug a bit deeper in the `Symfony/Component/DependencyInjection/Loader/Configurator/messenger.php` file. Here are the defaults set for all mentioned Middlewares. Custom Middlewares are read from the config in the `FrameworkBundle/DependencyInjection/Configuration.php::addMessengerSection()`. And looking at the code, that’s a story for another post.

### Consuming Messages [#](#consuming-messages)

Assuming the SendMessageMiddleware sent the message to a Transport of your choice, the message was in a queue which picked it up is now calling a console command `messenger:consume` which is a `Symfony\Component\Messenger\Command\ConsumeMessagesCommand`. This instantiates a Worker, which `Messenger/Worker` which performs the actual consumption of an Envelope.

A simplified version of the Worker [4](#fn:4):

```
 private function handleMessage(Envelope $envelope, string $transportName): void { // throughout the whole process, events are dispatched to allow to hook into the process $this->eventDispatcher?->dispatch(new WorkerMessageReceivedEvent($envelope, $transportName));  // the message is dispatched to the bus, which calls the middlewares // the ReceivedStamp is added $envelope = $event->getEnvelope(); $envelope = $this->bus->dispatch($envelope->with(new ReceivedStamp($transportName), new ConsumedByWorkerStamp()));   $this->ack(); } 
```

So here the Middlewares are called again, but this time the `HandleMessageMiddleware` is called, in which the Handler(s) are determined and called. The HandlerLocator uses mostly a config to determine the Handler (but I guess an Attribute would be possible too). Foreach Handler the `HandledStamp` is added to the Envelope, to ensure the message is not handled multiple times.

Conclusion [#](#conclusion)
---------------------------

Symfony Messenger is a great tool to decouple parts of your application. Looking under its hood, it is a well-designed tool, it’s awesomely named, and it’s more versatile than I personally found the Laravel solution to the same problem. The middlewares are easy and spot on in their utility. I am looking forward to using it in future blog posts.

Happy Coding :)