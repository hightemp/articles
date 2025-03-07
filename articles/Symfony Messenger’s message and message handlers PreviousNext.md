# Symfony Messenger’s message and message handlers | PreviousNext
This post is part 2 in a series about Symfony Messenger.

1.  [Introducing Symfony Messenger integrations with Drupal](https://www.previousnext.com.au/blog/symfony-messenger/post-1-introducing-symfony-messenger)
2.  _Symfony Messenger’ message and message handlers, and comparison with @QueueWorker_
3.  [Real-time: Symfony Messenger’ Consume command and prioritised messages](https://www.previousnext.com.au/blog/symfony-messenger/post-3-real-time)
4.  [Automatic message scheduling and replacing hook\_cron](https://www.previousnext.com.au/blog/symfony-messenger/post-4-scheduling-and-cron)
5.  [Adding real-time processing to QueueWorker plugins](https://www.previousnext.com.au/blog/symfony-messenger/post-5-intercepting-queue-worker-plugins)
6.  [Making Symfony Mailer asynchronous: integration with Symfony Messenger](https://www.previousnext.com.au/blog/symfony-messenger/post-6-emails)
7.  [Displaying notifications when Symfony Messenger messages are processed](https://www.previousnext.com.au/blog/symfony-messenger/post-7-ui-notifications)
8.  [Future of Symfony Messenger in Drupal](https://www.previousnext.com.au/blog/symfony-messenger/post-8-symfony-messenger-in-drupal-core)

* * *

The Symfony Messenger integration with Drupal provided by the [SM](https://www.drupal.org/project/sm) project is the only requirement for the following examples.

A **message** itself is very flexible, as it doesn't require annotations, attributes, or specific class namespace. It only needs to be a class serialisable by Symfony. For simplicity, don’t include any complex objects like Drupal entities. Opt to store entity UUIDs instead.

At its most simple implementation, a **message handler** is:

*   a class at the `Messenger\` namespace
*   with a `#[AsMessageHandler]` class attribute
*   an `__invoke` method. Where its first argument is an argument typehinted with the message class.

_Example message and message handler:_

```php
namespace Drupal\my_module;

final class MyMessage {

  public function __construct(public string $foo) {}

}

```

```php
namespace Drupal\my_module\Messenger;

use Drupal\Core\State\StateInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final class MyMessageHandler {

  public function __construct(StateInterface $state) {}

  public function __invoke(\Drupal\my_module\MyMessage $message): void {
    // Do something with $message.
    $this->state->set('storage', $message->foo);
  }

}
```

_And dispatch code:_

```php
$bus = \Drupal::service(\Symfony\Component\Messenger\MessageBusInterface::class);
$bus->dispatch(new MyMessage(foo: 'bar'));
```

**Non-autowirable dependency injection**

Message handlers use autowiring by default, so you don’t need `ContainerFactoryPluginInterface` and friends.

In the rare case that dependencies are not autowirable, you can opt to define a message handler as a tagged service instead of a class with `#[AsMessageHandler]` attribute and define dependencies explicitly. The same `__invoke` and argument typehinting semantics apply.

```plaintext
services:
  my_module.my_message_handler:
    class: Drupal\my_module\Messenger\MyMessageHandler
	arguments:
      - '@my_module.myservice'
    tags:
      - { name: messenger.message_handler }

```

Comparison with Legacy Drupal Queues
------------------------------------

Typically, when setting up a Drupal queue, you’ll be putting together a rigid class with a verbose annotation. When compared to the functionality of the messenger and handler above, the equivalent `@QueueWorker` looks like:

```php
namespace Drupal\my_module\Plugin\QueueWorker;

use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Drupal\Core\Queue\QueueWorkerBase;
use Drupal\Core\State\StateInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * @QueueWorker(
 *   id = "my_module_queue",
 *   title = @Translation("My Module Queue"),
 *   cron = {"time" = 60}
 * )
 */
final class MyModuleQueue extends QueueWorkerBase implements ContainerFactoryPluginInterface {

  private function __construct(
    array $configuration,
    $plugin_id,
    $plugin_definition,
    private StateInterface $state,
  ) {
    parent::__construct($configuration, $plugin_id, $plugin_definition);
  }

  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition): static {
    return new static(
      $configuration,
      $plugin_id,
      $plugin_definition,
      $container->get('state'),
    );
  }

  public function processItem(mixed $data): void {
    // Do something with $data.
    $this->state->set('storage', $data['foo']);
  }

}
```

And dispatch code

```php
\Drupal::service('queue')
  ->get('my_module_queue')
  ->createItem(['foo' => 'bar']);
```

Notice the hard-to-remember annotation, boilerplate dependency injection, and mixed-type `processItem` argument `$data` . In comparison, Symfony Messenger messages and message handlers are easier to use thanks to PHP attributes.

Routing messages to transports
------------------------------

All messages will be handled synchronously by default. To route messages to specific transports, routing needs to be configured.

Behind the scenes, routing is a simple map of class/namespaces to transports defined in a container parameter.

```plaintext
parameters:
  sm.routing:
    Drupal\my_module\MyMessage: doctrine
    Drupal\my_module\MyMessage2: synchronous
    'Drupal\my_module\*': doctrine
    '*': doctrine
```

Keys are either verbatim class names, partial class namespace followed by asterisk, or a standalone asterisk indicating the fallback. The values are the machine name of a transport. [SM](https://www.drupal.org/project/sm) includes a `synchronous` transport out of the box, which indicates messages are handled in the same thread as it is dispatched. The doctrine database transport is available as a separate module. I’d recommend always using an asynchronous transport like [Doctrine](https://www.drupal.org/project/sm_transport_doctrine).

### Routing configuration UI

SM includes a configuration UI submodule that allows site builders to build a routing map without needing to mess with YAML. The container parameter is set automatically as soon as the form is saved.

![](https://www.previousnext.com.au/sites/default/files/styles/content_1x/public/2023-12/p2-1.png.webp?itok=72Egq046)

Advanced usage of messages and handlers
---------------------------------------

### Adding stamps to messages

A common use case for adding stamps to a message is to delay the message for an amount of time. A stamp is created and attached to the envelope containing the message to be processed:

```php
$envelope = new Envelope(
  message: new MyMessage(foo: 'bar'),
  stamps: [\Symfony\Component\Messenger\Stamp\DelayStamp::delayUntil(new \DateTimeImmutable('tomorrow'))],
);
$bus = \Drupal::service(\Symfony\Component\Messenger\MessageBusInterface::class);
$bus->dispatch($envelope);
```

### Multiple handlers per message

For more advanced use cases, multiple handlers can be configured for a message. Useful if you want to listen for messages that you do not own. For example, additional handling of the Symfony Mailer email message:

```php
namespace Drupal\my_module\Messenger;

use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Drupal\Core\State\StateInterface;

#[AsMessageHandler]
final class MyMessageHandler {

  public function __construct(StateInterface $state) {}

  public function __invoke(\Symfony\Component\Mailer\Messenger\SendEmailMessage $message): void {
    $this->state->set(
      'sent_emails_counter', 
      $this->state->get('sent_emails_counter', 0) + 1,
    );
  }

}
```

Both this custom handler and the original `\Symfony\Component\Mailer\Messenger\MessageHandler::__invoke` handler will be invoked.

### Multiple messages per handler

Handlers can be configured to handle multiple message types. Instead of using the `#[AsMessageHandler]` attribute on the class, use it with methods.

```php
namespace Drupal\my_module\Messenger;

use Drupal\Core\State\StateInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

final class MyMessageHandler {

  #[AsMessageHandler]
  public function myHandler1(\Drupal\my_module\MyMessage $message): void {
    // Do something with $message.
  }

  #[AsMessageHandler]
  public function myHandler2(\Drupal\my_module\MyMessage2 $message2): void {
    // Do something with $message2.
  }

}
```

* * *

The next post covers the [worker, the heart of messenger’s real-time capabilities](https://www.previousnext.com.au/blog/symfony-messenger/post-3-real-time).