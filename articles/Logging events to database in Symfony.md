# Logging events to database in Symfony
I've never written any Symfony posts before, but since I've been using it in my job for some time now it's about time to change that. I really do like Symfony - it's quite refreshing to work with a _grown-up_ framework and leaving the nodejs/javascript scene, where most things are still pretty _young_ and partially even immature, apart for some time.

One of my most recent tasks was to implement a logging system for specific events, mostly related to entities (e.g. events like adding a product, etc.). Since it should be easy to search specific log entries everything is going to land within a database.

We're going through three different stages in this post:

1.  Logging to database in Symfony using Monolog by writing our own handler
2.  Add extra information by using a processor
3.  How to handle event and implement event subscribers

These sections will be handled separately and are mostly independent from each other - hence feel free to jump to whatever you need without having to worry about to miss something important.

1\. Logging to database in Symfony using Monolog by writing our own handler
---------------------------------------------------------------------------

Interestingly I didn't find a clean and fast solution for database logging for Symfony. There's a [monolog-mysql](https://github.com/waza-ari/monolog-mysql?ref=nehalist.io) handler on GitHub - sadly it's [triggering some errors](https://github.com/waza-ari/monolog-mysql/issues/12?ref=nehalist.io) (not just in Silex, also in Symfony). Luckily Symfony and Monolog make implementing it ourselves quite easy.

### The entity

The first thing we need is an entity for the log entries.

**Important**: To keep this piece of code a bit shorter the getters and setters are missing here. Therefore don't forget to run `php bin/console doctrine:generate:entities AppBundle/Entity/Log` to generate them.

This scheme is basically the one [used by Monolog](https://github.com/Seldaek/monolog/blob/master/doc/message-structure.md?ref=nehalist.io), except `channel`, but since we're using an own channel for database logging it would be same everytime.

To have our `createdAt` created automatically we're using the [`HasLifecycleCallbacks`](http://docs.doctrine-project.org/projects/doctrine-orm/en/latest/reference/annotations-reference.html?ref=nehalist.io#annref-haslifecyclecallbacks) annotation in conjunction with the `PrePersist` annotation to set the date before saving entities.

### The Monolog handler

The next thing we need is a new handler for Monolog.

Pretty simple class; the `write` method will called everytime we're going to utilize this handler, the constructor is to get the entity manager object, which will be injected in the next step.

### Configuring Monolog and Symfony

First let's configure Monolog by opening the `app/config/config.yml` and add the following lines:

```
monolog:
    channels: ['db']
    handlers:
        db:
            channels: ['db']
            type: service
            id: monolog.db_handler

```

We now have a custom channel for db logging which is handled by the class defined above. We just need to tell Symfony about the service; open the `app/config/services.yml` and add these lines:

```
services:
    # ...

    monolog.db_handler:
        class: AppBundle\Util\MonologDBHandler
        arguments: ['@doctrine.orm.entity_manager']

```

Now Symfony knows about the handler and injects our entity manager object.

### That's it.

We're done. _Wohoo!_

That's basically everything you need for database logging. Validation, etc. is up to you. To utilize our database logger now just use it as follows:

It's used the exact way as [default logging with Monolog](http://symfony.com/doc/current/logging.html?ref=nehalist.io).

The application I was writing required detailed log entries. It's not just enough to know _what_ happened, I also required to know _how_ it happened. Therefor I wanted to save some client and request information for every entry. Thanks to [Processors](http://symfony.com/doc/current/logging/processors.html?ref=nehalist.io) this is a very simple task:

And add it to your `app/config/services.yml`:

```
services:
    monolog.processor.request:
        class: AppBundle\Util\RequestProcessor
        arguments: ['@request_stack', '@service_container']
        tags:
            - { name: monolog.processor, method: processRecord, handler: db }

```

Now every time we log through our `db` channel this processor will add additional information to every single log entry. It's up to you to add whatever data you want (tokens, user information, ...).

3\. How to handle event and implement event subscribers
-------------------------------------------------------

The last thing I needed to think of was _where_ to log things. My initial attempt (_keep in mind that the application I used all these techniques was/is my second Symfony project_) was to put all logging into the controllers, but that just didn't felt right.

To keep everything [DRY](https://en.wikipedia.org/wiki/Don't_repeat_yourself?ref=nehalist.io) and organize it better I utilized the [event system](http://symfony.com/doc/current/components/event_dispatcher.html?ref=nehalist.io) and implemented a fairly easy logic: everytime something happens which should be logged an event is fired (e.g. `product_added`). Event subscribers are listening for these events and handle the logging.

The Symfony docs suggests events for every operation (like the `OrderPlacedEvent` there'd probably be a `OrderDeletedEvent` and `OrderUpdatedEvent`) - since most of my events are simply logging entities to the database I needed to break that down a bit and generalize it more. I ended up using more general events, in terms of orders it would be something like `OrderEvents`. These events look like this:

Very simple class which provides names for all the actions an order event can have. A bit more interesting is the parent class `AbstractEvent`:

Every time we create a new event instance we can pass an entity and get this entity from outside. This is basically the `OrderPlacedEvent` class from the Symfony docs in a way more generic way.

_Note:_ It would be good to have some kind of type validation here, since it'd make sense to have an `OrderEvent` just accepting an `Order` entity. Sadly, I'm not sure yet about how to implement that.

The next thing we need is an event subscriber which listens for specific events. Let's assume our listener is listening for some `OrderEvent`:

Our subscriber now handles logging to the database. Again I used a parent class for some general logic, the `AbstractSubscriber`:

Since logging entities is the main purpose of this system it makes sense to have a `logEntity` method which is responsible for writing entity data to the `context` of our log entry.

The last thing we need to do is to register our subscribers. Add the following lines to the `app/config/services.yml`:

```
services:
    # ...

    appbundle.subscriber.abstract_subscriber:
        class: AppBundle\EventSubscriber\AbstractSubscriber
        arguments: ['@service_container']

    appbundle.subscriber.order_subscriber:
        class: AppBundle\EventSubscriber\OrderSubscriber
        parent: appbundle.subscriber.abstract_subscriber
        tags:
            - { name: kernel.event_subscriber }

```

We need to register every subscriber here - don't forget about the `parent` key to inject dependencies to the `AbstractSubscriber` class.

Example
-------

Dispatching an event is simple as is:

```
$this->get('event_dispatcher')->dispatch(
    OrderEvent::ORDER_ADDED,
    new OrderEvent($order)
);

```

Final words
-----------

As said within the post: the project I implemented this system is my second Symfony project. I'm sure there's room for improvement, but I'm pretty happy with it so far. Feel free to suggest any improvement or changes in the comments.