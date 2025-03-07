# Использование компонентов symfony/messenger и symfony/console в качестве независимых компонентов / Хабр
Время на прочтение6 мин

Количество просмотров8.4K

Возникла как то потребность использовать асинхронную отправку писем.

Передо мной открылись два основных направления:

*   Наколхозить на скорую руку свою поделку для работы с очередью сообщений.
    
*   Использовать мощные стабильные инструменты.
    

Выбор пал на symfony/messenger по нескольким причинам:

*   Во первых, первым путём я уже хаживал.
    
*   Во вторых, я давно смотрел в сторону Symfony ожидая подходящей идеи для личного проекта, чтобы неспешно войти в его мир.
    
*   В третьих, он поддерживает несколько различных транспортов.
    
*   В четвёртых, предоставляет возможность использовать практически готовые к работе воркеры, предоставляемыe компонентом symfony/console.
    
*   Ну и последнее, впереди были выходные, и я мог себе позволить разобраться как это сделать.
    

Надо отметить, что официальная документация пролила мало света на то, как использовать компонент symfony/messenger без использования самого фреймворка. Все приводимые примеры рассматривают как сконфигурировать зависимости для symfony контейнера в yaml файлах.

В документации к компоненту есть [статья](https://symfony.com/doc/current/components/messenger.html) про использование мессенджера в качестве независимого компонента, но про настройку транспорта к сожалению в ней ничего не сказано.

Так же на Хабре есть статья - [Перевод PHP бэкенда на шину Redis streams и выбор независимой от фреймворков библиотеки](https://habr.com/ru/post/483584). В ней автор провёл важные изыскания, показал способ настройки транспорта, но по какой то причине отказался использовать symfony/console.

Из комментариев к той статье, я понял, что, существует пробел в понимании этого мощного и важного инструмента.

В статье я опущу описание создания классов сообщения и его обработчика так как в документации этот момент подробно описан.

И так приступим.

Конфигурируем соединение в контейнере используя DSN, для RabbitMQ это может выглядеть так:

```
AmqpConnection::class => function (ContainerInterface $container) {    return AmqpConnection::fromDsn('amqp://guest:guest@rabbitmq:5672/%2f/messages', []);}
```

для Redis так:

```
RedisConnection::class => function (ContainerInterface $container) {    return RedisConnection::fromDsn('redis://redis:6379/messages', [        'stream' => 'messages',        'group' => 'default',        'consumer' => 'default',    ]);}
```

Далее настраиваем рессиверы для обеих соединений, они нам понадобятся в консоли. Обратите внимание, что делаем их именованными, имменно по имени ampq-async или redis-async команда symfony/console messenger:consume ampq-async сможет его обнаружить в контейнере.

```
'ampq-async' => function (ContainerInterface $container) {    return new AmqpReceiver(        $container->get(AmqpConnection::class)    );},'redis-async' => function (ContainerInterface $container) {    return new RedisReceiver(        $container->get(RedisConnection::class)    );},
```

Далее описываем в контейнере шину сообщений, передавая создаваемые там же SendMessageMiddleware и HandleMessageMiddleware

```
'message-bus' => function (ContainerInterface $container) {    $handler = new EmailMessageHandler($container);    return new MessageBus([         new SendMessageMiddleware(            new SendersLocator([                 EmailMessage::class => [                    AmqpTransport::class,                /*    RedisTransport::class, */                ]            ], $container)        ),        new HandleMessageMiddleware(            new HandlersLocator([                EmailMessage::class => [$handler],            ])        )    ]);}    
```

Шину так же делаем именованной, имя шины опять таки потребуется нам в консольной команде messenger:consume, но к этому ещё вернёмся позже, когда будем рассматривать работу консольного приложения.

Таким образом, получаем полностью сконфигурированную шину сообщений. Очень просто, не правда ли?

Вот и всё, теперь в контроллере отправить сообщение на шину можно просто вызвав:

```
$busName = 'message-bus';$bus = $this->container->get($busName);$bus->dispatch(    new EmailMessage($message), [        new Symfony\Component\Messenger\Stamp\BusNameStamp($busName)     ]);
```

Обратите внимание, что помимо сообщения мы передаём в шину штамп с названием шины, без этого штампа нельзя использовать стандартную команду ConsumeMessagesCommand т.к. по имени в этом штампе RoutableMessageBus находит нужную шину в контейнере.

Теперь о потреблении наших сообщений из очереди.

Компонент symfony/console это очень мощный и гибкий инструмент. При использовании его в рамках фреймворка приложение использует Symfony\\Bundle\\FrameworkBundle\\Console\\Application, передавая ему конфигурацию фреймворка, таким образом консоль получает возможность использовать все команды всех доступных компонентов фреймворка.

Но нам такой радости не вкусить. В случае использования symfony/console в качестве независимого компонента, приложению придётся в качестве ядра использовать Symfony\\Component\\Console\\Application, а все команды конфигурировать в ручную.

Установим компонент консоли.

composer require symfony/console

После установки документация предлагает создать файл console в папке bin с вот таким содержимым.

```
#!/usr/bin/env php
<?php
// application.php
require __DIR__.'/vendor/autoload.php';
use Symfony\Component\Console\Application;
$application = new Application();
// ... register commands
$application->run();
```

Теперь обустроим это файл в соответствии с нашими потребностями.

В первую очередь добавим определение нашего контейнера.

```
$containerBuilder = new ContainerBuilder();$containerBuilder->addDefinitions(__DIR__ . '/../config/dependencies.php');$container = $containerBuilder->build();
```

Далее нам потребуется объект консольного вывода

```
$output = new ConsoleOutput();
```

ну и конечно же определения необходимых команд

```
$commands = [    new ConsumeMessagesCommand(        new RoutableMessageBus($container),        $container,        new EventDispatcher(),        new ConsoleLogger($output, [])    ),    new StopWorkersCommand(        new FilesystemAdapter('', 10, __DIR__ . '/../var/cache')    )];    
```

Тут требуются некоторые пояснения.

Конструктор класса ConsumeMessagesCommand требует RoutableMessageBus, в который нужно передать сконфигурированный контейнер.

В этом контейнере он сможет найти шину по имени 'message-bus', которое мы указали в определении шины ранее и передали в штампе сообщения.

Так же нужно передать сам контейнер, EventDispatcher и ConsoleLogger с созданным ранее $output для того,

что бы иметь возможность пользоваться всеми преимуществами стандартного консольного вывода от symfony, такими как:

*   расцветка вывода в зависимости от важности события
    
*   возможность регулировать детализацию вывода стандартными ключами при запуске -v -vv -vvv.
    

Обратите внимание, что $output с которым мы создавали ConsoleLogger впоследствии необходимо передать вызову $application->run(null, $output);

Для команды stopWorkersCommand нужно передать адаптер кэширования, для возможности мягкой остановки воркеров, чтобы избежать ситуации когда воркер уже взял сообщение из очереди, но ещё не успел его обработать.

Полный код файла console (используется контейнер php-di, но можно любой psr-11 совместимый)

```
#!/usr/bin/env php<?phprequire __DIR__.'/../vendor/autoload.php';use DI\ContainerBuilder;use Symfony\Component\Messenger\Command\ConsumeMessagesCommand;use Symfony\Component\Messenger\Command\StopWorkersCommand;use Symfony\Component\EventDispatcher\EventDispatcher;use Symfony\Component\Cache\Adapter\FilesystemAdapter;use Symfony\Component\Messenger\RoutableMessageBus;use Symfony\Component\Console\Logger\ConsoleLogger;use Symfony\Component\Console\Output\ConsoleOutput;use Symfony\Component\Console\Application;$containerBuilder = new ContainerBuilder();$containerBuilder->addDefinitions(__DIR__ . '/../config/dependencies.php');$container = $containerBuilder->build();$output = new ConsoleOutput();$commands = [    new ConsumeMessagesCommand(        new RoutableMessageBus($container),        $container,        new EventDispatcher(),        new ConsoleLogger($output, [])    ),    new StopWorkersCommand(        new FilesystemAdapter('', 10, __DIR__ . '/../var/cache')    )];$application = new Application('Console');$application->addCommands($commands);$application->run(null, $output);
```

Теперь запустить консольное приложение можно так: php bin/console messenger:consume ampq-async или для redis-транспорта: php bin/console messenger:consume redis-async, и при помощи ключей -v, -vv, или -vvv управлять детализацией вывода сообщений в консоль, также остановить воркеры командой php bin/console messenger:stop-workers.

### Заключение

Исследовав компоненты messenger и console, я высоко оценил удобство этих инструментов.

Для меня это был не только отличный повод разобраться в устройстве Symfony, но и статья (в хорошем смысле этого слова), ну ладно не статья, рецепт или заметочка.