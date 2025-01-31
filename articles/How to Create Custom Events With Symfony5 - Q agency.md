# How to Create Custom Events With Symfony5 - Q agency
March 8, 2020 - 10 min

![](https://q-web-production-s3bucket.s3.eu-central-1.amazonaws.com/wp-content/uploads/2020/03/03161437/1-43_eafcc47d2eac9b34493eba0289cfb02f-1.webp)

h, those events. Probably every modern application uses them on some occasion, and naturally, Symfony has its own built-in components to dispatch events and subscribe to them. It also has a few of its own build-in events that get dispatched on some points of the request -> response cycle. In this blog will see how to dispatch events manually when we need them and create subscribers, which will do some actions when an event occurs.

  

### Requirements

The only component that really needs to be installed, for events to work, is the Symfony’s event dispatcher component.

  

  
```
composer require symfony/event-dispatcher
```

  

That’s it for required ones for events dispatching to work. For a project that utilizes events, a few more will probably be needed:

Doctrine ORM

  

  
```
composer require symfony/orm-pack
```

  

Maker bundle (for easy create entities and controllers)

  

  
```
composer require --dev symfony/maker-bundle
```

  

Serializer

  

  
```
composer require symfony/serializer
```

  

Annotations

  

  
```
composer require doctrine/annotations
```

  

  

### Why Events?

Let’s answer the big question first, why do I need events anyway? Could I do a bunch of logic in my services instead?

Well, yes and no. Sure it is possible to code everything in one on more services, but events are more SOLID. They usually (and in Symfony, they do) utilize two design patterns, observer and mediator. This ensures that they are easily extendable, and that is their main strength. In practice, this means that you can always create a new subscriber to the event, without a requirement for any other additional logic.

  

### Subject

They are lots of possible usage for events in real-life applications, and it will depend on the type of applications and their internal architecture. So for our subject, let’s event that will be triggered when the user is deactivated. This is probably something most applications will use, and it is a good example for this post. When deactivating the user, the next steps will probably be needed:

  

1\. Send the user a notification, informing him/her that account was deactivated

2\. Clean up the database (relationships, flags…)

3\. Deactivate user

4\. Log stu

Next, we will create an event that will trigger a delete call and a subscriber to do all those steps.

  

### Entity

First things first, let’s create a simple user entity we can use later on. We will use the Symfony maker bundle for this.

  

  
```
php bin/console make:entity User
```

  

Our simple user entity class should look like this.

  

  

  
```
namespace App\Entity;
​
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;
​
class User
{
    public const DEFAULT_ROLE = 'ROLE_USER';
​
    /**
     * @ORM\Column(name="id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     * @Groups({"user:get", "user:id"})
     */
    private ?int $id = null;
​
    /**
     * @ORM\Column(name="email", type="string", length=180, nullable=false)
     * @Groups({"user:get", ""user:create""})
     */
    private string $email;
​
    /**
     * @ORM\Column(name="roles", type="json_array")
     * @Groups({"user:roles"})
     */
    private array $roles = [User::DEFAULT_ROLE];
​
    /**
     * @ORM\Column(name="password", type="string", length=255, nullable=false)
     * @Assert\NotCompromisedPassword(message="user.validation.password.compromised")
     * @Groups({"user:create"})
     */
    private string $password = '';
​
    /**
     * @ORM\Column(name="active", type="boolean", nullable=false, options={"default":1})
     * @Groups({"user:get", "user:create"})
     */
    private bool $active = true;
​
    public function getId(): ?int
    {
        return $this->id;
    }
​
    public function setId(?int $id): User
    {
        $this->id = $id;
​
        return $this;
    }
​
    public function getEmail(): string
    {
        return $this->email;
    }
​
    public function setEmail(string $email): User
    {
        $this->email = $email;
​
        return $this;
    }
​
    /**
     * @return array|string[]
     */
    public function getRoles(): array
    {
        return $this->roles;
    }
​
    /**
     * @param array|string[] $roles
     * @return User
     */
    public function setRoles(array $roles): User
    {
        $this->roles = $roles;
​
        return $this;
    }
​
    public function getPassword(): string
    {
        return $this->password;
    }
​
    public function setPassword(string $password): User
    {
        $this->password = $password;
​
        return $this;
    }
​
    public function isActive(): bool
    {
        return $this->active;
    }
​
    public function setActive(bool $active): User
    {
        $this->active = $active;
​
        return $this;
    }
}
```

  

  

Annotations here are only doctrine orm definitions and groups that will be used by the serializer later on.

  

### Event class

First, let’s create a class that will represent an event itself. In Symfony, every custom event class must extend the base Event class. So let’s create the UserDeactivateEvent class:

  

  

  
```
namespace App\Event;
​
use App\Entity\User\User;
use Symfony\Contracts\EventDispatcher\Event;
​
class UserDeactivateEvent extends Event
{
    public const NAME = 'user.delete';
​
    protected User $user;
​
    public function __construct(User $user)
    {
        $this->user = $user;
    }
​
    public function getUser(): User
    {
        return $this->user;
    }
​
    public function __toString(): string
    {
        return sprintf('User ID: %s', $this->user->getId());
    }
}
```

  

  

From a namespace, we can see that all events need to go in the Event directory in our src(App) directory. We are passing the user object to the constructor to access it later on in our subscribers when we build them. The easy way to think of event objects is a package that encapsulates data we will later need to create logic that will execute when the event is triggered.

  

### Subscriber

Now we have our event; next, we need to create a “listener” that will execute some logic when the event is triggered. Subscribers are those listeners; they “subscribe” to the event, and event classes are places when we can write logic that needs to be done when the event is triggered. Event listeners and event subscribers both exist in Symfony. I’m using subscribers because they are more reusable and won’t trigger an exception if we define multiple methods.

Our subscriber class needs to execute four steps described in the subject part; this is how it looks like:

  

  

  
```
namespace App\EventListener;
​
use App\Event\UserDeactivateEvent;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
​
class UserDeactivateSubscriber implements EventSubscriberInterface
{
    private EntityManagerInterface $entityManager;
​
    public function __construct(EntityManagerInterface $entityManager)
    {
        $this->entityManager = $entityManager;
    }
​
    public static function getSubscribedEvents(): array
    {
        return [
            UserDeactivateEvent::NAME => [
                ['deactivateUser', 10],
                ['databaseCleanup', 9],
                ['logUserDeactivated', 8],
                ['sendNotification', 7],
            ],
        ];
    }
​
    public function deactivateUser(UserDeactivateEvent $event): void
    {
        $user = $event->getUser();
        $user->setActive(false);
        $this->entityManager->flush();
    }
​
    public function databaseCleanup(UserDeactivateEvent $event): void
    {
        $user = $event->getUser();
​
        //do database cleanup stu
    }
​
    public function logUserDeactivated(UserDeactivateEvent $event): void
    {
        $user = $event->getUser();
​
        //log stu
    }
​
    public function sendNotification(UserDeactivateEvent $event): void
    {
        $user = $event->getUser();
​
        //do notification stu
    }
}
```

  

  

We put all our event subscribers in the EventListeners directory

  

Each subscriber needs to implement EventSubscriberInterface, which defines one method to implement, getSubscribedEvents. Here we define all subscriber methods that need to be called and assign them a priority. It defines the order in which assigned methods will be executed.

First, a method with the largest priority integer is executed, and from there goes from highest to lowest.

  

So in our example, with deactivating the user, first, we want to deactivate the user.

After that, we will do database clean-up and log that user was deactivated. The last thing we do is notify the user that his/here’s account was deactivated.

We pass the UserDeactivateEvent object that encapsulates or user object to each method to access it via getter and use it later on.

  

### Dispatching event

Event class: check, Event subscriber: check. All that’s left to do is dispatch the event and let the subscriber do its stu. Let’s create a controller used to delete user calls (fake in this example). The easiest way to do so is by using maker bundle.

  

  

  
```
namespace App\Controller;
​
use App\Entity\User\User;
use App\Event\UserDeactivateEvent;
use App\EventListener\UserDeactivateSubscriber;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;
​
class UserDeactivateController extends AbstractController
{
    private SerializerInterface $serializer;
    private EventDispatcherInterface $eventDispatcher;
​
    public function __construct(SerializerInterface $serializer, EventDispatcherInterface $eventDispatcher)
    {
        $this->serializer = $serializer;
        $this->eventDispatcher = $eventDispatcher;
    }
​
    /**
     * @Route("/user/deactivate/{user}", methods={"POST"}, name="user_deactivate")
     */
    public function __invoke(User $user): JsonResponse
    {
        $event = new UserDeactivateEvent($user);
        $this->eventDispatcher->addSubscriber(new UserDeactivateSubscriber());
        $this->eventDispatcher->dispatch($event, UserDeactivateEvent::NAME);
​
        $json = $this->serializer->serialize($user, 'json', ['groups' => ['user:get']]);
​
        return new JsonResponse($json, JsonResponse::HTTP_OK, [], true);
    }
}
```

  

  

We are using a single responsibility controller, so it defines only one method: invoke. First, we instantiate user UserDeactivateEvent and pass it a user object to encapsulate. After that, we are using injected EventDispatcher object to set a subscriber to use for this event. Finally, we are dispatching the event. After the user object is used and modified by a subscriber, we return it as a JSON string, using the serializer component.

Note that subscribers also can be added to the event using services.YAML file, we will address that later on.

With the controller, we have actually finished the base of our logic. The only thing left to do is clean it up a bit and add some extensibility.

  

### Cleanup time!

Any application will likely have more than one event, so it could be handy to create some repository for our events. Symfony already uses repositories for its DB queries. We can do something similar for our events. In high layers of our application, we can have just one method call for our events. Also, we can define a service that will handle event dispatching.

Let’s create a service first:

  

  
```
namespace App\Service;

use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Contracts\EventDispatcher\Event;

class DispatchEventService
{
private EventDispatcherInterface $eventDispatcher;
private LoggerInterface $logger;

public function __construct(EventDispatcherInterface $eventDispatcher, LoggerInterface $logger)
{
$this->eventDispatcher = $eventDispatcher;
$this->logger = $logger;
}

public function dispatchEvent(Event $event, string $eventName, array $subscribers = []): void
{
if (!empty($subscribers)) {
array_walk($subscribers, function ($subscriber) {
$this->eventDispatcher->addSubscriber($subscriber);
});
}

$this->eventDispatcher->dispatch($event, $eventName);
//log dispatched event
$this->logger->info('Event dispatched '.$eventName, [$event]);
}
}
```

  

We will create a base repository where we will inject our service, and then any other event repository can extend this base one. We will have only one, UserEventRepository.

  

  
```
namespace App\Repository\Event;

use App\Service\DispatchEventService;

class BaseEventRepository
{
    protected DispatchEventService $dispatchEventService;

    public function __construct(DispatchEventService $dispatchEventService)
    {
        $this->dispatchEventService = $dispatchEventService;
    }
}
```

  

  

  

  
```
namespace App\Repository\Event;

use App\Entity\User\User;
use App\Event\UserDeactivateEvent;
use App\EventListener\UserDeactivateSubscriber;
use App\Service\DispatchEventService;
use Doctrine\ORM\EntityManagerInterface;

class UserEventRepository extends BaseEventRepository
{
    private EntityManagerInterface $entityManager;

    public function __construct(DispatchEventService $dispatchEventService, EntityManagerInterface $entityManager)
    {
        $this->entityManager = $entityManager;
        parent::__construct($dispatchEventService);
    }

    public function dispatchUserDeactivateEvent(User $user): void
    {
        $event = new UserDeactivateEvent($user);
        $subscribers = $this->getUserDeactivateEventSubscribers();
        $this->dispatchEventService->dispatchEvent($event, UserDeactivateEvent::NAME, $subscribers);
    }

    private function getUserDeactivateEventSubscribers(): array
    {
        return [
            new UserDeactivateSubscriber($this->entityManager),
        ];
    }
}
```

  

  

The logic for dispatching events is not transferred to the repository and service. In the future, if we wish to add new events or new subscribers to an existing event, we can do it relatively simply by adding a new event to the repository or subscriber to events subscribers getter. The only thing left to do is clean up our controller make it even more simple.

  

  
```
namespace App\Controller;

use App\Entity\User\User;
use App\Repository\Event\UserEventRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

class UserDeactivateController extends AbstractController
{
private SerializerInterface $serializer;
private UserEventRepository $userEventRepository;

public function __construct(
SerializerInterface $serializer,
UserEventRepository $userEventRepository
) {
$this->serializer = $serializer;
$this->userEventRepository = $userEventRepository;
}

/**
* @Route("/user/deactivate/{user}", methods={"POST"}, name="user_deactivate")
*/
public function __invoke(User $user): JsonResponse
{
$this->userEventRepository->dispatchUserDeactivateEvent($user);
$json = $this->serializer->serialize($user, 'json', ['groups' => ['user:get']]);

return new JsonResponse($json, JsonResponse::HTTP_OK, [], true);
}
}
```

  

One more thing could be done if the number of events/subscribers gets large, which is to add a factory for subscribers and call factory methods instead of defining getters directly in a repository.

And now this code is mean and clean. So it’s fully baked. But wait a bit; I did mention that there is a way to register our subscribers using Symfony’s services.YAML file, let’s check that out next.

  

### Services and subscribers

Until now, we registered our subscribers by using addSubscriber method directly on the dispatcher. Another way to do this is by using services.yaml and register our subscribers there. We can do that by adding this line.

  

  

  
```
App\EventListener\UserDeactivateSubscriber:
        tags:
            - { name: kernel.event_subscriber, event: user.deactivate }
```

  

  

This tells Symfony that we want to add a new subscriber for our event user.deactivate. And subscriber class is UserDeactivateSubscriber. If we do it like this, then repositories and DispatchEventService are no longer needed to remove those files. Also, we need to adapt our controller to the new logic. We will remove the repository call and add direct event dispatch instead.

  

  

  
```
namespace App\Controller;

use App\Entity\User\User;
use App\Event\UserDeactivateEvent;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

class UserDeactivateController extends AbstractController
{
    private SerializerInterface $serializer;
    private EventDispatcherInterface $eventDispatcher;

    public function __construct(
        SerializerInterface $serializer,
        EventDispatcherInterface $eventDispatcher,
    ) {
        $this->serializer = $serializer;
        $this->eventDispatcher = $eventDispatcher;
    }

    /**
     * @Route("/user/deactivate/{user}", methods={"POST"}, name="user_deactivate")
     */
    public function __invoke(User $user): JsonResponse
    {
        $this->eventDispatcher->dispatch(new UserDeactivateEvent($user), UserDeactivateEvent::NAME);
        $json = $this->serializer->serialize($user, 'json', ['groups' => ['user:get']]);

        return new JsonResponse($json, JsonResponse::HTTP_OK, [], true);
    }
}
```

  

  

This looks much simpler, but it’s not always the best solution. Next, let’s look at the pros and cons of both approaches.

  

### Services.yaml vs Repository showdown

  

The last question we will address is which approach to use. Should you build event repositories for your project, register your event in services, and dispatch it? As it always does, it depends on application architecture and how you build your events, are simple or more complex.

This is a listing of some pros and cons of both approaches.

Services.yaml approach

Pros

  

  
*   Easy to use, dispatching of events is very simple and it avoids additional repositories and services.
  
*   Takes advantage of symphony’s authowire feature for registering events.
  

Cons

  

  
*   If your event logic is more complex(building objects before passing them to events, passing multiple objects…), there will be lots of event dispatching logic all over your code instead of in a single place.
  
*   Same problem as above, if the application utilizes a large number of events.
  

Repository approach

Pros

  

  
*   Defines as a single place to put all your event dispatching.
  
*   It’s a good approach if the application has a lot of events or logic; for some of them, it is a bit more complex.
  
*   If you don’t use the Symfony framework, but only the dispatcher component, it’s the only approach available, so it’s more universal.
  

Cons

  

  
*   More code to write; it is a bit of overkill if event dispatching logic is fairly simple.
  
*   Do not use Symfony’s native way to deal with services, which is by using the YAML file.
  

So which way would be best for you? As always, it depends on you and your application needs.

  

Now our code is double-baked, so it sure has to be well done 🙂

Thank you for reading this post, and I hope it was helpful.

  

Give Kudos by sharing the post!

###### ABOUT AUTHOR

![](https://q-web-production-s3bucket.s3.eu-central-1.amazonaws.com/wp-content/uploads/2022/04/03161652/mario.png)

Mario Ozuska

Backend Software developer

Mario's favorite things are solving complicated problems and possibly learning something in the process. His life motto is, "If you need it, I will build it."